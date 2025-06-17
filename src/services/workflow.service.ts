import { emitter } from "@/lib/litechat/event-emitter";
import { workflowEvent, type WorkflowEventPayloads } from "@/types/litechat/events/workflow.events";
import { interactionEvent } from "@/types/litechat/events/interaction.events";
import type { Interaction } from "@/types/litechat/interaction";
import { InteractionService } from "./interaction.service";
import { useWorkflowStore } from "@/store/workflow.store";
import { useConversationStore } from "@/store/conversation.store";
import type { WorkflowRun, WorkflowStep } from "@/types/litechat/workflow";
import { nanoid } from "nanoid";
import { compilePromptTemplate } from "@/lib/litechat/prompt-util";
import type { PromptTemplate } from "@/types/litechat/prompt-template";

class WorkflowServiceImpl {
  private isInitialized = false;
  private eventUnsubscribers: (() => void)[] = [];

  public initialize(): void {
    if (this.isInitialized) {
      return;
    }

    const unsubStart = emitter.on(workflowEvent.startRequest, this.handleWorkflowStartRequest);
    const unsubResume = emitter.on(workflowEvent.resumeRequest, this.handleWorkflowResumeRequest);
    const unsubInteractionCompleted = emitter.on(interactionEvent.completed, this.handleInteractionCompleted);

    // @ts-expect-error - this is a workaround, TS is throwing, IDNW
    this.eventUnsubscribers.push(unsubStart, unsubResume, unsubInteractionCompleted);
    this.isInitialized = true;
    console.log("[WorkflowService] Initialized.");
  }

