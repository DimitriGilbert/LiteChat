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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react"; // Removed SaveIcon import
import { useConversationStore } from "@/store/conversation.store";
import { useProviderStore } from "@/store/provider.store";
import { useSettingsStore } from "@/store/settings.store";
import { useShallow } from "zustand/react/shallow";
import { toast } from "sonner";
import { GlobalModelSelector } from "@/components/LiteChat/prompt/control/GlobalModelSelector"; // Reuse for model selection
import { cn } from "@/lib/utils";
import type { Project } from "@/types/litechat/project"; // Import Project type

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
  const { getProjectById, updateProject, getEffectiveProjectSettings } =
    useConversationStore(
      useShallow((state) => ({
        getProjectById: state.getProjectById,
        updateProject: state.updateProject,
        getEffectiveProjectSettings: state.getEffectiveProjectSettings,
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

  const [systemPrompt, setSystemPrompt] = useState<string | null>(null);
  const [modelId, setModelId] = useState<string | null>(null);
  const [temperature, setTemperature] = useState<number | null>(null);
  const [maxTokens, setMaxTokens] = useState<number | null>(null);
  const [topP, setTopP] = useState<number | null>(null);
  const [topK, setTopK] = useState<number | null>(null);
  const [presencePenalty, setPresencePenalty] = useState<number | null>(null);
  const [frequencyPenalty, setFrequencyPenalty] = useState<number | null>(null);

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

  // Load settings when modal opens or projectId changes
  useEffect(() => {
    if (isOpen && projectId) {
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

      // Initialize local slider states based on effective or global defaults
      setLocalTemp(effective?.temperature ?? globalDefaults.temperature);
      setLocalTopP(effective?.topP ?? globalDefaults.topP ?? 1.0);
      setLocalPresence(
        effective?.presencePenalty ?? globalDefaults.presencePenalty ?? 0.0,
      );
      setLocalFrequency(
        effective?.frequencyPenalty ?? globalDefaults.frequencyPenalty ?? 0.0,
      );
    } else {
      // Reset form when closed or no project ID
      setSystemPrompt(null);
      setModelId(null);
      setTemperature(null);
      setMaxTokens(null);
      setTopP(null);
      setTopK(null);
      setPresencePenalty(null);
      setFrequencyPenalty(null);
    }
  }, [
    isOpen,
    projectId,
    getProjectById,
    getEffectiveProjectSettings,
    globalDefaults,
  ]);

  // Update local slider state when the main state changes
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
      // Prepare updates, saving null if the value matches the *parent's* effective value or global default
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

      const updates: Partial<Project> = {};

      // Explicitly check if the value is different from the inherited value
      // If it is, set the update; otherwise, set it to undefined to clear the override
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

  const handleNumberInputChange = useCallback(
    (
      setter: (value: number | null) => void,
      e: React.ChangeEvent<HTMLInputElement>,
    ) => {
      const value = e.target.value;
      const numValue = value === "" ? null : parseInt(value, 10);
      if (value === "" || (!isNaN(numValue!) && numValue !== null)) {
        setter(numValue);
      }
    },
    [],
  );

  const handleSliderVisualChange = useCallback(
    (setter: React.Dispatch<React.SetStateAction<number>>, value: number[]) => {
      setter(value[0]);
    },
    [],
  );

  const handleSliderCommit = useCallback(
    <T extends number | null>(setter: (value: T) => void, value: number[]) => {
      setter(value[0] as T);
    },
    [],
  );

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

  const effectiveSystemPrompt =
    effectiveSettings?.systemPrompt ?? globalDefaults.globalSystemPrompt;
  const effectiveModelId = effectiveSettings?.modelId ?? globalModelId;
  const effectiveTemperature =
    effectiveSettings?.temperature ?? globalDefaults.temperature;
  const effectiveMaxTokens =
    effectiveSettings?.maxTokens ?? globalDefaults.maxTokens;
  const effectiveTopP = effectiveSettings?.topP ?? globalDefaults.topP;
  const effectiveTopK = effectiveSettings?.topK ?? globalDefaults.topK;
  const effectivePresencePenalty =
    effectiveSettings?.presencePenalty ?? globalDefaults.presencePenalty;
  const effectiveFrequencyPenalty =
    effectiveSettings?.frequencyPenalty ?? globalDefaults.frequencyPenalty;

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
          </TabsList>

          <div className="flex-grow overflow-y-auto pb-6 pr-2 -mr-2">
            <TabsContent value="prompt" className="space-y-4">
              <div>
                <Label htmlFor="project-system-prompt">
                  System Prompt (Overrides Parent/Global)
                </Label>
                <Textarea
                  id="project-system-prompt"
                  placeholder={`Inherited: ${effectiveSystemPrompt?.substring(0, 100) || "Default"}${effectiveSystemPrompt && effectiveSystemPrompt.length > 100 ? "..." : ""}`}
                  value={systemPrompt ?? ""}
                  onChange={(e) => setSystemPrompt(e.target.value || null)}
                  rows={6}
                  disabled={isSaving}
                  className="mt-1"
                />
                <Button
                  variant="link"
                  size="sm"
                  className="text-xs h-auto p-0 mt-1 text-muted-foreground"
                  onClick={() => setSystemPrompt(null)}
                  disabled={isSaving || systemPrompt === null}
                >
                  Use Inherited/Default
                </Button>
              </div>
              <div>
                <Label>Default Model (Overrides Parent/Global)</Label>
                <GlobalModelSelector
                  value={modelId ?? effectiveModelId} // Show effective if local is null
                  onChange={setModelId}
                  disabled={isSaving}
                />
                <Button
                  variant="link"
                  size="sm"
                  className="text-xs h-auto p-0 mt-1 text-muted-foreground"
                  onClick={() => setModelId(null)}
                  disabled={isSaving || modelId === null}
                >
                  Use Inherited/Default
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="params" className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="project-temperature" className="text-xs">
                  Temperature ({localTemp.toFixed(2)})
                </Label>
                <Slider
                  id="project-temperature"
                  min={0}
                  max={1}
                  step={0.01}
                  value={[localTemp]}
                  onValueChange={(v) =>
                    handleSliderVisualChange(setLocalTemp, v)
                  }
                  onValueCommit={(v) => handleSliderCommit(setTemperature, v)}
                  disabled={isSaving}
                />
                <Button
                  variant="link"
                  size="sm"
                  className="text-xs h-auto p-0 text-muted-foreground"
                  onClick={() => setTemperature(null)}
                  disabled={isSaving || temperature === null}
                >
                  Use Inherited/Default (
                  {effectiveTemperature?.toFixed(2) ?? "N/A"})
                </Button>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="project-top-p" className="text-xs">
                  Top P ({localTopP.toFixed(2)})
                </Label>
                <Slider
                  id="project-top-p"
                  min={0}
                  max={1}
                  step={0.01}
                  value={[localTopP]}
                  onValueChange={(v) =>
                    handleSliderVisualChange(setLocalTopP, v)
                  }
                  onValueCommit={(v) => handleSliderCommit(setTopP, v)}
                  disabled={isSaving}
                />
                <Button
                  variant="link"
                  size="sm"
                  className="text-xs h-auto p-0 text-muted-foreground"
                  onClick={() => setTopP(null)}
                  disabled={isSaving || topP === null}
                >
                  Use Inherited/Default ({effectiveTopP?.toFixed(2) ?? "N/A"})
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-4 items-end">
                <div className="space-y-1.5">
                  <Label htmlFor="project-max-tokens" className="text-xs">
                    Max Tokens
                  </Label>
                  <Input
                    id="project-max-tokens"
                    type="number"
                    placeholder={`Inherited: ${effectiveMaxTokens ?? "Default"}`}
                    value={maxTokens ?? ""}
                    onChange={(e) => handleNumberInputChange(setMaxTokens, e)}
                    min="1"
                    className="h-8 text-xs"
                    disabled={isSaving}
                  />
                  <Button
                    variant="link"
                    size="sm"
                    className="text-xs h-auto p-0 text-muted-foreground"
                    onClick={() => setMaxTokens(null)}
                    disabled={isSaving || maxTokens === null}
                  >
                    Use Inherited/Default
                  </Button>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="project-top-k" className="text-xs">
                    Top K
                  </Label>
                  <Input
                    id="project-top-k"
                    type="number"
                    placeholder={`Inherited: ${effectiveTopK ?? "Default"}`}
                    value={topK ?? ""}
                    onChange={(e) => handleNumberInputChange(setTopK, e)}
                    min="1"
                    className="h-8 text-xs"
                    disabled={isSaving}
                  />
                  <Button
                    variant="link"
                    size="sm"
                    className="text-xs h-auto p-0 text-muted-foreground"
                    onClick={() => setTopK(null)}
                    disabled={isSaving || topK === null}
                  >
                    Use Inherited/Default
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="project-presence-penalty" className="text-xs">
                  Presence Penalty ({localPresence.toFixed(2)})
                </Label>
                <Slider
                  id="project-presence-penalty"
                  min={-2}
                  max={2}
                  step={0.01}
                  value={[localPresence]}
                  onValueChange={(v) =>
                    handleSliderVisualChange(setLocalPresence, v)
                  }
                  onValueCommit={(v) =>
                    handleSliderCommit(setPresencePenalty, v)
                  }
                  disabled={isSaving}
                />
                <Button
                  variant="link"
                  size="sm"
                  className="text-xs h-auto p-0 text-muted-foreground"
                  onClick={() => setPresencePenalty(null)}
                  disabled={isSaving || presencePenalty === null}
                >
                  Use Inherited/Default (
                  {effectivePresencePenalty?.toFixed(2) ?? "N/A"})
                </Button>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="project-frequency-penalty" className="text-xs">
                  Frequency Penalty ({localFrequency.toFixed(2)})
                </Label>
                <Slider
                  id="project-frequency-penalty"
                  min={-2}
                  max={2}
                  step={0.01}
                  value={[localFrequency]}
                  onValueChange={(v) =>
                    handleSliderVisualChange(setLocalFrequency, v)
                  }
                  onValueCommit={(v) =>
                    handleSliderCommit(setFrequencyPenalty, v)
                  }
                  disabled={isSaving}
                />
                <Button
                  variant="link"
                  size="sm"
                  className="text-xs h-auto p-0 text-muted-foreground"
                  onClick={() => setFrequencyPenalty(null)}
                  disabled={isSaving || frequencyPenalty === null}
                >
                  Use Inherited/Default (
                  {effectiveFrequencyPenalty?.toFixed(2) ?? "N/A"})
                </Button>
              </div>
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
