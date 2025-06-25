import type { PromptVariable } from './prompt-template';

export type WorkflowStepType =
  | "trigger"
  | "prompt"
  | "agent-task"
  | "transform"
  | "tool-call"
  | "custom-prompt"
  | "function"
  | "human-in-the-loop";

export interface WorkflowStep {
  id: string; // nanoid
  name: string; // User-defined name for the step
  type: WorkflowStepType;
  modelId?: string; // ID of the model to use for this step

  // For 'prompt' or 'agent-task' types
  templateId?: string; // ID of the PromptTemplate
  
  // For 'human-in-the-loop'
  instructionsForHuman?: string; // e.g., "Please review the summary and make any necessary corrections."

  // For 'transform' type - JSON query mappings to transform data
  transformMappings?: Record<string, string>; // Field name -> JSONPath query string

  // For 'tool-call' type
  toolName?: string; // Name of the tool to call
  toolArgs?: Record<string, any>; // Static arguments defined in the UI

  // For 'custom-prompt' type
  promptContent?: string; // The custom prompt content
  promptVariables?: PromptVariable[]; // Input variables this step requires

  // For 'function' type
  functionLanguage?: 'js' | 'py'; // Language of the function
  functionCode?: string; // The function code
  functionVariables?: PromptVariable[]; // Input variables the function expects

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

  promptTemplateId?: string | null;
  agentId?: string | null;
  taskId?: string | null;
  transformDefinition?: any; //FIXME: should be WorkflowTransformDefinition but it's not defined
}

export interface WorkflowTemplate {
  id: string; // nanoid
  name: string;
  description: string;
  steps: WorkflowStep[];
  // Trigger information
  triggerType?: 'custom' | 'template' | 'task';
  triggerRef?: string; // template or task ID
  triggerPrompt?: string; // for custom prompts
  templateVariables?: Record<string, any>; // values for template variables
  isShortcut?: boolean; // New field for shortcut workflows
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

export type WorkflowRunStatus = "idle" | "running" | "completed" | "failed" | "paused" | "streaming" | "cancelled";

export interface WorkflowRun {
  runId: string; // Unique ID for this specific run
  conversationId: string; // The conversation this run belongs to
  mainInteractionId: string; // The "host" interaction for this run's UI
  template: WorkflowTemplate;
  status: WorkflowRunStatus;
  currentStepIndex: number;
  stepOutputs: Record<string, any>; // Store any kind of output, including structured JSON
  error?: string; // Error message if the workflow fails
  startedAt: string; // ISO 8601
  completedAt?: string; // ISO 8601
}

// Workflow error types for better error handling and debugging
export type WorkflowErrorCode = 
  | 'WORKFLOW_NOT_FOUND'
  | 'STEP_NOT_FOUND'
  | 'TEMPLATE_NOT_FOUND'
  | 'MODEL_NOT_AVAILABLE'
  | 'TEMPLATE_COMPILATION_FAILED'
  | 'STEP_CREATION_FAILED'
  | 'TRIGGER_STEP_FAILED'
  | 'TRANSFORM_STEP_FAILED'
  | 'HUMAN_STEP_FAILED'
  | 'AI_STEP_FAILED'
  | 'TOOL_NOT_FOUND'
  | 'TOOL_NO_IMPLEMENTATION'
  | 'TOOL_EXECUTION_FAILED'
  | 'DATA_VALIDATION_FAILED'
  | 'JSONPATH_INVALID'
  | 'OUTPUT_PARSING_FAILED'
  | 'CONVERSATION_NOT_FOUND'
  | 'PERSISTENCE_FAILED'
  | 'WORKFLOW_CANCELLED'
  | 'UNKNOWN_ERROR';

export interface WorkflowErrorContext {
  runId?: string;
  stepId?: string;
  stepIndex?: number;
  stepType?: WorkflowStepType | 'trigger';
  templateId?: string;
  modelId?: string;
  query?: string;
  toolName?: string;
  expectedFields?: string[];
  actualOutput?: any;
  [key: string]: any;
}

/**
 * Standardized error class for workflow operations
 * Provides consistent error formatting and context tracking
 */
export class WorkflowError extends Error {
  public readonly code: WorkflowErrorCode;
  public readonly context: WorkflowErrorContext;
  public readonly timestamp: string;
  public readonly isWorkflowError: boolean = true;