  private async _compileStepPrompt(step: WorkflowStep, context: Record<string, any>): Promise<string> {
    if (!step.prompt) {
      return "";
    }

    // The workflow context is flat: { step_1_id: { output: ... }, step_2_id: { ... } }
    // The prompt template variables are just `variableName`.
    // We need to create the form data object that the compiler expects.
    const formData: Record<string, any> = {};

    // This regex will find all {{...}} placeholders in the prompt
    const placeholderRegex = /\{\{(.*?)\}\}/g;
    let match;
    while ((match = placeholderRegex.exec(step.prompt)) !== null) {
      const fullPath = match[1].trim(); // e.g., "step_1.output.username"
      const pathParts = fullPath.split('.');
      const varName = pathParts[pathParts.length - 1]; // "username"
      
      let value: any = context;
      try {
        for (const k of pathParts) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                // Path is invalid in the current context
                throw new Error(`Could not resolve path: ${fullPath}`);
            }
        }
        formData[varName] = value;
      } catch (e) {
         console.warn(`[WorkflowService] Could not resolve template variable: ${fullPath}`);
      }
    }

    // Create a temporary, ad-hoc PromptTemplate object for the compiler
    const tempTemplate: PromptTemplate = {
      id: step.id,
      name: step.name,
      description: '',
      prompt: step.prompt,
      variables: Object.keys(formData).map(name => ({ name, type: 'string', required: true, description: '' })),
      tags: [],
      isPublic: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const compiled = await compilePromptTemplate(tempTemplate, formData);
    return compiled.content;
  }

  private handleWorkflowStartRequest = async (payload: WorkflowEventPayloads[typeof workflowEvent.startRequest]): Promise<void> => {
    console.log("[WorkflowService] Workflow start request received", payload);
    const { template, initialPrompt } = payload;

    try {
      // Get current conversation ID
      const conversationId = useConversationStore.getState().selectedItemId;
      if (!conversationId) {
        throw new Error("No active conversation selected to start a workflow.");
      }

      // 1. Create the main 'workflow.run' interaction to act as a container
      const mainInteraction = await InteractionService.startInteraction(
        {
          // The initial prompt is associated with the main workflow interaction
          messages: [{ role: 'user', content: initialPrompt }],
          system: "Executing workflow...", // Placeholder system prompt
          parameters: {}, // Add empty parameters to satisfy PromptObject type
          metadata: { isWorkflowRun: true, workflowName: template.name },
        },
        conversationId, // Use current conversation
        {
          id: nanoid(),
          content: initialPrompt,
          parameters: {}, // Add empty parameters
          metadata: { isWorkflowRun: true, workflowName: template.name },
        },
        "workflow.run"
      );

      if (!mainInteraction) {
        throw new Error("Failed to create the main workflow interaction.");
      }

      // 2. Create the WorkflowRun state object
      const run: WorkflowRun = {
        runId: nanoid(),
        mainInteractionId: mainInteraction.id,
        template: template,
        status: "RUNNING",
        currentStepIndex: 0,
        stepOutputs: {},
        startedAt: new Date().toISOString(),
      };

      // 3. Emit workflowEvent.started to update the store and any other listeners
      emitter.emit(workflowEvent.started, { run });

      // 4. Trigger the first step
      this.runNextStep(run);

    } catch (error) {
      console.error("[WorkflowService] Error starting workflow:", error);
      emitter.emit(workflowEvent.error, { runId: "", error: String(error) });
    }
  };

  private runNextStep = async (run: WorkflowRun): Promise<void> => {
    console.log(`[WorkflowService] Running step ${run.currentStepIndex} for run ${run.runId}`);

    // Check if the workflow is complete
    if (run.currentStepIndex >= run.template.steps.length) {
      emitter.emit(workflowEvent.completed, { runId: run.runId, finalOutput: run.stepOutputs });
      console.log(`[WorkflowService] Workflow ${run.runId} completed.`);
      return;
    }

    const currentStep = run.template.steps[run.currentStepIndex];
    const conversationId = useConversationStore.getState().selectedItemId;

    if (!conversationId) {
      emitter.emit(workflowEvent.error, { runId: run.runId, error: "No active conversation found during step execution." });
      return;
    }

    try {
      if (currentStep.type === "human-in-the-loop") {
        // Pause the workflow and wait for human input
        emitter.emit(workflowEvent.paused, { runId: run.runId, dataForReview: run.stepOutputs });
        console.log(`[WorkflowService] Workflow ${run.runId} paused for human in the loop.`);

      } else if (currentStep.type === "prompt" || currentStep.type === "agent-task") {
        // 1. Compile the prompt template with data from previous steps
        const promptText = await this._compileStepPrompt(currentStep, run.stepOutputs);

        // 2. Construct a system prompt to enforce structured JSON output if required
        let systemPrompt = "Executing workflow step...";
        if (currentStep.structuredOutput?.jsonSchema) {
          systemPrompt = `You are an expert at following instructions. Your response MUST be a single JSON object that strictly conforms to the following JSON Schema. Do not include any other text, explanations, or markdown formatting like \`\`\`json. Your response must be only the JSON object itself.

JSON Schema:
${JSON.stringify(currentStep.structuredOutput.jsonSchema, null, 2)}`;
        }

        // Create a child interaction for this step
        await InteractionService.startInteraction(
          {
            messages: [{ role: 'user', content: promptText }],
            system: systemPrompt,
            parameters: {},
            metadata: {
              isWorkflowStep: true,
              workflowRunId: run.runId,
              workflowStepId: currentStep.id,
              workflowStepName: currentStep.name,
            },
          },
          conversationId,
          {
            id: nanoid(),
            content: promptText,
            parameters: {},
            metadata: {
              isWorkflowStep: true,
              workflowRunId: run.runId,
              workflowStepId: currentStep.id,
            },
          },
          "message.assistant_regen" // Use regen to show it as a child
        );
      }
    } catch (error) {
      console.error(`[WorkflowService] Error running step ${currentStep.id} for run ${run.runId}:`, error);
      emitter.emit(workflowEvent.error, { runId: run.runId, error: `Failed on step "${currentStep.name}": ${String(error)}` });
    }
  };

  private handleWorkflowResumeRequest = async (payload: WorkflowEventPayloads[typeof workflowEvent.resumeRequest]): Promise<void> => {
    console.log("[WorkflowService] Workflow resume request received", payload);
    const { runId, resumeData } = payload;
    const activeRun = useWorkflowStore.getState().activeRun;

    if (!activeRun || activeRun.runId !== runId || activeRun.status !== "PAUSED") {
      console.warn(`[WorkflowService] Ignoring resume request for invalid or non-paused run ${runId}`);
      return;
    }

    const currentStep = activeRun.template.steps[activeRun.currentStepIndex];

    // Save the human's input as the output of this HITL step
    emitter.emit(workflowEvent.stepCompleted, { 
      runId: activeRun.runId, 
      stepId: currentStep.id, 
      output: resumeData 
    });

    // Notify that the workflow is resuming
    emitter.emit(workflowEvent.resumed, { runId: activeRun.runId });
    
    // The store will update the state, so we get the latest version
    const nextRunState = useWorkflowStore.getState().activeRun;
    if(nextRunState) {
      this.runNextStep(nextRunState);
    }
  };

  private handleInteractionCompleted = (payload: { interactionId: string; status: string; interaction?: Interaction }): void => {
    const activeRun = useWorkflowStore.getState().activeRun;
    // Ensure there's an active, running workflow
    if (!activeRun || activeRun.status !== "RUNNING") {
      return;
    }
    
    // Check if the completed interaction is a step in our active workflow
    const interaction = payload.interaction;
    if (
      !interaction || 
      !interaction.metadata?.isWorkflowStep ||
      interaction.metadata?.workflowRunId !== activeRun.runId
    ) {
      return;
    }

    console.log(`[WorkflowService] Handling completed interaction for step ${interaction.metadata.workflowStepId}`);

    const currentStep = activeRun.template.steps[activeRun.currentStepIndex];

    // Ensure the completed step is the one we're waiting for
    if (interaction.metadata.workflowStepId !== currentStep.id) {
      console.warn(`[WorkflowService] Received completion for an unexpected step. Expected: ${currentStep.id}, Received: ${interaction.metadata.workflowStepId}`);
      return;
    }

    if (payload.status === "ERROR") {
      emitter.emit(workflowEvent.error, { runId: activeRun.runId, error: `Step "${currentStep.name}" failed.` });
      return;
    }

    // Attempt to parse structured output if the step was configured for it
    let stepOutput: any = interaction.response ?? "No output";
    const stepSpec = activeRun.template.steps.find(s => s.id === interaction.metadata?.workflowStepId);

    if (stepSpec?.structuredOutput) {
      console.log(`[WorkflowService] Step ${stepSpec.id} requires structured output. Parsing response...`);
      try {
        // Attempt to extract JSON from markdown code blocks, or assume the whole response is JSON
        const jsonRegex = /```json\s*([\s\S]*?)\s*```/;
        const match = interaction.response?.match(jsonRegex);
        const jsonString = match ? match[1].trim() : interaction.response?.trim();
        
        if (jsonString) {
          stepOutput = JSON.parse(jsonString);
          console.log(`[WorkflowService] Successfully parsed structured output for step ${stepSpec.id}.`);
        } else {
          throw new Error("Empty response, cannot parse JSON.");
        }
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        console.error(`[WorkflowService] Failed to parse structured output for step ${stepSpec.id}. Error: ${errorMessage}. Storing raw response instead.`);
        // Keep stepOutput as the raw response on failure
        emitter.emit(workflowEvent.error, { runId: activeRun.runId, error: `Step "${stepSpec.name}" failed to produce valid JSON.` });
        return; // Halt workflow execution on parsing failure
      }
    }

    // Emit event to notify store of step completion
    emitter.emit(workflowEvent.stepCompleted, { 
      runId: activeRun.runId, 
      stepId: currentStep.id, 
      output: stepOutput 
    });

    // The store updates the activeRun state. We must get the fresh state before proceeding.
    const nextRunState = useWorkflowStore.getState().activeRun;
    if (nextRunState) {
      this.runNextStep(nextRunState);
    }
  };

  public destroy(): void {
    this.eventUnsubscribers.forEach(unsub => unsub());
    this.eventUnsubscribers = [];
    this.isInitialized = false;
    console.log("[WorkflowService] Destroyed.");
  }
}

export const WorkflowService = new WorkflowServiceImpl(); 