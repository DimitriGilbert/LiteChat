// src/components/LiteChat/project-settings/ProjectSettingsParams.tsx
// Entire file content provided due to multiple changes
import React, { useCallback } from "react";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface ProjectSettingsParamsProps {
  temperature: number | null;
  setTemperature: (value: number | null) => void;
  maxTokens: number | null;
  setMaxTokens: (value: number | null) => void;
  topP: number | null;
  setTopP: (value: number | null) => void;
  topK: number | null;
  setTopK: (value: number | null) => void;
  presencePenalty: number | null;
  setPresencePenalty: (value: number | null) => void;
  frequencyPenalty: number | null;
  setFrequencyPenalty: (value: number | null) => void;
  // Local slider states
  localTemp: number;
  setLocalTemp: (value: number) => void;
  localTopP: number;
  setLocalTopP: (value: number) => void;
  localPresence: number;
  setLocalPresence: (value: number) => void;
  localFrequency: number;
  setLocalFrequency: (value: number) => void;
  // Effective values for placeholders/defaults
  effectiveTemperature: number | null;
  effectiveMaxTokens: number | null;
  effectiveTopP: number | null;
  effectiveTopK: number | null;
  effectivePresencePenalty: number | null;
  effectiveFrequencyPenalty: number | null;
  isSaving: boolean;
}

export const ProjectSettingsParams: React.FC<ProjectSettingsParamsProps> = ({
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
  localTemp,
  setLocalTemp,
  localTopP,
  setLocalTopP,
  localPresence,
  setLocalPresence,
  localFrequency,
  setLocalFrequency,
  effectiveTemperature,
  effectiveMaxTokens,
  effectiveTopP,
  effectiveTopK,
  effectivePresencePenalty,
  effectiveFrequencyPenalty,
  isSaving,
}) => {
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

  // Removed handleSliderVisualChange helper

  const handleSliderCommit = useCallback(
    <T extends number | null>(setter: (value: T) => void, value: number[]) => {
      setter(value[0] as T);
    },
    [],
  );

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="project-temperature" className="text-xs">
          Temperature ({localTemp.toFixed(2)})
        </Label>
        <Slider
          id="project-temperature"
          min={0}
          max={1}
          step={0.01}
          value={[localTemp]}
          // Directly call the setter in onValueChange
          onValueChange={(v: number[]) => setLocalTemp(v[0])}
          onValueCommit={(v) => handleSliderCommit(setTemperature, v)}
          disabled={isSaving}
        />
        <Button
          variant="link"
          size="sm"
          className="text-xs h-auto p-0 text-muted-foreground"
          onClick={() => setTemperature(null)}
          disabled={isSaving || temperature === null}
        >
          Use Inherited/Default ({effectiveTemperature?.toFixed(2) ?? "N/A"})
        </Button>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="project-top-p" className="text-xs">
          Top P ({localTopP.toFixed(2)})
        </Label>
        <Slider
          id="project-top-p"
          min={0}
          max={1}
          step={0.01}
          value={[localTopP]}
          // Directly call the setter in onValueChange
          onValueChange={(v: number[]) => setLocalTopP(v[0])}
          onValueCommit={(v) => handleSliderCommit(setTopP, v)}
          disabled={isSaving}
        />
        <Button
          variant="link"
          size="sm"
          className="text-xs h-auto p-0 text-muted-foreground"
          onClick={() => setTopP(null)}
          disabled={isSaving || topP === null}
        >
          Use Inherited/Default ({effectiveTopP?.toFixed(2) ?? "N/A"})
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-4 items-end">
        <div className="space-y-1.5">
          <Label htmlFor="project-max-tokens" className="text-xs">
            Max Tokens
          </Label>
          <Input
            id="project-max-tokens"
            type="number"
            placeholder={`Inherited: ${effectiveMaxTokens ?? "Default"}`}
            value={maxTokens ?? ""}
            onChange={(e) => handleNumberInputChange(setMaxTokens, e)}
            min="1"
            className="h-8 text-xs"
            disabled={isSaving}
          />
          <Button
            variant="link"
            size="sm"
            className="text-xs h-auto p-0 text-muted-foreground"
            onClick={() => setMaxTokens(null)}
            disabled={isSaving || maxTokens === null}
          >
            Use Inherited/Default
          </Button>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="project-top-k" className="text-xs">
            Top K
          </Label>
          <Input
            id="project-top-k"
            type="number"
            placeholder={`Inherited: ${effectiveTopK ?? "Default"}`}
            value={topK ?? ""}
            onChange={(e) => handleNumberInputChange(setTopK, e)}
            min="1"
            className="h-8 text-xs"
            disabled={isSaving}
          />
          <Button
            variant="link"
            size="sm"
            className="text-xs h-auto p-0 text-muted-foreground"
            onClick={() => setTopK(null)}
            disabled={isSaving || topK === null}
          >
            Use Inherited/Default
          </Button>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="project-presence-penalty" className="text-xs">
          Presence Penalty ({localPresence.toFixed(2)})
        </Label>
        <Slider
          id="project-presence-penalty"
          min={-2}
          max={2}
          step={0.01}
          value={[localPresence]}
          // Directly call the setter in onValueChange
          onValueChange={(v: number[]) => setLocalPresence(v[0])}
          onValueCommit={(v) => handleSliderCommit(setPresencePenalty, v)}
          disabled={isSaving}
        />
        <Button
          variant="link"
          size="sm"
          className="text-xs h-auto p-0 text-muted-foreground"
          onClick={() => setPresencePenalty(null)}
          disabled={isSaving || presencePenalty === null}
        >
          Use Inherited/Default ({effectivePresencePenalty?.toFixed(2) ?? "N/A"}
          )
        </Button>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="project-frequency-penalty" className="text-xs">
          Frequency Penalty ({localFrequency.toFixed(2)})
        </Label>
        <Slider
          id="project-frequency-penalty"
          min={-2}
          max={2}
          step={0.01}
          value={[localFrequency]}
          // Directly call the setter in onValueChange
          onValueChange={(v: number[]) => setLocalFrequency(v[0])}
          onValueCommit={(v) => handleSliderCommit(setFrequencyPenalty, v)}
          disabled={isSaving}
        />
        <Button
          variant="link"
          size="sm"
          className="text-xs h-auto p-0 text-muted-foreground"
          onClick={() => setFrequencyPenalty(null)}
          disabled={isSaving || frequencyPenalty === null}
        >
          Use Inherited/Default (
          {effectiveFrequencyPenalty?.toFixed(2) ?? "N/A"})
        </Button>
      </div>
    </div>
  );
};
