import { emitter } from "@/lib/litechat/event-emitter";
import {
  workflowEvent,
  type WorkflowEventPayloads,
  createWorkflowEventMetadata,
} from "@/types/litechat/events/workflow.events";
import { interactionEvent } from "@/types/litechat/events/interaction.events";
import type { Interaction } from "@/types/litechat/interaction";
import { useWorkflowStore } from "@/store/workflow.store";
import type { WorkflowRun, WorkflowStep } from "@/types/litechat/workflow";
import { WorkflowError } from "@/types/litechat/workflow";
import { nanoid } from "nanoid";
import { compilePromptTemplate } from "@/lib/litechat/prompt-util";
import type { CompiledPrompt } from "@/types/litechat/prompt-template";
import type { PromptTurnObject, PromptObject } from "@/types/litechat/prompt";
import { useInteractionStore } from "@/store/interaction.store";
import { PersistenceService } from "./persistence.service";
import { usePromptStateStore } from "@/store/prompt.store";
import { InteractionService } from "./interaction.service";
import { useProjectStore } from "@/store/project.store";
import { useProviderStore } from "@/store/provider.store";
import { useControlRegistryStore } from "@/store/control.store";
import { useConversationStore } from "@/store/conversation.store";
import type { CoreMessage } from "ai";
import { buildHistoryMessages } from "@/lib/litechat/ai-helpers";
import { WorkflowFlowGenerator } from "@/lib/litechat/workflow-flow-generator";
import type { StepStatus } from "@/types/litechat/flow";

// Flow content manipulation types for better type safety
interface FlowContentUpdate {
  stepId: string;
  status: StepStatus;
  output?: any;
}

interface FlowContentMatch {
  fullMatch: string;
  flowContent: string;
  hasFlow: boolean;
}

