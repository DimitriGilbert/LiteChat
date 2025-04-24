

import { streamText, StreamTextResult, TextStreamPart } from "ai";
import { toast } from "sonner";
import { workflowEvents, WorkflowEvent } from "./workflow-events";
import type {
  AiModelConfig,
  AiProviderConfig,
  Message,
  CoreMessage,
  Workflow,
} from "@/lib/types";
import { getStreamHeaders } from "@/hooks/ai-interaction/stream-handler";




export interface TaskConfig {
  model: AiModelConfig;
  provider: AiProviderConfig;
  messages: CoreMessage[];
  systemPrompt?: string | null;
  temperature?: number;
  maxTokens?: number | null;
}


export interface WorkflowExecutionOptions {
  getApiKey: (providerId: string) => string | undefined;
}


export interface WorkflowTask {
  taskId: string;
  config: TaskConfig;
}

export class WorkflowExecutionService {
  // Map: parentMessageId -> taskId -> AbortController
  private workflowAbortControllers = new Map<
    string,
    Map<string, AbortController>
  >();
  private options: WorkflowExecutionOptions;

  constructor(options: WorkflowExecutionOptions) {
    this.options = options;
  }

  // --- Public Methods ---

  /**
   * Starts a workflow based on the specified type and tasks.
   * @param parentMessageId The ID of the message triggering the workflow.
   * @param workflowType The type of workflow ('race', 'sequence', 'parallel').
   * @param tasks An array of tasks to be executed.
   */
  public async startWorkflow(
    parentMessageId: string,
    workflowType: Workflow["type"],
    tasks: WorkflowTask[],
  ): Promise<void> {
    console.log(
      `[WorkflowService] Starting workflow (${workflowType}) for ${parentMessageId}`,
    );
    if (!this.workflowAbortControllers.has(parentMessageId)) {
      this.workflowAbortControllers.set(
        parentMessageId,
        new Map<string, AbortController>(),
      );
    }

    // Emit the start event with the correct type
    workflowEvents.emit(WorkflowEvent.START, {
      parentMessageId,
      workflowType: workflowType,
      tasks: tasks.map((t) => ({ taskId: t.taskId, config: t.config })),
    });

    try {
      switch (workflowType) {
        case "race":
        // 'race' and 'parallel' currently have the same execution logic: run all concurrently.
        // Differences might emerge in how results are handled later (e.g., race might stop on first success).
        case "parallel":
          await this.executeParallelTasks(parentMessageId, tasks);
          break;
        case "sequence":
          await this.executeSequentialTasks(parentMessageId, tasks);
          break;
        default:
          console.error(
            `[WorkflowService] Unsupported workflow type: ${workflowType}`,
          );
          throw new Error(`Unsupported workflow type: ${workflowType}`);
      }

      // Emit completion event if execution didn't throw
      workflowEvents.emit(WorkflowEvent.COMPLETE, {
        parentMessageId,
        status: "completed",
      });
    } catch (error) {
      console.error(
        `[WorkflowService] Workflow ${parentMessageId} failed:`,
        error,
      );
      workflowEvents.emit(WorkflowEvent.COMPLETE, {
        parentMessageId,
        status: "error",
      });
    } finally {
      // Clean up controllers for this workflow instance once it's fully settled or errored
      this.workflowAbortControllers.delete(parentMessageId);
      console.log(
        `[WorkflowService] Cleaned up controllers for workflow ${parentMessageId}`,
      );
    }
  }

  /**
   * Cancels a specific running workflow instance.
   * @param parentMessageId The ID of the workflow (parent message) to cancel.
   */
  public cancelWorkflow(parentMessageId: string): void {
    const abortMap = this.workflowAbortControllers.get(parentMessageId);
    if (abortMap) {
      console.log(
        `[WorkflowService] Cancelling workflow ${parentMessageId}...`,
      );
      abortMap.forEach((controller, taskId) => {
        console.log(`[WorkflowService] Aborting task ${taskId}`);
        controller.abort();
      });
      // This prevents race conditions if cancellation happens during execution.
      // this.workflowAbortControllers.delete(parentMessageId);
      // workflowEvents.emit(WorkflowEvent.CANCELLED, { parentMessageId });
      toast.info(`Workflow ${parentMessageId} cancelled.`);
    } else {
      console.log(
        `[WorkflowService] No active controllers found to cancel for workflow ${parentMessageId}.`,
      );
    }
  }

  // --- Private Execution Logic ---

  /**
   * Executes a list of tasks concurrently.
   */
  private async executeParallelTasks(
    parentMessageId: string,
    tasks: WorkflowTask[],
  ): Promise<void> {
    const promises = tasks.map((task) =>
      this.executeSingleTask(parentMessageId, task.taskId, task.config),
    );
    const results = await Promise.allSettled(promises);
    console.log(
      `[WorkflowService] Parallel tasks settled for ${parentMessageId}`,
      results,
    );
    const firstRejection = results.find((r) => r.status === "rejected");
    if (firstRejection) {
      // Throw the error from the first rejected promise to signal workflow failure
      throw (firstRejection as PromiseRejectedResult).reason;
    }
  }

