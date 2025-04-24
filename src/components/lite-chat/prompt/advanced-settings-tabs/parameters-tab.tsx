// src/components/lite-chat/prompt/advanced-settings-tabs/parameters-tab.tsx
import React, { useCallback } from "react";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { useSettingsStore } from "@/store/settings.store";
import { useShallow } from "zustand/react/shallow";

export const ParametersTab: React.FC = () => {
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
    <div className="space-y-4 mt-0">
      <div className="grid grid-cols-2 gap-4 items-end">
        <div className="space-y-1.5">
          <Label htmlFor="temperature" className="text-xs">
            Temperature ({temperature.toFixed(2)})
          </Label>
          <Slider
            id="temperature"
            min={0}
            max={1}
            step={0.01}
            value={[temperature]}
            onValueChange={(value) => setTemperature(value[0])}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="top-p" className="text-xs">
            Top P ({(topP ?? 1.0).toFixed(2)})
          </Label>
          <Slider
            id="top-p"
            min={0}
            max={1}
            step={0.01}
            value={[topP ?? 1.0]}
            onValueChange={(value) => handleSliderChange(setTopP, value)}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 items-end">
        <div className="space-y-1.5">
          <Label htmlFor="max-tokens" className="text-xs">
            Max Tokens
          </Label>
          <Input
            id="max-tokens"
            type="number"
            placeholder="Default"
            value={maxTokens ?? ""}
            onChange={(e) => handleNumberInputChange(setMaxTokens, e)}
            min="1"
            className="h-8 text-xs"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="top-k" className="text-xs">
            Top K
          </Label>
          <Input
            id="top-k"
            type="number"
            placeholder="Default"
            value={topK ?? ""}
            onChange={(e) => handleNumberInputChange(setTopK, e)}
            min="1"
            className="h-8 text-xs"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 items-end">
        <div className="space-y-1.5">
          <Label htmlFor="presence-penalty" className="text-xs">
            Presence Penalty ({(presencePenalty ?? 0.0).toFixed(2)})
          </Label>
          <Slider
            id="presence-penalty"
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
          <Label htmlFor="frequency-penalty" className="text-xs">
            Frequency Penalty ({(frequencyPenalty ?? 0.0).toFixed(2)})
          </Label>
          <Slider
            id="frequency-penalty"
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
    </div>
  );
};
