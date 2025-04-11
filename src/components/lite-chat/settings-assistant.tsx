// src/components/lite-chat/settings-assistant.tsx
import React from "react";
import { useChatContext } from "@/hooks/use-chat-context";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const SettingsAssistant: React.FC = () => {
  const { globalSystemPrompt, setGlobalSystemPrompt } = useChatContext();

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
