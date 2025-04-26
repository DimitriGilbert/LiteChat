// src/components/LiteChat/prompt/control/ParameterControlComponent.tsx
import React, { useCallback, useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { useSettingsStore } from "@/store/settings.store";
import { useShallow } from "zustand/react/shallow";
import { cn } from "@/lib/utils";

interface ParameterControlComponentProps {
  className?: string;
}

export const ParameterControlComponent: React.FC<
  ParameterControlComponentProps
> = ({ className }) => {
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
    })),
  );

  const [localTemp, setLocalTemp] = useState(temperature);
  const [localTopP, setLocalTopP] = useState(topP ?? 1.0);
  const [localPresence, setLocalPresence] = useState(presencePenalty ?? 0.0);
  const [localFrequency, setLocalFrequency] = useState(frequencyPenalty ?? 0.0);

  useEffect(() => setLocalTemp(temperature), [temperature]);
  useEffect(() => setLocalTopP(topP ?? 1.0), [topP]);
  useEffect(() => setLocalPresence(presencePenalty ?? 0.0), [presencePenalty]);
  useEffect(
    () => setLocalFrequency(frequencyPenalty ?? 0.0),
    [frequencyPenalty],
  );

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

  const handleSliderVisualChange = useCallback(
    (setter: React.Dispatch<React.SetStateAction<number>>, value: number[]) => {
      setter(value[0]);
    },
    [],
  );

  // Correctly type the setter based on whether it accepts null or not
  const handleSliderCommit = useCallback(
    <T extends number | null>(setter: (value: T) => void, value: number[]) => {
      // The slider always provides a number, so value[0] is safe
      // We cast to T to satisfy the specific setter's requirement (number or number | null)
      setter(value[0] as T);
    },
    [],
  );

  return (
    <div className={cn("space-y-4 p-4 w-80", className)}>
      <div className="space-y-1.5">
        <Label htmlFor="popover-temperature" className="text-xs">
          Temperature ({localTemp.toFixed(2)})
        </Label>
        <Slider
          id="popover-temperature"
          min={0}
          max={1}
          step={0.01}
          value={[localTemp]}
          onValueChange={(v) => handleSliderVisualChange(setLocalTemp, v)}
          onValueCommit={(v) => handleSliderCommit(setTemperature, v)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="popover-top-p" className="text-xs">
          Top P ({localTopP.toFixed(2)})
        </Label>
        <Slider
          id="popover-top-p"
          min={0}
          max={1}
          step={0.01}
          value={[localTopP]}
          onValueChange={(v) => handleSliderVisualChange(setLocalTopP, v)}
          onValueCommit={(v) => handleSliderCommit(setTopP, v)}
        />
      </div>
      <div className="grid grid-cols-2 gap-4 items-end">
        <div className="space-y-1.5">
          <Label htmlFor="popover-max-tokens" className="text-xs">
            Max Tokens
          </Label>
          <Input
            id="popover-max-tokens"
            type="number"
            placeholder="Default"
            value={maxTokens ?? ""}
            onChange={(e) => handleNumberInputChange(setMaxTokens, e)}
            min="1"
            className="h-8 text-xs"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="popover-top-k" className="text-xs">
            Top K
          </Label>
          <Input
            id="popover-top-k"
            type="number"
            placeholder="Default"
            value={topK ?? ""}
            onChange={(e) => handleNumberInputChange(setTopK, e)}
            min="1"
            className="h-8 text-xs"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="popover-presence-penalty" className="text-xs">
          Presence Penalty ({localPresence.toFixed(2)})
        </Label>
        <Slider
          id="popover-presence-penalty"
          min={-2}
          max={2}
          step={0.01}
          value={[localPresence]}
          onValueChange={(v) => handleSliderVisualChange(setLocalPresence, v)}
          onValueCommit={(v) => handleSliderCommit(setPresencePenalty, v)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="popover-frequency-penalty" className="text-xs">
          Frequency Penalty ({localFrequency.toFixed(2)})
        </Label>
        <Slider
          id="popover-frequency-penalty"
          min={-2}
          max={2}
          step={0.01}
          value={[localFrequency]}
          onValueChange={(v) => handleSliderVisualChange(setLocalFrequency, v)}
          onValueCommit={(v) => handleSliderCommit(setFrequencyPenalty, v)}
        />
      </div>
    </div>
  );
};
