import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  memo,
} from "react";

import { useSettingsStore } from "@/store/settings.store";
import { useConversationStore } from "@/store/conversation.store";
import { useShallow } from "zustand/react/shallow";
import type { CanvasControl } from "@/types/litechat/canvas/control";
import { useControlRegistryStore } from "@/store/control.store";
import type { CanvasControlRenderContext } from "@/types/litechat/canvas/control";
import { 
  AlertCircleIcon, 
  Loader2Icon, 
  PlayIcon, 
  SaveIcon, 
  EditIcon, 
  CodeIcon,
  WorkflowIcon,
  ChevronRightIcon
} from "lucide-react";
import { CodeBlockRenderer } from "./CodeBlockRenderer";
import { toast } from "sonner";
import { emitter } from "@/lib/litechat/event-emitter";
import { workflowEvent } from "@/types/litechat/events/workflow.events";
import { nanoid } from "nanoid";
import type { WorkflowTemplate, WorkflowStep } from "@/types/litechat/workflow";
import { PersistenceService } from "@/services/persistence.service";

interface WorkflowBlockRendererProps {
  code: string;
  isStreaming?: boolean;
}

// Safe parser for Workflow definitions
class WorkflowParser {
  private static readonly ALLOWED_STEP_TYPES = [
    'trigger', 'prompt', 'agent-task', 'transform', 'tool-call', 
    'custom-prompt', 'function', 'human-in-the-loop', 'parallel', 'sub-workflow'
  ];

  private static readonly ALLOWED_WORKFLOW_KEYS = [
    'id', 'name', 'description', 'steps', 'triggerType', 'triggerRef', 
    'triggerPrompt', 'templateVariables', 'isShortcut', 'createdAt', 'updatedAt'
  ];

  private static readonly ALLOWED_STEP_KEYS = [
    'id', 'name', 'type', 'modelId', 'templateId', 'instructionsForHuman',
    'transformMappings', 'toolName', 'toolArgs', 'promptContent', 'promptVariables',
    'functionLanguage', 'functionCode', 'functionVariables', 'parallelOn',
    'parallelStep', 'parallelModelVar', 'subWorkflowTemplateId', 'subWorkflowInputMapping',
    'inputMapping', 'prompt', 'structuredOutput', 'promptTemplateId', 'agentId',
    'taskId', 'transformDefinition'
  ];

