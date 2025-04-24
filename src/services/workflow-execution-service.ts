// src/services/workflow-execution-service.ts
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

// Define the structure for task configuration
export interface TaskConfig {
  model: AiModelConfig;
  provider: AiProviderConfig;
  messages: CoreMessage[]; // Use CoreMessage for API calls
  systemPrompt?: string | null;
  temperature?: number;
  maxTokens?: number | null;
  // Add other potential parameters like topP, topK etc. if needed
}

// Define options needed by the service, like API key retrieval
export interface WorkflowExecutionOptions {
  getApiKey: (providerId: string) => string | undefined;
}

// Define the structure for a workflow task
export interface WorkflowTask {
  taskId: string; // Unique ID for this specific task execution
  config: TaskConfig;
}

export class WorkflowExecutionService {
  // Map: parentMessageId -> taskId -> AbortController
  // Stores AbortControllers for each active task within each workflow instance
  private workflowAbortControllers = new Map<
    string, // parentMessageId (workflow instance ID)
    Map<string, AbortController> // taskId -> AbortController
  >();
  private options: WorkflowExecutionOptions;

  constructor(options: WorkflowExecutionOptions) {
    this.options = options;
  }

  // --- Public Methods ---

  /**
   * Starts a workflow based on the specified type and tasks.
   * Manages the execution flow (parallel or sequential) and emits events.
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
      `[WorkflowService] Starting workflow (${workflowType}) for parent ${parentMessageId} with ${tasks.length} tasks.`,
    );

    // Initialize the AbortController map for this workflow instance
    if (!this.workflowAbortControllers.has(parentMessageId)) {
      this.workflowAbortControllers.set(
        parentMessageId,
        new Map<string, AbortController>(),
      );
    }

    // Emit the workflow start event
    workflowEvents.emit(WorkflowEvent.START, {
      parentMessageId,
      workflowType: workflowType,
      tasks: tasks.map((t) => ({ taskId: t.taskId, config: t.config })), // Send task info
    });

    try {
      // Execute tasks based on the workflow type
      switch (workflowType) {
        case "race":
        // 'race' and 'parallel' currently run all tasks concurrently.
        // The distinction might be in how results are handled later (e.g., race stops on first success/error).
        case "parallel":
          await this.executeParallelTasks(parentMessageId, tasks);
          break;
        case "sequence":
          await this.executeSequentialTasks(parentMessageId, tasks);
          break;
        default:
          // Should not happen if types are checked, but handle defensively
          console.error(
            `[WorkflowService] Unsupported workflow type: ${workflowType}`,
          );
          throw new Error(`Unsupported workflow type: ${workflowType}`);
      }

      // Emit completion event if the entire workflow execution succeeded
      console.log(
        `[WorkflowService] Workflow ${parentMessageId} completed successfully.`,
      );
      workflowEvents.emit(WorkflowEvent.COMPLETE, {
        parentMessageId,
        status: "completed",
      });
    } catch (error) {
      // Handle errors that caused the workflow to fail (e.g., a task error in sequence)
      console.error(
        `[WorkflowService] Workflow ${parentMessageId} failed:`,
        error,
      );
      // Emit completion event with error status
      workflowEvents.emit(WorkflowEvent.COMPLETE, {
        parentMessageId,
        status: "error",
      });
      // Do not re-throw here, let the caller handle the completion event
    } finally {
      // Clean up controllers for this workflow instance once it's fully settled (completed or errored)
      this.workflowAbortControllers.delete(parentMessageId);
      console.log(
        `[WorkflowService] Cleaned up controllers for workflow ${parentMessageId}.`,
      );
    }
  }

  /**
   * Cancels a specific running workflow instance by aborting all its active tasks.
   * @param parentMessageId The ID of the workflow (parent message) to cancel.
   */
  public cancelWorkflow(parentMessageId: string): void {
    const abortMap = this.workflowAbortControllers.get(parentMessageId);
    if (abortMap && abortMap.size > 0) {
      console.log(
        `[WorkflowService] Cancelling workflow ${parentMessageId} with ${abortMap.size} active tasks...`,
      );
      let abortedCount = 0;
      abortMap.forEach((controller, taskId) => {
        if (!controller.signal.aborted) {
          console.log(
            `[WorkflowService] Aborting task ${taskId} for workflow ${parentMessageId}`,
          );
          controller.abort(); // Signal abortion
          abortedCount++;
        }
      });
      // Optionally remove the map immediately after signaling abort
      // this.workflowAbortControllers.delete(parentMessageId);
      if (abortedCount > 0) {
        toast.info(`Workflow ${parentMessageId} cancelled.`);
        // Note: WORKFLOW_COMPLETE with 'error' status will likely be emitted
        // when the aborted tasks throw AbortError in executeSingleTask.
      } else {
        console.log(
          `[WorkflowService] Workflow ${parentMessageId} had no running tasks to abort.`,
        );
      }
    } else {
      console.log(
        `[WorkflowService] No active controllers found to cancel for workflow ${parentMessageId}. It might have already completed or failed.`,
      );
    }
  }

