export type WorkflowStepType = "prompt" | "agent-task" | "human-in-the-loop";

export interface WorkflowStep {
  id: string; // nanoid
  name: string; // User-defined name for the step
  type: WorkflowStepType;
  modelId?: string; // ID of the model to use for this step

  // For 'prompt' or 'agent-task' types
  templateId?: string; // ID of the PromptTemplate
  
  // For 'human-in-the-loop'
  instructionsForHuman?: string; // e.g., "Please review the summary and make any necessary corrections."

  // Defines how to map output from the *previous* step to the input variables of *this* step.
  // The keys are the variable names in this step's template (e.g., 'customer_email').
  // The values are JSONPath-like strings to extract data from the previous step's structured output (e.g., '$.user.email').
  inputMapping?: Record<string, string>;

  prompt?: string; // The prompt template for this step, denormalized from PromptTemplate
  structuredOutput?: {
    // The schema for the expected structured output. Denormalized from PromptTemplate
    schema: Record<string, 'string' | 'number' | 'boolean' | 'object' | 'array'>;
    jsonSchema: object;
  };
}

export interface WorkflowTemplate {
  id: string; // nanoid
  name: string;
  description: string;
  steps: WorkflowStep[];
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

export type WorkflowRunStatus = "IDLE" | "RUNNING" | "PAUSED" | "COMPLETED" | "ERROR" | "STREAMING" | "CANCELLED";

export interface WorkflowRun {
  runId: string; // Unique ID for this specific run
  mainInteractionId: string; // The ID of the parent 'workflow.run' interaction
  template: WorkflowTemplate;
  status: WorkflowRunStatus;
  currentStepIndex: number;
  stepOutputs: Record<string, any>; // Store any kind of output, including structured JSON
  error?: string; // Error message if the workflow fails
  startedAt: string; // ISO 8601
  completedAt?: string; // ISO 8601
} 