  static parse(code: string): WorkflowTemplate {
    try {
      // Remove any potential function calls or dangerous patterns
      const sanitizedCode = this.sanitizeCode(code);
      
      // Parse the JSON-like structure
      const parsed = this.parseObjectLiteral(sanitizedCode);
      
      // Validate and sanitize the parsed object
      return this.validateAndSanitize(parsed);
    } catch (error) {
      throw new Error(`Failed to parse Workflow definition: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private static sanitizeCode(code: string): string {
    // Remove comments
    let sanitized = code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    
    // Remove any function calls or expressions that could be dangerous
    sanitized = sanitized.replace(/\b(eval|Function|setTimeout|setInterval|require|import)\s*\(/g, '');
    
    // Remove any arrow functions or function expressions
    sanitized = sanitized.replace(/=>\s*{[^}]*}/g, '""');
    sanitized = sanitized.replace(/function\s*\([^)]*\)\s*{[^}]*}/g, '""');
    
    return sanitized;
  }

  private static parseObjectLiteral(code: string): any {
    try {
      // First try direct JSON parsing
      return JSON.parse(code);
    } catch (jsonError) {
      // If that fails, try to convert JS object literal to JSON
      try {
        let processedCode = code.trim();
        
        // Convert unquoted keys to quoted keys
        processedCode = processedCode.replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":');
        
        // Remove trailing commas
        processedCode = processedCode.replace(/,(\s*[}\]])/g, '$1');
        
        // Convert single quotes to double quotes
        processedCode = processedCode.replace(/'/g, '"');
        
        return JSON.parse(processedCode);
      } catch (conversionError) {
        throw new Error(`Invalid syntax. Please use valid JSON format or JavaScript object literal syntax. Error: ${conversionError instanceof Error ? conversionError.message : String(conversionError)}`);
      }
    }
  }

  private static validateAndSanitize(obj: any): WorkflowTemplate {
    if (typeof obj !== 'object' || obj === null) {
      throw new Error('Definition must be an object');
    }

    const sanitized: any = {};

    // Validate top-level keys
    for (const [key, value] of Object.entries(obj)) {
      if (!this.ALLOWED_WORKFLOW_KEYS.includes(key)) {
        continue; // Skip unknown keys
      }

      switch (key) {
        case 'id':
        case 'name':
        case 'description':
        case 'triggerRef':
        case 'triggerPrompt':
        case 'createdAt':
        case 'updatedAt':
          if (typeof value === 'string') {
            sanitized[key] = value;
          }
          break;
        case 'steps':
          sanitized[key] = this.validateSteps(value);
          break;
        case 'triggerType':
          if (typeof value === 'string' && ['custom', 'template', 'task'].includes(value)) {
            sanitized[key] = value;
          }
          break;
        case 'templateVariables':
          if (typeof value === 'object' && value !== null) {
            sanitized[key] = value;
          }
          break;
        case 'isShortcut':
          if (typeof value === 'boolean') {
            sanitized[key] = value;
          }
          break;
      }
    }

    // Ensure required fields
    if (!sanitized.name) {
      throw new Error('Workflow must have a name');
    }
    if (!sanitized.description) {
      sanitized.description = '';
    }
    if (!sanitized.steps) {
      sanitized.steps = [];
    }

    // Generate ID if not provided
    if (!sanitized.id) {
      sanitized.id = nanoid();
    }

    // Set timestamps if not provided
    const now = new Date().toISOString();
    if (!sanitized.createdAt) {
      sanitized.createdAt = now;
    }
    if (!sanitized.updatedAt) {
      sanitized.updatedAt = now;
    }

    return sanitized as WorkflowTemplate;
  }

  private static validateSteps(steps: any): WorkflowStep[] {
    if (!Array.isArray(steps)) {
      return [];
    }

    return steps.map((step, index) => {
      if (typeof step !== 'object' || step === null) {
        throw new Error(`Step at index ${index} must be an object`);
      }

      const sanitizedStep: any = {};

      for (const [key, value] of Object.entries(step)) {
        if (!this.ALLOWED_STEP_KEYS.includes(key)) {
          continue;
        }

        switch (key) {
          case 'id':
          case 'name':
          case 'modelId':
          case 'templateId':
          case 'instructionsForHuman':
          case 'toolName':
          case 'promptContent':
          case 'functionLanguage':
          case 'functionCode':
          case 'parallelOn':
          case 'parallelModelVar':
          case 'subWorkflowTemplateId':
          case 'prompt':
          case 'promptTemplateId':
          case 'agentId':
          case 'taskId':
            if (typeof value === 'string') {
              sanitizedStep[key] = value;
            }
            break;
          case 'type':
            if (typeof value === 'string' && this.ALLOWED_STEP_TYPES.includes(value)) {
              sanitizedStep[key] = value;
            }
            break;
          case 'transformMappings':
          case 'toolArgs':
          case 'inputMapping':
          case 'subWorkflowInputMapping':
          case 'structuredOutput':
          case 'transformDefinition':
            if (typeof value === 'object' && value !== null) {
              sanitizedStep[key] = value;
            }
            break;
          case 'promptVariables':
          case 'functionVariables':
            if (Array.isArray(value)) {
              sanitizedStep[key] = value;
            }
            break;
          case 'parallelStep':
            if (typeof value === 'object' && value !== null) {
              sanitizedStep[key] = this.validateSteps([value])[0];
            }
            break;
        }
      }

      // Ensure required fields
      if (!sanitizedStep.id) {
        sanitizedStep.id = nanoid();
      }
      if (!sanitizedStep.name) {
        sanitizedStep.name = `Step ${index + 1}`;
      }
      if (!sanitizedStep.type) {
        throw new Error(`Step at index ${index} must have a type`);
      }

      return sanitizedStep as WorkflowStep;
    });
  }
}

const WorkflowBlockRendererComponent: React.FC<WorkflowBlockRendererProps> = ({
  code,
  isStreaming = false,
}) => {
  const { foldStreamingCodeBlocks } = useSettingsStore(
    useShallow((state) => ({
      foldStreamingCodeBlocks: state.foldStreamingCodeBlocks,
    }))
  );

  const { selectedItemId } = useConversationStore(
    useShallow((state) => ({
      selectedItemId: state.selectedItemId,
    }))
  );

  const [isFolded, setIsFolded] = useState(
    isStreaming ? foldStreamingCodeBlocks : false
  );
  const [workflowDefinition, setWorkflowDefinition] = useState<WorkflowTemplate | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCode, setShowCode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  const canvasControls = useControlRegistryStore(
    useShallow((state) => Object.values(state.canvasControls))
  );

  const renderSlotForCodeBlock = useCallback(
    (
      targetSlotName: CanvasControl["targetSlot"],
      currentCode: string,
      currentIsFolded?: boolean,
      currentToggleFold?: () => void
    ): React.ReactNode[] => {
      return canvasControls
        .filter(
          (c) =>
            c.type === "codeblock" &&
            c.targetSlot === targetSlotName &&
            c.renderer
        )
        .map((control) => {
          if (control.renderer) {
            const context: CanvasControlRenderContext = {
              codeBlockContent: currentCode,
              codeBlockLang: "workflow",
              isFolded: currentIsFolded,
              toggleFold: currentToggleFold,
              canvasContextType: "codeblock",
            };
            return (
              <React.Fragment key={control.id}>
                {control.renderer(context)}
              </React.Fragment>
            );
          }
          return null;
        })
        .filter(Boolean);
    },
    [canvasControls]
  );

  const parseWorkflowDefinition = useCallback(async () => {
    if (!code.trim() || isFolded) return;

    setIsLoading(true);
    setError(null);
    setWorkflowDefinition(null);

    try {
      const parsed = WorkflowParser.parse(code);
      setWorkflowDefinition(parsed);
    } catch (err) {
      console.error("Workflow parsing error:", err);
      setError(err instanceof Error ? err.message : "Failed to parse Workflow definition");
    } finally {
      setIsLoading(false);
    }
  }, [code, isFolded]);

  useEffect(() => {
    // Only parse if not folded, code is present, not showing raw code, AND NOT STREAMING
    if (!isFolded && code.trim() && !showCode && !isStreaming) {
      parseWorkflowDefinition();
    }
  }, [code, isFolded, showCode, isStreaming, parseWorkflowDefinition]);

  const toggleFold = () => {
    const unfolding = isFolded;
    setIsFolded((prev) => !prev);
    if (unfolding && !showCode) {
      setTimeout(parseWorkflowDefinition, 0);
    }
  };

  const toggleView = useCallback(() => {
    setShowCode((prev) => !prev);
  }, []);

  const foldedPreviewText = useMemo(() => {
    if (!code) return "";
    return code
      .split("\n")
      .slice(0, 3)
      .join("\n");
  }, [code]);

  // Handle workflow save
  const handleSaveWorkflow = useCallback(async () => {
    if (!workflowDefinition) return;

    setIsSaving(true);
    try {
      const workflowToSave: WorkflowTemplate = {
        ...workflowDefinition,
        id: workflowDefinition.id || nanoid(),
        createdAt: workflowDefinition.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      await PersistenceService.saveWorkflow(workflowToSave);
      toast.success("Workflow saved successfully");
    } catch (error) {
      toast.error("Failed to save workflow", {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsSaving(false);
    }
  }, [workflowDefinition]);

  // Handle workflow edit (placeholder - would need WorkflowBuilder integration)
  const handleEditWorkflow = useCallback(() => {
    if (!workflowDefinition) return;
    
    // TODO: Implement edit functionality with WorkflowBuilder
    toast.info("Edit functionality coming soon", {
      description: "This will open the workflow in the WorkflowBuilder",
    });
  }, [workflowDefinition]);

  // Handle workflow run
  const handleRunWorkflow = useCallback(async () => {
    if (!workflowDefinition || !selectedItemId) return;

    setIsRunning(true);
    try {
      // Create temporary workflow entry for execution
      const tempWorkflow: WorkflowTemplate = {
        ...workflowDefinition,
        id: `temp_${nanoid()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      // Save temporarily to database (required for execution)
      await PersistenceService.saveWorkflow(tempWorkflow);
      
      // Execute workflow
      emitter.emit(workflowEvent.startRequest, {
        template: tempWorkflow,
        initialPrompt: "Workflow started from chat block",
        conversationId: selectedItemId,
      });
      
      toast.success("Workflow started successfully");
    } catch (error) {
      toast.error("Failed to run workflow", {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsRunning(false);
    }
  }, [workflowDefinition, selectedItemId]);

  // Render workflow visualization
  const renderedWorkflow = useMemo(() => {
    if (!workflowDefinition) return null;

    return (
      <div className="space-y-4">
        {/* Workflow header */}
        <div className="border-b pb-3">
          <h3 className="font-semibold text-lg">{workflowDefinition.name}</h3>
          {workflowDefinition.description && (
            <p className="text-sm text-muted-foreground mt-1">
              {workflowDefinition.description}
            </p>
          )}
        </div>

        {/* Steps visualization */}
        <div className="space-y-2">
          <h4 className="font-medium text-sm text-muted-foreground">
            Steps ({workflowDefinition.steps.length})
          </h4>
          {workflowDefinition.steps.length === 0 ? (
            <div className="text-sm text-muted-foreground italic">
              No steps defined
            </div>
          ) : (
            <div className="space-y-2">
              {workflowDefinition.steps.map((step, index) => (
                <div
                  key={step.id}
                  className="flex items-center gap-2 p-2 bg-muted/30 rounded-md"
                >
                  <div className="flex items-center gap-2 flex-1">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-sm">{step.name}</div>
                      <div className="text-xs text-muted-foreground">
                        Type: {step.type}
                        {step.modelId && ` • Model: ${step.modelId}`}
                      </div>
                    </div>
                  </div>
                  {index < workflowDefinition.steps.length - 1 && (
                    <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Workflow metadata */}
        {(workflowDefinition.triggerType || workflowDefinition.isShortcut) && (
          <div className="pt-3 border-t">
            <div className="text-xs text-muted-foreground space-y-1">
              {workflowDefinition.triggerType && (
                <div>Trigger: {workflowDefinition.triggerType}</div>
              )}
              {workflowDefinition.isShortcut && (
                <div>Shortcut workflow</div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }, [workflowDefinition]);

  const codeBlockHeaderActions = renderSlotForCodeBlock(
    "codeblock-header-actions",
    code,
    isFolded,
    toggleFold
  );

  return (
    <div className="code-block-container group/codeblock my-4 max-w-full">
      <div className="code-block-header sticky top-0 z-[var(--z-sticky)] flex items-center justify-between">
        <div className="flex items-center gap-1">
          <WorkflowIcon className="h-4 w-4" />
          <div className="text-sm font-medium">Orchestration</div>
          <div className="flex items-center gap-0.5 opacity-0 group-hover/codeblock:opacity-100 focus-within:opacity-100 transition-opacity">
            {codeBlockHeaderActions}
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover/codeblock:opacity-100 focus-within:opacity-100 transition-opacity">
          {/* Toggle between workflow and code view */}
          <button
            onClick={toggleView}
            className="p-1.5 rounded-md hover:bg-muted/50 transition-colors"
            title={showCode ? "Show workflow view" : "Show code view"}
          >
            {showCode ? (
              <WorkflowIcon className="h-4 w-4" />
            ) : (
              <CodeIcon className="h-4 w-4" />
            )}
          </button>

          {/* Save button */}
          {workflowDefinition && !showCode && (
            <button
              onClick={handleSaveWorkflow}
              disabled={isSaving}
              className="p-1.5 rounded-md hover:bg-muted/50 transition-colors disabled:opacity-50"
              title="Save workflow"
            >
              {isSaving ? (
                <Loader2Icon className="h-4 w-4 animate-spin" />
              ) : (
                <SaveIcon className="h-4 w-4" />
              )}
            </button>
          )}

          {/* Edit button */}
          {workflowDefinition && !showCode && (
            <button
              onClick={handleEditWorkflow}
              className="p-1.5 rounded-md hover:bg-muted/50 transition-colors"
              title="Edit workflow"
            >
              <EditIcon className="h-4 w-4" />
            </button>
          )}

          {/* Run button */}
          {workflowDefinition && !showCode && selectedItemId && (
            <button
              onClick={handleRunWorkflow}
              disabled={isRunning}
              className="p-1.5 rounded-md hover:bg-muted/50 transition-colors disabled:opacity-50"
              title="Run workflow"
            >
              {isRunning ? (
                <Loader2Icon className="h-4 w-4 animate-spin" />
              ) : (
                <PlayIcon className="h-4 w-4" />
              )}
            </button>
          )}
        </div>
      </div>

      {!isFolded && (
        <div className="overflow-hidden w-full">
          {showCode ? (
            // Show raw code using CodeBlockRenderer
            <CodeBlockRenderer
              lang="json"
              code={code}
              isStreaming={isStreaming}
            />
          ) : (
            // Show workflow visualization
            <>
              {isLoading && (
                <div className="flex items-center justify-center p-8">
                  <Loader2Icon className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">
                    Parsing workflow...
                  </span>
                </div>
              )}
              
              {error && !isStreaming && (
                <div className="flex items-center gap-2 p-4 border border-destructive/20 bg-destructive/10 rounded-md">
                  <AlertCircleIcon className="h-5 w-5 text-destructive flex-shrink-0" />
                  <div className="text-sm text-destructive">
                    <div className="font-medium">Parse Error</div>
                    <div className="text-xs mt-1 opacity-80">{error}</div>
                  </div>
                </div>
              )}
              
              {renderedWorkflow && !isLoading && !error && (
                <div className="p-4 bg-background border rounded-md">
                  <div className="mb-4 p-2 bg-muted/50 rounded text-xs text-muted-foreground">
                    This workflow can be saved to your library, edited, or run directly.
                  </div>
                  {renderedWorkflow}
                </div>
              )}
            </>
          )}
        </div>
      )}
      
      {isFolded && (
        <div
          className="folded-content-preview p-4 cursor-pointer w-full box-border"
          onClick={toggleFold}
        >
          <pre className="whitespace-pre-wrap break-words text-muted-foreground font-mono text-sm">
            {foldedPreviewText}
          </pre>
        </div>
      )}
    </div>
  );
};

export const WorkflowBlockRenderer = memo(WorkflowBlockRendererComponent);