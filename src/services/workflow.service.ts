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
import { useProviderStore } from "@/store/provider.store";

// Note: Refactored to a static class to align with other services like InteractionService.
// This service's lifecycle is tied to the application's lifecycle, so event listeners
// are registered once and are not manually unsubscribed.
export const WorkflowService = {
  isInitialized: false,

  initialize(): void {
    if (this.isInitialized) {
      return;
    }

    emitter.on(workflowEvent.startRequest, this.handleWorkflowStartRequest);
    emitter.on(workflowEvent.resumeRequest, this.handleWorkflowResumeRequest);
    emitter.on(interactionEvent.completed, this.handleInteractionCompleted);
    
    this.isInitialized = true;
    console.log("[WorkflowService] Initialized.");
  },

  _resolveJsonPath(obj: any, path: string): any {
    // Basic resolver for paths like "stepId.output.fieldName"
    if (path.startsWith('$.')) {
      path = path.substring(2);
    }
    const parts = path.split('.');
    let current = obj;
    for (const part of parts) {
      if (current === null || typeof current !== 'object' || !(part in current)) {
        return undefined;
      }
      current = current[part];
    }
    return current;
  },

  async _compileStepPrompt(step: WorkflowStep, context: Record<string, any>): Promise<string> {
    if (!step.prompt) {
        return "";
    }

    const formData: Record<string, any> = {};
    const placeholderRegex = /\{\{(.*?)\}\}/g;
    
    const uniquePlaceholders = new Set<string>();
    let match;
    while ((match = placeholderRegex.exec(step.prompt)) !== null) {
        uniquePlaceholders.add(match[1].trim());
    }

    for (const fullPath of uniquePlaceholders) {
        const value = this._resolveJsonPath(context, `$.${fullPath}`);
        if (value !== undefined) {
            formData[fullPath] = value;
        } else {
            console.warn(`[WorkflowService] Could not resolve template variable: ${fullPath}`);
        }
    }

    const tempTemplate: PromptTemplate = {
      id: step.id,
      name: step.name,
      description: '',
      prompt: step.prompt,
      variables: Array.from(uniquePlaceholders).map(path => ({ 
        name: path, 
        type: 'string', 
        required: true, 
        description: '' 
      })),
      tags: [],
      isPublic: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const compiled = await compilePromptTemplate(tempTemplate, formData);
    return compiled.content;
  },

  handleWorkflowStartRequest: async (payload: WorkflowEventPayloads[typeof workflowEvent.startRequest]): Promise<void> => {
    console.log("[WorkflowService] Workflow start request received", payload);
    const { template, initialPrompt } = payload;

    try {
      const conversationId = useConversationStore.getState().selectedItemId;
      if (!conversationId) {
        throw new Error("No active conversation selected to start a workflow.");
      }

      const mainInteraction = await InteractionService.startInteraction(
        {
          messages: [{ role: 'user', content: initialPrompt }],
          system: "Executing workflow...",
          parameters: {},
          metadata: { isWorkflowRun: true, workflowName: template.name },
        },
        conversationId,
        {
          id: nanoid(),
          content: initialPrompt,
          parameters: {},
          metadata: { isWorkflowRun: true, workflowName: template.name },
        },
        "workflow.run"
      );

      if (!mainInteraction) {
        throw new Error("Failed to create the main workflow interaction.");
      }

      const run: WorkflowRun = {
        runId: nanoid(),
        mainInteractionId: mainInteraction.id,
        template: template,
        status: "RUNNING",
        currentStepIndex: 0,
        stepOutputs: {
          initialPrompt: { output: initialPrompt }
        },
        startedAt: new Date().toISOString(),
      };

      emitter.emit(workflowEvent.started, { run });
      WorkflowService.runNextStep(run);

    } catch (error) {
      console.error("[WorkflowService] Error starting workflow:", error);
      emitter.emit(workflowEvent.error, { runId: "", error: String(error) });
    }
  },

  runNextStep: async (run: WorkflowRun): Promise<void> => {
    console.log(`[WorkflowService] Running step ${run.currentStepIndex} for run ${run.runId}`);

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
        emitter.emit(workflowEvent.paused, { 
          runId: run.runId, 
          step: currentStep,
          pauseReason: 'human-in-the-loop',
          dataForReview: run.stepOutputs,
        });
        console.log(`[WorkflowService] Workflow ${run.runId} paused for human in the loop.`);

      } else if (currentStep.type === "prompt" || currentStep.type === "agent-task") {
        const promptText = await WorkflowService._compileStepPrompt(currentStep, run.stepOutputs);

        const providerStore = useProviderStore.getState();
        const modelConfig = currentStep.modelId && currentStep.modelId !== 'global'
          ? providerStore.getModelConfigById(currentStep.modelId)
          : providerStore.getSelectedModel();
        
        if (!modelConfig) {
          throw new Error(`Could not find a model configuration for step "${currentStep.name}"`);
        }

        const interactionPayload: any = {
          messages: [{ role: 'user', content: promptText }],
          system: "You are a helpful assistant executing a task.",
          parameters: {},
          modelConfig: modelConfig,
          metadata: {
            isWorkflowStep: true,
            workflowRunId: run.runId,
            workflowStepId: currentStep.id,
            workflowStepName: currentStep.name,
          },
        };

        if (currentStep.structuredOutput?.jsonSchema) {
          const schema = currentStep.structuredOutput.jsonSchema as any;
          interactionPayload.tools = {
            structured_output: {
              description: `Provide the structured output for the step. The output must conform to the provided JSON schema.`,
              parameters: schema,
            }
          };
          interactionPayload.system = `You are an expert at following instructions. Use the 'structured_output' tool to provide your answer. Your response MUST be a call to this tool with the correct arguments. Do not include any other text or explanations.`;
        }

        await InteractionService.startInteraction(
          interactionPayload,
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
          "message.assistant_regen"
        );
      }
    } catch (error) {
      console.error(`[WorkflowService] Error running step ${currentStep.id} for run ${run.runId}:`, error);
      emitter.emit(workflowEvent.error, { runId: run.runId, error: `Failed on step "${currentStep.name}": ${String(error)}` });
    }
  },

  handleWorkflowResumeRequest: async (payload: WorkflowEventPayloads[typeof workflowEvent.resumeRequest]): Promise<void> => {
    console.log("[WorkflowService] Workflow resume request received", payload);
    const { runId, resumeData } = payload;
    const activeRun = useWorkflowStore.getState().activeRun;

    if (!activeRun || activeRun.runId !== runId || activeRun.status !== "PAUSED") {
      console.warn(`[WorkflowService] Ignoring resume request for invalid or non-paused run ${runId}`);
      return;
    }

    const currentStep = activeRun.template.steps[activeRun.currentStepIndex];

    emitter.emit(workflowEvent.stepCompleted, { 
      runId: activeRun.runId, 
      stepId: currentStep.id, 
      output: resumeData 
    });

    emitter.emit(workflowEvent.resumed, { runId: activeRun.runId });
    
    const nextRunState = useWorkflowStore.getState().activeRun;
    if(nextRunState) {
      WorkflowService.runNextStep(nextRunState);
    }
  },

  handleInteractionCompleted: (payload: { interactionId: string; status: string; interaction?: Interaction }): void => {
    const activeRun = useWorkflowStore.getState().activeRun;
    if (!activeRun || activeRun.status !== "RUNNING") {
      return;
    }
    
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

    if (interaction.metadata.workflowStepId !== currentStep.id) {
      console.warn(`[WorkflowService] Received completion for an unexpected step. Expected: ${currentStep.id}, Received: ${interaction.metadata.workflowStepId}`);
      return;
    }

    if (payload.status === "ERROR") {
      emitter.emit(workflowEvent.error, { runId: activeRun.runId, error: `Step "${currentStep.name}" failed.` });
      return;
    }

    let stepOutput: any;
    const stepSpec = activeRun.template.steps.find(s => s.id === interaction.metadata?.workflowStepId);
    let successfullyParsed = false;

    if (stepSpec?.structuredOutput && interaction.metadata.toolCalls?.length) {
      for (const toolCallStr of interaction.metadata.toolCalls) {
        try {
          const toolCall = JSON.parse(toolCallStr);
          if (toolCall.toolName === 'structured_output' || toolCall.name === 'structured_output') {
            stepOutput = toolCall.arguments || toolCall.args;
            successfullyParsed = true;
            break; 
          }
        } catch (e) {
          console.warn(`[WorkflowService] Failed to parse tool call from metadata string: ${toolCallStr}`, e);
        }
      }
    }

    if (!successfullyParsed && stepSpec?.structuredOutput) {
      try {
        const jsonRegex = /```json\s*([\s\S]*?)\s*```/;
        const match = interaction.response?.match(jsonRegex);
        const jsonString = match ? match[1].trim() : interaction.response?.trim();
        
        if (jsonString) {
          stepOutput = JSON.parse(jsonString);
          successfullyParsed = true;
        }
      } catch (e) {
        console.error(`[WorkflowService] Failed to parse JSON from response for step ${stepSpec.id}.`);
      }
    }

    if (stepSpec?.structuredOutput && !successfullyParsed) {
      emitter.emit(workflowEvent.paused, {
        runId: activeRun.runId,
        step: stepSpec,
        pauseReason: 'data-correction',
        rawAssistantResponse: interaction.response,
      });
      return; 
    }
    
    if (!stepSpec?.structuredOutput) {
      stepOutput = interaction.response ?? "No output";
    }

    emitter.emit(workflowEvent.stepCompleted, { 
      runId: activeRun.runId, 
      stepId: currentStep.id, 
      output: stepOutput 
    });

    const nextRunState = useWorkflowStore.getState().activeRun;
    if (nextRunState) {
      WorkflowService.runNextStep(nextRunState);
    }
  },
}; 