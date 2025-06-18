import { emitter } from "@/lib/litechat/event-emitter";
import { workflowEvent, type WorkflowEventPayloads } from "@/types/litechat/events/workflow.events";
import { interactionEvent } from "@/types/litechat/events/interaction.events";
import type { Interaction } from "@/types/litechat/interaction";
import { useWorkflowStore } from "@/store/workflow.store";
import type { WorkflowRun, WorkflowStep } from "@/types/litechat/workflow";
import { nanoid } from "nanoid";
import { compilePromptTemplate } from "@/lib/litechat/prompt-util";
import type { CompiledPrompt } from "@/types/litechat/prompt-template";
import type { PromptTurnObject, PromptObject } from "@/types/litechat/prompt";
import { useInteractionStore } from "@/store/interaction.store";
import { PersistenceService } from "./persistence.service";
import { usePromptStateStore } from "@/store/prompt.store";
import { usePromptTemplateStore } from "@/store/prompt-template.store";
import { InteractionService } from "./interaction.service";
import { useProjectStore } from "@/store/project.store";
import { useControlRegistryStore } from "@/store/control.store";
import { useConversationStore } from "@/store/conversation.store";
import type { CoreMessage } from "ai";
import { buildHistoryMessages } from "@/lib/litechat/ai-helpers";
import { WorkflowFlowGenerator } from "@/lib/litechat/workflow-flow-generator";

