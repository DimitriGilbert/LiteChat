// src/components/LiteChat/settings/ProjectSettingsPrompt.tsx

import React from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { GlobalModelSelector } from "@/components/LiteChat/prompt/control/GlobalModelSelector";

interface ProjectSettingsPromptProps {
  systemPrompt: string | null;
  setSystemPrompt: (value: string | null) => void;
  modelId: string | null;
  setModelId: (value: string | null) => void;
  effectiveSystemPrompt: string | null;
  effectiveModelId: string | null;
  isSaving: boolean;
}

export const ProjectSettingsPrompt: React.FC<ProjectSettingsPromptProps> = ({
  systemPrompt,
  setSystemPrompt,
  modelId,
  setModelId,
  effectiveSystemPrompt,
  effectiveModelId,
  isSaving,
}) => {
  return (
    <div className="space-y-4">
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
    </div>
  );
};
