// src/components/LiteChat/settings/assistant/SettingsAssistantTools.tsx
// FULL FILE
import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useSettingsStore } from "@/store/settings.store";
import { useShallow } from "zustand/react/shallow";

export const SettingsAssistantTools: React.FC = () => {
  const { toolMaxSteps, setToolMaxSteps } = useSettingsStore(
    useShallow((state) => ({
      toolMaxSteps: state.toolMaxSteps,
      setToolMaxSteps: state.setToolMaxSteps,
    })),
  );

  const handleMaxStepsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const numValue = value === "" ? 5 : parseInt(value, 10);
    if (!isNaN(numValue)) {
      setToolMaxSteps(numValue);
    }
  };

  return (
    <div className="space-y-4">
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
        className="w-24"
      />
    </div>
  );
};