// Note: Refactored to a static class to align with other services like InteractionService.
// This service's lifecycle is tied to the application's lifecycle, so event listeners
// are registered once and are not manually unsubscribed.
export const WorkflowService = {
  isInitialized: false,
  activeWorkflowConfig: null as { template: any; initialPrompt: string; conversationId: string } | null,
  flowGenerator: new WorkflowFlowGenerator(),

  initialize: () => {
    if (WorkflowService.isInitialized) return;
    
    // Listen for workflow start requests
    emitter.on(workflowEvent.startRequest, WorkflowService.handleWorkflowStartRequest);
    
    // Listen for interaction completions to handle step progression
    emitter.on(interactionEvent.completed, WorkflowService.handleInteractionCompleted);
    
    // Listen for step completion events
    emitter.on(workflowEvent.stepCompleted, WorkflowService.handleStepCompleted);
    
    // Listen for resume requests
    emitter.on(workflowEvent.resumeRequest, WorkflowService.handleWorkflowResumeRequest);
    
    WorkflowService.isInitialized = true;
    console.log("[WorkflowService] Initialized - workflows start immediately on request.");
  },

  _resolveJsonPath: (obj: any, path: string): any => {
    if (path.startsWith('$.')) path = path.substring(2);
    
    try {
      return path.split('.').reduce((acc, part) => {
        if (acc === null || acc === undefined) return undefined;
        if (part.includes('[') && part.includes(']')) {
          const [prop, indexStr] = part.split('[');
          const index = parseInt(indexStr.replace(']', ''));
          return acc[prop]?.[index];
        }
        return acc[part];
      }, obj);
    } catch (error) {
      console.warn(`[WorkflowService] JSONPath resolution failed for ${path}:`, error);
      return undefined;
    }
  },

  _compileStepPrompt: async (step: WorkflowStep, context: Record<string, any>, stepIndex: number): Promise<CompiledPrompt> => {
    if (!step.templateId) {
      throw new Error(`Step ${step.name} has no templateId specified`);
    }

    const { promptTemplates } = usePromptTemplateStore.getState();
    const template = promptTemplates.find(t => t.id === step.templateId);
    if (!template) {
      throw new Error(`Template ${step.templateId} not found for step ${step.name}`);
    }

    // Get the immediate previous step output
    const previousStepKey = stepIndex === 0 ? 'trigger' : `step${stepIndex - 1}`;
    const previousStepOutput = context[previousStepKey];
    
    // Use the parsed output directly as form data
    const formData = previousStepOutput || {};

    console.log(`[WorkflowService] Compiling template "${template.name}" for step "${step.name}" with data:`, formData);

    return await compilePromptTemplate(template, formData);
  },

  _parseStepOutput: (interaction: Interaction, step: WorkflowStep): any => {
    if (!step.structuredOutput) {
      return interaction.response || "No output";
    }

    // Try to parse structured output
    if (interaction.metadata?.toolCalls?.length) {
      try {
        const toolCall = JSON.parse(interaction.metadata.toolCalls[0]);
        if (toolCall.toolName === 'structured_output' || toolCall.name === 'structured_output') {
          return toolCall.arguments || toolCall.args;
        }
      } catch (e) { /* continue to text parsing */ }
    }

    // Parse JSON from response
    try {
      const jsonRegex = /```json\s*([\s\S]*?)\s*```/;
      const match = (interaction.response ?? '').match(jsonRegex);
      if (match?.[1]) {
        return JSON.parse(match[1]);
      }
      return JSON.parse(interaction.response ?? '{}');
    } catch (e) {
      throw new Error('Could not parse structured output from response');
    }
  },

  handleWorkflowStartRequest: async (payload: WorkflowEventPayloads[typeof workflowEvent.startRequest]): Promise<void> => {
    console.log("[WorkflowService] Workflow start request received", payload);
    const { template, initialPrompt, conversationId } = payload;
    if (!conversationId) return;

    // DEBUG: Log template details
    console.log("[WorkflowService] Template details:", {
      name: template.name,
      stepsCount: template.steps?.length || 0,
      steps: template.steps?.map((s: any) => ({ id: s.id, name: s.name, type: s.type, templateId: s.templateId })) || []
    });

    // Start the workflow immediately using the provided initial prompt
    // No need to wait for middleware interception like race system
    console.log("[WorkflowService] Starting workflow immediately with initial prompt");
    
    // Build complete prompt object with all controls (structured output, tools, etc.)
    const baseTurnData: PromptTurnObject = {
      id: nanoid(),
      content: initialPrompt,
      parameters: {},
      metadata: {
        modelId: usePromptStateStore.getState().modelId || undefined,
      },
    };

    const { promptObject } = await WorkflowService.buildCompletePromptObject(
      conversationId, 
      initialPrompt, 
      baseTurnData
    );
    
    await WorkflowService.handleWorkflowConversion(promptObject, conversationId, { template, initialPrompt, conversationId });
  },

  // Main workflow conversion handler (equivalent to handleRaceConversion)
  handleWorkflowConversion: async (prompt: PromptObject, conversationId: string, workflowConfig: { template: any; initialPrompt: string; conversationId: string }): Promise<void> => {
    try {
      const { template } = workflowConfig;
      
      if (!template.steps || template.steps.length === 0) {
        throw new Error("Workflow template has no steps");
      }

      const interactionStore = useInteractionStore.getState();
      
      // Extract user content from prompt (like race system)
      const userMessage = prompt.messages[prompt.messages.length - 1];
      if (!userMessage || userMessage.role !== "user") {
        throw new Error("Could not find user message in prompt");
      }
      
      let userContent = "";
      if (typeof userMessage.content === "string") {
        userContent = userMessage.content;
      } else if (Array.isArray(userMessage.content)) {
        userContent = userMessage.content
          .filter(part => part.type === "text")
          .map(part => (part as any).text)
          .join("");
      }

      // Create base turn data (like race system)
      const baseTurnData: PromptTurnObject = {
        id: "",  // Will be set per interaction
        content: userContent,
        parameters: prompt.parameters || {},
        metadata: {
          ...prompt.metadata,
          modelId: prompt.metadata?.modelId || "",
        },
      };

      // --- Manually create the main workflow host interaction (like race main interaction) ---
      const mainInteractionId = nanoid();
      const runId = nanoid();
      
      const conversationInteractions = interactionStore.interactions.filter(
        (i: Interaction) => i.conversationId === conversationId
      );
      const newIndex = conversationInteractions.reduce((max: number, i: Interaction) => Math.max(max, i.index), -1) + 1;

      const mainInteraction: Interaction = {
        id: mainInteractionId,
        conversationId: conversationId,
        type: "message.user_assistant",
        prompt: {
          id: mainInteractionId,
          content: userContent,
          parameters: {},
          metadata: {
            isWorkflowRun: true,
            workflowName: template.name,
            workflowTemplateId: template.id,
            workflowRunId: runId,
          }
        },
        response: null, // Content comes from stream buffer
        status: "STREAMING",
        startedAt: new Date(),
        endedAt: null,
        metadata: {
          isWorkflowRun: true,
          workflowName: template.name,
          workflowTemplateId: template.id,
          workflowRunId: runId,
          toolCalls: [],
          toolResults: [],
        },
        index: newIndex,
        parentId: null,
      };

      // Add to state and persistence (like race system)
      interactionStore._addInteractionToState(mainInteraction);
      interactionStore._addStreamingId(mainInteraction.id);
      
      // Set initial content in stream buffer (will be updated with flow content after run is created)
      interactionStore.setActiveStreamBuffer(
        mainInteraction.id,
        `# ${template.name}\n\nWorkflow starting with ${template.steps.length} step${template.steps.length > 1 ? 's' : ''}...`
      );
      
      await PersistenceService.saveInteraction(mainInteraction);
      
      // Emit events (like race system)
      emitter.emit(interactionEvent.added, { interaction: mainInteraction });
      emitter.emit(interactionEvent.started, {
        interactionId: mainInteraction.id,
        conversationId: mainInteraction.conversationId,
        type: mainInteraction.type,
      });

      // Create workflow run
      const run: WorkflowRun = {
        runId,
        conversationId,
        mainInteractionId,
        template,
        status: "RUNNING",
        currentStepIndex: -1, // Start at -1, trigger step is 0
        stepOutputs: {},
        startedAt: new Date().toISOString(),
      };

      // Generate and update with flow content
      const initialFlowContent = WorkflowService.flowGenerator.generateInitialFlow(run);
      console.log(`[WorkflowService] Generated initial flow content:`, {
        flowContentLength: initialFlowContent.length,
        flowContentPreview: initialFlowContent.substring(0, 200) + (initialFlowContent.length > 200 ? '...' : ''),
      });
      
      const fullContent = `# ${template.name}\n\nWorkflow starting with ${template.steps.length} step${template.steps.length > 1 ? 's' : ''}...\n\n\`\`\`flow\n${initialFlowContent}\n\`\`\``;
      console.log(`[WorkflowService] Setting stream buffer with full content:`, {
        fullContentLength: fullContent.length,
        mainInteractionId: mainInteraction.id,
      });
      
      interactionStore.setActiveStreamBuffer(mainInteraction.id, fullContent);

      // Start the trigger step as first child (like race system)
      await WorkflowService.createTriggerStep(mainInteraction, run, baseTurnData);
      
      // Emit workflow started event
      emitter.emit(workflowEvent.started, { run });
      
    } catch (error) {
      console.error(`[WorkflowService] Error during workflow conversion:`, error);
    }
  },

  // Create trigger step as child interaction (like race children)
  createTriggerStep: async (mainInteraction: Interaction, run: WorkflowRun, baseTurnData: PromptTurnObject): Promise<void> => {
    try {
      // Build structured output schema based on what step 0 needs
      const nextStep = run.template.steps[0];
      const triggerParameters = { ...baseTurnData.parameters };
      
      if (nextStep?.templateId) {
        // Get the template for step 0 to see what variables it needs
        const { promptTemplates } = usePromptTemplateStore.getState();
        const nextStepTemplate = promptTemplates.find(t => t.id === nextStep.templateId);
        
        if (nextStepTemplate && nextStepTemplate.variables && nextStepTemplate.variables.length > 0) {
          // Build structured output schema for the variables step 0 needs
          const { schema } = WorkflowService._createStructuredOutputSchema(nextStepTemplate.variables);
          
          triggerParameters.structured_output = schema;
          console.log(`[WorkflowService] Trigger step will output structured data for step "${nextStep.name}" variables:`, nextStepTemplate.variables.map(v => v.name));
        }
      } else if (nextStep?.structuredOutput) {
        // Fallback to step's own structured output if defined
        triggerParameters.structured_output = nextStep.structuredOutput.jsonSchema;
        console.log(`[WorkflowService] Trigger step will output structured data for next step: ${nextStep.name}`);
      }

      const triggerTurnData: PromptTurnObject = {
        ...baseTurnData,
        id: nanoid(),
        parameters: triggerParameters,
        metadata: {
          ...baseTurnData.metadata,
          isWorkflowStep: true,
          workflowRunId: run.runId,
          workflowStepId: 'trigger',
          workflowMainInteractionId: mainInteraction.id,
          workflowTab: true,
          workflowStepIndex: 0, // Tab index
        },
      };

      // TRIGGER outputs variables for step[0]
      if (nextStep?.templateId && triggerParameters.structured_output) {
        // Get the global system prompt from project settings
        const conversationStoreState = useConversationStore.getState();
        const projectStoreState = useProjectStore.getState();
        const currentConversation = conversationStoreState.getConversationById(run.conversationId);
        const currentProjectId = currentConversation?.projectId ?? null;
        const effectiveSettings = projectStoreState.getEffectiveProjectSettings(currentProjectId);
        const globalSystemPrompt = effectiveSettings.systemPrompt || "You are a helpful AI assistant.";
        
        // Get the proper specification for this step
        const { promptTemplates } = usePromptTemplateStore.getState();
        const nextStepTemplate = promptTemplates.find(t => t.id === nextStep.templateId);
        
        if (nextStepTemplate && nextStepTemplate.variables && nextStepTemplate.variables.length > 0) {
          const { specification } = WorkflowService._createStructuredOutputSchema(nextStepTemplate.variables);
          
          triggerTurnData.metadata.turnSystemPrompt = `${globalSystemPrompt}

You are part of a workflow system. ${specification}`;
        } else {
          triggerTurnData.metadata.turnSystemPrompt = `${globalSystemPrompt}

You are part of a workflow system. You ABSOLUTELY MUST respect the following output format when answering to not break the workflow:

${JSON.stringify(triggerParameters.structured_output, null, 2)}`;
        }
      }

      console.log(`[WorkflowService] Creating trigger step as child tab for run ${run.runId}`);
      
      // Rebuild the prompt object with the structured output for next step
      const { promptObject: triggerPrompt } = await WorkflowService.buildCompletePromptObject(
        run.conversationId,
        baseTurnData.content,
        triggerTurnData
      );
      
      const triggerInteraction = await InteractionService.startInteraction(
        triggerPrompt,
        run.conversationId,
        triggerTurnData,
        "message.user_assistant"
      );

      if (triggerInteraction) {
        // Set as child of main interaction (like race system)
        const updates: Partial<Omit<Interaction, "id">> = {
          parentId: mainInteraction.id,
          index: 0, // Tab index for trigger
        };

        const interactionStore = useInteractionStore.getState();
        interactionStore._updateInteractionInState(triggerInteraction.id, updates);
        await PersistenceService.saveInteraction({
          ...triggerInteraction,
          ...updates,
        } as Interaction);

        console.log(`[WorkflowService] Trigger step created as child ${triggerInteraction.id} of main ${mainInteraction.id}`);
      }
    } catch (error) {
      console.error(`[WorkflowService] Error creating trigger step:`, error);
    }
  },

  // Create regular workflow step as child interaction (like race children)
  createWorkflowStep: async (run: WorkflowRun, stepIndex: number): Promise<void> => {
    try {
      const step = run.template.steps[stepIndex];
      if (!step) {
        throw new Error(`Step at index ${stepIndex} not found`);
      }

      const stepName = step.name || `Step ${stepIndex + 1}`;
      console.log(`[WorkflowService] Creating step "${stepName}" as child tab for run ${run.runId}`);

      // Update main interaction progress
      const interactionStore = useInteractionStore.getState();
      
      // Update flow content with step status
      const currentContent = interactionStore.activeStreamBuffers[run.mainInteractionId] || '';
      const flowMatch = currentContent.match(/```flow\n([\s\S]*?)\n```/);
      if (flowMatch && flowMatch[1]) {
        const updatedFlowContent = WorkflowService.flowGenerator.updateNodeStatus(
          flowMatch[1], 
          step.id, 
          'running'
        );
        const newContent = currentContent.replace(
          /```flow\n[\s\S]*?\n```/,
          `\`\`\`flow\n${updatedFlowContent}\n\`\`\``
        );
        interactionStore.setActiveStreamBuffer(run.mainInteractionId, newContent);
      } else {
        interactionStore.appendStreamBuffer(run.mainInteractionId, `\n\n---\n▶️ **Executing: ${stepName}**`);
      }

      if (step.type === "human-in-the-loop") {
        interactionStore.appendStreamBuffer(run.mainInteractionId, `\n⏸️ **Paused:** ${step.instructionsForHuman || 'Requires human input.'}`);
        interactionStore._updateInteractionInState(run.mainInteractionId, { status: 'AWAITING_INPUT' });
        interactionStore._removeStreamingId(run.mainInteractionId);
        emitter.emit(workflowEvent.paused, { runId: run.runId, step, pauseReason: 'human-in-the-loop', dataForReview: run.stepOutputs });
        return;
      }

      // Compile step prompt
      const compiled = await WorkflowService._compileStepPrompt(step, run.stepOutputs, stepIndex);
      const modelId = step.modelId ?? usePromptStateStore.getState().modelId;

      if (!modelId) {
        throw new Error(`Could not determine a valid AI model ID for step "${stepName}".`);
      }

      console.log(`[WorkflowService] Step "${stepName}" configuration:`, {
        modelId,
        hasStructuredOutput: !!step.structuredOutput,
        structuredOutputSchema: step.structuredOutput?.schema,
        enabledTools: compiled.selectedTools?.length || 0,
        selectedRules: compiled.selectedRules?.length || 0
      });

      // Template details will be handled by buildCompletePromptObject

      // Add structured output schema for the NEXT step if it exists
      const nextStepIndex = stepIndex + 1;
      const nextStep = run.template.steps[nextStepIndex];
      const stepParameters: Record<string, any> = {};
      
      if (nextStep?.templateId) {
        // Get the template for the NEXT step to see what variables it needs
        const { promptTemplates } = usePromptTemplateStore.getState();
        const nextStepTemplate = promptTemplates.find(t => t.id === nextStep.templateId);
        
        if (nextStepTemplate && nextStepTemplate.variables && nextStepTemplate.variables.length > 0) {
          // Build structured output schema for the variables the NEXT step needs
          const { schema, specification } = WorkflowService._createStructuredOutputSchema(nextStepTemplate.variables);
          
          stepParameters.structured_output = schema;
          console.log(`[WorkflowService] Step "${stepName}" will output structured data for next step "${nextStep.name}" variables:`, nextStepTemplate.variables.map(v => v.name));
          
          // Store the specification for the system prompt
          stepParameters.outputSpecification = specification;
        }
      } else if (nextStep?.structuredOutput) {
        // Fallback to step's own structured output if defined
        stepParameters.structured_output = nextStep.structuredOutput.jsonSchema;
        console.log(`[WorkflowService] Step "${stepName}" will output structured data for next step: ${nextStep.name}`);
      }

      // Create step turn data with step-specific configuration
      const stepTurnData: PromptTurnObject = {
        id: nanoid(),
        content: compiled.content,
        parameters: stepParameters,
        metadata: {
          isWorkflowStep: true,
          workflowRunId: run.runId,
          workflowStepId: step.id,
          workflowMainInteractionId: run.mainInteractionId,
          workflowTab: true,
          workflowStepIndex: stepIndex + 1, // Tab index (0 is trigger, 1+ are steps)
          modelId, // Step-specific model ID override
          enabledTools: compiled.selectedTools,
          effectiveRulesContent: compiled.selectedRules?.map(ruleId => ({ 
            sourceRuleId: ruleId,
            content: "/* Rule content will be resolved */",
            type: "before" as const,
          })),
        },
      };

      // Each step uses its OWN template's system prompt + workflow output format for the NEXT step
      if (stepParameters.structured_output) {
        const { promptTemplates } = usePromptTemplateStore.getState();
        const currentStepTemplate = promptTemplates.find(t => t.id === step.templateId);
        
        if (currentStepTemplate) {
          // Get the global system prompt from project settings
          const conversationStoreState = useConversationStore.getState();
          const projectStoreState = useProjectStore.getState();
          const currentConversation = conversationStoreState.getConversationById(run.conversationId);
          const currentProjectId = currentConversation?.projectId ?? null;
          const effectiveSettings = projectStoreState.getEffectiveProjectSettings(currentProjectId);
          const globalSystemPrompt = effectiveSettings.systemPrompt || "You are a helpful AI assistant.";
          
          const templateSystemPrompt = currentStepTemplate.prompt || "";
          const baseSystemPrompt = templateSystemPrompt ? `${globalSystemPrompt}\n\n${templateSystemPrompt}` : globalSystemPrompt;
          
          // Use the specification if available, otherwise fall back to JSON schema
          if (stepParameters.outputSpecification) {
            stepTurnData.metadata.turnSystemPrompt = `${baseSystemPrompt}

You are part of a workflow system. ${stepParameters.outputSpecification}`;
          } else {
            stepTurnData.metadata.turnSystemPrompt = `${baseSystemPrompt}

You are part of a workflow system. You ABSOLUTELY MUST respect the following output format when answering to not break the workflow:

${JSON.stringify(stepParameters.structured_output, null, 2)}`;
          }
        }
      }

      // Build complete step prompt with all controls (structured output, tools, etc.)
      const { promptObject: stepPrompt } = await WorkflowService.buildCompletePromptObject(
        run.conversationId,
        compiled.content,
        stepTurnData
      );

      // Create child interaction using InteractionService.startInteraction (like race system)
      const stepInteraction = await InteractionService.startInteraction(
        stepPrompt,
        run.conversationId,
        stepTurnData,
        "message.assistant_regen"
      );

      if (stepInteraction) {
        // Set as child of main interaction (like race system)
        const updates: Partial<Omit<Interaction, "id">> = {
          parentId: run.mainInteractionId,
          index: stepIndex + 1, // Tab index
        };

        const interactionStore = useInteractionStore.getState();
        interactionStore._updateInteractionInState(stepInteraction.id, updates);
        await PersistenceService.saveInteraction({
          ...stepInteraction,
          ...updates,
        } as Interaction);

        console.log(`[WorkflowService] Step "${stepName}" created as child ${stepInteraction.id} of main ${run.mainInteractionId}`);
      }
    } catch (error) {
      console.error(`[WorkflowService] Error creating step ${stepIndex}:`, error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      const interactionStore = useInteractionStore.getState();
      
              // Update the main interaction response (like RacePromptControlModule does)
        const errorUpdates = {
          response: `❌ **Workflow Error**\n\nFailed to create step ${stepIndex + 1}: ${errorMsg}`,
          status: 'ERROR' as const,
          endedAt: new Date()
        };
        interactionStore._updateInteractionInState(run.mainInteractionId, errorUpdates);
        interactionStore._removeStreamingId(run.mainInteractionId);
        
        // Save to persistence (like RacePromptControlModule does)
        const errorMainInteraction = interactionStore.interactions.find(i => i.id === run.mainInteractionId);
        if (errorMainInteraction) {
          PersistenceService.saveInteraction({
            ...errorMainInteraction,
            ...errorUpdates,
          } as Interaction).catch(console.error);
        }
      emitter.emit(workflowEvent.error, { runId: run.runId, error: errorMsg });
    }
  },

  handleInteractionCompleted: (payload: { interactionId: string; status: string; interaction?: Interaction }): void => {
    const { interaction } = payload;
    if (!interaction?.metadata?.isWorkflowStep || !interaction.metadata.workflowRunId) {
      return;
    }

    // Wait for interaction to be fully finalized before processing output
    setTimeout(() => {
      const { workflowRunId, workflowStepId } = interaction.metadata;
      console.log(`[WorkflowService] Step completed for run: ${workflowRunId}, step: ${workflowStepId}, status: ${payload.status}`);
      
      const activeRun = useWorkflowStore.getState().activeRun;
      if (!activeRun || activeRun.runId !== workflowRunId) {
        console.warn(`[WorkflowService] Mismatched or no active run for ${workflowRunId}`);
        return;
      }

      if (payload.status === "ERROR" || payload.status === "CANCELLED") {
        const errorMsg = `Step failed with status ${payload.status}. ${interaction.response || ""}`;
        console.error(`[WorkflowService] Step error for run ${activeRun.runId}:`, errorMsg);
        useInteractionStore.getState().appendStreamBuffer(activeRun.mainInteractionId, `\n❌ **Error:** ${errorMsg}`);
        emitter.emit(workflowEvent.error, { runId: activeRun.runId, error: errorMsg });
        return;
      }

      // Handle trigger step completion
      if (workflowStepId === 'trigger') {
        // For trigger step, parse its structured output (it was configured to output for step 0)
        let triggerOutput: any;
        
        // Try to parse structured output from the trigger step response
        try {
          // Create a fake step with structured output to use the parser
          const fakeStep = { structuredOutput: { jsonSchema: {} } } as WorkflowStep;
          triggerOutput = WorkflowService._parseStepOutput(interaction, fakeStep);
        } catch (error) {
          console.warn(`[WorkflowService] Trigger step structured output parsing failed:`, error);
          // Fallback: use raw response
          triggerOutput = interaction.response ?? "No output";
        }
        
        // Update flow content for completed trigger
        const interactionStore = useInteractionStore.getState();
        const currentContent = interactionStore.activeStreamBuffers[activeRun.mainInteractionId] || '';
        const flowMatch = currentContent.match(/```flow\n([\s\S]*?)\n```/);
        if (flowMatch && flowMatch[1]) {
          const updatedFlowContent = WorkflowService.flowGenerator.updateNodeStatus(
            flowMatch[1], 
            'initial', 
            'success'
          );
          const newContent = currentContent.replace(
            /```flow\n[\s\S]*?\n```/,
            `\`\`\`flow\n${updatedFlowContent}\n\`\`\``
          );
          // Update stream buffer directly (main stays streaming like race system)
          interactionStore.setActiveStreamBuffer(activeRun.mainInteractionId, newContent);
        } else {
          // Append progress directly to stream buffer
          interactionStore.appendStreamBuffer(activeRun.mainInteractionId, `\n✔️ **Finished: Initial User Prompt**`);
        }
        
        emitter.emit(workflowEvent.stepCompleted, { runId: activeRun.runId, stepId: 'trigger', output: triggerOutput });
        return;
      }

      // Handle regular step completion
      const stepSpec = activeRun.template.steps.find((s: any) => s.id === workflowStepId);
      if (!stepSpec) {
        console.error(`[WorkflowService] Could not find step ${workflowStepId} in template`);
        return;
      }

      let stepOutput: any;
      try {
        stepOutput = WorkflowService._parseStepOutput(interaction, stepSpec);
      } catch (error) {
        emitter.emit(workflowEvent.paused, { 
          runId: activeRun.runId, 
          step: stepSpec, 
          pauseReason: 'data-correction', 
          rawAssistantResponse: interaction.response 
        });
        return;
      }

      // Update flow content for completed step
      const interactionStore = useInteractionStore.getState();
      const currentContent = interactionStore.activeStreamBuffers[activeRun.mainInteractionId] || '';
      const flowMatch = currentContent.match(/```flow\n([\s\S]*?)\n```/);
      if (flowMatch && flowMatch[1]) {
        const updatedFlowContent = WorkflowService.flowGenerator.updateNodeStatus(
          flowMatch[1], 
          workflowStepId as string, 
          'success'
        );
        const newContent = currentContent.replace(
          /```flow\n[\s\S]*?\n```/,
          `\`\`\`flow\n${updatedFlowContent}\n\`\`\``
        );
        // Update stream buffer directly (main stays streaming like race system)
        interactionStore.setActiveStreamBuffer(activeRun.mainInteractionId, newContent);
      } else {
        const finalStepName = stepSpec.name || 'Unnamed Step';
        // Append progress directly to stream buffer
        interactionStore.appendStreamBuffer(activeRun.mainInteractionId, `\n✔️ **Finished: ${finalStepName}**`);
      }
      
      emitter.emit(workflowEvent.stepCompleted, { runId: activeRun.runId, stepId: workflowStepId as string, output: stepOutput });
    }, 100); // 100ms delay to ensure interaction is fully finalized
  },

  handleStepCompleted: (payload: WorkflowEventPayloads[typeof workflowEvent.stepCompleted]): void => {
    const { runId, stepId } = payload;
    
    // Wait for store to process step completion
    setTimeout(() => {
      const activeRun = useWorkflowStore.getState().activeRun;
      if (!activeRun || activeRun.runId !== runId || activeRun.status !== 'RUNNING') {
        console.log(`[WorkflowService] Step completion ignored - no active run or status changed`);
        return;
      }
      
      // DEBUG: Log step progression details
      console.log(`[WorkflowService] Step completed: ${stepId}, currentStepIndex: ${activeRun.currentStepIndex}, totalSteps: ${activeRun.template.steps.length}`);
      
      // Check if workflow is complete (currentStepIndex now points to completed steps)
      if (activeRun.currentStepIndex >= activeRun.template.steps.length) {
        const interactionStore = useInteractionStore.getState();
        
        // Format workflow completion as markdown with input and all step outputs
        const mainInteraction = interactionStore.interactions.find(i => i.id === activeRun.mainInteractionId);
        const originalInput = mainInteraction?.prompt?.content || "No input";
        
        // Build markdown summary
        let markdownSummary = `# ${activeRun.template.name}\n\n`;
        markdownSummary += `**Original Input:** ${originalInput}\n\n`;
        markdownSummary += `---\n\n`;
        
        // Add each step's output
        Object.entries(activeRun.stepOutputs).forEach(([stepKey, output], index) => {
          if (stepKey === 'trigger') {
            markdownSummary += `## Initial Processing\n\n`;
          } else {
            // Steps are sequential: step0, step1, step2... so index-1 (since trigger is index 0)
            const stepIndex = index - 1;
            const stepName = activeRun.template.steps[stepIndex]?.name || `Step ${stepIndex + 1}`;
            markdownSummary += `## ${stepName}\n\n`;
          }
          
          if (typeof output === 'object' && output !== null) {
            // Format structured output nicely
            Object.entries(output).forEach(([key, value]) => {
              markdownSummary += `**${key}:** ${value}\n\n`;
            });
          } else {
            markdownSummary += `${output}\n\n`;
          }
          
          markdownSummary += `---\n\n`;
        });
        
        markdownSummary += `✅ **Workflow completed successfully**`;
        
        // Update flow content to finalized state
        const currentContent = interactionStore.activeStreamBuffers[activeRun.mainInteractionId] || '';
        const flowMatch = currentContent.match(/```flow\n([\s\S]*?)\n```/);
        let finalContent = markdownSummary;
        
        if (flowMatch && flowMatch[1]) {
          const finalizedFlowContent = WorkflowService.flowGenerator.finalizeWorkflow(
            flowMatch[1], 
            activeRun.stepOutputs
          );
          finalContent = currentContent.replace(
            /```flow\n[\s\S]*?\n```/,
            `\`\`\`flow\n${finalizedFlowContent}\n\`\`\``
          ).replace(/Workflow starting with.*?\.\.\./, `✅ **Workflow completed successfully**\n\n**Summary:**\n${markdownSummary}`);
        }
        
        // Update the main interaction response (like RacePromptControlModule does)
        const completionUpdates = {
          response: finalContent,
          status: 'COMPLETED' as const,
          endedAt: new Date()
        };
        interactionStore._updateInteractionInState(activeRun.mainInteractionId, completionUpdates);
        interactionStore._removeStreamingId(activeRun.mainInteractionId);
        
        // Save to persistence (like RacePromptControlModule does)
        const completionMainInteraction = interactionStore.interactions.find(i => i.id === activeRun.mainInteractionId);
        if (completionMainInteraction) {
          PersistenceService.saveInteraction({
            ...completionMainInteraction,
            ...completionUpdates,
          } as Interaction).catch(console.error);
        }
        
        emitter.emit(workflowEvent.completed, { runId: activeRun.runId, finalOutput: activeRun.stepOutputs });
        console.log(`[WorkflowService] Workflow completed: ${runId}`);
        return;
      }
      
      // Create current step (store has already incremented currentStepIndex)
      console.log(`[WorkflowService] Creating current step ${activeRun.currentStepIndex} for run ${runId}`);
      WorkflowService.createWorkflowStep(activeRun, activeRun.currentStepIndex);
      
    }, 0);
  },

  handleWorkflowResumeRequest: async (payload: WorkflowEventPayloads[typeof workflowEvent.resumeRequest]): Promise<void> => {
    console.log("[WorkflowService] Workflow resume request received", payload);
    const { runId, resumeData } = payload;
    const activeRun = useWorkflowStore.getState().activeRun;
    if (!activeRun || activeRun.runId !== runId) {
      console.warn(`[WorkflowService] Cannot resume run ${runId}, not active`);
      return;
    }
    
    const stepSpec = activeRun.template.steps[activeRun.currentStepIndex];
    if (!stepSpec) {
      console.error(`[WorkflowService] Cannot resume, no step at index ${activeRun.currentStepIndex}`);
      return;
    }

    emitter.emit(workflowEvent.stepCompleted, { runId: activeRun.runId, stepId: stepSpec.id, output: resumeData });
  },

  /**
   * Extract and build complete PromptObject like ConversationService.submitPrompt does
   * This ensures all prompt controls (structured output, tools, parameters) are included
   */
  async buildCompletePromptObject(
    conversationId: string, 
    userContent: string, 
    baseTurnData: PromptTurnObject
  ): Promise<{ promptObject: PromptObject; turnData: PromptTurnObject }> {
    const interactionStoreState = useInteractionStore.getState();
    const projectStoreState = useProjectStore.getState();
    const promptState = usePromptStateStore.getState();
    const conversationStoreState = useConversationStore.getState();

    const controlRegistryState = useControlRegistryStore.getState();

    // Get conversation and project settings
    const currentConversation = conversationStoreState.getConversationById(conversationId);
    const currentProjectId = currentConversation?.projectId ?? null;
    const effectiveSettings = projectStoreState.getEffectiveProjectSettings(currentProjectId);

    // Collect parameters and metadata from all prompt controls
    const promptControls = Object.values(controlRegistryState.promptControls);
    let parameters: Record<string, any> = {};
    let metadata: Record<string, any> = { ...baseTurnData.metadata };

    for (const control of promptControls) {
      if (control.getParameters) {
        const params = await control.getParameters();
        if (params) parameters = { ...parameters, ...params };
      }
      if (control.getMetadata) {
        const meta = await control.getMetadata();
        if (meta) metadata = { ...metadata, ...meta };
      }
    }

    // Build history from existing interactions
    const activeInteractionsOnSpine = interactionStoreState.interactions
      .filter(i => i.conversationId === conversationId && i.parentId === null && i.status === "COMPLETED")
      .sort((a, b) => a.index - b.index);

    const turnsForHistoryBuilder: Interaction[] = activeInteractionsOnSpine.map(activeInteraction => {
      if (activeInteraction.type === "message.assistant_regen" && activeInteraction.metadata?.regeneratedFromId) {
        const originalInteraction = interactionStoreState.interactions.find(
          orig => orig.id === activeInteraction.metadata!.regeneratedFromId
        );
        if (originalInteraction && originalInteraction.prompt && originalInteraction.type === "message.user_assistant") {
          return {
            ...activeInteraction,
            prompt: originalInteraction.prompt,
            type: "message.user_assistant",
          } as Interaction;
        }
      }
      if (activeInteraction.type === "message.user_assistant" && activeInteraction.prompt) {
        return activeInteraction;
      }
      return null;
    }).filter(Boolean) as Interaction[];

    const historyMessages: CoreMessage[] = buildHistoryMessages(turnsForHistoryBuilder);

    // Add current user message
    historyMessages.push({ role: "user", content: userContent });

    // Build system prompt with rules if any
    const turnSystemPrompt = metadata?.turnSystemPrompt as string | undefined;
    let baseSystemPrompt = turnSystemPrompt ?? effectiveSettings.systemPrompt ?? undefined;

    const effectiveRulesContent = metadata?.effectiveRulesContent ?? [];
    const systemRulesContent = effectiveRulesContent
      .filter((r: any) => r.type === "system")
      .map((r: any) => r.content);

    if (systemRulesContent.length > 0) {
      baseSystemPrompt = `${baseSystemPrompt ? `${baseSystemPrompt}\n\n` : ""}${systemRulesContent.join("\n")}`;
    }

    // Build final parameters from prompt state + control parameters
    const finalParameters = {
      temperature: promptState.temperature,
      max_tokens: promptState.maxTokens,
      top_p: promptState.topP,
      top_k: promptState.topK,
      presence_penalty: promptState.presencePenalty,
      frequency_penalty: promptState.frequencyPenalty,
      ...parameters, // Control parameters override prompt state
      ...(baseTurnData.parameters ?? {}), // Base turn data parameters have highest priority
    };

    // DEBUG: Log parameter building
    console.log(`[WorkflowService] Building prompt parameters:`, {
      promptStateParams: { temperature: promptState.temperature, max_tokens: promptState.maxTokens },
      controlParams: parameters,
      baseTurnParams: baseTurnData.parameters,
      finalParams: finalParameters
    });

    // Remove null/undefined parameters
    Object.keys(finalParameters).forEach((key) => {
      if (
        finalParameters[key as keyof typeof finalParameters] === null ||
        finalParameters[key as keyof typeof finalParameters] === undefined
      ) {
        delete finalParameters[key as keyof typeof finalParameters];
      }
    });

    // Build complete metadata
    const completeMetadata = {
      ...metadata,
      modelId: metadata.modelId || promptState.modelId || undefined,
    };

    // Build complete turn data
    const completeTurnData: PromptTurnObject = {
      ...baseTurnData,
      content: userContent,
      parameters: finalParameters,
      metadata: completeMetadata,
    };

    // Build complete prompt object
    const promptObject: PromptObject = {
      system: baseSystemPrompt,
      messages: historyMessages,
      parameters: finalParameters,
      metadata: completeMetadata,
    };

    return { promptObject, turnData: completeTurnData };
  },

  /**
   * Create proper structured output schema and specification for workflow steps
   * This ensures the model outputs actual data values, not schema format
   */
  _createStructuredOutputSchema: (variables: Array<{ name: string; type: string; description?: string; required?: boolean }>): { schema: object; specification: string } => {
    // Build the JSON schema for structured output
    const schema = {
      type: "object",
      properties: {} as Record<string, any>,
      required: [] as string[],
      additionalProperties: false
    };

    variables.forEach(variable => {
      schema.properties[variable.name] = {
        type: variable.type === 'number' ? 'number' : 'string',
        description: variable.description || `The ${variable.name} value`
      };
      if (variable.required) {
        schema.required.push(variable.name);
      }
    });

    // Create specification text that clearly explains the expected output format
    const exampleOutput = variables.reduce((acc, variable) => {
      const exampleValue = variable.type === 'number' ? 42 : `"your ${variable.name} here"`;
      acc[variable.name] = exampleValue;
      return acc;
    }, {} as Record<string, any>);

    const specification = `You must respond with a JSON object containing the actual values (not schema definitions). 

Expected format:
${JSON.stringify(exampleOutput, null, 2)}

Required fields: ${schema.required.join(', ')}
${variables.map(v => `- ${v.name}: ${v.description || `The ${v.name} value`}`).join('\n')}

IMPORTANT: Provide the actual values, not schema definitions with "type" and "description" fields.
IMPORTANT: Keep your response as they would be in normal condition you can use all of LiteChat capabilities, do not shorten or simplify the response but make sure to provide a valid json output.`;

    return { schema, specification };
  },

  
};
