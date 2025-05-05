// src/components/LiteChat/project-settings/ProjectSettingsModal.tsx
// FULL FILE - Adjusted DialogContent sizing
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
import { useConversationStore } from "@/store/conversation.store";
import { TabbedLayout, TabDefinition } from "../common/TabbedLayout";
import { cn } from "@/lib/utils"; // Import cn

interface ProjectSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string | null;
}

export const ProjectSettingsModal: React.FC<ProjectSettingsModalProps> = ({
  isOpen,
  onClose,
  projectId,
}) => {
  // Select primitive/stable values or stable functions
  const { getProjectById, updateProject } = useProjectStore(
    useShallow((state) => ({
      getProjectById: state.getProjectById, // Function is stable
      updateProject: state.updateProject, // Function is stable
    })),
  );
  // Use getState for selector function outside hook dependencies
  const getEffectiveProjectSettings = useProjectStore(
    (state) => state.getEffectiveProjectSettings,
  );
  const syncRepos = useConversationStore((state) => state.syncRepos); // Array ref might change
  const globalDefaults = useSettingsStore(
    useShallow((state) => ({
      globalSystemPrompt: state.globalSystemPrompt,
      temperature: state.temperature,
      maxTokens: state.maxTokens,
      topP: state.topP,
      topK: state.topK,
      presencePenalty: state.presencePenalty,
      frequencyPenalty: state.frequencyPenalty,
    })),
  );
  const globalModelId = useProviderStore((state) => state.selectedModelId);
  const setVfsKey = useVfsStore((state) => state.setVfsKey);

  const [systemPrompt, setSystemPrompt] = useState<string | null>(null);
  const [modelId, setModelId] = useState<string | null>(null);
  const [temperature, setTemperature] = useState<number | null>(null);
  const [maxTokens, setMaxTokens] = useState<number | null>(null);
  const [topP, setTopP] = useState<number | null>(null);
  const [topK, setTopK] = useState<number | null>(null);
  const [presencePenalty, setPresencePenalty] = useState<number | null>(null);
  const [frequencyPenalty, setFrequencyPenalty] = useState<number | null>(null);
  const [syncRepoId, setSyncRepoId] = useState<string | null>(null);

  const [localTemp, setLocalTemp] = useState(0.7);
  const [localTopP, setLocalTopP] = useState(1.0);
  const [localPresence, setLocalPresence] = useState(0.0);
  const [localFrequency, setLocalFrequency] = useState(0.0);

  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("prompt");

  // Compute project and effective settings inside useMemo
  const { project, effectiveSettings } = useMemo(() => {
    const proj = projectId ? getProjectById(projectId) : null;
    const effSettings = projectId
      ? getEffectiveProjectSettings(projectId)
      : null;
    return { project: proj, effectiveSettings: effSettings };
  }, [projectId, getProjectById, getEffectiveProjectSettings]);

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
    [getProjectById],
  );
  const effectiveSyncRepoId = projectId
    ? getEffectiveSyncRepoId(projectId)
    : null;

  useEffect(() => {
    if (isOpen && projectId && project && effectiveSettings) {
      setVfsKey(projectId);
      setSystemPrompt(project.systemPrompt ?? null);
      setModelId(project.modelId ?? null);
      setTemperature(project.temperature ?? null);
      setMaxTokens(project.maxTokens ?? null);
      setTopP(project.topP ?? null);
      setTopK(project.topK ?? null);
      setPresencePenalty(project.presencePenalty ?? null);
      setFrequencyPenalty(project.frequencyPenalty ?? null);
      setSyncRepoId(project.metadata?.syncRepoId ?? null);
      setLocalTemp(effectiveSettings.temperature ?? globalDefaults.temperature);
      setLocalTopP(effectiveSettings.topP ?? globalDefaults.topP ?? 1.0);
      setLocalPresence(
        effectiveSettings.presencePenalty ??
          globalDefaults.presencePenalty ??
          0.0,
      );
      setLocalFrequency(
        effectiveSettings.frequencyPenalty ??
          globalDefaults.frequencyPenalty ??
          0.0,
      );
      setActiveTab("prompt");
    } else if (!isOpen) {
      setVfsKey(null);
      setSystemPrompt(null);
      setModelId(null);
      setTemperature(null);
      setMaxTokens(null);
      setTopP(null);
      setTopK(null);
      setPresencePenalty(null);
      setFrequencyPenalty(null);
      setSyncRepoId(null);
    }
    // Depend on computed project/settings
  }, [
    isOpen,
    projectId,
    project,
    effectiveSettings,
    globalDefaults,
    setVfsKey,
  ]);

  useEffect(
    () =>
      setLocalTemp(
        temperature ??
          effectiveSettings?.temperature ??
          globalDefaults.temperature,
      ),
    [temperature, effectiveSettings, globalDefaults.temperature],
  );
  useEffect(
    () =>
      setLocalTopP(
        topP ?? effectiveSettings?.topP ?? globalDefaults.topP ?? 1.0,
      ),
    [topP, effectiveSettings, globalDefaults.topP],
  );
  useEffect(
    () =>
      setLocalPresence(
        presencePenalty ??
          effectiveSettings?.presencePenalty ??
          globalDefaults.presencePenalty ??
          0.0,
      ),
    [presencePenalty, effectiveSettings, globalDefaults.presencePenalty],
  );
  useEffect(
    () =>
      setLocalFrequency(
        frequencyPenalty ??
          effectiveSettings?.frequencyPenalty ??
          globalDefaults.frequencyPenalty ??
          0.0,
      ),
    [frequencyPenalty, effectiveSettings, globalDefaults.frequencyPenalty],
  );

  const handleSave = async () => {
    if (!projectId || !project) return; // Use computed project
    setIsSaving(true);
    try {
      // Use computed project for parentId
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
          };
      const parentSyncRepoId = project.parentId
        ? getEffectiveSyncRepoId(project.parentId)
        : null;

      const updates: Partial<Omit<Project, "id" | "createdAt" | "path">> = {};
      const metadataUpdates: Record<string, any> = {
        ...(project.metadata ?? {}), // Use computed project
      };

      if (systemPrompt !== parentSettings.systemPrompt)
        updates.systemPrompt = systemPrompt;
      else updates.systemPrompt = undefined;
      if (modelId !== parentSettings.modelId) updates.modelId = modelId;
      else updates.modelId = undefined;
      if (temperature !== parentSettings.temperature)
        updates.temperature = temperature;
      else updates.temperature = undefined;
      if (maxTokens !== parentSettings.maxTokens) updates.maxTokens = maxTokens;
      else updates.maxTokens = undefined;
      if (topP !== parentSettings.topP) updates.topP = topP;
      else updates.topP = undefined;
      if (topK !== parentSettings.topK) updates.topK = topK;
      else updates.topK = undefined;
      if (presencePenalty !== parentSettings.presencePenalty)
        updates.presencePenalty = presencePenalty;
      else updates.presencePenalty = undefined;
      if (frequencyPenalty !== parentSettings.frequencyPenalty)
        updates.frequencyPenalty = frequencyPenalty;
      else updates.frequencyPenalty = undefined;
      if (syncRepoId !== parentSyncRepoId)
        metadataUpdates.syncRepoId = syncRepoId;
      else delete metadataUpdates.syncRepoId;
      updates.metadata = metadataUpdates;

      await updateProject(projectId, updates);
      toast.success(`Project "${project.name}" settings updated.`); // Use computed project
      onClose();
    } catch (error) {
      toast.error("Failed to save project settings.");
      console.error("Failed to save project settings:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // Define tabs for the layout
  const tabs: TabDefinition[] = useMemo(
    () => [
      {
        value: "prompt",
        label: "Prompt & Model",
        content: (
          <ProjectSettingsPrompt
            systemPrompt={systemPrompt}
            setSystemPrompt={setSystemPrompt}
            modelId={modelId}
            setModelId={setModelId}
            effectiveSystemPrompt={
              effectiveSettings?.systemPrompt ??
              globalDefaults.globalSystemPrompt
            }
            effectiveModelId={effectiveSettings?.modelId ?? globalModelId}
            isSaving={isSaving}
          />
        ),
      },
      {
        value: "params",
        label: "Parameters",
        content: (
          <ProjectSettingsParams
            temperature={temperature}
            setTemperature={setTemperature}
            maxTokens={maxTokens}
            setMaxTokens={setMaxTokens}
            topP={topP}
            setTopP={setTopP}
            topK={topK}
            setTopK={setTopK}
            presencePenalty={presencePenalty}
            setPresencePenalty={setPresencePenalty}
            frequencyPenalty={frequencyPenalty}
            setFrequencyPenalty={setFrequencyPenalty}
            localTemp={localTemp}
            setLocalTemp={setLocalTemp}
            localTopP={localTopP}
            setLocalTopP={setLocalTopP}
            localPresence={localPresence}
            setLocalPresence={setLocalPresence}
            localFrequency={localFrequency}
            setLocalFrequency={setLocalFrequency}
            effectiveTemperature={
              effectiveSettings?.temperature ?? globalDefaults.temperature
            }
            effectiveMaxTokens={
              effectiveSettings?.maxTokens ?? globalDefaults.maxTokens
            }
            effectiveTopP={effectiveSettings?.topP ?? globalDefaults.topP}
            effectiveTopK={effectiveSettings?.topK ?? globalDefaults.topK}
            effectivePresencePenalty={
              effectiveSettings?.presencePenalty ??
              globalDefaults.presencePenalty
            }
            effectiveFrequencyPenalty={
              effectiveSettings?.frequencyPenalty ??
              globalDefaults.frequencyPenalty
            }
            isSaving={isSaving}
          />
        ),
      },
      {
        value: "sync",
        label: "Sync",
        content: (
          <ProjectSettingsSync
            syncRepoId={syncRepoId}
            setSyncRepoId={setSyncRepoId}
            effectiveSyncRepoId={effectiveSyncRepoId}
            syncRepos={syncRepos}
            isSaving={isSaving}
          />
        ),
      },
      {
        value: "vfs",
        label: "Filesystem",
        content: (
          <ProjectSettingsVfs
            projectId={projectId}
            projectName={project?.name ?? null} // Use computed project
            isSaving={isSaving}
          />
        ),
      },
    ],
    [
      systemPrompt,
      modelId,
      temperature,
      maxTokens,
      topP,
      topK,
      presencePenalty,
      frequencyPenalty,
      syncRepoId,
      effectiveSettings, // Depend on computed settings
      globalDefaults,
      globalModelId,
      isSaving,
      localTemp,
      localTopP,
      localPresence,
      localFrequency,
      effectiveSyncRepoId,
      syncRepos,
      projectId,
      project?.name, // Depend on computed project name
    ],
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className={cn(
          // Base styles
          "w-[95vw] h-[85vh] flex flex-col p-0",
          // Responsive overrides
          "sm:w-[90vw] sm:max-w-[800px]",
          "md:h-[75vh]",
          "min-h-[500px] max-h-[90vh]", // Ensure min/max height
        )}
      >
        <DialogHeader className="p-4 md:p-6 pb-2 md:pb-4 flex-shrink-0">
          <DialogTitle>Project Settings: {project?.name}</DialogTitle>
          <DialogDescription>
            Configure default settings for this project. Settings inherit from
            parent projects or global defaults if not set here.
          </DialogDescription>
        </DialogHeader>

        {/* Use TabbedLayout */}
        <TabbedLayout
          tabs={tabs}
          initialValue={activeTab}
          onValueChange={setActiveTab}
          className="flex-grow overflow-hidden px-4 md:px-6"
          listClassName="-mx-4 md:-mx-6 px-4 md:px-6"
          contentContainerClassName="pb-4 md:pb-6 pr-2 -mr-2"
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
