
import React from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { useShallow } from "zustand/react/shallow";
import { useSettingsStore } from "@/store/settings.store";

const SettingsAssistantComponent: React.FC = () => {
  // --- Fetch state/actions from store ---
  const { globalSystemPrompt, setGlobalSystemPrompt } = useSettingsStore(
    useShallow((state) => ({
      globalSystemPrompt: state.globalSystemPrompt,
      setGlobalSystemPrompt: state.setGlobalSystemPrompt,
    })),
  );

  return (
    <div className="space-y-6 p-1">
      <div>
        <h3 className="text-lg font-medium mb-2">Prompt configuration</h3>
        <Label
          htmlFor="assistant-global-system-prompt"
          className="text-sm mb-3 block"
        >
          System prompt
        </Label>
        <Textarea
          id="assistant-global-system-prompt"
          placeholder="Enter default system instructions for the assistant..."
          value={globalSystemPrompt ?? ""}
          onChange={(e) => setGlobalSystemPrompt(e.target.value)}
          rows={4}
        />
      </div>
    </div>
  );
};

export const SettingsAssistant = React.memo(SettingsAssistantComponent);
