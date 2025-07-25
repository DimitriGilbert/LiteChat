/** biome-ignore-all lint/complexity/noStaticOnlyClass: <explanation> */
import React, { useState, useEffect, useMemo, useCallback, memo, useRef } from "react";

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
  ChevronRightIcon,
} from "lucide-react";
import { CodeBlockRenderer } from "./CodeBlockRenderer";
import { toast } from "sonner";
import { emitter } from "@/lib/litechat/event-emitter";
import { workflowEvent, type WorkflowEventPayloads } from "@/types/litechat/events/workflow.events";
import { nanoid } from "nanoid";
import type { WorkflowTemplate } from "@/types/litechat/workflow";
import { PersistenceService } from "@/services/persistence.service";
import { validateWorkflowForRenderer } from "@/lib/litechat/workflow-validation";

interface WorkflowBlockRendererProps {
  code: string;
  isStreaming?: boolean;
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
  const [workflowDefinition, setWorkflowDefinition] =
    useState<WorkflowTemplate | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCode, setShowCode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  
  // Track temporary workflow template IDs and their corresponding run IDs for cleanup
  const tempWorkflowMappingRef = useRef<Map<string, string>>(new Map()); // runId -> templateId

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
      const result = validateWorkflowForRenderer(code);
      
      if (!result.isValid) {
        throw new Error(result.error);
      }

      if (result.workflow) {
        setWorkflowDefinition(result.workflow);
      }
    } catch (err) {
      console.error("Workflow parsing error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to parse Workflow definition"
      );
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

  // Cleanup temporary workflows when workflow completes or errors
  useEffect(() => {
    const handleWorkflowStarted = (payload: WorkflowEventPayloads[typeof workflowEvent.started]) => {
      const templateId = payload.run.template.id;
      if (templateId.startsWith('temp_')) {
        tempWorkflowMappingRef.current.set(payload.run.runId, templateId);
      }
    };

    const handleWorkflowCompleted = (payload: WorkflowEventPayloads[typeof workflowEvent.completed]) => {
      const templateId = tempWorkflowMappingRef.current.get(payload.runId);
      if (templateId) {
        PersistenceService.deleteWorkflow(templateId).catch(console.error);
        tempWorkflowMappingRef.current.delete(payload.runId);
      }
    };

    const handleWorkflowError = (payload: WorkflowEventPayloads[typeof workflowEvent.error]) => {
      const templateId = tempWorkflowMappingRef.current.get(payload.runId);
      if (templateId) {
        PersistenceService.deleteWorkflow(templateId).catch(console.error);
        tempWorkflowMappingRef.current.delete(payload.runId);
      }
    };

    const handleWorkflowCancelled = (payload: WorkflowEventPayloads[typeof workflowEvent.cancelRequest]) => {
      const templateId = tempWorkflowMappingRef.current.get(payload.runId);
      if (templateId) {
        PersistenceService.deleteWorkflow(templateId).catch(console.error);
        tempWorkflowMappingRef.current.delete(payload.runId);
      }
    };

    emitter.on(workflowEvent.started, handleWorkflowStarted);
    emitter.on(workflowEvent.completed, handleWorkflowCompleted);
    emitter.on(workflowEvent.error, handleWorkflowError);
    emitter.on(workflowEvent.cancelRequest, handleWorkflowCancelled);

    return () => {
      emitter.off(workflowEvent.started, handleWorkflowStarted);
      emitter.off(workflowEvent.completed, handleWorkflowCompleted);
      emitter.off(workflowEvent.error, handleWorkflowError);
      emitter.off(workflowEvent.cancelRequest, handleWorkflowCancelled);
    };
  }, []);

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
    return code.split("\n").slice(0, 3).join("\n");
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
              {workflowDefinition.isShortcut && <div>Shortcut workflow</div>}
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
            type="button"
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
              type="button"
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
              type="button"
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
              type="button"
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
                    This workflow can be saved to your library, edited, or run
                    directly.
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
