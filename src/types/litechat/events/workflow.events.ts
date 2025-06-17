import type { WorkflowTemplate, WorkflowRun, WorkflowStep } from "../workflow";

export const workflowEvent = {
  // --- Requests ---
  // Fired by the UI to start a new workflow
  startRequest: "workflow.start.request",
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
} as const;


export interface WorkflowEventPayloads {
  [workflowEvent.startRequest]: {
    template: WorkflowTemplate;
    initialPrompt: string; // The first user message that kicks off the workflow
  };
  [workflowEvent.resumeRequest]: {
    runId: string;
    // The corrected/approved data from the human
    resumeData?: any; 
  };
  [workflowEvent.cancelRequest]: {
    runId: string;
  };
  [workflowEvent.started]: {
    run: WorkflowRun;
  };
  [workflowEvent.paused]: {
    runId: string;
    step: WorkflowStep;
    pauseReason: 'human-in-the-loop' | 'data-correction';
    // For 'human-in-the-loop'
    dataForReview?: any;
    // For 'data-correction'
    rawAssistantResponse?: string;
  };
  [workflowEvent.resumed]: {
    runId: string;
  };
  [workflowEvent.stepCompleted]: {
    runId: string;
    stepId: string;
    output: any;
  };
  [workflowEvent.completed]: {
    runId: string;
    finalOutput: any;
  };
  [workflowEvent.error]: {
    runId: string;
    error: string;
  };
} 