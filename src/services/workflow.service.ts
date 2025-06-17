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
import { ConversationService } from "./conversation.service";

// Note: Refactored to a static class to align with other services like InteractionService.
// This service's lifecycle is tied to the application's lifecycle, so event listeners
// are registered once and are not manually unsubscribed.
export const WorkflowService = {
  isInitialized: false,

  initialize: () => {
    if (WorkflowService.isInitialized) return;
    emitter.on(workflowEvent.startRequest, WorkflowService.handleWorkflowStartRequest);
    emitter.on(interactionEvent.completed, WorkflowService.handleInteractionCompleted);
    emitter.on(workflowEvent.runNextStepRequest, (e) => WorkflowService.runNextStep(e.run));
    emitter.on(workflowEvent.stepCompleted, WorkflowService.handleStepCompleted);
    emitter.on(workflowEvent.resumeRequest, WorkflowService.handleWorkflowResumeRequest);
    WorkflowService.isInitialized = true;
    console.log("[WorkflowService] Initialized.");
  },

  _resolveJsonPath: (obj: any, path: string): any => {
    if (path.startsWith('$.')) path = path.substring(2);
    
    try {
      return path.split('.').reduce((acc, part) => {
        if (acc === null || acc === undefined) return undefined;
        if (part.includes('[') && part.includes(']')) {
          // Handle array access like 'items[0]'
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

  _compileStepPrompt: async (step: WorkflowStep, context: Record<string, any>): Promise<CompiledPrompt> => {
    if (!step.templateId) {
      throw new Error(`Step ${step.name} has no templateId specified`);
    }

    // Get REAL template from store (like PromptLibraryControlModule)
    const { promptTemplates } = usePromptTemplateStore.getState();
    const template = promptTemplates.find(t => t.id === step.templateId);
    if (!template) {
      throw new Error(`Template ${step.templateId} not found for step ${step.name}`);
    }

    // Build form data from context using inputMapping
    const formData: Record<string, any> = {};
    template.variables.forEach(variable => {
      const mappingPath = step.inputMapping?.[variable.name];
      if (mappingPath) {
        const value = WorkflowService._resolveJsonPath(context, mappingPath);
        if (value !== undefined) {
          formData[variable.name] = value;
        }
      }
    });

    // Use EXISTING compilation utility (like PromptLibraryControlModule)
    return await compilePromptTemplate(template, formData);
  },

  _parseStepOutput: (interaction: Interaction, step: WorkflowStep): any => {
    if (!step.structuredOutput) {
      return interaction.response || "No output";
    }

    // Try to parse structured output (like current handleInteractionCompleted)
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

    const interactionStore = useInteractionStore.getState();
    const newIndex = interactionStore.interactions.filter(i => i.conversationId === conversationId).length;

    const mainInteractionId = nanoid();
    const mainInteraction: Interaction = {
      id: mainInteractionId, conversationId, startedAt: new Date(), endedAt: null,
      type: 'message.user_assistant', status: 'STREAMING',
      prompt: { id: nanoid(), content: initialPrompt, parameters: {}, metadata: { isWorkflowRun: true, workflowName: template.name } },
      response: "🚀 Workflow starting...",
      index: newIndex, parentId: null,
      metadata: { isWorkflowRun: true, workflowName: template.name, workflowTemplateId: template.id },
    };

    interactionStore._addInteractionToState(mainInteraction);
    interactionStore._addStreamingId(mainInteraction.id);
    await PersistenceService.saveInteraction(mainInteraction);
    emitter.emit(interactionEvent.added, { interaction: mainInteraction });
    emitter.emit(interactionEvent.started, { interactionId: mainInteraction.id, conversationId, type: mainInteraction.type });

    const run: WorkflowRun = {
      runId: nanoid(), conversationId, mainInteractionId, template, status: "RUNNING", currentStepIndex: -1,
      stepOutputs: {}, // Initialize as empty. The trigger's output will be added first.
      startedAt: new Date().toISOString(),
    };
    emitter.emit(workflowEvent.started, { run });

    // --- EXECUTE THE INITIAL PROMPT AS THE TRIGGER STEP ---
    console.log(`%c[WorkflowService] ==> Executing initial prompt for run ${run.runId}`, 'color: #9C27B0; font-weight: bold;');
    interactionStore.appendStreamBuffer(mainInteractionId, `\n\n---\n▶️ **Executing: Initial User Prompt**`);

    const turnData: PromptTurnObject = {
      id: nanoid(),
      content: initialPrompt,
      parameters: {}, // Use default parameters for the initial prompt
      metadata: {
        isWorkflowStep: true,
        workflowRunId: run.runId,
        workflowStepId: 'trigger', // Special ID for the initial step
        workflowMainInteractionId: mainInteractionId,
        modelId: usePromptStateStore.getState().modelId, // Use the globally selected model for this
      },
    };

    const promptObject: PromptObject = {
      messages: [{ role: 'user', content: initialPrompt }],
      parameters: turnData.parameters,
      metadata: turnData.metadata,
    };
    
    // Start the interaction. Completion is handled by the `handleInteractionCompleted` listener.
    InteractionService.startInteraction(promptObject, conversationId, turnData, "message.workflow_step")
      .catch(error => {
        const errorMsg = `Failed on initial prompt: ${String(error)}`;
        console.error(`%c[WorkflowService] ==> Workflow ERROR for run ${run.runId} on initial prompt`, 'color: #F44336; font-weight: bold;', error);
        interactionStore.appendStreamBuffer(run.mainInteractionId, `\n❌ **Error:** ${errorMsg}`);
        interactionStore._updateInteractionInState(run.mainInteractionId, { status: 'ERROR', endedAt: new Date() });
        interactionStore._removeStreamingId(run.mainInteractionId);
        emitter.emit(workflowEvent.error, { runId: run.runId, error: errorMsg });
      });
  },

  runNextStep: async (run: WorkflowRun): Promise<void> => {
    const interactionStore = useInteractionStore.getState();
    const currentRun = useWorkflowStore.getState().activeRun;

    if (!currentRun || currentRun.runId !== run.runId) {
      console.warn(`[WorkflowService] runNextStep received for run ${run.runId}, but active run is ${currentRun?.runId}. Aborting.`);
      return;
    }
    
    if (interactionStore.currentConversationId !== currentRun.conversationId) {
      console.warn(`[WorkflowService] runNextStep for ${run.runId} ignored, conversation has changed.`);
      return;
    }
    
    // The store holds the index of the last completed step. `currentStepIndex` is -1 for the trigger.
    // The first real step is at index 0.
    const stepIdxToRun = currentRun.currentStepIndex + 1;

    // Check if we are done.
    if (stepIdxToRun >= currentRun.template.steps.length) {
      interactionStore.appendStreamBuffer(currentRun.mainInteractionId, "\n\n✅ **Workflow Completed.**");
      
      const finalOutput = Object.entries(currentRun.stepOutputs)
        .map(([key, value]) => `**${key}**: ${JSON.stringify(value, null, 2)}`)
        .join('\n\n');
      interactionStore.setActiveStreamBuffer(currentRun.mainInteractionId, `✅ **Workflow Completed.**\n\n**Final Outputs:**\n${finalOutput}`);

      interactionStore._updateInteractionInState(currentRun.mainInteractionId, { status: 'COMPLETED', endedAt: new Date() });
      interactionStore._removeStreamingId(currentRun.mainInteractionId);
      emitter.emit(workflowEvent.completed, { runId: currentRun.runId, finalOutput: currentRun.stepOutputs });
      console.log(`%c[WorkflowService] ==> Workflow COMPLETED for run ${currentRun.runId}`, 'color: #4CAF50; font-weight: bold;');
      return;
    }

    const currentStep = currentRun.template.steps[stepIdxToRun];
    const stepName = currentStep.name || `Step ${stepIdxToRun + 1}`;
    
    console.log(`%c[WorkflowService] ==> Executing step ${stepIdxToRun}: "${stepName}" for run ${currentRun.runId}`, 'color: #2196F3; font-weight: bold;');
    interactionStore.appendStreamBuffer(currentRun.mainInteractionId, `\n\n---\n▶️ **Executing: ${stepName}**`);

    try {
      if (currentStep.type === "human-in-the-loop") {
        interactionStore.appendStreamBuffer(currentRun.mainInteractionId, `\n⏸️ **Paused:** ${currentStep.instructionsForHuman || 'Requires human input.'}`);
        interactionStore._updateInteractionInState(currentRun.mainInteractionId, { status: 'AWAITING_INPUT' });
        interactionStore._removeStreamingId(currentRun.mainInteractionId);
        emitter.emit(workflowEvent.paused, { runId: currentRun.runId, step: currentStep, pauseReason: 'human-in-the-loop', dataForReview: currentRun.stepOutputs });
        console.log(`%c[WorkflowService] ==> Workflow PAUSED for run ${currentRun.runId} at step "${stepName}"`, 'color: #FF9800; font-weight: bold;');
        return;
      }

      const compiled = await WorkflowService._compileStepPrompt(currentStep, currentRun.stepOutputs);
      const modelId = currentStep.modelId ?? usePromptStateStore.getState().modelId;

      if (!modelId) throw new Error(`Could not determine a valid AI model ID for step "${stepName}".`);
      
      // Build proper PromptTurnObject with compiled template metadata (like ConversationService)
      const turnData: PromptTurnObject = {
        id: nanoid(),
        content: compiled.content,
        parameters: {}, // Will be merged with global parameters by ConversationService
        metadata: {
          isWorkflowStep: true,
          workflowRunId: currentRun.runId,
          workflowStepId: currentStep.id,
          workflowMainInteractionId: currentRun.mainInteractionId,
          modelId,
          // Include tools and rules from template compilation
          enabledTools: compiled.selectedTools,
          effectiveRulesContent: compiled.selectedRules?.map(ruleId => ({ 
            sourceRuleId: ruleId,
            content: "/* Rule content will be resolved by ConversationService */",
            type: "before" as const,
          })),
        },
      };

      console.log(`[WorkflowService] Using ConversationService.submitPrompt for step "${stepName}" (run: ${currentRun.runId})`);
      
      // Use EXISTING ConversationService.submitPrompt (like other parts of the system)
      // This ensures proper system prompt construction, parameter merging, and rule application
      await ConversationService.submitPrompt(turnData);

    } catch (error) {
      const errorMsg = `Failed on step "${stepName}": ${String(error)}`;
      console.error(`%c[WorkflowService] ==> Workflow ERROR for run ${run.runId} at step "${stepName}"`, 'color: #F44336; font-weight: bold;', error);
      interactionStore.appendStreamBuffer(run.mainInteractionId, `\n❌ **Error:** ${errorMsg}`);
      interactionStore._updateInteractionInState(run.mainInteractionId, { status: 'ERROR', endedAt: new Date() });
      interactionStore._removeStreamingId(run.mainInteractionId);
      emitter.emit(workflowEvent.error, { runId: run.runId, error: errorMsg });
    }
  },

  handleInteractionCompleted: (payload: { interactionId: string; status: string; interaction?: Interaction }): void => {
    const { interaction } = payload;
    if (!interaction?.metadata?.isWorkflowStep || !interaction.metadata.workflowRunId) {
      return;
    }

    const { workflowRunId, workflowStepId } = interaction.metadata;
    console.log(`[WorkflowService] handleInteractionCompleted received for run: ${workflowRunId}, step: ${workflowStepId}, status: ${payload.status}`);
    const activeRun = useWorkflowStore.getState().activeRun;

    if (!activeRun) {
      console.warn(`[WorkflowService] Received completed step for run ${workflowRunId}, but no active run in store. Ignoring.`);
      return;
    }
    if (activeRun.runId !== workflowRunId) {
      console.warn(`[WorkflowService] Mismatched run ID. Store has ${activeRun.runId}, completed interaction has ${workflowRunId}. Ignoring.`);
      return;
    }

    if (payload.status === "ERROR" || payload.status === "CANCELLED") {
      const errorMsg = `Step failed with status ${payload.status}. ${interaction.response || ""}`;
      console.error(`%c[WorkflowService] ==> Workflow ERROR for run ${activeRun.runId} due to interaction failure.`, 'color: #F44336; font-weight: bold;', interaction);
      useInteractionStore.getState().appendStreamBuffer(activeRun.mainInteractionId, `\n❌ **Error:** ${errorMsg}`);
      emitter.emit(workflowEvent.error, { runId: activeRun.runId, error: errorMsg });
      return;
    }
    
    // --- HANDLE TRIGGER STEP COMPLETION ---
    if (workflowStepId === 'trigger') {
      const output = interaction.response ?? "No output";
      useInteractionStore.getState().appendStreamBuffer(activeRun.mainInteractionId, `\n✔️ **Finished: Initial User Prompt**`);
      
      // Announce the completion of the 'trigger' step.
      // This will cause the store to save the output and increment the step index to 0.
      // It will also cause _handleStepCompletedAndRunNext to fire, starting the first *real* step.
      emitter.emit(workflowEvent.stepCompleted, { runId: activeRun.runId, stepId: 'trigger', output: output });
      return; // End here for the trigger step.
    }

    // --- HANDLE REGULAR STEP COMPLETION ---
    const stepSpec = activeRun.template.steps.find(s => s.id === workflowStepId);
    if (!stepSpec) {
      console.error(`[WorkflowService] CRITICAL: Could not find step with ID ${workflowStepId} in template for run ${activeRun.runId}.`);
      return;
    }

    let stepOutput: any;
    try {
      stepOutput = WorkflowService._parseStepOutput(interaction, stepSpec);
    } catch (error) {
      // Could not parse structured output, pause for manual correction
      emitter.emit(workflowEvent.paused, { 
        runId: activeRun.runId, 
        step: stepSpec, 
        pauseReason: 'data-correction', 
        rawAssistantResponse: interaction.response 
      });
      return;
    }

    const finalStepName = stepSpec.name || 'Unnamed Step';
    useInteractionStore.getState().appendStreamBuffer(activeRun.mainInteractionId, `\n✔️ **Finished: ${finalStepName}**`);
    
    console.log(`[WorkflowService] Emitting stepCompleted for step "${finalStepName}" in run ${activeRun.runId}`);
    emitter.emit(workflowEvent.stepCompleted, { runId: activeRun.runId, stepId: workflowStepId as string, output: stepOutput });
  },

  handleStepCompleted: (payload: WorkflowEventPayloads[typeof workflowEvent.stepCompleted]): void => {
    const { runId } = payload;
    const activeRun = useWorkflowStore.getState().activeRun;

    if (!activeRun || activeRun.runId !== runId) {
      if (activeRun) console.log(`[WorkflowService] Ignored step completion for run ${runId}, active run is ${activeRun.runId}.`);
      return;
    }
    
    if (activeRun.status === 'RUNNING') {
      console.log(`[WorkflowService] Triggering next step for run ${runId}. Next index: ${activeRun.currentStepIndex + 1}`);
      emitter.emit(workflowEvent.runNextStepRequest, { run: activeRun });
    } else {
      console.log(`[WorkflowService] Workflow ${runId} is no longer RUNNING (current status: ${activeRun.status}). Not triggering next step.`);
    }
  },

  handleWorkflowResumeRequest: async (payload: WorkflowEventPayloads[typeof workflowEvent.resumeRequest]): Promise<void> => {
    console.log("[WorkflowService] Workflow resume request received", payload);
    const { runId, resumeData } = payload;
    const activeRun = useWorkflowStore.getState().activeRun;
    if (!activeRun || activeRun.runId !== runId) {
      console.warn(`[WorkflowService] Cannot resume run ${runId}, it is not the active run.`);
      return;
    }
    const stepSpec = activeRun.template.steps[activeRun.currentStepIndex];
    if (!stepSpec) {
      console.error(`[WorkflowService] Cannot resume run ${runId}, could not find current step spec at index ${activeRun.currentStepIndex}.`);
      return;
    }

    console.log(`[WorkflowService] Emitting stepCompleted for resumed step "${stepSpec.name}" in run ${activeRun.runId}`);
    emitter.emit(workflowEvent.stepCompleted, { runId: activeRun.runId, stepId: stepSpec.id, output: resumeData });
  },
};