  // --- Private Execution Logic ---

  /**
   * Executes a list of tasks concurrently using Promise.allSettled.
   * Waits for all tasks to complete or fail.
   * @throws The error from the first task that rejects, if any.
   */
  private async executeParallelTasks(
    parentMessageId: string,
    tasks: WorkflowTask[],
  ): Promise<void> {
    const promises = tasks.map((task) =>
      this.executeSingleTask(parentMessageId, task.taskId, task.config),
    );
    // Wait for all promises to settle (either resolve or reject)
    const results = await Promise.allSettled(promises);
    console.log(
      `[WorkflowService] Parallel tasks settled for ${parentMessageId}`,
      // results // Avoid logging potentially large results object
    );

    // Check if any task failed
    const firstRejection = results.find((r) => r.status === "rejected");
    if (firstRejection) {
      // If a task failed, throw its reason to signal workflow failure
      console.error(
        `[WorkflowService] At least one parallel task failed for ${parentMessageId}.`,
        (firstRejection as PromiseRejectedResult).reason,
      );
      throw (firstRejection as PromiseRejectedResult).reason;
    }
    // If all tasks succeeded, the method completes successfully
  }

  /**
   * Executes a list of tasks sequentially, one after the other.
   * If any task fails, the sequence stops and the error is thrown.
   * @throws The error from the first task that fails.
   */
  private async executeSequentialTasks(
    parentMessageId: string,
    tasks: WorkflowTask[],
  ): Promise<void> {
    console.log(
      `[WorkflowService] Starting sequential execution for ${parentMessageId}`,
    );
    for (const task of tasks) {
      // Check if the workflow was cancelled *before* starting the next task
      const abortMap = this.workflowAbortControllers.get(parentMessageId);
      // If the map is gone, the workflow was cancelled or completed externally
      if (!abortMap) {
        console.log(
          `[WorkflowService] Workflow ${parentMessageId} cancelled or completed before starting task ${task.taskId}.`,
        );
        throw new Error(`Workflow ${parentMessageId} stopped.`);
      }

      console.log(
        `[WorkflowService] Executing sequential task ${task.taskId} for ${parentMessageId}`,
      );
      // Await the task execution. If it throws, the loop breaks and the error propagates.
      await this.executeSingleTask(parentMessageId, task.taskId, task.config);
      console.log(
        `[WorkflowService] Completed sequential task ${task.taskId} for ${parentMessageId}`,
      );
    }
    console.log(
      `[WorkflowService] Completed sequential execution for ${parentMessageId}`,
    );
  }

