import type { WorkflowTemplate, WorkflowRun, WorkflowStep } from "../workflow";

// Event priority levels for proper ordering
export type WorkflowEventPriority = 'low' | 'normal' | 'high' | 'critical';

// Event ordering metadata to ensure proper sequence
export interface WorkflowEventMetadata {
  timestamp: string;
  priority: WorkflowEventPriority;
  sequence?: number; // For strict ordering within a workflow run
  runId?: string; // For workflow-specific event filtering
}

export const workflowEvent = {
  // --- Requests ---
  // Fired by the UI to start a new workflow
  startRequest: "workflow.start.request",
  // Fired by the reactive UI engine to run the next step in a workflow
  runNextStepRequest: "workflow.runNextStep.request",
  // Fired by the UI (Human in the Loop control) to resume a paused workflow
  resumeRequest: "workflow.resume.request",
  // Fired by the UI to cancel a running workflow
  cancelRequest: "workflow.cancel.request",

  // --- State Changes ---
  // Fired by the WorkflowService when a workflow officially starts
  started: "workflow.started",
  // Fired by the WorkflowService when a HITL step is encountered
  paused: "workflow.paused",
  // Fired by the WorkflowService when a workflow resumes after being paused
  resumed: "workflow.resumed",
  // Fired by the WorkflowService after each step completes
  stepCompleted: "workflow.step.completed",
  // Fired by the WorkflowService when the entire workflow is finished
  completed: "workflow.completed",
  // Fired by the WorkflowService if any unrecoverable error occurs
  error: "workflow.error",

  // --- Internal Events for Better Integration ---
  // Fired before a step starts (for UI preparation)
  stepStarting: "workflow.step.starting",
  // Fired when workflow state changes (for store synchronization)
  stateChanged: "workflow.state.changed",
  // Fired when flow visualization needs update
  flowUpdated: "workflow.flow.updated",
} as const;

// Event priority mapping for proper ordering
export const WORKFLOW_EVENT_PRIORITIES: Record<string, WorkflowEventPriority> = {
  [workflowEvent.cancelRequest]: 'critical',
  [workflowEvent.error]: 'critical',
  [workflowEvent.startRequest]: 'high',
  [workflowEvent.started]: 'high',
  [workflowEvent.stepStarting]: 'normal',
  [workflowEvent.stepCompleted]: 'normal',
  [workflowEvent.paused]: 'normal',
  [workflowEvent.resumed]: 'normal',
  [workflowEvent.completed]: 'high',
  [workflowEvent.stateChanged]: 'low',
  [workflowEvent.flowUpdated]: 'low',
  [workflowEvent.runNextStepRequest]: 'normal',
  [workflowEvent.resumeRequest]: 'high',
};

export interface WorkflowEventPayloads {
  [workflowEvent.startRequest]: {
    template: WorkflowTemplate;
    initialPrompt: string; // The first user message that kicks off the workflow
    conversationId: string; // The ID of the conversation this workflow belongs to
    metadata?: WorkflowEventMetadata;
  };
  [workflowEvent.runNextStepRequest]: {
    run: WorkflowRun;
    metadata?: WorkflowEventMetadata;
  };
  [workflowEvent.resumeRequest]: {
    runId: string;
    // The corrected/approved data from the human
    resumeData?: any;
    metadata?: WorkflowEventMetadata;
  };
  [workflowEvent.cancelRequest]: {
    runId: string;
    reason?: string;
    metadata?: WorkflowEventMetadata;
  };
  [workflowEvent.started]: {
    run: WorkflowRun;
    metadata?: WorkflowEventMetadata;
  };
  [workflowEvent.paused]: {
    runId: string;
    step: WorkflowStep;
    pauseReason: 'human-in-the-loop' | 'data-correction';
    // For 'human-in-the-loop'
    dataForReview?: any;
    // For 'data-correction'
    rawAssistantResponse?: string;
    metadata?: WorkflowEventMetadata;
  };
  [workflowEvent.resumed]: {
    runId: string;
    metadata?: WorkflowEventMetadata;
  };
  [workflowEvent.stepCompleted]: {
    runId: string;
    stepId: string;
    output: any;
    metadata?: WorkflowEventMetadata;
  };
  [workflowEvent.completed]: {
    runId: string;
    finalOutput: any;
    metadata?: WorkflowEventMetadata;
  };
  [workflowEvent.error]: {
    runId: string;
    error: string;
    context?: Record<string, any>;
    metadata?: WorkflowEventMetadata;
  };
  [workflowEvent.stepStarting]: {
    runId: string;
    step: WorkflowStep;
    stepIndex: number;
    metadata?: WorkflowEventMetadata;
  };
  [workflowEvent.stateChanged]: {
    runId: string;
    oldState: any;
    newState: any;
    metadata?: WorkflowEventMetadata;
  };
  [workflowEvent.flowUpdated]: {
    runId: string;
    flowContent: string;
    updateType: 'status' | 'output' | 'complete' | 'error';
    metadata?: WorkflowEventMetadata;
  };
}

/**
 * Helper function to create workflow event metadata with proper ordering
 */
export function createWorkflowEventMetadata(
  runId: string,
  priority: WorkflowEventPriority = 'normal',
  sequence?: number
): WorkflowEventMetadata {
  return {
    timestamp: new Date().toISOString(),
    priority,
    sequence,
    runId
  };
}

/**
 * Helper function to compare event priorities for proper ordering
 */
export function compareEventPriority(a: WorkflowEventPriority, b: WorkflowEventPriority): number {
  const priorityOrder: Record<WorkflowEventPriority, number> = {
    'low': 1,
    'normal': 2,
    'high': 3,
    'critical': 4
  };
  
  return priorityOrder[b] - priorityOrder[a]; // Higher priority first
} 