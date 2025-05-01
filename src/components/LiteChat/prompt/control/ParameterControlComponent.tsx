// src/components/LiteChat/prompt/control/ParameterControlComponent.tsx
import React, { useState, useEffect, useCallback } from "react";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Define props to accept potentially nullable values and setters
export interface ParameterControlComponentProps {
  temperature: number | null;
  setTemperature: (value: number | null) => void;
  topP: number | null;
  setTopP: (value: number | null) => void;
  maxTokens: number | null;
  setMaxTokens: (value: number | null) => void;
  topK: number | null;
  setTopK: (value: number | null) => void;
  presencePenalty: number | null;
  setPresencePenalty: (value: number | null) => void;
  frequencyPenalty: number | null;
  setFrequencyPenalty: (value: number | null) => void;
  // Optional props for default/inherited values (used in ProjectSettings)
  defaultTemperature?: number;
  defaultTopP?: number | null;
  defaultMaxTokens?: number | null;
  defaultTopK?: number | null;
  defaultPresencePenalty?: number | null;
  defaultFrequencyPenalty?: number | null;
  // Optional className
  className?: string;
}

export const ParameterControlComponent: React.FC<
  ParameterControlComponentProps
> = ({
  temperature,
  setTemperature,
  topP,
  setTopP,
  maxTokens,
  setMaxTokens,
  topK,
  setTopK,
  presencePenalty,
  setPresencePenalty,
  frequencyPenalty,
  setFrequencyPenalty,
  // Use provided defaults or fallback to global typical defaults
  defaultTemperature = 0.7,
  defaultTopP = null,
  defaultMaxTokens = null,
  defaultTopK = null,
  defaultPresencePenalty = 0.0,
  defaultFrequencyPenalty = 0.0,
  className,
}) => {
  // Local state for visual feedback during slider interaction
  // Initialize with the current value or the default if null
  const [localTemp, setLocalTemp] = useState(temperature ?? defaultTemperature);
  const [localTopP, setLocalTopP] = useState(topP ?? defaultTopP ?? 1.0)
  const [localPresence, setLocalPresence] = useState(
    presencePenalty ?? defaultPresencePenalty ?? 0.0,
  );
  const [localFrequency, setLocalFrequency] = useState(
    frequencyPenalty ?? defaultFrequencyPenalty ?? 0.0,
  );

  // Update local state if the prop value changes (e.g., reset or external update)
  useEffect(() => {
    setLocalTemp(temperature ?? defaultTemperature);
  }, [temperature, defaultTemperature]);
  useEffect(() => {
    setLocalTopP(topP ?? defaultTopP ?? 1.0);
  }, [topP, defaultTopP]);
  useEffect(() => {
    setLocalPresence(presencePenalty ?? defaultPresencePenalty ?? 0.0);
  }, [presencePenalty, defaultPresencePenalty]);
  useEffect(() => {
    setLocalFrequency(frequencyPenalty ?? defaultFrequencyPenalty ?? 0.0);
  }, [frequencyPenalty, defaultFrequencyPenalty]);

  // Handlers for number inputs (Max Tokens, Top K)
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

  // Handler for committing slider changes
  const handleSliderCommit = useCallback(
    (setter: (value: number | null) => void, value: number[]) => {
      setter(value[0]);
    },
    [],
  );

  // Handler for "Use Default" buttons
  const handleUseDefault = useCallback(
    (setter: (value: number | null) => void) => {
      setter(null)
    },
    [],
  );

  // Determine if "Use Default" should be shown (only if defaults are provided, e.g., in ProjectSettings)
  const showUseDefault =
    defaultTemperature !== undefined ||
    defaultTopP !== undefined ||
    defaultMaxTokens !== undefined ||
    defaultTopK !== undefined ||
    defaultPresencePenalty !== undefined ||
    defaultFrequencyPenalty !== undefined;

  return (
    <div className={cn("space-y-4 p-4", className)}>
      {/* Temperature */}
      <div className="space-y-1.5">
        <Label htmlFor="param-temperature" className="text-xs">
          Temperature ({localTemp.toFixed(2)})
        </Label>
        <Slider
          id="param-temperature"
          min={0}
          max={1}
          step={0.01}
          value={[localTemp]}
          onValueChange={(v) => setLocalTemp(v[0])}
          onValueCommit={(v) => handleSliderCommit(setTemperature, v)}
        />
        {showUseDefault && (
          <Button
            variant="link"
            size="sm"
            className="text-xs h-auto p-0 text-muted-foreground"
            onClick={() => handleUseDefault(setTemperature)}
            disabled={temperature === null}
          >
            Use Default ({defaultTemperature?.toFixed(2) ?? "N/A"})
          </Button>
        )}
      </div>

      {/* Top P */}
      <div className="space-y-1.5">
        <Label htmlFor="param-top-p" className="text-xs">
          Top P ({(localTopP ?? 0).toFixed(2)}) {/* Default to 0 for display */}
        </Label>
        <Slider
          id="param-top-p"
          min={0}
          max={1}
          step={0.01}
          value={[localTopP ?? 1.0]} // Default to 1 for slider value
          onValueChange={(v) => setLocalTopP(v[0])}
          onValueCommit={(v) => handleSliderCommit(setTopP, v)}
        />
        {showUseDefault && (
          <Button
            variant="link"
            size="sm"
            className="text-xs h-auto p-0 text-muted-foreground"
            onClick={() => handleUseDefault(setTopP)}
            disabled={topP === null}
          >
            Use Default ({defaultTopP?.toFixed(2) ?? "N/A"})
          </Button>
        )}
      </div>

      {/* Max Tokens & Top K */}
      <div className="grid grid-cols-2 gap-4 items-end">
        <div className="space-y-1.5">
          <Label htmlFor="param-max-tokens" className="text-xs">
            Max Tokens
          </Label>
          <Input
            id="param-max-tokens"
            type="number"
            placeholder={`Default: ${defaultMaxTokens ?? "None"}`}
            value={maxTokens ?? ""}
            onChange={(e) => handleNumberInputChange(setMaxTokens, e)}
            min="1"
            className="h-8 text-xs"
          />
          {showUseDefault && (
            <Button
              variant="link"
              size="sm"
              className="text-xs h-auto p-0 text-muted-foreground"
              onClick={() => handleUseDefault(setMaxTokens)}
              disabled={maxTokens === null}
            >
              Use Default
            </Button>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="param-top-k" className="text-xs">
            Top K
          </Label>
          <Input
            id="param-top-k"
            type="number"
            placeholder={`Default: ${defaultTopK ?? "None"}`}
            value={topK ?? ""}
            onChange={(e) => handleNumberInputChange(setTopK, e)}
            min="1"
            className="h-8 text-xs"
          />
          {showUseDefault && (
            <Button
              variant="link"
              size="sm"
              className="text-xs h-auto p-0 text-muted-foreground"
              onClick={() => handleUseDefault(setTopK)}
              disabled={topK === null}
            >
              Use Default
            </Button>
          )}
        </div>
      </div>

      {/* Presence Penalty */}
      <div className="space-y-1.5">
        <Label htmlFor="param-presence-penalty" className="text-xs">
          Presence Penalty ({(localPresence ?? 0).toFixed(2)}){" "}
          {/* Default to 0 */}
        </Label>
        <Slider
          id="param-presence-penalty"
          min={-2}
          max={2}
          step={0.01}
          value={[localPresence ?? 0]} // Default to 0
          onValueChange={(v) => setLocalPresence(v[0])}
          onValueCommit={(v) => handleSliderCommit(setPresencePenalty, v)}
        />
        {showUseDefault && (
          <Button
            variant="link"
            size="sm"
            className="text-xs h-auto p-0 text-muted-foreground"
            onClick={() => handleUseDefault(setPresencePenalty)}
            disabled={presencePenalty === null}
          >
            Use Default ({defaultPresencePenalty?.toFixed(2) ?? "N/A"})
          </Button>
        )}
      </div>

      {/* Frequency Penalty */}
      <div className="space-y-1.5">
        <Label htmlFor="param-frequency-penalty" className="text-xs">
          Frequency Penalty ({(localFrequency ?? 0).toFixed(2)}){" "}
          {/* Default to 0 */}
        </Label>
        <Slider
          id="param-frequency-penalty"
          min={-2}
          max={2}
          step={0.01}
          value={[localFrequency ?? 0]} // Default to 0
          onValueChange={(v) => setLocalFrequency(v[0])}
          onValueCommit={(v) => handleSliderCommit(setFrequencyPenalty, v)}
        />
        {showUseDefault && (
          <Button
            variant="link"
            size="sm"
            className="text-xs h-auto p-0 text-muted-foreground"
            onClick={() => handleUseDefault(setFrequencyPenalty)}
            disabled={frequencyPenalty === null}
          >
            Use Default ({defaultFrequencyPenalty?.toFixed(2) ?? "N/A"})
          </Button>
        )}
      </div>
    </div>
  );
};