  /**
   * Executes a single AI streaming task, handling events and errors.
   * @throws An error if the task fails or is aborted.
   */
  private async executeSingleTask(
    parentMessageId: string,
    taskId: string,
    config: TaskConfig,
  ): Promise<void> {
    // --- Task Setup ---
    const abortController = new AbortController();
    const parentMap = this.workflowAbortControllers.get(parentMessageId);

    // Check if the parent workflow still exists before adding the controller
    if (!parentMap) {
      console.warn(
        `[WorkflowService] Parent abort map not found for ${parentMessageId} when starting task ${taskId}. Workflow might have been cancelled.`,
      );
      throw new Error(
        `Workflow ${parentMessageId} cancelled before task start.`,
      );
    }
    // Register the AbortController for this task
    parentMap.set(taskId, abortController);

    // Emit task start event
    workflowEvents.emit(WorkflowEvent.TASK_START, { parentMessageId, taskId });
    console.log(
      `[WorkflowService] Task ${taskId} started for ${parentMessageId}`,
    );

    // --- State for this task ---
    const contentRef = { current: "" }; // Accumulate content for this task
    const startTime = Date.now();
    let streamError: Error | null = null;
    let finalUsage:
      | { promptTokens: number; completionTokens: number }
      | undefined = undefined;
    let finalFinishReason: string | undefined = undefined;

    try {
      // --- Prepare API Call ---
      const apiKey = this.options.getApiKey(config.provider.id);
      const headers = getStreamHeaders(config.provider.type, apiKey);

      // Validate model instance
      if (!config.model.instance) {
        throw new Error(
          `Model instance missing for task ${taskId} (Model ID: ${config.model.id})`,
        );
      }

      // --- Call AI SDK ---
      const result: StreamTextResult<any, any> = await streamText({
        model: config.model.instance,
        messages: config.messages,
        system: config.systemPrompt ?? undefined,
        temperature: config.temperature,
        maxTokens: config.maxTokens ?? undefined,
        headers,
        abortSignal: abortController.signal, // Pass the signal
        // Add other parameters like topP, topK if needed from config
      });

      // --- Process Stream ---
      for await (const part of result.fullStream as AsyncIterable<
        TextStreamPart<any> // Adjust type if tools are expected
      >) {
        // Check for cancellation *inside* the loop
        if (abortController.signal.aborted) {
          streamError = new Error("Stream aborted by user.");
          toast.info(`Task ${taskId} stopped.`);
          break; // Exit loop
        }

        // Handle different stream part types
        switch (part.type) {
          case "text-delta":
            contentRef.current += part.textDelta;
            // Emit chunk event
            workflowEvents.emit(WorkflowEvent.TASK_CHUNK, {
              parentMessageId,
              taskId,
              chunk: part.textDelta,
            });
            break;
          case "tool-call":
            // Basic handling for tool calls within workflows if needed
            console.warn(
              `[WorkflowService] Tool call received in task ${taskId}, not fully handled yet.`,
              part,
            );
            // TODO: Implement tool call handling if workflows require it
            break;
          case "error":
            // Capture the first stream error
            if (!streamError) {
              streamError =
                part.error instanceof Error
                  ? part.error
                  : new Error(String(part.error));
              toast.error(`Task ${taskId} error: ${streamError.message}`);
            }
            break;
          case "finish":
            // Capture final usage and reason
            finalUsage = part.usage;
            finalFinishReason = part.finishReason;
            break;
          // Handle other potential part types
        }
      } // End stream loop

      // If the stream finished, but an error was recorded earlier, throw it
      if (streamError) {
        throw streamError;
      }

      // Check if aborted *after* the loop finished naturally
      if (abortController.signal.aborted && !streamError) {
        streamError = new Error("Stream aborted by user.");
      }

      // If any error occurred (including abort), throw it to signal task failure
      if (streamError) {
        throw streamError;
      }

      // --- Task Success ---
      // Get final usage/reason if not received during stream
      if (!finalUsage) finalUsage = await result.usage;
      if (!finalFinishReason) finalFinishReason = await result.finishReason;

      console.log(
        `[WorkflowService] Task ${taskId} succeeded for ${parentMessageId}.`,
      );

      // Prepare the final message object for the event
      const finalChildMessage: Message = {
        id: taskId,
        role: "assistant",
        content: contentRef.current,
        createdAt: new Date(startTime), // Use task start time
        conversationId: parentMessageId, // Link to parent
        providerId: config.provider.id,
        modelId: config.model.id,
        tokensInput: finalUsage?.promptTokens,
        tokensOutput: finalUsage?.completionTokens,
        isStreaming: false, // Mark as not streaming
        error: null, // No error on success
      };

      // Emit task finish event
      workflowEvents.emit(WorkflowEvent.TASK_FINISH, {
        parentMessageId,
        taskId,
        result: finalChildMessage,
        usage: finalUsage,
        finishReason: finalFinishReason,
      });
    } catch (err: unknown) {
      // --- Task Failure Handling ---
      // Ensure streamError is set, preferring errors caught earlier
      if (!streamError) {
        streamError = err instanceof Error ? err : new Error(String(err));
      }

      console.error(
        `[WorkflowService] Task ${taskId} failed for ${parentMessageId}:`,
        streamError,
      );

      // Emit task error event
      workflowEvents.emit(WorkflowEvent.TASK_ERROR, {
        parentMessageId,
        taskId,
        error: streamError, // Send the error object
      });

      // Re-throw the error to signal failure to the workflow execution logic
      throw streamError;
    } finally {
      // --- Task Cleanup ---
      // Clean up this task's controller from the map *if* the workflow still exists
      // It might have been removed already by cancelWorkflow or the main finally block
      const currentParentMap =
        this.workflowAbortControllers.get(parentMessageId);
      currentParentMap?.delete(taskId); // Remove controller for this specific task
      console.log(
        `[WorkflowService] Cleaned up controller for task ${taskId} (if present).`,
      );
    }
  }
}
