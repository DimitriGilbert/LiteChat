// src/components/LiteChat/prompt/control/ParameterControlComponent.tsx
import React, { useCallback } from "react";
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
      temperature: state.temperature, // Now exists
      setTemperature: state.setTemperature, // Now exists
      topP: state.topP, // Now exists
      setTopP: state.setTopP, // Now exists
      maxTokens: state.maxTokens, // Now exists
      setMaxTokens: state.setMaxTokens, // Now exists
      topK: state.topK, // Now exists
      setTopK: state.setTopK, // Now exists
      presencePenalty: state.presencePenalty, // Now exists
      setPresencePenalty: state.setPresencePenalty, // Now exists
      frequencyPenalty: state.frequencyPenalty, // Now exists
      setFrequencyPenalty: state.setFrequencyPenalty, // Now exists
    })),
  );

  const handleNumberInputChange = useCallback(
    (
      setter: (value: number | null) => void,
      e: React.ChangeEvent<HTMLInputElement>,
    ) => {
      const value = e.target.value;
      setter(value === "" ? null : parseInt(value, 10) || null);
    },
    [],
  );

  const handleSliderChange = useCallback(
    (setter: (value: number | null) => void, value: number[]) => {
      setter(value[0]);
    },
    [],
  );

  return (
    <div className={cn("space-y-4 p-4 w-80", className)}>
      <div className="space-y-1.5">
        <Label htmlFor="popover-temperature" className="text-xs">
          Temperature ({temperature.toFixed(2)})
        </Label>
        <Slider
          id="popover-temperature"
          min={0}
          max={1}
          step={0.01}
          value={[temperature]}
          onValueChange={(value) => setTemperature(value[0])}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="popover-top-p" className="text-xs">
          Top P ({(topP ?? 1.0).toFixed(2)})
        </Label>
        <Slider
          id="popover-top-p"
          min={0}
          max={1}
          step={0.01}
          value={[topP ?? 1.0]}
          onValueChange={(value) => handleSliderChange(setTopP, value)}
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
          Presence Penalty ({(presencePenalty ?? 0.0).toFixed(2)})
        </Label>
        <Slider
          id="popover-presence-penalty"
          min={-2}
          max={2}
          step={0.01}
          value={[presencePenalty ?? 0.0]}
          onValueChange={(value) =>
            handleSliderChange(setPresencePenalty, value)
          }
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="popover-frequency-penalty" className="text-xs">
          Frequency Penalty ({(frequencyPenalty ?? 0.0).toFixed(2)})
        </Label>
        <Slider
          id="popover-frequency-penalty"
          min={-2}
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