// Note: Refactored to a static class to align with other services like InteractionService.
// This service's lifecycle is tied to the application's lifecycle, so event listeners
// are registered once and are not manually unsubscribed.
export const WorkflowService = {
  isInitialized: false,
  activeWorkflowConfig: null as {
    template: any;
    initialPrompt: string;
    conversationId: string;
  } | null,
  flowGenerator: new WorkflowFlowGenerator(),

  // Typed helper methods for flow content manipulation
  _extractFlowContent: (content: string): FlowContentMatch => {
    const flowMatch = content.match(/```flow\n([\s\S]*?)\n```/);
    return {
      fullMatch: flowMatch?.[0] || "",
      flowContent: flowMatch?.[1] || "",
      hasFlow: !!flowMatch,
    };
  },

  _updateFlowInContent: (
    content: string,
    updatedFlowContent: string
  ): string => {
    const flowMatch = WorkflowService._extractFlowContent(content);
    if (flowMatch.hasFlow) {
      return content.replace(
        /```flow\n[\s\S]*?\n```/,
        `\`\`\`flow\n${updatedFlowContent}\n\`\`\``
      );
    }
    return content;
  },

  _updateStepStatusInFlow: (
    content: string,
    update: FlowContentUpdate
  ): string => {
    const flowMatch = WorkflowService._extractFlowContent(content);
    if (flowMatch.hasFlow) {
      const updatedFlowContent = WorkflowService.flowGenerator.updateNodeStatus(
        flowMatch.flowContent,
        update.stepId,
        update.status
      );
      return WorkflowService._updateFlowInContent(content, updatedFlowContent);
    }
    return content;
  },

  _addStepOutputToFlow: (
    content: string,
    stepId: string,
    output: any
  ): string => {
    const flowMatch = WorkflowService._extractFlowContent(content);
    if (flowMatch.hasFlow) {
      const updatedFlowContent = WorkflowService.flowGenerator.addStepOutput(
        flowMatch.flowContent,
        stepId,
        output
      );
      return WorkflowService._updateFlowInContent(content, updatedFlowContent);
    }
    return content;
  },

  _finalizeFlowVisualization: (
    content: string,
    finalOutput: Record<string, any>
  ): string => {
    const flowMatch = WorkflowService._extractFlowContent(content);
    if (flowMatch.hasFlow) {
      const finalizedFlowContent =
        WorkflowService.flowGenerator.finalizeWorkflow(
          flowMatch.flowContent,
          finalOutput
        );
      return WorkflowService._updateFlowInContent(
        content,
        finalizedFlowContent
      );
    }
    return content;
  },

  initialize: () => {
    if (WorkflowService.isInitialized) return;

    // Listen for workflow start requests
    emitter.on(
      workflowEvent.startRequest,
      WorkflowService.handleWorkflowStartRequest
    );

    // Listen for interaction completions to handle step progression
    emitter.on(
      interactionEvent.completed,
      WorkflowService.handleInteractionCompleted
    );

    // Listen for step completion events
    emitter.on(
      workflowEvent.stepCompleted,
      WorkflowService.handleStepCompleted
    );

    // Listen for resume requests
    emitter.on(
      workflowEvent.resumeRequest,
      WorkflowService.handleWorkflowResumeRequest
    );

    WorkflowService.isInitialized = true;
    console.log(
      "[WorkflowService] Initialized - workflows start immediately on request."
    );
  },

  _resolveJsonPath: (obj: any, path: string): any => {
    if (path.startsWith("$.")) path = path.substring(2);

    try {
      return path.split(".").reduce((acc, part) => {
        if (acc === null || acc === undefined) return undefined;
        
        // Handle array indices (including multi-dimensional arrays)
        if (part.includes("[") && part.includes("]")) {
          // Split property name from array indices
          const propMatch = part.match(/^([^[]*)/);
          const prop = propMatch ? propMatch[1] : "";
          
          // Extract all array indices
          const indexMatches = part.match(/\[(\d+)\]/g);
          if (!indexMatches) return undefined;
          
          // Start with the property (if it exists)
          let current = prop ? acc[prop] : acc;
          
          // Apply each array index in sequence
          for (const indexMatch of indexMatches) {
            const indexStr = indexMatch.slice(1, -1); // Remove [ and ]
            const index = parseInt(indexStr, 10);
            if (isNaN(index) || current === null || current === undefined) {
              return undefined;
            }
            current = current[index];
          }
          
          return current;
        }
        
        return acc[part];
      }, obj);
    } catch (error) {
      console.warn(
        `[WorkflowService] JSONPath resolution failed for ${path}:`,
        error
      );
      return undefined;
    }
  },

  /**
   * Validate JSON query strings for transform steps
   */
  _validateJsonQuery: (
    query: string,
    context: Record<string, any>
  ): { isValid: boolean; error?: string; result?: any } => {
    if (!query.trim()) {
      return { isValid: false, error: "Query cannot be empty" };
    }

    // Check for static values first
    if (query.startsWith('"') && query.endsWith('"')) {
      return { isValid: true, result: query.slice(1, -1) }; // Remove quotes
    }

    if (!isNaN(Number(query))) {
      return { isValid: true, result: Number(query) };
    }

    if (query === "true" || query === "false") {
      return { isValid: true, result: query === "true" };
    }

    // Basic JSONPath validation
    if (!query.startsWith("$.")) {
      return {
        isValid: false,
        error:
          'Query must start with "$." or be a static value ("text", number, true/false)',
      };
    }

    // Check for invalid characters or patterns
    const invalidChars = /[^a-zA-Z0-9_.$\[\]]/;
    if (invalidChars.test(query.replace(/\[(\d+)\]/g, ""))) {
      return { isValid: false, error: "Invalid characters in query" };
    }

    // Test the query against the context
    try {
      const result = WorkflowService._resolveJsonPath(context, query);
      return { isValid: true, result };
    } catch (error) {
      return {
        isValid: false,
        error: `Query execution failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  },

  /**
   * Build full context for transform steps including workflow data and all previous outputs
   */
  _buildTransformContext: (
    run: WorkflowRun,
    stepIndex: number
  ): Record<string, any> => {
    // console.log(
    //   `[WorkflowService] Building transform context for stepIndex ${stepIndex}`
    // );
    // console.log(
    //   `[WorkflowService] Available step outputs:`,
    //   Object.keys(run.stepOutputs)
    // );

    // Build outputs array with proper indexing - limit to previous steps only
    const outputs: any[] = [];

    // outputs[0] = trigger output
    if (run.stepOutputs.trigger) {
      outputs[0] = run.stepOutputs.trigger;
      // console.log(
      //   `[WorkflowService] Added trigger output to outputs[0]:`,
      //   outputs[0]
      // );
    }

    // outputs[1] = step0, outputs[2] = step1, etc. - only include completed steps before current step
    for (let i = 0; i < stepIndex; i++) {
      const actualStep = run.template.steps[i];
      if (actualStep && run.stepOutputs[actualStep.id]) {
        outputs[i + 1] = run.stepOutputs[actualStep.id];
        // console.log(
        //   `[WorkflowService] Added step[${i}] (${
        //     actualStep.id
        //   }) output to outputs[${i + 1}]:`,
        //   outputs[i + 1]
        // );
      } else {
        console.warn(
          `[WorkflowService] No output found for step at index ${i} (${actualStep?.id})`
        );
      }
    }

    const context: Record<string, any> = {
      // Keep original workflow template intact - NO TRANSFORMATIONS
      workflow: run.template,
      // Access to initial prompt output
      initial_step: run.stepOutputs.trigger || {},
      // Array-based access to previous step outputs
      outputs: outputs,
    };

      // console.log(
      //   `[WorkflowService] Built context with ${outputs.length} outputs`
      // );
    return context;
  },

  /**
   * Execute transform step - validate queries and apply transformations
   */
  _executeTransformStep: async (
    run: WorkflowRun,
    step: WorkflowStep,
    stepIndex: number
  ): Promise<any> => {
    // console.log(
    //   `[WorkflowService] Executing transform step "${step.name}" at index ${stepIndex}`
    // );

    // Get the next step to determine what fields should be output
    const nextStepIndex = stepIndex + 1;
    const nextStep = run.template.steps[nextStepIndex];

    if (!nextStep) {
      throw new WorkflowError(
        `Transform step "${step.name}" has no following step to provide data for`,
        "STEP_NOT_FOUND",
        { runId: run.runId, stepId: step.id, stepIndex, stepType: "transform" }
      );
    }

    // Some step types don't require templateId (e.g., human-in-the-loop, transform)
    const requiresTemplate = nextStep.type === "prompt" || nextStep.type === "agent-task";
    
    if (requiresTemplate && !nextStep.templateId) {
      throw new WorkflowError(
        `Transform step "${step.name}" has following step "${nextStep.name}" (type: ${nextStep.type}) that requires a template but has no templateId`,
        "TEMPLATE_NOT_FOUND",
        { runId: run.runId, stepId: step.id, stepIndex, stepType: "transform", nextStepType: nextStep.type }
      );
    }

    // Get the required fields from the next step's template - LOAD FRESH FROM DATABASE
    let nextStepTemplate;

    if (nextStep.type === "prompt" || nextStep.type === "agent-task") {
      if (nextStep.templateId) {
        nextStepTemplate = await PersistenceService.loadPromptTemplateById(
          nextStep.templateId
        );
      }
    }

    // Handle cases where next step has no template variables (e.g., human-in-the-loop, transform)
    if (!nextStepTemplate?.variables?.length) {
      console.warn(
        `[WorkflowService] Transform step "${step.name}": Next step "${nextStep.name}" (type: ${nextStep.type}) has no template variables. Passing raw output from previous step.`
      );
      
      // For steps without template variables, pass through the most recent output
      const context = WorkflowService._buildTransformContext(run, stepIndex);
      const previousOutput = context.outputs[context.outputs.length - 1] || context.initial_step;
      
      // console.log(
      //   `[WorkflowService] Transform step "${step.name}" passing through previous output:`,
      //   previousOutput
      // );
      
      return previousOutput;
    }

    // Build context using the new unified method
    const context = WorkflowService._buildTransformContext(run, stepIndex);
    // console.log(
    //   `[WorkflowService] Transform context for step "${step.name}":`,
    //   context
    // );

    // Transform each required field using configured mappings
    const transformedData: Record<string, any> = {};
    const transformMappings = step.transformMappings || {};
    // console.log(
    //   `[WorkflowService] Transform mappings for step "${step.name}":`,
    //   transformMappings
    // );

    for (const variable of nextStepTemplate.variables) {
      const fieldName = variable.name;
      const query = transformMappings[fieldName];

      if (!query) {
        // Field not configured - skip it (partial configuration allowed)
        console.warn(
          `[WorkflowService] Transform step "${step.name}": No mapping configured for field "${fieldName}"`
        );
        continue;
      }

      // console.log(
      //   `[WorkflowService] Processing field "${fieldName}" with query "${query}"`
      // );

      try {
        let value: any;

        // Handle static values
        if (query.startsWith('"') && query.endsWith('"')) {
          value = query.slice(1, -1); // Remove quotes
        } else if (!isNaN(Number(query))) {
          value = Number(query);
        } else if (query === "true" || query === "false") {
          value = query === "true";
        } else if (query.startsWith("$.")) {
          // JSON query
          value = WorkflowService._resolveJsonPath(context, query);
          if (value === undefined) {
            console.warn(
              `[WorkflowService] Transform step "${step.name}": Query "${query}" for field "${fieldName}" returned undefined`
            );
          }
        } else {
          throw new WorkflowError(
            `Invalid query format: "${query}". Must be a JSON path starting with "$." or a static value.`,
            "JSONPATH_INVALID",
            {
              runId: run.runId,
              stepId: step.id,
              stepIndex,
              stepType: "transform",
              query,
            }
          );
        }

        // console.log(
        //   `[WorkflowService] Field "${fieldName}" resolved to:`,
        //   value
        // );
        transformedData[fieldName] = value;
      } catch (error) {
        const workflowError = WorkflowError.fromError(
          error,
          "TRANSFORM_STEP_FAILED",
          {
            runId: run.runId,
            stepId: step.id,
            stepIndex,
            stepType: "transform",
            query,
            expectedFields: [fieldName],
          }
        );
        console.error(
          `[WorkflowService] Transform error for field "${fieldName}":`,
          workflowError
        );
        throw workflowError;
      }
    }

    // console.log(
    //   `[WorkflowService] Transform step "${step.name}" completed with data:`,
    //   transformedData
    // );
    return transformedData;
  },

  _compileStepPrompt: async (
    step: WorkflowStep,
    run: WorkflowRun,
    stepIndex: number
  ): Promise<CompiledPrompt> => {
    if (!step.templateId) {
      throw new WorkflowError(
        `Step "${step.name}" has no templateId specified`,
        "TEMPLATE_NOT_FOUND",
        { runId: run.runId, stepId: step.id, stepIndex, stepType: step.type }
      );
    }

    // Load template fresh from database instead of stale store
    const template = await PersistenceService.loadPromptTemplateById(
      step.templateId
    );
    if (!template) {
      throw new WorkflowError(
        `Template "${step.templateId}" not found for step "${step.name}"`,
        "TEMPLATE_NOT_FOUND",
        {
          runId: run.runId,
          stepId: step.id,
          stepIndex,
          stepType: step.type,
          templateId: step.templateId,
        }
      );
    }

    // Get the immediate previous step output from run.stepOutputs
    let formData: Record<string, any> = {};

    if (stepIndex === 0) {
      // First step uses trigger output
      formData = run.stepOutputs.trigger || {};
    } else {
      // Find the actual previous step ID from the template
      const previousStepIndex = stepIndex - 1;
      const previousStep = run.template.steps[previousStepIndex];
      if (previousStep && run.stepOutputs[previousStep.id]) {
        formData = run.stepOutputs[previousStep.id];
      } else {
        console.warn(
          `[WorkflowService] No output found for previous step at index ${previousStepIndex}`
        );
      }
    }

    // console.log(
    //   `[WorkflowService] Compiling template "${template.name}" for step "${step.name}" with data:`,
    //   formData
    // );

    try {
      return await compilePromptTemplate(template, formData);
    } catch (error) {
      throw WorkflowError.fromError(error, "TEMPLATE_COMPILATION_FAILED", {
        runId: run.runId,
        stepId: step.id,
        stepIndex,
        stepType: step.type,
        templateId: step.templateId,
      });
    }
  },

  _parseStepOutput: (interaction: Interaction, step: WorkflowStep): any => {
    if (!step.structuredOutput) {
      return interaction.response || "No output";
    }

    // Try to parse structured output
    if (interaction.metadata?.toolCalls?.length) {
      try {
        const toolCall = JSON.parse(interaction.metadata.toolCalls[0]);
        if (
          toolCall.toolName === "structured_output" ||
          toolCall.name === "structured_output"
        ) {
          return toolCall.arguments || toolCall.args;
        }
      } catch (e) {
        /* continue to text parsing */
      }
    }

    // Parse JSON from response
    try {
      const jsonRegex = /```json\s*([\s\S]*?)\s*```/;
      const match = (interaction.response ?? "").match(jsonRegex);
      if (match?.[1]) {
        return JSON.parse(match[1]);
      }
      return JSON.parse(interaction.response ?? "{}");
    } catch (e) {
      throw new Error("Could not parse structured output from response");
    }
  },

  handleWorkflowStartRequest: async (
    payload: WorkflowEventPayloads[typeof workflowEvent.startRequest]
  ): Promise<void> => {
    console.log("[WorkflowService] Workflow start request received", payload);
    const { template, initialPrompt, conversationId } = payload;

    if (!conversationId) {
      throw new WorkflowError(
        "No conversation ID provided for workflow start",
        "CONVERSATION_NOT_FOUND",
        { templateId: template?.id }
      );
    }

    if (!template) {
      throw new WorkflowError(
        "No workflow template provided",
        "WORKFLOW_NOT_FOUND"
      );
    }

    if (!template.steps || template.steps.length === 0) {
      throw new WorkflowError(
        `Workflow "${template.name}" has no steps defined`,
        "WORKFLOW_NOT_FOUND",
        { templateId: template.id }
      );
    }

    // DEBUG: Log template details
    // console.log("[WorkflowService] Template details:", {
    //   name: template.name,
    //   stepsCount: template.steps?.length || 0,
    //   steps:
    //     template.steps?.map((s: any) => ({
    //       id: s.id,
    //       name: s.name,
    //       type: s.type,
    //       templateId: s.templateId,
    //     })) || [],
    // });

    // Start the workflow immediately using the provided initial prompt
    // No need to wait for middleware interception like race system
    console.log(
      "[WorkflowService] Starting workflow immediately with initial prompt"
    );

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

    await WorkflowService.handleWorkflowConversion(
      promptObject,
      conversationId,
      { template, initialPrompt, conversationId }
    );
  },

  // Main workflow conversion handler (equivalent to handleRaceConversion)
  handleWorkflowConversion: async (
    prompt: PromptObject,
    conversationId: string,
    workflowConfig: {
      template: any;
      initialPrompt: string;
      conversationId: string;
    }
  ): Promise<void> => {
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
          .filter((part) => part.type === "text")
          .map((part) => (part as any).text)
          .join("");
      }

      // Create base turn data (like race system)
      const baseTurnData: PromptTurnObject = {
        id: "", // Will be set per interaction
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
      const newIndex =
        conversationInteractions.reduce(
          (max: number, i: Interaction) => Math.max(max, i.index),
          -1
        ) + 1;

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
          },
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

      // Add to state and persistence WITHOUT starting an AI call for it (like race system)
      interactionStore._addInteractionToState(mainInteraction);
      interactionStore._addStreamingId(mainInteraction.id);

      // Set initial content in stream buffer (will be updated with flow content after run is created)
      interactionStore.setActiveStreamBuffer(
        mainInteraction.id,
        `# ${template.name}\n\nWorkflow starting with ${
          template.steps.length
        } step${template.steps.length > 1 ? "s" : ""}...`
      );

      await PersistenceService.saveInteraction(mainInteraction);

      // Manually emit events (like race system)
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
      const initialFlowContent =
        WorkflowService.flowGenerator.generateInitialFlow(run);
      console.log(`[WorkflowService] Generated initial flow content:`, {
        flowContentLength: initialFlowContent.length,
        flowContentPreview:
          initialFlowContent.substring(0, 200) +
          (initialFlowContent.length > 200 ? "..." : ""),
      });

      const fullContent = `# ${template.name}\n\nWorkflow starting with ${
        template.steps.length
      } step${
        template.steps.length > 1 ? "s" : ""
      }...\n\n\`\`\`flow\n${initialFlowContent}\n\`\`\``;
      console.log(
        `[WorkflowService] Setting stream buffer with full content:`,
        {
          fullContentLength: fullContent.length,
          mainInteractionId: mainInteraction.id,
        }
      );

      interactionStore.setActiveStreamBuffer(mainInteraction.id, fullContent);

      // Keep main interaction streaming throughout (like race system)
      // Main interaction receives manual updates via setActiveStreamBuffer during child completion

      // Start the trigger step as first child (like race system)
      await WorkflowService.createTriggerStep(
        mainInteraction,
        run,
        baseTurnData
      );

      // Emit workflow started event
      emitter.emit(workflowEvent.started, {
        run,
        metadata: createWorkflowEventMetadata(run.runId, "high", 1),
      });
    } catch (error) {
      console.error(
        `[WorkflowService] Error during workflow conversion:`,
        error
      );
    }
  },

  // Create trigger step as child interaction (like race children)
  createTriggerStep: async (
    mainInteraction: Interaction,
    run: WorkflowRun,
    baseTurnData: PromptTurnObject
  ): Promise<void> => {
    try {
      // Build structured output schema based on what step 0 needs
      const nextStep = run.template.steps[0];
      const triggerParameters = { ...baseTurnData.parameters };

      // Only add structured output constraints if the NEXT step is not a transform step
      // Transform steps can handle any input format through JSON queries
      if (
        nextStep &&
        nextStep.type !== "transform" &&
        nextStep.type !== "human-in-the-loop"
      ) {
        if (nextStep.templateId) {
          // Load fresh template from database instead of stale store
          const nextStepTemplate = await PersistenceService.loadPromptTemplateById(nextStep.templateId);

          if (
            nextStepTemplate &&
            nextStepTemplate.variables &&
            nextStepTemplate.variables.length > 0
          ) {
            // Build structured output schema for the variables step 0 needs
            const { schema } = WorkflowService._createStructuredOutputSchema(
              nextStepTemplate.variables
            );

            triggerParameters.structured_output = schema;
            console.log(
              `[WorkflowService] Trigger step will output structured data for step "${nextStep.name}" variables:`,
              nextStepTemplate.variables.map((v) => v.name)
            );
          }
        } else if (nextStep.structuredOutput) {
          // Fallback to step's own structured output if defined
          triggerParameters.structured_output =
            nextStep.structuredOutput.jsonSchema;
          console.log(
            `[WorkflowService] Trigger step will output structured data for next step: ${nextStep.name}`
          );
        }
      } else if (nextStep?.type === "transform") {
        console.log(
          `[WorkflowService] Trigger step will output free-form data for transform step "${nextStep.name}" - no format constraints`
        );
      }

      // console.log(
      //   `[WorkflowService] Creating initial step as child tab for run ${run.runId}`
      // );

      // Create unique turnData for initial step child (like race system)
      const initialStepTurnData: PromptTurnObject = {
        ...baseTurnData,
        id: nanoid(),
        parameters: triggerParameters,
        metadata: {
          ...baseTurnData.metadata,
          modelId:
            baseTurnData.metadata?.modelId ||
            usePromptStateStore.getState().modelId,
          isWorkflowStep: true,
          workflowRunId: run.runId,
          workflowStepId: "trigger",
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
        const currentConversation = conversationStoreState.getConversationById(
          run.conversationId
        );
        const currentProjectId = currentConversation?.projectId ?? null;
        const effectiveSettings =
          projectStoreState.getEffectiveProjectSettings(currentProjectId);
        const globalSystemPrompt =
          effectiveSettings.systemPrompt || "You are a helpful AI assistant.";

        // Get the proper specification for this step
        const nextStepTemplate = await PersistenceService.loadPromptTemplateById(nextStep.templateId);

        if (
          nextStepTemplate &&
          nextStepTemplate.variables &&
          nextStepTemplate.variables.length > 0
        ) {
          const { specification } =
            WorkflowService._createStructuredOutputSchema(
              nextStepTemplate.variables
            );

          initialStepTurnData.metadata.turnSystemPrompt = `${globalSystemPrompt}

You are part of a workflow system. ${specification}`;
        } else {
          initialStepTurnData.metadata.turnSystemPrompt = `${globalSystemPrompt}

You are part of a workflow system. You ABSOLUTELY MUST respect the following output format when answering to not break the workflow:

${JSON.stringify(triggerParameters.structured_output, null, 2)}`;
        }
      }

      // Build complete prompt object with all controls (like race system)
      const { promptObject: initialStepPrompt } =
        await WorkflowService.buildCompletePromptObject(
          run.conversationId,
          baseTurnData.content,
          initialStepTurnData
        );

      // Create child prompt for this specific model (like race system)
      const childPrompt: PromptObject = {
        ...initialStepPrompt,
        metadata: {
          ...initialStepPrompt.metadata,
          modelId: initialStepTurnData.metadata.modelId,
        },
      };

      const initialStepInteraction = await InteractionService.startInteraction(
        childPrompt,
        run.conversationId,
        initialStepTurnData,
        "message.user_assistant"
      );

      if (initialStepInteraction) {
        // Set as child of main interaction (like race system)
        const updates: Partial<Omit<Interaction, "id">> = {
          parentId: mainInteraction.id,
          index: 0, // Tab index for initial step
        };

        const interactionStore = useInteractionStore.getState();
        interactionStore._updateInteractionInState(
          initialStepInteraction.id,
          updates
        );
        await PersistenceService.saveInteraction({
          ...initialStepInteraction,
          ...updates,
        } as Interaction);

        console.log(
          `[WorkflowService] Initial step created as child ${initialStepInteraction.id} of main ${mainInteraction.id}`
        );
      } else {
        throw new WorkflowError(
          `Failed to create initial step interaction`,
          "STEP_CREATION_FAILED",
          {
            runId: run.runId,
            stepType: "trigger",
          }
        );
      }
    } catch (error) {
      const workflowError = WorkflowError.fromError(
        error,
        "TRIGGER_STEP_FAILED",
        {
          runId: run.runId,
        }
      );
      console.error(
        `[WorkflowService] ${workflowError.message}:`,
        workflowError
      );

      // Emit error event for proper handling
      emitter.emit(workflowEvent.error, {
        runId: run.runId,
        error: workflowError.message,
      });

      throw workflowError;
    }
  },

  // Create regular workflow step as child interaction (like race children)
  createWorkflowStep: async (
    run: WorkflowRun,
    stepIndex: number
  ): Promise<void> => {
    try {
      const step = run.template.steps[stepIndex];
      if (!step) {
        throw new WorkflowError(
          `Step at index ${stepIndex} not found`,
          "STEP_NOT_FOUND",
          { runId: run.runId, stepIndex }
        );
      }

      const stepName = step.name || `Step ${stepIndex + 1}`;
      // console.log(
      //   `[WorkflowService] Creating step "${stepName}" as child tab for run ${run.runId}`
      // );

      // Emit step starting event for UI preparation
      emitter.emit(workflowEvent.stepStarting, {
        runId: run.runId,
        step,
        stepIndex,
        metadata: createWorkflowEventMetadata(
          run.runId,
          "normal",
          stepIndex + 2
        ),
      });

      // Update main interaction progress
      const interactionStore = useInteractionStore.getState();

      // Update flow content with step status using typed helper
      const currentContent =
        interactionStore.activeStreamBuffers[run.mainInteractionId] || "";
      const updatedContent = WorkflowService._updateStepStatusInFlow(
        currentContent,
        {
          stepId: step.id,
          status: "running",
        }
      );

      if (updatedContent !== currentContent) {
        interactionStore.setActiveStreamBuffer(
          run.mainInteractionId,
          updatedContent
        );
      } else {
        interactionStore.appendStreamBuffer(
          run.mainInteractionId,
          `\n\n---\n▶️ **Executing: ${stepName}**`
        );
      }

      if (step.type === "human-in-the-loop") {
        interactionStore.appendStreamBuffer(
          run.mainInteractionId,
          `\n⏸️ **Paused:** ${
            step.instructionsForHuman || "Requires human input."
          }`
        );
        interactionStore._updateInteractionInState(run.mainInteractionId, {
          status: "AWAITING_INPUT",
        });
        interactionStore._removeStreamingId(run.mainInteractionId);
        emitter.emit(workflowEvent.paused, {
          runId: run.runId,
          step,
          pauseReason: "human-in-the-loop",
          dataForReview: run.stepOutputs,
          metadata: createWorkflowEventMetadata(
            run.runId,
            "normal",
            stepIndex + 10
          ),
        });
        return;
      }

      if (step.type === "transform") {
        try {
          // Execute transform step synchronously (no AI call needed)
          const transformOutput = await WorkflowService._executeTransformStep(
            run,
            step,
            stepIndex
          );

          // Update flow content for completed transform
          const currentContent =
            interactionStore.activeStreamBuffers[run.mainInteractionId] || "";
          const updatedContent = WorkflowService._updateStepStatusInFlow(
            currentContent,
            {
              stepId: step.id,
              status: "success",
            }
          );

          if (updatedContent !== currentContent) {
            interactionStore.setActiveStreamBuffer(
              run.mainInteractionId,
              updatedContent
            );
          } else {
            interactionStore.appendStreamBuffer(
              run.mainInteractionId,
              `\n✔️ **Completed: ${stepName}** - Data transformed`
            );
          }

          // Emit step completion directly (no interaction to wait for)
          emitter.emit(workflowEvent.stepCompleted, {
            runId: run.runId,
            stepId: step.id,
            output: transformOutput,
            metadata: createWorkflowEventMetadata(
              run.runId,
              "normal",
              stepIndex + 20
            ),
          });
          return;
        } catch (error) {
          const workflowError = WorkflowError.fromError(
            error,
            "TRANSFORM_STEP_FAILED",
            {
              runId: run.runId,
              stepId: step.id,
              stepIndex,
              stepType: "transform",
            }
          );
          console.error(
            `[WorkflowService] ${workflowError.message}:`,
            workflowError
          );

          // Update flow content for failed transform
          const currentContent =
            interactionStore.activeStreamBuffers[run.mainInteractionId] || "";
          const updatedContent = WorkflowService._updateStepStatusInFlow(
            currentContent,
            {
              stepId: step.id,
              status: "error",
            }
          );

          if (updatedContent !== currentContent) {
            interactionStore.setActiveStreamBuffer(
              run.mainInteractionId,
              updatedContent
            );
          } else {
            interactionStore.appendStreamBuffer(
              run.mainInteractionId,
              `\n❌ **Error in ${stepName}:** ${workflowError.getUserMessage()}`
            );
          }

          // Update the main interaction response with error
          const errorUpdates = {
            response: `❌ **Workflow Error**\n\nTransform step "${stepName}" failed: ${workflowError.getUserMessage()}`,
            status: "ERROR" as const,
            endedAt: new Date(),
          };
          interactionStore._updateInteractionInState(
            run.mainInteractionId,
            errorUpdates
          );
          interactionStore._removeStreamingId(run.mainInteractionId);

          // Save to persistence
          const errorMainInteraction = interactionStore.interactions.find(
            (i) => i.id === run.mainInteractionId
          );
          if (errorMainInteraction) {
            PersistenceService.saveInteraction({
              ...errorMainInteraction,
              ...errorUpdates,
            } as Interaction).catch(console.error);
          }

          emitter.emit(workflowEvent.error, {
            runId: run.runId,
            error: workflowError.getUserMessage(),
          });
          return;
        }
      }

      // Validate model availability if specified
      if (step.modelId) {
        const providerState = useProviderStore.getState();
        const availableModels =
          providerState.getGloballyEnabledModelDefinitions();
        const isModelAvailable = availableModels.some(
          (model: any) => model.id === step.modelId
        );

        if (!isModelAvailable) {
          throw new WorkflowError(
            `Model "${step.modelId}" is not available or enabled`,
            "MODEL_NOT_AVAILABLE",
            {
              runId: run.runId,
              stepId: step.id,
              stepIndex,
              stepType: step.type,
              modelId: step.modelId,
            }
          );
        }
      }

      // Compile step prompt
      const compiled = await WorkflowService._compileStepPrompt(
        step,
        run,
        stepIndex
      );
      const modelId = step.modelId ?? usePromptStateStore.getState().modelId;

      if (!modelId) {
        throw new Error(
          `Could not determine a valid AI model ID for step "${stepName}".`
        );
      }

      console.log(`[WorkflowService] Step "${stepName}" configuration:`, {
        modelId,
        hasStructuredOutput: !!step.structuredOutput,
        structuredOutputSchema: step.structuredOutput?.schema,
        enabledTools: compiled.selectedTools?.length || 0,
        selectedRules: compiled.selectedRules?.length || 0,
      });

      // Template details will be handled by buildCompletePromptObject

      // Add structured output schema for the NEXT step if it exists and is not a transform step
      const nextStepIndex = stepIndex + 1;
      const nextStep = run.template.steps[nextStepIndex];
      const stepParameters: Record<string, any> = {};

      // Only add structured output constraints if the NEXT step is not a transform step
      // Transform steps can handle any input format through JSON queries
      if (
        nextStep &&
        nextStep.type !== "transform" &&
        nextStep.type !== "human-in-the-loop"
      ) {
        if (nextStep.templateId) {
          // Load fresh template from database instead of stale store
          const nextStepTemplate = await PersistenceService.loadPromptTemplateById(nextStep.templateId);

          if (
            nextStepTemplate &&
            nextStepTemplate.variables &&
            nextStepTemplate.variables.length > 0
          ) {
            // Build structured output schema for the variables the NEXT step needs
            const { schema, specification } =
              WorkflowService._createStructuredOutputSchema(
                nextStepTemplate.variables
              );

            stepParameters.structured_output = schema;
            console.log(
              `[WorkflowService] Step "${stepName}" will output structured data for next step "${nextStep.name}" variables:`,
              nextStepTemplate.variables.map((v) => v.name)
            );

            // Store the specification for the system prompt
            stepParameters.outputSpecification = specification;
          }
        } else if (nextStep.structuredOutput) {
          // Fallback to step's own structured output if defined
          stepParameters.structured_output =
            nextStep.structuredOutput.jsonSchema;
          console.log(
            `[WorkflowService] Step "${stepName}" will output structured data for next step: ${nextStep.name}`
          );
        }
      } else if (nextStep?.type === "transform") {
        console.log(
          `[WorkflowService] Step "${stepName}" will output free-form data for transform step "${nextStep.name}" - no format constraints`
        );
      }

      // Create step turn data with step-specific configuration (like race system)
      const stepTurnData: PromptTurnObject = {
        id: nanoid(),
        content: compiled.content,
        parameters: stepParameters,
        metadata: {
          modelId, // Step-specific model ID override
          isWorkflowStep: true,
          workflowRunId: run.runId,
          workflowStepId: step.id,
          workflowMainInteractionId: run.mainInteractionId,
          workflowTab: true,
          workflowStepIndex: stepIndex + 1, // Tab index (0 is trigger, 1+ are steps)
          enabledTools: compiled.selectedTools,
          effectiveRulesContent: compiled.selectedRules?.map((ruleId) => ({
            sourceRuleId: ruleId,
            content: "/* Rule content will be resolved */",
            type: "before" as const,
          })),
        },
      };

      // Each step uses its OWN template's system prompt + workflow output format for the NEXT step
      if (stepParameters.structured_output) {
        // Load fresh template from database instead of stale store
        const currentStepTemplate = step.templateId ? 
          await PersistenceService.loadPromptTemplateById(step.templateId) : null;

        if (currentStepTemplate) {
          // Get the global system prompt from project settings
          const conversationStoreState = useConversationStore.getState();
          const projectStoreState = useProjectStore.getState();
          const currentConversation =
            conversationStoreState.getConversationById(run.conversationId);
          const currentProjectId = currentConversation?.projectId ?? null;
          const effectiveSettings =
            projectStoreState.getEffectiveProjectSettings(currentProjectId);
          const globalSystemPrompt =
            effectiveSettings.systemPrompt || "You are a helpful AI assistant.";

          const templateSystemPrompt = currentStepTemplate.prompt || "";
          const baseSystemPrompt = templateSystemPrompt
            ? `${globalSystemPrompt}\n\n${templateSystemPrompt}`
            : globalSystemPrompt;

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

      // Build complete step prompt with all controls (like race system)
      const { promptObject: stepPrompt } =
        await WorkflowService.buildCompletePromptObject(
          run.conversationId,
          compiled.content,
          stepTurnData
        );

      // Create child prompt for this specific model (like race system)
      const childPrompt: PromptObject = {
        ...stepPrompt,
        metadata: {
          ...stepPrompt.metadata,
          modelId: stepTurnData.metadata.modelId,
        },
      };

      const stepInteraction = await InteractionService.startInteraction(
        childPrompt,
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

        // console.log(
        //   `[WorkflowService] Step "${stepName}" created as child ${stepInteraction.id} of main ${run.mainInteractionId}`
        // );
      }
    } catch (error) {
      console.error(
        `[WorkflowService] Error creating step ${stepIndex}:`,
        error
      );
      const errorMsg = error instanceof Error ? error.message : String(error);
      const interactionStore = useInteractionStore.getState();

      // Update the main interaction response (like RacePromptControlModule does)
      const errorUpdates = {
        response: `❌ **Workflow Error**\n\nFailed to create step ${
          stepIndex + 1
        }: ${errorMsg}`,
        status: "ERROR" as const,
        endedAt: new Date(),
      };
      interactionStore._updateInteractionInState(
        run.mainInteractionId,
        errorUpdates
      );
      interactionStore._removeStreamingId(run.mainInteractionId);

      // Save to persistence (like RacePromptControlModule does)
      const errorMainInteraction = interactionStore.interactions.find(
        (i) => i.id === run.mainInteractionId
      );
      if (errorMainInteraction) {
        PersistenceService.saveInteraction({
          ...errorMainInteraction,
          ...errorUpdates,
        } as Interaction).catch(console.error);
      }
      emitter.emit(workflowEvent.error, { runId: run.runId, error: errorMsg });
    }
  },

  handleInteractionCompleted: (payload: {
    interactionId: string;
    status: string;
    interaction?: Interaction;
  }): void => {
    const { interaction } = payload;
    if (
      !interaction?.metadata?.isWorkflowStep ||
      !interaction.metadata.workflowRunId
    ) {
      return;
    }

    // Wait for interaction to be fully finalized before processing output
    setTimeout(() => {
      const { workflowRunId, workflowStepId } = interaction.metadata;
      // console.log(
      //   `[WorkflowService] Step completed for run: ${workflowRunId}, step: ${workflowStepId}, status: ${payload.status}`
      // );

      const activeRun = useWorkflowStore.getState().activeRun;
      if (!activeRun || activeRun.runId !== workflowRunId) {
        console.warn(
          `[WorkflowService] Mismatched or no active run for ${workflowRunId}`
        );
        return;
      }

      if (payload.status === "ERROR" || payload.status === "CANCELLED") {
        const errorMsg = `Step failed with status ${payload.status}. ${
          interaction.response || ""
        }`;
        console.error(
          `[WorkflowService] Step error for run ${activeRun.runId}:`,
          errorMsg
        );
        useInteractionStore
          .getState()
          .appendStreamBuffer(
            activeRun.mainInteractionId,
            `\n❌ **Error:** ${errorMsg}`
          );
        emitter.emit(workflowEvent.error, {
          runId: activeRun.runId,
          error: errorMsg,
        });
        return;
      }

      // Handle trigger step completion
      if (workflowStepId === "trigger") {
        // For trigger step, check if next step is transform to determine output format
        let triggerOutput: any;

        const firstStep = activeRun.template.steps[0];
        const isNextStepTransform = firstStep?.type === "transform";

        if (isNextStepTransform) {
          // Transform steps expect free-form data, so use raw response
          console.log(
            `[WorkflowService] Trigger step output will be free-form for transform step "${firstStep.name}"`
          );
          triggerOutput = interaction.response ?? "No output";
        } else {
          // Try to parse structured output from the initial step response
          try {
            // Create a fake step with structured output to use the parser
            const fakeStep = {
              structuredOutput: { jsonSchema: {} },
            } as WorkflowStep;
            triggerOutput = WorkflowService._parseStepOutput(
              interaction,
              fakeStep
            );
          } catch (error) {
            console.warn(
              `[WorkflowService] Initial step structured output parsing failed:`,
              error
            );
            // Fallback: use raw response
            triggerOutput = interaction.response ?? "No output";
          }
        }

        // Update flow content for completed initial step
        const interactionStore = useInteractionStore.getState();
        const currentContent =
          interactionStore.activeStreamBuffers[activeRun.mainInteractionId] ||
          "";
        const flowMatch = currentContent.match(/```flow\n([\s\S]*?)\n```/);
        if (flowMatch && flowMatch[1]) {
          const updatedFlowContent =
            WorkflowService.flowGenerator.updateNodeStatus(
              flowMatch[1],
              "initial",
              "success"
            );
          const newContent = currentContent.replace(
            /```flow\n[\s\S]*?\n```/,
            `\`\`\`flow\n${updatedFlowContent}\n\`\`\``
          );
          // Update stream buffer directly (main stays streaming like race system)
          interactionStore.setActiveStreamBuffer(
            activeRun.mainInteractionId,
            newContent
          );
        } else {
          // Append progress directly to stream buffer
          interactionStore.appendStreamBuffer(
            activeRun.mainInteractionId,
            `\n✔️ **Finished: Initial User Prompt**`
          );
        }

        emitter.emit(workflowEvent.stepCompleted, {
          runId: activeRun.runId,
          stepId: "trigger",
          output: triggerOutput,
        });
        return;
      }

      // Handle regular step completion
      const stepSpec = activeRun.template.steps.find(
        (s: any) => s.id === workflowStepId
      );
      if (!stepSpec) {
        console.error(
          `[WorkflowService] Could not find step ${workflowStepId} in template`
        );
        return;
      }

      let stepOutput: any;
      try {
        stepOutput = WorkflowService._parseStepOutput(interaction, stepSpec);
      } catch (error) {
        emitter.emit(workflowEvent.paused, {
          runId: activeRun.runId,
          step: stepSpec,
          pauseReason: "data-correction",
          rawAssistantResponse: interaction.response,
        });
        return;
      }

      // Update flow content for completed step
      const interactionStore = useInteractionStore.getState();
      const currentContent =
        interactionStore.activeStreamBuffers[activeRun.mainInteractionId] || "";
      const flowMatch = currentContent.match(/```flow\n([\s\S]*?)\n```/);
      if (flowMatch && flowMatch[1]) {
        const updatedFlowContent =
          WorkflowService.flowGenerator.updateNodeStatus(
            flowMatch[1],
            workflowStepId as string,
            "success"
          );
        const newContent = currentContent.replace(
          /```flow\n[\s\S]*?\n```/,
          `\`\`\`flow\n${updatedFlowContent}\n\`\`\``
        );
        // Update stream buffer directly (main stays streaming like race system)
        interactionStore.setActiveStreamBuffer(
          activeRun.mainInteractionId,
          newContent
        );
      } else {
        const finalStepName = stepSpec.name || "Unnamed Step";
        // Append progress directly to stream buffer
        interactionStore.appendStreamBuffer(
          activeRun.mainInteractionId,
          `\n✔️ **Finished: ${finalStepName}**`
        );
      }

      emitter.emit(workflowEvent.stepCompleted, {
        runId: activeRun.runId,
        stepId: workflowStepId as string,
        output: stepOutput,
      });
    }, 100); // 100ms delay to ensure interaction is fully finalized
  },

  handleStepCompleted: (
    payload: WorkflowEventPayloads[typeof workflowEvent.stepCompleted]
  ): void => {
    const { runId } = payload;

    // Wait for store to process step completion
    setTimeout(() => {
      const activeRun = useWorkflowStore.getState().activeRun;
      if (
        !activeRun ||
        activeRun.runId !== runId ||
        activeRun.status !== "RUNNING"
      ) {
        console.log(
          `[WorkflowService] Step completion ignored - no active run or status changed`
        );
        return;
      }

      // DEBUG: Log step progression details
      // console.log(
      //   `[WorkflowService] Step completed: ${stepId}, currentStepIndex: ${activeRun.currentStepIndex}, totalSteps: ${activeRun.template.steps.length}`
      // );

      // Check if workflow is complete (currentStepIndex now points to completed steps)
      if (activeRun.currentStepIndex >= activeRun.template.steps.length) {
        const interactionStore = useInteractionStore.getState();

        // Format workflow completion as markdown with input and all step outputs
        const mainInteraction = interactionStore.interactions.find(
          (i) => i.id === activeRun.mainInteractionId
        );
        const originalInput = mainInteraction?.prompt?.content || "No input";

        // Build markdown summary
        let markdownSummary = `# ${activeRun.template.name}\n\n`;
        markdownSummary += `**Original Input:** ${originalInput}\n\n`;
        markdownSummary += `---\n\n`;

        // Add each step's output (excluding transform steps)
        Object.entries(activeRun.stepOutputs).forEach(([stepKey, output]) => {
          if (stepKey === "trigger") {
            markdownSummary += `## Initial Processing\n\n`;
          } else {
            // Find the actual step definition to check its type
            const stepDefinition = activeRun.template.steps.find(
              (step: any) => step.id === stepKey
            );

            // Skip transform steps - they don't generate user-visible content
            if (stepDefinition?.type === "transform") {
              return;
            }

            const stepName = stepDefinition?.name || stepKey;
            markdownSummary += `## ${stepName}\n\n`;
          }

          if (typeof output === "object" && output !== null) {
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
        const currentContent =
          interactionStore.activeStreamBuffers[activeRun.mainInteractionId] ||
          "";
        const flowMatch = currentContent.match(/```flow\n([\s\S]*?)\n```/);
        let finalContent = markdownSummary;

        if (flowMatch && flowMatch[1]) {
          const finalizedFlowContent =
            WorkflowService.flowGenerator.finalizeWorkflow(
              flowMatch[1],
              activeRun.stepOutputs
            );
          finalContent = currentContent
            .replace(
              /```flow\n[\s\S]*?\n```/,
              `\`\`\`flow\n${finalizedFlowContent}\n\`\`\``
            )
            .replace(
              /Workflow starting with.*?\.\.\./,
              `✅ **Workflow completed successfully**\n\n**Summary:**\n${markdownSummary}`
            );
        }

        // Update the main interaction response (like RacePromptControlModule does)
        const completionUpdates = {
          response: finalContent,
          status: "COMPLETED" as const,
          endedAt: new Date(),
        };
        interactionStore._updateInteractionInState(
          activeRun.mainInteractionId,
          completionUpdates
        );
        interactionStore._removeStreamingId(activeRun.mainInteractionId);

        // Save to persistence (like RacePromptControlModule does)
        const completionMainInteraction = interactionStore.interactions.find(
          (i) => i.id === activeRun.mainInteractionId
        );
        if (completionMainInteraction) {
          PersistenceService.saveInteraction({
            ...completionMainInteraction,
            ...completionUpdates,
          } as Interaction).catch(console.error);
        }

        emitter.emit(workflowEvent.completed, {
          runId: activeRun.runId,
          finalOutput: activeRun.stepOutputs,
        });
        console.log(`[WorkflowService] Workflow completed: ${runId}`);
        return;
      }

      // Create current step (store has already incremented currentStepIndex)
      // console.log(
      //   `[WorkflowService] Creating current step ${activeRun.currentStepIndex} for run ${runId}`
      // );
      WorkflowService.createWorkflowStep(activeRun, activeRun.currentStepIndex);
    }, 0);
  },

  handleWorkflowResumeRequest: async (
    payload: WorkflowEventPayloads[typeof workflowEvent.resumeRequest]
  ): Promise<void> => {
    console.log("[WorkflowService] Workflow resume request received", payload);
    const { runId, resumeData } = payload;
    const activeRun = useWorkflowStore.getState().activeRun;
    if (!activeRun || activeRun.runId !== runId) {
      console.warn(`[WorkflowService] Cannot resume run ${runId}, not active`);
      return;
    }

    const stepSpec = activeRun.template.steps[activeRun.currentStepIndex];
    if (!stepSpec) {
      console.error(
        `[WorkflowService] Cannot resume, no step at index ${activeRun.currentStepIndex}`
      );
      return;
    }

    emitter.emit(workflowEvent.stepCompleted, {
      runId: activeRun.runId,
      stepId: stepSpec.id,
      output: resumeData,
    });
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
    const currentConversation =
      conversationStoreState.getConversationById(conversationId);
    const currentProjectId = currentConversation?.projectId ?? null;
    const effectiveSettings =
      projectStoreState.getEffectiveProjectSettings(currentProjectId);

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
      .filter(
        (i) =>
          i.conversationId === conversationId &&
          i.parentId === null &&
          i.status === "COMPLETED"
      )
      .sort((a, b) => a.index - b.index);

    const turnsForHistoryBuilder: Interaction[] = activeInteractionsOnSpine
      .map((activeInteraction) => {
        if (
          activeInteraction.type === "message.assistant_regen" &&
          activeInteraction.metadata?.regeneratedFromId
        ) {
          const originalInteraction = interactionStoreState.interactions.find(
            (orig) => orig.id === activeInteraction.metadata!.regeneratedFromId
          );
          if (
            originalInteraction &&
            originalInteraction.prompt &&
            originalInteraction.type === "message.user_assistant"
          ) {
            return {
              ...activeInteraction,
              prompt: originalInteraction.prompt,
              type: "message.user_assistant",
            } as Interaction;
          }
        }
        if (
          activeInteraction.type === "message.user_assistant" &&
          activeInteraction.prompt
        ) {
          return activeInteraction;
        }
        return null;
      })
      .filter(Boolean) as Interaction[];

    const historyMessages: CoreMessage[] = buildHistoryMessages(
      turnsForHistoryBuilder
    );

    // Add current user message
    historyMessages.push({ role: "user", content: userContent });

    // Build system prompt with rules if any
    const turnSystemPrompt = metadata?.turnSystemPrompt as string | undefined;
    let baseSystemPrompt =
      turnSystemPrompt ?? effectiveSettings.systemPrompt ?? undefined;

    const effectiveRulesContent = metadata?.effectiveRulesContent ?? [];
    const systemRulesContent = effectiveRulesContent
      .filter((r: any) => r.type === "system")
      .map((r: any) => r.content);

    if (systemRulesContent.length > 0) {
      baseSystemPrompt = `${
        baseSystemPrompt ? `${baseSystemPrompt}\n\n` : ""
      }${systemRulesContent.join("\n")}`;
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
    // console.log(`[WorkflowService] Building prompt parameters:`, {
    //   promptStateParams: {
    //     temperature: promptState.temperature,
    //     max_tokens: promptState.maxTokens,
    //   },
    //   controlParams: parameters,
    //   baseTurnParams: baseTurnData.parameters,
    //   finalParams: finalParameters,
    // });

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
  _createStructuredOutputSchema: (
    variables: Array<{
      name: string;
      type: string;
      description?: string;
      required?: boolean;
    }>
  ): { schema: object; specification: string } => {
    // Build the JSON schema for structured output
    const schema = {
      type: "object",
      properties: {} as Record<string, any>,
      required: [] as string[],
      additionalProperties: false,
    };

    variables.forEach((variable) => {
      schema.properties[variable.name] = {
        type: variable.type === "number" ? "number" : "string",
        description: variable.description || `The ${variable.name} value`,
      };
      if (variable.required) {
        schema.required.push(variable.name);
      }
    });

    // Create specification text that clearly explains the expected output format
    const exampleOutput = variables.reduce((acc, variable) => {
      const exampleValue =
        variable.type === "number" ? 42 : `"your ${variable.name} here"`;
      acc[variable.name] = exampleValue;
      return acc;
    }, {} as Record<string, any>);

    const specification = `You must respond with a JSON object containing the actual values (not schema definitions). 

Expected format:
${JSON.stringify(exampleOutput, null, 2)}

Required fields: ${schema.required.join(", ")}
${variables
  .map((v) => `- ${v.name}: ${v.description || `The ${v.name} value`}`)
  .join("\n")}

IMPORTANT: Provide the actual values, not schema definitions with "type" and "description" fields.
IMPORTANT: Keep your response as they would be in normal condition you can use all of LiteChat capabilities, do not shorten or simplify the response but make sure to provide a valid json output.`;

    return { schema, specification };
  },
};
