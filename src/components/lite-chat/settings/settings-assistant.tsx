// src/components/lite-chat/settings/settings-assistant.tsx
import React from "react";
// REMOVED store imports
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// Define props based on what SettingsModal passes down
interface SettingsAssistantProps {
  globalSystemPrompt: string | null;
  setGlobalSystemPrompt: (prompt: string | null) => void;
}

// Wrap component logic in a named function for React.memo
const SettingsAssistantComponent: React.FC<SettingsAssistantProps> = ({
  globalSystemPrompt, // Use prop
  setGlobalSystemPrompt, // Use prop action
}) => {
  // REMOVED store access

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
          value={globalSystemPrompt ?? ""} // Use prop
          onChange={(e) => setGlobalSystemPrompt(e.target.value)} // Use prop action
          rows={4}
        />
      </div>
    </div>
  );
};

// Export the memoized component
export const SettingsAssistant = React.memo(SettingsAssistantComponent);
