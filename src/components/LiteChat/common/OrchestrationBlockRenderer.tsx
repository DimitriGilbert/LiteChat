import React, { useState, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { CodeIcon, PlayIcon, SaveIcon, EditIcon, ChevronDownIcon, ChevronRightIcon, AlertCircleIcon } from "lucide-react";
import { toast } from "sonner";
import { emitter } from "@/lib/litechat/event-emitter";
import { PersistenceService } from "@/services/persistence.service";
import type { WorkflowTemplate } from "@/types/litechat/workflow";
import { uiEvent } from "@/types/litechat/events/ui.events";
import { usePromptTemplateStore } from "@/store/prompt-template.store";
import { nanoid } from "nanoid";

interface OrchestrationBlockRendererProps {
  code: string;
  isStreaming?: boolean;
}

function parseWorkflow(code: string): { workflow?: WorkflowTemplate; error?: string } {
  try {
    const parsed = JSON.parse(code);
    // Basic validation (reuse logic from WorkflowRawEditor)
    if (!parsed.id || typeof parsed.id !== "string") return { error: 'Workflow must have a valid "id" field (string)' };
    if (!parsed.name || typeof parsed.name !== "string") return { error: 'Workflow must have a valid "name" field (string)' };
    if (!parsed.description || typeof parsed.description !== "string") return { error: 'Workflow must have a valid "description" field (string)' };
    if (!Array.isArray(parsed.steps)) return { error: 'Workflow must have a "steps" field that is an array' };
    if (!parsed.createdAt || typeof parsed.createdAt !== "string") return { error: 'Workflow must have a valid "createdAt" field (ISO string)' };
    if (!parsed.updatedAt || typeof parsed.updatedAt !== "string") return { error: 'Workflow must have a valid "updatedAt" field (ISO string)' };
    // Steps validation (minimal)
    for (let i = 0; i < parsed.steps.length; i++) {
      const step = parsed.steps[i];
      if (!step.id || typeof step.id !== "string") return { error: `Step ${i + 1}: must have a valid "id" field (string)` };
      if (!step.name || typeof step.name !== "string") return { error: `Step ${i + 1}: must have a valid "name" field (string)` };
      if (!step.type || typeof step.type !== "string") return { error: `Step ${i + 1}: must have a valid "type" field (string)` };
    }
    return { workflow: parsed as WorkflowTemplate };
  } catch (e) {
    return { error: `Invalid workflow JSON: ${(e as Error).message}` };
  }
}

function checkIfWorkflowNeedsInput(workflow: WorkflowTemplate): boolean {
  // Check if trigger needs input
  if (workflow.triggerType === 'custom' && !workflow.triggerPrompt) {
    return true; // Custom trigger without prompt
  }
  if (workflow.triggerType === 'template' && workflow.triggerRef) {
    // Check if template has variables that need values
    const templates = usePromptTemplateStore.getState().promptTemplates;
    const template = templates.find(t => t.id === workflow.triggerRef);
    if (template && template.variables && template.variables.length > 0) {
      // Check if templateVariables has all required values
      const hasAllValues = template.variables.every(variable => {
        const value = workflow.templateVariables?.[variable.name];
        return value !== undefined && value !== null && value !== '';
      });
      if (!hasAllValues) return true;
    }
  }
  // Workflow is ready to run
  return false;
}

export const OrchestrationBlockRenderer: React.FC<OrchestrationBlockRendererProps> = ({ code, isStreaming = false }) => {
  const { t } = useTranslation();
  const [isFolded, setIsFolded] = useState(isStreaming);
  const [showCode, setShowCode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { workflow, error } = useMemo(() => parseWorkflow(code), [code]);

  const handleRun = useCallback(async () => {
    if (!workflow) return;
    const needsInput = checkIfWorkflowNeedsInput(workflow);
    if (needsInput) {
      // Open the workflow builder modal for configuration
      emitter.emit(uiEvent.openModalRequest, {
        modalId: "workflowBuilderModal",
        modalProps: { workflow },
      });
      return;
    }
    // Always create a temporary workflow in the DB with __TEMP__ prefix
    const tempWorkflow = {
      ...workflow,
      id: nanoid(),
      name: `__TEMP__-${workflow.name}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    let tempId = tempWorkflow.id;
    try {
      await PersistenceService.saveWorkflow(tempWorkflow);
      // Run using the event system, passing the temp workflow's ID
      emitter.emit("workflow.run.orchestration", { workflowId: tempId });
      toast.success(`Workflow "${workflow.name}" started!`);
    } catch (e) {
      toast.error("Failed to run workflow: " + (e instanceof Error ? e.message : String(e)));
      // Attempt cleanup if save failed
      try { await PersistenceService.deleteWorkflow(tempId); } catch {}
      return;
    }
    // Always delete the temp workflow after a short delay to allow runner to fetch it
    setTimeout(async () => {
      try { await PersistenceService.deleteWorkflow(tempId); } catch {}
    }, 5000);
  }, [workflow]);

  const handleSave = useCallback(async () => {
    if (!workflow) return;
    setIsSaving(true);
    try {
      // Check if this workflow already exists in the DB
      let existing: WorkflowTemplate | null = null;
      try {
        existing = await PersistenceService.loadWorkflows().then(ws => ws.find(w => w.id === workflow.id) || null);
      } catch (e) {
        existing = null;
      }
      let workflowToSave: WorkflowTemplate;
      if (existing) {
        // Editing existing: preserve all step IDs
        workflowToSave = { ...workflow };
      } else {
        // New workflow: assign IDs according to the strict plan
        workflowToSave = {
          ...workflow,
          steps: workflow.steps.map(step => {
            if (
              (step.type === 'prompt' && step.templateId) ||
              (step.type === 'agent-task' && step.taskId)
            ) {
              // Preserve the step id as-is
              return { ...step };
            } else {
              // Assign a new nanoid for all other cases
              return { ...step, id: nanoid() };
            }
          })
        };
      }
      await PersistenceService.saveWorkflow(workflowToSave);
      toast.success("Workflow saved to library");
    } catch (e) {
      toast.error("Failed to save workflow: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setIsSaving(false);
    }
  }, [workflow]);

  const handleEdit = useCallback(() => {
    if (!workflow) return;
    // Open the workflow builder modal with the workflow as modalProps
    emitter.emit(uiEvent.openModalRequest, {
      modalId: "workflowBuilderModal",
      modalProps: { workflow },
    });
  }, [workflow]);

  if (error) {
    return (
      <div className="border border-red-400 bg-red-50 text-red-700 rounded p-4 flex items-center gap-2">
        <AlertCircleIcon className="w-5 h-5" />
        <span>{error}</span>
      </div>
    );
  }

  if (!workflow) return null;

  return (
    <div className="border rounded bg-muted p-4 mb-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setIsFolded(f => !f)} aria-label="Toggle fold">
            {isFolded ? <ChevronRightIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
          </Button>
          <span className="font-bold text-lg">{workflow.name}</span>
          <span className="text-xs text-muted-foreground">Orchestration Workflow</span>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleRun} title="Run Workflow">
            <PlayIcon className="w-4 h-4 mr-1" /> {t("Run")}
          </Button>
          <Button size="sm" variant="outline" onClick={handleSave} disabled={isSaving} title="Save Workflow">
            <SaveIcon className="w-4 h-4 mr-1" /> {t("Save")}
          </Button>
          <Button size="sm" variant="outline" onClick={handleEdit} title="Edit Workflow">
            <EditIcon className="w-4 h-4 mr-1" /> {t("Edit")}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setShowCode(c => !c)} title="Show code">
            <CodeIcon className="w-4 h-4" />
          </Button>
        </div>
      </div>
      {/* Preview Area */}
      {!isFolded && (
        <div className="mb-2">
          <div className="text-sm text-muted-foreground mb-1">{workflow.description}</div>
          <div className="border rounded bg-background p-2">
            <div className="font-semibold mb-1">Steps:</div>
            <ol className="list-decimal ml-5">
              {workflow.steps.map((step) => (
                <li key={step.id} className="mb-1">
                  <span className="font-medium">{step.name}</span> <span className="text-xs text-muted-foreground">[{step.type}]</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
      {/* Code View */}
      {showCode && (
        <pre className="mt-2 p-2 bg-background border rounded text-xs overflow-x-auto">
          <code>{code}</code>
        </pre>
      )}
    </div>
  );
}; 