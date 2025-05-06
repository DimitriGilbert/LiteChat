// src/components/LiteChat/settings/assistant/SettingsAssistantPrompt.tsx
// FULL FILE
import React from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSettingsStore } from "@/store/settings.store";
import { useShallow } from "zustand/react/shallow";

export const SettingsAssistantPrompt: React.FC = () => {
  const { globalSystemPrompt, setGlobalSystemPrompt } = useSettingsStore(
    useShallow((state) => ({
      globalSystemPrompt: state.globalSystemPrompt,
      setGlobalSystemPrompt: state.setGlobalSystemPrompt,
    })),
  );

  return (
    <div className="space-y-4">
      <div>
        <Label
          htmlFor="assistant-global-system-prompt"
          className="text-sm mb-1 block"
        >
          Global System Prompt
        </Label>
        <p className="text-xs text-muted-foreground mb-2">
          Default instructions for the assistant. Can be overridden per-project.
        </p>
        <Textarea
          id="assistant-global-system-prompt"
          placeholder="Enter default system instructions for the assistant..."
          value={globalSystemPrompt ?? ""}
          onChange={(e) => setGlobalSystemPrompt(e.target.value)}
          rows={6}
        />
      </div>
    </div>
  );
};
