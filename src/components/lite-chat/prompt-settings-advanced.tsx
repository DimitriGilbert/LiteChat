// src/components/lite-chat/prompt-settings-advanced.tsx
import React from "react";
import { useChatContext } from "@/hooks/use-chat-context";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { ApiKeySelector } from "./api-key-selector";
import { cn } from "@/lib/utils";

interface PromptSettingsAdvancedProps {
  className?: string;
}

export const PromptSettingsAdvanced: React.FC<PromptSettingsAdvancedProps> = ({
  className,
}) => {
  const {
    temperature,
    setTemperature,
    maxTokens,
    setMaxTokens,
    topP,
    setTopP,
    topK,
    setTopK,
    presencePenalty,
    setPresencePenalty,
    frequencyPenalty,
    setFrequencyPenalty,
  } = useChatContext();

  // Helper to handle number input for nullable state
  const handleNumberInputChange = (
    setter: (value: number | null) => void,
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const value = e.target.value;
    if (value === "") {
      setter(null);
    } else {
      const num = parseInt(value, 10);
      if (!isNaN(num)) {
        setter(num);
      }
    }
  };

  // Helper for sliders needing null conversion
  const handleSliderChange = (
    setter: (value: number | null) => void,
    value: number[],
  ) => {
    setter(value[0]);
  };

  return (
    <div
      className={cn(
        "p-3 border-t border-gray-200 dark:border-gray-700 space-y-4",
        className,
      )}
    >
      <ApiKeySelector />

      {/* Temperature */}
      <div className="space-y-2">
        <Label htmlFor="temperature" className="text-xs">
          Temperature: {temperature.toFixed(2)}
        </Label>
        <Slider
          id="temperature"
          min={0}
          max={1} // Or 2 depending on model support
          step={0.01}
          value={[temperature]}
          onValueChange={(value) => setTemperature(value[0])}
        />
      </div>

      {/* Max Tokens */}
      <div className="space-y-2">
        <Label htmlFor="max-tokens" className="text-xs">
          Max Tokens (optional)
        </Label>
        <Input
          id="max-tokens"
          type="number"
          placeholder="Provider default"
          value={maxTokens ?? ""}
          onChange={(e) => handleNumberInputChange(setMaxTokens, e)}
          min="1"
          className="h-8 text-xs"
        />
      </div>

      {/* Top P */}
      <div className="space-y-2">
        <Label htmlFor="top-p" className="text-xs">
          Top P (optional): {(topP ?? 1.0).toFixed(2)}
        </Label>
        <Slider
          id="top-p"
          min={0}
          max={1}
          step={0.01}
          value={[topP ?? 1.0]} // Default to 1 if null for slider display
          onValueChange={(value) => handleSliderChange(setTopP, value)}
        />
      </div>

      {/* Top K */}
      <div className="space-y-2">
        <Label htmlFor="top-k" className="text-xs">
          Top K (optional)
        </Label>
        <Input
          id="top-k"
          type="number"
          placeholder="Provider default"
          value={topK ?? ""}
          onChange={(e) => handleNumberInputChange(setTopK, e)}
          min="1"
          className="h-8 text-xs"
        />
      </div>

      {/* Presence Penalty */}
      <div className="space-y-2">
        <Label htmlFor="presence-penalty" className="text-xs">
          Presence Penalty (optional): {(presencePenalty ?? 0.0).toFixed(2)}
        </Label>
        <Slider
          id="presence-penalty"
          min={-2} // Common range, adjust if needed
          max={2}
          step={0.01}
          value={[presencePenalty ?? 0.0]}
          onValueChange={(value) =>
            handleSliderChange(setPresencePenalty, value)
          }
        />
      </div>

      {/* Frequency Penalty */}
      <div className="space-y-2">
        <Label htmlFor="frequency-penalty" className="text-xs">
          Frequency Penalty (optional): {(frequencyPenalty ?? 0.0).toFixed(2)}
        </Label>
        <Slider
          id="frequency-penalty"
          min={-2} // Common range, adjust if needed
          max={2}
          step={0.01}
          value={[frequencyPenalty ?? 0.0]}
          onValueChange={(value) =>
            handleSliderChange(setFrequencyPenalty, value)
          }
        />
      </div>
    </div>
  );
};
