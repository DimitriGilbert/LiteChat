// src/services/workflow-events.ts
import mitt from "mitt";
import type { Message, Workflow } from "@/lib/types"; // Assuming Workflow type is defined in types.ts

// Define event payloads
type WorkflowStartPayload = {
  parentMessageId: string;
  workflowType: Workflow["type"];
  // Define tasks more concretely if possible, e.g., model/prompt pairs
  tasks: Array<{ taskId: string; config: any }>;
};
type WorkflowTaskStartPayload = { parentMessageId: string; taskId: string };
type WorkflowTaskChunkPayload = {
  parentMessageId: string;
  taskId: string;
  chunk: string;
};
type WorkflowTaskFinishPayload = {
  parentMessageId: string;
  taskId: string;
  result: Message; // The final child message object
  usage?: { promptTokens: number; completionTokens: number };
  finishReason?: string;
};
type WorkflowTaskErrorPayload = {
  parentMessageId: string;
  taskId: string;
  error: Error | string;
};
type WorkflowCompletePayload = {
  parentMessageId: string;
  status: "completed" | "error";
};

// Define the event map
type WorkflowEvents = {
  WORKFLOW_START: WorkflowStartPayload;
  WORKFLOW_TASK_START: WorkflowTaskStartPayload;
  WORKFLOW_TASK_CHUNK: WorkflowTaskChunkPayload;
  WORKFLOW_TASK_FINISH: WorkflowTaskFinishPayload;
  WORKFLOW_TASK_ERROR: WorkflowTaskErrorPayload;
  WORKFLOW_COMPLETE: WorkflowCompletePayload;
};

// Create and export the emitter instance
export const workflowEvents = mitt<WorkflowEvents>();

// Export event names as constants for type safety (optional but good practice)
export const WorkflowEvent = {
  START: "WORKFLOW_START",
  TASK_START: "WORKFLOW_TASK_START",
  TASK_CHUNK: "WORKFLOW_TASK_CHUNK",
  TASK_FINISH: "WORKFLOW_TASK_FINISH",
  TASK_ERROR: "WORKFLOW_TASK_ERROR",
  COMPLETE: "WORKFLOW_COMPLETE",
} as const;
