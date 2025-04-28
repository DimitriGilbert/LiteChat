// src/components/LiteChat/settings/SettingsAssistant.tsx
import React from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input"; // Import Input
import { useShallow } from "zustand/react/shallow";
import { useSettingsStore } from "@/store/settings.store";

const SettingsAssistantComponent: React.FC = () => {
  // --- Fetch state/actions from store ---
  const {
    globalSystemPrompt,
    setGlobalSystemPrompt,
    toolMaxSteps, // Get max steps state
    setToolMaxSteps, // Get max steps setter
  } = useSettingsStore(
    useShallow((state) => ({
      globalSystemPrompt: state.globalSystemPrompt, // Now exists
      setGlobalSystemPrompt: state.setGlobalSystemPrompt, // Now exists
      toolMaxSteps: state.toolMaxSteps, // Get max steps state
      setToolMaxSteps: state.setToolMaxSteps, // Get max steps setter
    })),
  );

  const handleMaxStepsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const numValue = value === "" ? 5 : parseInt(value, 10); // Default to 5 if empty
    if (!isNaN(numValue)) {
      setToolMaxSteps(numValue); // Setter already clamps
    }
  };

  return (
    <div className="space-y-6 p-1">
      <div>
        <h3 className="text-lg font-medium mb-2">Prompt Configuration</h3>
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
          rows={4}
        />
      </div>

      {/* Tool Settings Section */}
      <div>
        <h3 className="text-lg font-medium mb-2">Tool Usage</h3>
        <Label htmlFor="tool-max-steps" className="text-sm mb-1 block">
          Maximum Tool Steps per Turn
        </Label>
        <p className="text-xs text-muted-foreground mb-2">
          Limits the number of sequential tool calls the AI can make before
          generating a final response (1-20). Higher values allow more complex
          tasks but increase latency and cost. (Default: 5)
        </p>
        <Input
          id="tool-max-steps"
          type="number"
          min="1"
          max="20"
          step="1"
          value={toolMaxSteps}
          onChange={handleMaxStepsChange}
          className="w-24" // Make input smaller
        />
      </div>
    </div>
  );
};

export const SettingsAssistant = React.memo(SettingsAssistantComponent);
