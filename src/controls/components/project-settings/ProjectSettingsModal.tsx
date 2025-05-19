// src/controls/components/project-settings/ProjectSettingsModal.tsx
// FULL FILE
import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useProjectStore } from "@/store/project.store";
import { useProviderStore } from "@/store/provider.store";
import { useSettingsStore } from "@/store/settings.store";
import { useVfsStore } from "@/store/vfs.store";
import { useShallow } from "zustand/react/shallow";
import { toast } from "sonner";
import type { Project } from "@/types/litechat/project";
import { ProjectSettingsPrompt } from "./ProjectSettingsPrompt";
import { ProjectSettingsParams } from "./ProjectSettingsParams";
import { ProjectSettingsSync } from "./ProjectSettingsSync";
import { ProjectSettingsVfs } from "./ProjectSettingsVfs";
import { ProjectSettingsRules } from "./ProjectSettingsRules";
import { ProjectSettingsTags } from "./ProjectSettingsTags";
import { useConversationStore } from "@/store/conversation.store";
import {
  TabbedLayout,
  TabDefinition,
} from "@/components/LiteChat/common/TabbedLayout";
import { cn } from "@/lib/utils";
import type { ProjectSettingsControlModule } from "@/controls/modules/ProjectSettingsControlModule";

import { useForm } from "@tanstack/react-form";
import { z } from "zod";

interface ProjectSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string | null;
  module: ProjectSettingsControlModule;
}

const projectParamsSchema = z.object({
  temperature: z.number().min(0).max(1),
  topP: z.number().min(0).max(1),
  maxTokens: z.number().min(1).nullable(),
  topK: z.number().min(1).nullable(),
  presencePenalty: z.number().min(-2).max(2),
  frequencyPenalty: z.number().min(-2).max(2),
});