  constructor(
    message: string,
    code: WorkflowErrorCode = 'UNKNOWN_ERROR',
    context: WorkflowErrorContext = {}
  ) {
    super(WorkflowError.formatMessage(message, code, context));
    this.name = 'WorkflowError';
    this.code = code;
    this.context = context;
    this.timestamp = new Date().toISOString();

    // Maintain proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, WorkflowError);
    }
  }

  /**
   * Create a WorkflowError from any error, preserving the original error information
   */
  static fromError(
    error: unknown,
    code: WorkflowErrorCode = 'UNKNOWN_ERROR',
    context: WorkflowErrorContext = {}
  ): WorkflowError {
    if (error instanceof WorkflowError) {
      // Already a WorkflowError, just update context
      return new WorkflowError(error.message, error.code, { ...error.context, ...context });
    }

    const message = error instanceof Error ? error.message : String(error);
    const workflowError = new WorkflowError(message, code, context);

    // Preserve original stack if available
    if (error instanceof Error && error.stack) {
      workflowError.stack = error.stack;
    }

    return workflowError;
  }

  /**
   * Format error message with code and context for better debugging
   */
  private static formatMessage(
    message: string, 
    code: WorkflowErrorCode, 
    context: WorkflowErrorContext
  ): string {
    const parts = [`[${code}] ${message}`];
    
    if (context.runId) {
      parts.push(`(Run: ${context.runId})`);
    }
    
    if (context.stepId || context.stepIndex !== undefined) {
      const stepInfo = context.stepId 
        ? `Step: ${context.stepId}` 
        : `Step[${context.stepIndex}]`;
      parts.push(`(${stepInfo})`);
    }

    return parts.join(' ');
  }

  /**
   * Get user-friendly error message for display in UI
   */
  getUserMessage(): string {
    switch (this.code) {
      case 'TEMPLATE_NOT_FOUND':
        return `Template not found. Please check that the selected template still exists.`;
      case 'MODEL_NOT_AVAILABLE':
        return `The selected AI model is not available. Please check your model configuration.`;
      case 'TEMPLATE_COMPILATION_FAILED':
        return `Failed to compile template. Please check template variables and format.`;
      case 'TRANSFORM_STEP_FAILED':
        return `Data transformation failed. Please check your JSONPath queries.`;
      case 'JSONPATH_INVALID':
        return `Invalid JSONPath query: "${this.context.query}". Please check the syntax.`;
      case 'OUTPUT_PARSING_FAILED':
        return `Failed to parse AI response. The output format may be incorrect.`;
      case 'TOOL_NOT_FOUND':
        return `Tool "${this.context.toolName}" not found. Please check that the tool is still available.`;
      case 'TOOL_NO_IMPLEMENTATION':
        return `Tool "${this.context.toolName}" has no implementation. Please contact the tool provider.`;
      case 'TOOL_EXECUTION_FAILED':
        return `Tool "${this.context.toolName}" execution failed. Please check the tool arguments and try again.`;
      case 'CONVERSATION_NOT_FOUND':
        return `Conversation not found. Please ensure you have an active conversation.`;
      default:
        return this.message;
    }
  }

  /**
   * Get debugging information for error reporting
   */
  getDebugInfo(): Record<string, any> {
    return {
      message: this.message,
      code: this.code,
      context: this.context,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }

  /**
   * Convert to JSON for logging or persistence
   */
  toJSON(): Record<string, any> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      timestamp: this.timestamp
    };
  }
} 