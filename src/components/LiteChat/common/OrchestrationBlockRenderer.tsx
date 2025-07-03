import React, { useState, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { CodeIcon, PlayIcon, SaveIcon, EditIcon, AlertCircleIcon } from "lucide-react";
import { toast } from "sonner";
import { emitter } from "@/lib/litechat/event-emitter";
import { PersistenceService } from "@/services/persistence.service";
import type { WorkflowTemplate } from "@/types/litechat/workflow";
import { uiEvent } from "@/types/litechat/events/ui.events";
import { usePromptTemplateStore } from "@/store/prompt-template.store";
import { nanoid } from "nanoid";
import { workflowEvent } from "@/types/litechat/events/workflow.events";
import { useControlRegistryStore } from "@/store/control.store";
import { useSettingsStore } from "@/store/settings.store";
import { useShallow } from "zustand/react/shallow";
import { CodeBlockRenderer } from "./CodeBlockRenderer";
import type { CanvasControl } from "@/types/litechat/canvas/control";
import { useConversationStore } from "@/store/conversation.store";

interface OrchestrationBlockProps {
  code: string;
  isStreaming: boolean;
}

function parseWorkflow(code: string): { workflow?: WorkflowTemplate; error?: string } {
  if (!code.trim()) {
    return {};
  }
  try {
    const parsed = JSON.parse(code);
    // Basic validation
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
    // Only show parse errors if not streaming, to avoid flicker with incomplete JSON
    return { error: `Invalid workflow JSON: ${(e as Error).message}` };
  }
}

function checkIfWorkflowNeedsInput(workflow: WorkflowTemplate): boolean {
  if (workflow.triggerType === 'custom' && !workflow.triggerPrompt) {
    return true;
  }
  if (workflow.triggerType === 'template' && workflow.triggerRef) {
    const templates = usePromptTemplateStore.getState().promptTemplates;
    const template = templates.find(t => t.id === workflow.triggerRef);
    if (template?.variables?.length) {
      return !template.variables.every(variable => {
        const value = workflow.templateVariables?.[variable.name];
        return value !== undefined && value !== null && value !== '';
      });
    }
  }
  return false;
}

export const OrchestrationBlockRenderer: React.FC<OrchestrationBlockProps> = ({ code, isStreaming = false }) => {
  const { t } = useTranslation('renderers');
  const { foldStreamingCodeBlocks } = useSettingsStore(
    useShallow((state) => ({
      foldStreamingCodeBlocks: state.foldStreamingCodeBlocks,
    }))
  );
  const conversationId = useConversationStore(state => state.selectedItemId);

  const [isFolded, setIsFolded] = useState(isStreaming ? foldStreamingCodeBlocks : false);
  const [showCode, setShowCode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const { workflow, error } = useMemo(() => {
    if (isStreaming) {
        const trimmedCode = code.trim();
        const isLikelyJson = (trimmedCode.startsWith('{') && trimmedCode.endsWith('}'));
        if (!isLikelyJson) return {}; // Wait for more complete structure
        const openBraces = (trimmedCode.match(/[{[]/g) || []).length;
        const closeBraces = (trimmedCode.match(/[}\]]/g) || []).length;
        if (openBraces !== closeBraces) return {}; // Still incomplete
    }
    return parseWorkflow(code);
  }, [code, isStreaming]);

  const canvasControls = useControlRegistryStore(
    useShallow((state) => Object.values(state.canvasControls))
  );

  const toggleFold = () => setIsFolded((prev) => !prev);
  const toggleView = () => setShowCode((prev) => !prev);

  const handleRun = useCallback(() => {
    if (!workflow || !conversationId) return;
    if (checkIfWorkflowNeedsInput(workflow)) {
      emitter.emit(uiEvent.openModalRequest, {
        modalId: "workflowBuilderModal",
        modalProps: { workflow },
      });
    } else {
      emitter.emit(workflowEvent.startRequest, { template: workflow, initialPrompt: workflow.triggerPrompt || "", conversationId });
      toast.success(t('orchestrationBlock.runRequestSent', { name: workflow.name }));
    }
  }, [workflow, t, conversationId]);

  const handleSave = useCallback(async () => {
    if (!workflow) return;
    setIsSaving(true);
    try {
      const existing = await PersistenceService.loadWorkflows().then(ws => ws.find(w => w.id === workflow.id) || null);
      const workflowToSave: WorkflowTemplate = existing ? { ...workflow } : {
        ...workflow,
        steps: workflow.steps.map(step => ({ ...step, id: nanoid() }))
      };
      await PersistenceService.saveWorkflow(workflowToSave);
      toast.success(t('orchestrationBlock.saveSuccess'));
    } catch (e) {
      toast.error(t('orchestrationBlock.saveFailed', { message: (e as Error).message }));
    } finally {
      setIsSaving(false);
    }
  }, [workflow, t]);

  const handleEdit = useCallback(() => {
    if (!workflow) return;
    emitter.emit(uiEvent.openModalRequest, {
      modalId: "workflowBuilderModal",
      modalProps: { workflow },
    });
  }, [workflow]);

  const renderSlotForCodeBlock = useCallback(
    (
      targetSlotName: CanvasControl["targetSlot"],
      currentCode: string,
      currentLang?: string,
      currentIsFolded?: boolean,
      currentToggleFold?: () => void
    ): React.ReactNode[] => {
      return canvasControls
        .filter(c => c.type === "codeblock" && c.targetSlot === targetSlotName && c.renderer)
        .map((control) => (
          <React.Fragment key={control.id}>
            {control.renderer!({
              codeBlockContent: currentCode,
              codeBlockLang: currentLang,
              isFolded: currentIsFolded,
              toggleFold: currentToggleFold,
              canvasContextType: "codeblock",
            })}
          </React.Fragment>
        ));
    },
    [canvasControls]
  );

  const foldedPreviewText = useMemo(() => {
    if (!code) return "";
    return code.split("\n").slice(0, 3).join("\n");
  }, [code]);

  const codeBlockHeaderActions = renderSlotForCodeBlock(
    "codeblock-header-actions",
    code,
    "orchestration",
    isFolded,
    toggleFold
  );

  if (error && !isStreaming) {
    return (
      <div className="p-4 border border-destructive/20 bg-destructive/10 rounded-md">
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircleIcon className="h-5 w-5 flex-shrink-0" />
          <div className="font-medium">{t('orchestrationBlock.dataErrorTitle')}</div>
        </div>
        <pre className="text-xs mt-2 p-2 bg-black/20 rounded font-mono whitespace-pre-wrap">{error}</pre>
      </div>
    );
  }

  if (!workflow) {
    return isStreaming ? (
        <div className="code-block-container group/codeblock my-4 max-w-full">
            <div className="code-block-header sticky top-0 z-10 flex items-center justify-between">
                <div className="flex items-center gap-1">
                    <div className="text-sm font-medium">{t('orchestrationBlock.header')}</div>
                </div>
            </div>
            <div className="p-4 text-muted-foreground">{t('orchestrationBlock.waitingForData')}</div>
        </div>
    ) : null;
  }

  return (
    <div className="code-block-container group/codeblock my-4 max-w-full">
      <div className="code-block-header sticky top-0 z-10 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <div className="text-sm font-medium">{t('orchestrationBlock.header')}</div>
          <div className="flex items-center gap-0.5 opacity-0 group-hover/codeblock:opacity-100 focus-within:opacity-100 transition-opacity">
            {codeBlockHeaderActions}
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover/codeblock:opacity-100 focus-within:opacity-100 transition-opacity">
          <Button size="sm" variant="ghost" onClick={handleRun} title={t('orchestrationBlock.runTitle')}>
            <PlayIcon className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={handleSave} disabled={isSaving} title={t('orchestrationBlock.saveTitle')}>
            <SaveIcon className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={handleEdit} title={t('orchestrationBlock.editTitle')}>
            <EditIcon className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={toggleView} title={showCode ? t('orchestrationBlock.showWorkflowTitle') : t('orchestrationBlock.showCodeTitle')}>
            <CodeIcon className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {!isFolded && (
        <div className="overflow-hidden w-full">
          {showCode ? (
            <CodeBlockRenderer lang="json" code={code} isStreaming={isStreaming} />
          ) : (
            <div className="p-4">
              <div className="font-bold text-lg">{workflow.name}</div>
              <div className="text-sm text-muted-foreground mb-2">{workflow.description}</div>
              <div className="border rounded bg-background/50 p-2">
                <div className="font-semibold mb-1">{t('orchestrationBlock.stepsHeader')}:</div>
                <ol className="list-decimal ml-5 space-y-1">
                  {workflow.steps.map((step) => (
                    <li key={step.id}>
                      <span className="font-medium">{step.name}</span>{' '}
                      <span className="text-xs text-muted-foreground">[{step.type}]</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}
        </div>
      )}

      {isFolded && (
        <div className="folded-content-preview p-4 cursor-pointer w-full box-border" onClick={toggleFold}>
          <pre className="whitespace-pre-wrap break-words text-muted-foreground font-mono text-sm">
            {foldedPreviewText}
          </pre>
        </div>
      )}
    </div>
  );
}; 