export const ProjectSettingsModal: React.FC<ProjectSettingsModalProps> = ({
  isOpen,
  onClose,
  projectId,
  module,
}) => {
  const { getProjectById, updateProject } = useProjectStore(
    useShallow((state) => ({
      getProjectById: state.getProjectById,
      updateProject: state.updateProject,
    }))
  );
  const getEffectiveProjectSettings = useProjectStore(
    (state) => state.getEffectiveProjectSettings
  );
  const syncRepos = useConversationStore((state) => state.syncRepos);
  const globalDefaults = useSettingsStore(
    useShallow((state) => ({
      globalSystemPrompt: state.globalSystemPrompt,
      temperature: state.temperature,
      maxTokens: state.maxTokens,
      topP: state.topP,
      topK: state.topK,
      presencePenalty: state.presencePenalty,
      frequencyPenalty: state.frequencyPenalty,
    }))
  );
  const globalModelId = useProviderStore((state) => state.selectedModelId);
  const setVfsKey = useVfsStore((state) => state.setVfsKey);

  const [systemPrompt, setSystemPrompt] = useState<string | null>(null);
  const [modelId, setModelId] = useState<string | null>(null);
  const [syncRepoId, setSyncRepoId] = useState<string | null>(null);
  const [defaultTagIds, setDefaultTagIds] = useState<string[] | null>(null);
  const [defaultRuleIds, setDefaultRuleIds] = useState<string[] | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("prompt");

  const { project, effectiveSettings } = useMemo(() => {
    const proj = projectId ? getProjectById(projectId) : null;
    const effSettings = projectId
      ? getEffectiveProjectSettings(projectId)
      : null;
    return { project: proj, effectiveSettings: effSettings };
  }, [projectId, getProjectById, getEffectiveProjectSettings]);

  const paramsForm = useForm({
    defaultValues: {
      temperature: project?.temperature ?? 0.7,
      topP: project?.topP ?? 1.0,
      maxTokens: project?.maxTokens ?? null,
      topK: project?.topK ?? null,
      presencePenalty: project?.presencePenalty ?? 0.0,
      frequencyPenalty: project?.presencePenalty ?? 0.0,
      // todo: topK: project.topK,
    },
    validators: {
      onChangeAsync: projectParamsSchema,
      onChangeAsyncDebounceMs: 500,
    },
  });

  const getEffectiveSyncRepoId = useCallback(
    (projId: string | null): string | null => {
      if (!projId) return null;
      const currentProj = getProjectById(projId);
      if (!currentProj) return null;
      if (currentProj.metadata?.syncRepoId !== undefined) {
        return currentProj.metadata.syncRepoId;
      }
      return getEffectiveSyncRepoId(currentProj.parentId);
    },
    [getProjectById]
  );
  const effectiveSyncRepoId = projectId
    ? getEffectiveSyncRepoId(projectId)
    : null;

  useEffect(() => {
    if (isOpen && projectId && project && effectiveSettings) {
      setVfsKey(projectId);
      setSystemPrompt(project.systemPrompt ?? null);
      setModelId(project.modelId ?? null);
      setSyncRepoId(project.metadata?.syncRepoId ?? null);
      setDefaultTagIds(project.defaultTagIds ?? null);
      setDefaultRuleIds(project.defaultRuleIds ?? null);

      paramsForm.reset({
        temperature: project.temperature ?? 0.7,
        topP: project.topP ?? 1.0,
        maxTokens: project.maxTokens ?? null,
        topK: project.topK ?? null,
        presencePenalty: project.presencePenalty ?? 0.0,
        frequencyPenalty: project.frequencyPenalty ?? 0.0,
      });
      setActiveTab("prompt");
    } else if (!isOpen) {
      setVfsKey(null);
      setSystemPrompt(null);
      setModelId(null);
      setSyncRepoId(null);
      setDefaultTagIds(null);
      setDefaultRuleIds(null);
      paramsForm.reset({
        temperature: 0.7,
        topP: 1.0,
        maxTokens: null,
        topK: null,
        presencePenalty: 0.0,
        frequencyPenalty: 0.0,
      });
    }
  }, [isOpen, projectId, project, effectiveSettings, setVfsKey, paramsForm]);

  const handleSave = async () => {
    if (!projectId || !project) return;
    setIsSaving(true);
    try {
      const parentSettings = project.parentId
        ? getEffectiveProjectSettings(project.parentId)
        : {
            systemPrompt: globalDefaults.globalSystemPrompt,
            modelId: globalModelId,
            temperature: globalDefaults.temperature,
            maxTokens: globalDefaults.maxTokens,
            topP: globalDefaults.topP,
            topK: globalDefaults.topK,
            presencePenalty: globalDefaults.presencePenalty,
            frequencyPenalty: globalDefaults.frequencyPenalty,
            defaultTagIds: null,
            defaultRuleIds: null,
          };
      const parentSyncRepoId = project.parentId
        ? getEffectiveSyncRepoId(project.parentId)
        : null;

      const updates: Partial<Omit<Project, "id" | "createdAt" | "path">> = {};
      const metadataUpdates: Record<string, any> = {
        ...(project.metadata ?? {}),
      };

      const formParamValues = paramsForm.state.values;

      if (systemPrompt !== parentSettings.systemPrompt)
        updates.systemPrompt = systemPrompt;
      else updates.systemPrompt = undefined;

      if (modelId !== parentSettings.modelId) updates.modelId = modelId;
      else updates.modelId = undefined;

      if (formParamValues.temperature !== parentSettings.temperature)
        updates.temperature = formParamValues.temperature;
      else updates.temperature = undefined;
      if (formParamValues.maxTokens !== parentSettings.maxTokens)
        updates.maxTokens = formParamValues.maxTokens;
      else updates.maxTokens = undefined;
      if (formParamValues.topP !== parentSettings.topP)
        updates.topP = formParamValues.topP;
      else updates.topP = undefined;
      if (formParamValues.topK !== parentSettings.topK)
        updates.topK = formParamValues.topK;
      else updates.topK = undefined;
      if (formParamValues.presencePenalty !== parentSettings.presencePenalty)
        updates.presencePenalty = formParamValues.presencePenalty;
      else updates.presencePenalty = undefined;
      if (formParamValues.frequencyPenalty !== parentSettings.frequencyPenalty)
        updates.frequencyPenalty = formParamValues.frequencyPenalty;
      else updates.frequencyPenalty = undefined;

      if (syncRepoId !== parentSyncRepoId)
        metadataUpdates.syncRepoId = syncRepoId;
      else delete metadataUpdates.syncRepoId;

      if (
        JSON.stringify(defaultTagIds) !==
        JSON.stringify(parentSettings.defaultTagIds)
      )
        updates.defaultTagIds = defaultTagIds;
      else updates.defaultTagIds = undefined;

      if (
        JSON.stringify(defaultRuleIds) !==
        JSON.stringify(parentSettings.defaultRuleIds)
      )
        updates.defaultRuleIds = defaultRuleIds;
      else updates.defaultRuleIds = undefined;

      updates.metadata = metadataUpdates;

      await updateProject(projectId, updates);
      toast.success(`Project "${project.name}" settings updated.`);
      onClose();
    } catch (error) {
      toast.error("Failed to save project settings.");
      console.error("Failed to save project settings:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const tabs: TabDefinition[] = useMemo(
    () => [
      {
        value: "prompt",
        label: "Prompt & Model",
        content: (
          <ProjectSettingsPrompt
            initialSystemPrompt={systemPrompt}
            initialModelId={modelId}
            onSave={({ systemPrompt: sp, modelId: mi }) => {
              setSystemPrompt(sp);
              setModelId(mi);
            }}
            effectiveSystemPrompt={
              effectiveSettings?.systemPrompt ??
              globalDefaults.globalSystemPrompt
            }
            effectiveModelId={effectiveSettings?.modelId ?? globalModelId}
            isParentSaving={isSaving}
          />
        ),
      },
      {
        value: "params",
        label: "Parameters",
        content: (
          <ProjectSettingsParams
            form={paramsForm}
            effectiveTemperature={
              effectiveSettings?.temperature ?? globalDefaults.temperature
            }
            effectiveMaxTokens={
              effectiveSettings?.maxTokens ?? globalDefaults.maxTokens
            }
            effectiveTopP={
              effectiveSettings?.topP ?? globalDefaults.topP ?? 1.0
            }
            effectiveTopK={effectiveSettings?.topK ?? globalDefaults.topK}
            effectivePresencePenalty={
              effectiveSettings?.presencePenalty ??
              globalDefaults.presencePenalty ??
              0.0
            }
            effectiveFrequencyPenalty={
              effectiveSettings?.frequencyPenalty ??
              globalDefaults.frequencyPenalty ??
              0.0
            }
            isSaving={isSaving}
          />
        ),
      },
      {
        value: "rules-tags",
        label: "Rules & Tags",
        content: (
          <div className="space-y-6">
            <ProjectSettingsRules
              defaultRuleIds={defaultRuleIds}
              setDefaultRuleIds={setDefaultRuleIds}
              isSaving={isSaving}
              allRules={module.getAllRules()}
            />
            <ProjectSettingsTags
              defaultTagIds={defaultTagIds}
              setDefaultTagIds={setDefaultTagIds}
              isSaving={isSaving}
              allTags={module.getAllTags()}
              getRulesForTag={module.getRulesForTag}
            />
          </div>
        ),
      },
      {
        value: "sync",
        label: "Sync",
        content: (
          <ProjectSettingsSync
            initialSyncRepoId={syncRepoId}
            onSave={({ syncRepoId: sri }) => {
              setSyncRepoId(sri);
            }}
            effectiveSyncRepoId={effectiveSyncRepoId}
            syncRepos={syncRepos}
            isParentSaving={isSaving}
          />
        ),
      },
      {
        value: "vfs",
        label: "Filesystem",
        content: (
          <ProjectSettingsVfs
            projectId={projectId}
            projectName={project?.name ?? null}
            isSaving={isSaving}
          />
        ),
      },
    ],
    [
      systemPrompt,
      modelId,
      syncRepoId,
      defaultTagIds,
      defaultRuleIds,
      paramsForm,
      effectiveSettings,
      globalDefaults,
      globalModelId,
      isSaving,
      effectiveSyncRepoId,
      syncRepos,
      projectId,
      project?.name,
      module,
    ]
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className={cn(
          "w-[95vw] h-[85vh] flex flex-col p-0",
          "sm:w-[90vw] sm:max-w-[800px]",
          "md:h-[75vh]",
          "min-h-[500px] max-h-[90vh]"
        )}
      >
        <DialogHeader className="p-4 md:p-6 pb-2 md:pb-4 flex-shrink-0">
          <DialogTitle>Project Settings: {project?.name}</DialogTitle>
          <DialogDescription>
            Configure default settings for this project. Settings inherit from
            parent projects or global defaults if not set here.
          </DialogDescription>
        </DialogHeader>

        <TabbedLayout
          tabs={tabs}
          initialValue={activeTab}
          onValueChange={setActiveTab}
          className="flex-grow overflow-hidden px-4 md:px-6"
          listClassName="-mx-4 md:-mx-6 px-2 md:px-6 py-1 md:py-0"
          contentContainerClassName="pb-4 md:pb-6 pr-1 md:pr-2 -mr-1 md:-mr-2"
          scrollable={true}
        />

        <DialogFooter className="flex-shrink-0 border-t p-4 md:p-6 pt-3 md:pt-4 mt-auto">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Project Settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
