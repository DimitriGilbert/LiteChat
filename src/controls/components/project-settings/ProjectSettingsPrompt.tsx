// src/controls/components/project-settings/ProjectSettingsPrompt.tsx
// FULL FILE
import React from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ModelSelector } from "@/controls/components/global-model-selector/ModelSelector"; // Updated to use ModelSelector from global-model-selector
import { useProviderStore } from "@/store/provider.store"; // To get effectiveModelId for placeholder
import { useShallow } from "zustand/react/shallow";

interface ProjectSettingsPromptProps {
  systemPrompt: string | null;
  setSystemPrompt: (value: string | null) => void;
  modelId: string | null;
  setModelId: (value: string | null) => void;
  effectiveSystemPrompt: string | null;
  effectiveModelId: string | null; // This is the inherited/global default
  isSaving: boolean;
}

export const ProjectSettingsPrompt: React.FC<ProjectSettingsPromptProps> = ({
  systemPrompt,
  setSystemPrompt,
  modelId,
  setModelId,
  effectiveSystemPrompt,
  effectiveModelId, // This is the one to show as "Inherited"
  isSaving,
}) => {
  // Get all models to find the name of the effectiveModelId for placeholder
  const { getAvailableModelListItems } = useProviderStore(
    useShallow((state) => ({
      getAvailableModelListItems: state.getAvailableModelListItems,
    }))
  );
  const availableModels = getAvailableModelListItems();
  const effectiveModelName =
    availableModels.find((m) => m.id === effectiveModelId)?.name ||
    effectiveModelId;

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="project-system-prompt">
          System Prompt (Overrides Parent/Global)
        </Label>
        <Textarea
          id="project-system-prompt"
          placeholder={`Inherited: ${
            effectiveSystemPrompt?.substring(0, 100) || "Default"
          }${
            effectiveSystemPrompt && effectiveSystemPrompt.length > 100
              ? "..."
              : ""
          }`}
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
        <Label htmlFor="project-model-selector">
          Default Model (Overrides Parent/Global)
        </Label>
        <ModelSelector
          models={availableModels}
          value={modelId}
          onChange={setModelId}
          disabled={isSaving}
          className="w-full mt-1"
        />
        <Button
          variant="link"
          size="sm"
          className="text-xs h-auto p-0 mt-1 text-muted-foreground"
          onClick={() => setModelId(null)}
          disabled={isSaving || modelId === null}
        >
          Use Inherited/Default ({effectiveModelName || "Global Default"})
        </Button>
      </div>
    </div>
  );
};
