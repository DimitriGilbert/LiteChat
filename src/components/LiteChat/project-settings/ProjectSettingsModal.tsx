// src/components/LiteChat/settings/ProjectSettingsModal.tsx
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
import { useConversationStore } from "@/store/conversation.store";
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
  const {
    getProjectById,
    updateProject,
    getEffectiveProjectSettings,
    syncRepos,
  } = useConversationStore(
    useShallow((state) => ({
      getProjectById: state.getProjectById,
      updateProject: state.updateProject,
      getEffectiveProjectSettings: state.getEffectiveProjectSettings,
      syncRepos: state.syncRepos,
    })),
  );

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
  // Only need setVfsKey from VFS store
  const setVfsKey = useVfsStore((state) => state.setVfsKey);

  // State for each setting, allowing null to represent 'inherit'
  const [systemPrompt, setSystemPrompt] = useState<string | null>(null);
  const [modelId, setModelId] = useState<string | null>(null);
  const [temperature, setTemperature] = useState<number | null>(null);
  const [maxTokens, setMaxTokens] = useState<number | null>(null);
  const [topP, setTopP] = useState<number | null>(null);
  const [topK, setTopK] = useState<number | null>(null);
  const [presencePenalty, setPresencePenalty] = useState<number | null>(null);
  const [frequencyPenalty, setFrequencyPenalty] = useState<number | null>(null);
  const [syncRepoId, setSyncRepoId] = useState<string | null>(null);

  // Local state for slider visual feedback
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

  // Effect to load settings AND set VFS key when modal opens/closes
  useEffect(() => {
    if (isOpen && projectId) {
      console.log(
        `[ProjectSettingsModal] Opening for ${projectId}. Setting VFS key.`,
      );
      // Set the desired VFS key. The VFS store will handle initialization.
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
      // Set desired VFS key to null when modal closes
      setVfsKey(null);
      // Reset form state when closed
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
    getEffectiveSyncRepoId,
    globalDefaults,
    setVfsKey, // Add setVfsKey dependency
  ]);

  // Update local slider state when the main state changes (no changes needed here)
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
      const parentSyncRepoId = project?.parentId
        ? getEffectiveSyncRepoId(project.parentId)
        : null;

      const updates: Partial<Project> = {};
      const metadataUpdates: Record<string, any> = {
        ...(project?.metadata ?? {}),
      };

      updates.systemPrompt =
        systemPrompt !== parentSettings.systemPrompt ? systemPrompt : undefined;
      updates.modelId =
        modelId !== parentSettings.modelId ? modelId : undefined;
      updates.temperature =
        temperature !== parentSettings.temperature ? temperature : undefined;
      updates.maxTokens =
        maxTokens !== parentSettings.maxTokens ? maxTokens : undefined;
      updates.topP = topP !== parentSettings.topP ? topP : undefined;
      updates.topK = topK !== parentSettings.topK ? topK : undefined;
      updates.presencePenalty =
        presencePenalty !== parentSettings.presencePenalty
          ? presencePenalty
          : undefined;
      updates.frequencyPenalty =
        frequencyPenalty !== parentSettings.frequencyPenalty
          ? frequencyPenalty
          : undefined;

      if (syncRepoId !== parentSyncRepoId) {
        metadataUpdates.syncRepoId = syncRepoId;
      } else {
        delete metadataUpdates.syncRepoId;
      }
      updates.metadata = metadataUpdates;

      await updateProject(projectId, updates);
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

          {/* Container for tab content with overflow */}
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
                syncRepos={syncRepos}
                isSaving={isSaving}
              />
            </TabsContent>

            {/* Render VFS tab content */}
            <TabsContent value="vfs" className="h-full">
              {" "}
              {/* Ensure content takes height */}
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
