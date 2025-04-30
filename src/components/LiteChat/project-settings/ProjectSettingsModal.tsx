// src/components/LiteChat/project-settings/ProjectSettingsModal.tsx
// Entire file content provided
import React, { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import { useProjectStore } from "@/store/project.store"; // Use ProjectStore
import { useProviderStore } from "@/store/provider.store";
import { useSettingsStore } from "@/store/settings.store";
import { useVfsStore } from "@/store/vfs.store";
import { useShallow } from "zustand/react/shallow";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Project } from "@/types/litechat/project";
import { ProjectSettingsPrompt } from "./ProjectSettingsPrompt";
import { ProjectSettingsParams } from "./ProjectSettingsParams";
import { ProjectSettingsSync } from "./ProjectSettingsSync";
import { ProjectSettingsVfs } from "./ProjectSettingsVfs";
import { useConversationStore } from "@/store/conversation.store"; // Needed for syncRepos

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
  // Use ProjectStore for project data and actions
  const { getProjectById, updateProject, getEffectiveProjectSettings } =
    useProjectStore(
      useShallow((state) => ({
        getProjectById: state.getProjectById,
        updateProject: state.updateProject,
        getEffectiveProjectSettings: state.getEffectiveProjectSettings,
      })),
    );
  // Get syncRepos from ConversationStore
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

  const project = projectId ? getProjectById(projectId) : null;
  const effectiveSettings = projectId
    ? getEffectiveProjectSettings(projectId)
    : null;

  // This recursive helper needs to stay or be moved to ProjectStore if preferred
  const getEffectiveSyncRepoId = useCallback(
    (projId: string | null): string | null => {
      if (!projId) return null;
      const currentProj = getProjectById(projId); // Use ProjectStore's getter
      if (!currentProj) return null;
      if (currentProj.metadata?.syncRepoId !== undefined) {
        return currentProj.metadata.syncRepoId;
      }
      return getEffectiveSyncRepoId(currentProj.parentId);
    },
    [getProjectById], // Depend on ProjectStore's getter
  );
  const effectiveSyncRepoId = projectId
    ? getEffectiveSyncRepoId(projectId)
    : null;

  useEffect(() => {
    if (isOpen && projectId) {
      console.log(
        `[ProjectSettingsModal] Opening for ${projectId}. Setting VFS key.`,
      );
      setVfsKey(projectId);

      const currentProject = getProjectById(projectId);
      const effective = getEffectiveProjectSettings(projectId);

      setSystemPrompt(currentProject?.systemPrompt ?? null);
      setModelId(currentProject?.modelId ?? null);
      setTemperature(currentProject?.temperature ?? null);
      setMaxTokens(currentProject?.maxTokens ?? null);
      setTopP(currentProject?.topP ?? null);
      setTopK(currentProject?.topK ?? null);
      setPresencePenalty(currentProject?.presencePenalty ?? null);
      setFrequencyPenalty(currentProject?.frequencyPenalty ?? null);
      setSyncRepoId(currentProject?.metadata?.syncRepoId ?? null);

      setLocalTemp(effective?.temperature ?? globalDefaults.temperature);
      setLocalTopP(effective?.topP ?? globalDefaults.topP ?? 1.0);
      setLocalPresence(
        effective?.presencePenalty ?? globalDefaults.presencePenalty ?? 0.0,
      );
      setLocalFrequency(
        effective?.frequencyPenalty ?? globalDefaults.frequencyPenalty ?? 0.0,
      );
    } else if (!isOpen) {
      console.log("[ProjectSettingsModal] Closing. Setting VFS key to null.");
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
  }, [
    isOpen,
    projectId,
    getProjectById,
    getEffectiveProjectSettings,
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
    if (!projectId) return;
    setIsSaving(true);
    try {
      const parentSettings = project?.parentId
        ? getEffectiveProjectSettings(project.parentId) // Use ProjectStore getter
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
      const parentSyncRepoId = project?.parentId
        ? getEffectiveSyncRepoId(project.parentId)
        : null;

      const updates: Partial<Omit<Project, "id" | "createdAt" | "path">> = {};
      const metadataUpdates: Record<string, any> = {
        ...(project?.metadata ?? {}),
      };

      // Only include the field in updates if it's different from the parent/default
      if (systemPrompt !== parentSettings.systemPrompt) {
        updates.systemPrompt = systemPrompt;
      } else {
        updates.systemPrompt = undefined; // Explicitly set to undefined to remove override
      }
      if (modelId !== parentSettings.modelId) {
        updates.modelId = modelId;
      } else {
        updates.modelId = undefined;
      }
      if (temperature !== parentSettings.temperature) {
        updates.temperature = temperature;
      } else {
        updates.temperature = undefined;
      }
      if (maxTokens !== parentSettings.maxTokens) {
        updates.maxTokens = maxTokens;
      } else {
        updates.maxTokens = undefined;
      }
      if (topP !== parentSettings.topP) {
        updates.topP = topP;
      } else {
        updates.topP = undefined;
      }
      if (topK !== parentSettings.topK) {
        updates.topK = topK;
      } else {
        updates.topK = undefined;
      }
      if (presencePenalty !== parentSettings.presencePenalty) {
        updates.presencePenalty = presencePenalty;
      } else {
        updates.presencePenalty = undefined;
      }
      if (frequencyPenalty !== parentSettings.frequencyPenalty) {
        updates.frequencyPenalty = frequencyPenalty;
      } else {
        updates.frequencyPenalty = undefined;
      }

      if (syncRepoId !== parentSyncRepoId) {
        metadataUpdates.syncRepoId = syncRepoId;
      } else {
        delete metadataUpdates.syncRepoId; // Remove from metadata if matching parent
      }
      updates.metadata = metadataUpdates;

      await updateProject(projectId, updates); // Use ProjectStore action
      toast.success(`Project "${project?.name}" settings updated.`);
      onClose();
    } catch (error) {
      toast.error("Failed to save project settings.");
      console.error("Failed to save project settings:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const tabTriggerClass = cn(
    "px-3 py-1.5 text-sm font-medium rounded-md",
    "text-muted-foreground",
    "border border-transparent",
    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    "data-[state=active]:bg-primary/10 data-[state=active]:text-primary",
    "data-[state=active]:border-primary",
    "dark:data-[state=active]:bg-primary/20 dark:data-[state=active]:text-primary",
    "dark:data-[state=active]:border-primary/70",
    "hover:bg-muted/50 hover:text-primary/80",
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px] w-[90vw] h-[70vh] min-h-[500px] max-h-[80vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-4 flex-shrink-0">
          <DialogTitle>Project Settings: {project?.name}</DialogTitle>
          <DialogDescription>
            Configure default settings for this project. Settings inherit from
            parent projects or global defaults if not set here.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex-grow flex flex-col overflow-hidden px-6"
        >
          <TabsList className="flex-shrink-0 sticky top-0 bg-background z-10 mb-4 flex-wrap h-auto justify-start border-b gap-1 p-1 -mx-6 px-6">
            <TabsTrigger value="prompt" className={tabTriggerClass}>
              Prompt & Model
            </TabsTrigger>
            <TabsTrigger value="params" className={tabTriggerClass}>
              Parameters
            </TabsTrigger>
            <TabsTrigger value="sync" className={tabTriggerClass}>
              Sync
            </TabsTrigger>
            <TabsTrigger value="vfs" className={tabTriggerClass}>
              Filesystem
            </TabsTrigger>
          </TabsList>

          <div className="flex-grow overflow-y-auto pb-6 pr-2 -mr-2">
            <TabsContent value="prompt">
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
            </TabsContent>

            <TabsContent value="params">
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
            </TabsContent>

            <TabsContent value="sync">
              <ProjectSettingsSync
                syncRepoId={syncRepoId}
                setSyncRepoId={setSyncRepoId}
                effectiveSyncRepoId={effectiveSyncRepoId}
                syncRepos={syncRepos} // Pass syncRepos from ConversationStore
                isSaving={isSaving}
              />
            </TabsContent>

            <TabsContent value="vfs" className="h-full">
              <ProjectSettingsVfs
                projectId={projectId}
                projectName={project?.name ?? null}
                isSaving={isSaving}
              />
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="flex-shrink-0 border-t p-6 pt-4 mt-auto">
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
