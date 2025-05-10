// src/controls/components/assitant/SettingsAssistantParameters.tsx
// FULL FILE
import React, { useState, useEffect, useCallback } from "react";
import { useSettingsStore } from "@/store/settings.store";
import { useShallow } from "zustand/react/shallow";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
// ParameterControlComponent is for prompt-time overrides, not global settings.
// We will replicate its relevant UI parts here for global settings.

export const SettingsAssistantParameters: React.FC = () => {
  const {
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
  } = useSettingsStore(
    useShallow((state) => ({
      temperature: state.temperature,
      setTemperature: state.setTemperature,
      topP: state.topP,
      setTopP: state.setTopP,
      maxTokens: state.maxTokens,
      setMaxTokens: state.setMaxTokens,
      topK: state.topK,
      setTopK: state.setTopK,
      presencePenalty: state.presencePenalty,
      setPresencePenalty: state.setPresencePenalty,
      frequencyPenalty: state.frequencyPenalty,
      setFrequencyPenalty: state.setFrequencyPenalty,
    }))
  );

  // Local states for sliders to provide smooth UX
  const [localTemp, setLocalTemp] = useState(temperature);
  const [localTopP, setLocalTopP] = useState(topP ?? 1.0); // Default to 1.0 if null
  const [localPresence, setLocalPresence] = useState(presencePenalty ?? 0.0);
  const [localFrequency, setLocalFrequency] = useState(frequencyPenalty ?? 0.0);

  useEffect(() => setLocalTemp(temperature), [temperature]);
  useEffect(() => setLocalTopP(topP ?? 1.0), [topP]);
  useEffect(() => setLocalPresence(presencePenalty ?? 0.0), [presencePenalty]);
  useEffect(
    () => setLocalFrequency(frequencyPenalty ?? 0.0),
    [frequencyPenalty]
  );

  const handleNumberInputChange = useCallback(
    (
      setter: (value: number | null) => void,
      e: React.ChangeEvent<HTMLInputElement>
    ) => {
      const value = e.target.value;
      const numValue = value === "" ? null : parseInt(value, 10);
      if (value === "" || (!isNaN(numValue!) && numValue !== null)) {
        setter(numValue);
      }
    },
    []
  );

  const handleSliderCommit = useCallback(
    (setter: (value: number) => void, value: number[]) => {
      setter(value[0]);
    },
    []
  );

  return (
    <div className="space-y-6">
      <p className="text-xs text-muted-foreground mb-3">
        Set the default global values for AI parameters. These can be overridden
        per-project or per-prompt turn.
      </p>
      <div className="space-y-1.5">
        <Label htmlFor="global-temperature" className="text-sm">
          Temperature ({localTemp.toFixed(2)})
        </Label>
        <Slider
          id="global-temperature"
          min={0}
          max={1}
          step={0.01}
          value={[localTemp]}
          onValueChange={(v) => setLocalTemp(v[0])}
          onValueCommit={(v) => handleSliderCommit(setTemperature, v)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="global-top-p" className="text-sm">
          Top P ({localTopP.toFixed(2)})
        </Label>
        <Slider
          id="global-top-p"
          min={0}
          max={1}
          step={0.01}
          value={[localTopP]}
          onValueChange={(v) => setLocalTopP(v[0])}
          onValueCommit={(v) => handleSliderCommit(setTopP, v)}
        />
      </div>

      <div className="grid grid-cols-2 gap-4 items-end">
        <div className="space-y-1.5">
          <Label htmlFor="global-max-tokens" className="text-sm">
            Max Tokens
          </Label>
          <Input
            id="global-max-tokens"
            type="number"
            placeholder="Default (None)"
            value={maxTokens ?? ""}
            onChange={(e) => handleNumberInputChange(setMaxTokens, e)}
            min="1"
            className="h-9 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="global-top-k" className="text-sm">
            Top K
          </Label>
          <Input
            id="global-top-k"
            type="number"
            placeholder="Default (None)"
            value={topK ?? ""}
            onChange={(e) => handleNumberInputChange(setTopK, e)}
            min="1"
            className="h-9 text-sm"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="global-presence-penalty" className="text-sm">
          Presence Penalty ({localPresence.toFixed(2)})
        </Label>
        <Slider
          id="global-presence-penalty"
          min={-2}
          max={2}
          step={0.01}
          value={[localPresence]}
          onValueChange={(v) => setLocalPresence(v[0])}
          onValueCommit={(v) => handleSliderCommit(setPresencePenalty, v)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="global-frequency-penalty" className="text-sm">
          Frequency Penalty ({localFrequency.toFixed(2)})
        </Label>
        <Slider
          id="global-frequency-penalty"
          min={-2}
          max={2}
          step={0.01}
          value={[localFrequency]}
          onValueChange={(v) => setLocalFrequency(v[0])}
          onValueCommit={(v) => handleSliderCommit(setFrequencyPenalty, v)}
        />
      </div>
    </div>
  );
};