  /**
   * Executes a list of tasks sequentially.
   */
  private async executeSequentialTasks(
    parentMessageId: string,
    tasks: WorkflowTask[],
  ): Promise<void> {
    console.log(
      `[WorkflowService] Starting sequential execution for ${parentMessageId}`,
    );
    for (const task of tasks) {
      // Check if workflow was cancelled before starting next task
      const abortMap = this.workflowAbortControllers.get(parentMessageId);
      if (!abortMap) {
        console.log(
          `[WorkflowService] Workflow ${parentMessageId} cancelled before task ${task.taskId}.`,
        );
        throw new Error(`Workflow ${parentMessageId} cancelled.`);
      }

      console.log(
        `[WorkflowService] Executing sequential task ${task.taskId} for ${parentMessageId}`,
      );
      // because executeSingleTask will throw on error.
      await this.executeSingleTask(parentMessageId, task.taskId, task.config);
      console.log(`[WorkflowService] Completed sequential task ${task.taskId}`);
    }
    console.log(
      `[WorkflowService] Completed sequential execution for ${parentMessageId}`,
    );
  }

  /**
   * Executes a single AI streaming task.
   * @throws An error if the task fails.
   */
  private async executeSingleTask(
    parentMessageId: string,
    taskId: string,
    config: TaskConfig,
  ): Promise<void> {
    const abortController = new AbortController();
    const parentMap = this.workflowAbortControllers.get(parentMessageId);
    if (!parentMap) {
      console.warn(
        `[WorkflowService] Parent abort map not found for ${parentMessageId} when starting task ${taskId}. Workflow might have been cancelled.`,
      );
      throw new Error(
        `Workflow ${parentMessageId} cancelled before task start.`,
      );
    }
    // Add the controller to the map
    parentMap.set(taskId, abortController);

    workflowEvents.emit(WorkflowEvent.TASK_START, { parentMessageId, taskId });
    console.log(
      `[WorkflowService] Task ${taskId} started for ${parentMessageId}`,
    );

    const contentRef = { current: "" };
    const startTime = Date.now();
    let streamError: Error | null = null;
    let finalUsage:
      | { promptTokens: number; completionTokens: number }
      | undefined = undefined;
    let finalFinishReason: string | undefined = undefined;

    try {
      const apiKey = this.options.getApiKey(config.provider.id);
      const headers = getStreamHeaders(config.provider.type, apiKey);
      if (!config.model.instance) {
        throw new Error(`Model instance missing for task ${taskId}`);
      }

      const result: StreamTextResult<any, any> = await streamText({
        model: config.model.instance,
        messages: config.messages,
        system: config.systemPrompt ?? undefined,
        temperature: config.temperature,
        maxTokens: config.maxTokens ?? undefined,
        headers,
        abortSignal: abortController.signal,
        // toolChoice: undefined,
      });

      for await (const part of result.fullStream as AsyncIterable<
        TextStreamPart<any>
      >) {
        // Check cancellation *inside* the loop
        if (abortController.signal.aborted) {
          streamError = new Error("Stream aborted by user.");
          toast.info(`Task ${taskId} stopped.`);
          break;
        }

        switch (part.type) {
          case "text-delta":
            contentRef.current += part.textDelta;
            workflowEvents.emit(WorkflowEvent.TASK_CHUNK, {
              parentMessageId,
              taskId,
              chunk: part.textDelta,
            });
            break;
          case "tool-call":
            // Handle tool calls if necessary for workflows
            console.warn(
              `[WorkflowService] Tool call received in task ${taskId}, not fully handled yet.`,
              part,
            );
            break;
          case "error":
            streamError =
              part.error instanceof Error
                ? part.error
                : new Error(String(part.error));
            toast.error(
              `Task ${taskId} error: ${streamError ? streamError.message : "Unknown"}`,
            );
            break;
          case "finish":
            finalUsage = part.usage;
            finalFinishReason = part.finishReason;
            break;
        }
      }

      // If the stream finished but an error was recorded earlier
      if (streamError) {
        throw streamError;
      }

      // Check if aborted *after* the loop (in case it was aborted but loop finished)
      if (abortController.signal.aborted && !streamError) {
        streamError = new Error("Stream aborted by user.");
      }

      // Throw error if one occurred
      if (streamError) {
        throw streamError;
      }

      // Get final usage if not received during stream
      if (!finalUsage) finalUsage = await result.usage;
      if (!finalFinishReason) finalFinishReason = await result.finishReason;
      console.log(
        `[WorkflowService] Task ${taskId} succeeded for ${parentMessageId}.`,
      );
      const finalChildMessage: Message = {
        id: taskId,
        role: "assistant",
        content: contentRef.current,
        createdAt: new Date(startTime),
        conversationId: parentMessageId,
        providerId: config.provider.id,
        modelId: config.model.id,
        tokensInput: finalUsage?.promptTokens,
        tokensOutput: finalUsage?.completionTokens,
        isStreaming: false,
        error: null,
      };

      workflowEvents.emit(WorkflowEvent.TASK_FINISH, {
        parentMessageId,
        taskId,
        result: finalChildMessage,
        usage: finalUsage,
        finishReason: finalFinishReason,
      });
    } catch (err: unknown) {
      // --- Task Failure ---
      // Ensure streamError is set correctly
      if (!streamError) {
        // If error wasn't caught inside loop/streamText
        streamError = err instanceof Error ? err : new Error(String(err));
      }

      console.error(
        `[WorkflowService] Task ${taskId} failed for ${parentMessageId}:`,
        streamError,
      );
      workflowEvents.emit(WorkflowEvent.TASK_ERROR, {
        parentMessageId,
        taskId,
        error: streamError,
      });
      throw streamError;
    } finally {
      // Clean up this task's controller from the map *if* it still exists
      // It might have been removed already by cancelWorkflow
      const currentParentMap =
        this.workflowAbortControllers.get(parentMessageId);
      currentParentMap?.delete(taskId);
      console.log(
        `[WorkflowService] Cleaned up controller for task ${taskId} (if present).`,
      );
    }
  }
}
