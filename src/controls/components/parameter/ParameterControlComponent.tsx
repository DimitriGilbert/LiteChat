// src/controls/components/parameter/ParameterControlComponent.tsx
// FULL FILE
import React, { useState, useEffect, useCallback } from "react";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ParameterControlModule } from "@/controls/modules/ParameterControlModule"; // Import module type

// Props now take the module instance
interface ParameterControlComponentProps {
  module: ParameterControlModule;
  className?: string;
}

export const ParameterControlComponent: React.FC<
  ParameterControlComponentProps
> = ({ module, className }) => {
  const [, forceUpdate] = useState({});
  useEffect(() => {
    module.setNotifyCallback(() => forceUpdate({}));
    return () => module.setNotifyCallback(null);
  }, [module]);

  // Read current values and defaults from the module
  const temperature = module.temperature;
  const topP = module.topP;
  const maxTokens = module.maxTokens;
  const topK = module.topK;
  const presencePenalty = module.presencePenalty;
  const frequencyPenalty = module.frequencyPenalty;

  const defaultTemperature = module.defaultTemperature;
  const defaultTopP = module.defaultTopP;
  const defaultMaxTokens = module.defaultMaxTokens;
  const defaultTopK = module.defaultTopK;
  const defaultPresencePenalty = module.defaultPresencePenalty;
  const defaultFrequencyPenalty = module.defaultFrequencyPenalty;

  const supportedParams = module.supportedParams;

  // Local slider states, initialized from module's current effective values
  const [localTemp, setLocalTemp] = useState(
    temperature ?? defaultTemperature ?? 0.7
  );
  const [localTopP, setLocalTopP] = useState(topP ?? defaultTopP ?? 1.0);
  const [localPresence, setLocalPresence] = useState(
    presencePenalty ?? defaultPresencePenalty ?? 0.0
  );
  const [localFrequency, setLocalFrequency] = useState(
    frequencyPenalty ?? defaultFrequencyPenalty ?? 0.0
  );

  // Sync local slider states if module's state changes
  useEffect(() => {
    setLocalTemp(temperature ?? defaultTemperature ?? 0.7);
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

  const handleNumberInputChange = useCallback(
    (
      setter: (value: number | null) => void,
      e: React.ChangeEvent<HTMLInputElement>
    ) => {
      const value = e.target.value;
      const numValue = value === "" ? null : parseInt(value, 10);
      if (value === "" || (!isNaN(numValue!) && numValue !== null)) {
        setter(numValue); // This calls the module's setter
      }
    },
    []
  );

  const handleSliderCommit = useCallback(
    (setter: (value: number | null) => void, value: number[]) => {
      setter(value[0]); // This calls the module's setter
    },
    []
  );

  const handleUseDefault = useCallback(
    (setter: (value: number | null) => void) => {
      setter(null); // This calls the module's setter
    },
    []
  );

  const showUseDefault =
    defaultTemperature !== undefined ||
    defaultTopP !== undefined ||
    defaultMaxTokens !== undefined ||
    defaultTopK !== undefined ||
    defaultPresencePenalty !== undefined ||
    defaultFrequencyPenalty !== undefined;

  return (
    <div className={cn("space-y-4 p-4", className)}>
      {supportedParams.has("temperature") && (
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
            onValueCommit={(v) => handleSliderCommit(module.setTemperature, v)}
          />
          {showUseDefault && (
            <Button
              variant="link"
              size="sm"
              className="text-xs h-auto p-0 text-muted-foreground"
              onClick={() => handleUseDefault(module.setTemperature)}
              disabled={temperature === null}
            >
              Use Default ({defaultTemperature?.toFixed(2) ?? "N/A"})
            </Button>
          )}
        </div>
      )}

      {supportedParams.has("top_p") && (
        <div className="space-y-1.5">
          <Label htmlFor="param-top-p" className="text-xs">
            Top P ({(localTopP ?? 0).toFixed(2)})
          </Label>
          <Slider
            id="param-top-p"
            min={0}
            max={1}
            step={0.01}
            value={[localTopP ?? 1.0]}
            onValueChange={(v) => setLocalTopP(v[0])}
            onValueCommit={(v) => handleSliderCommit(module.setTopP, v)}
          />
          {showUseDefault && (
            <Button
              variant="link"
              size="sm"
              className="text-xs h-auto p-0 text-muted-foreground"
              onClick={() => handleUseDefault(module.setTopP)}
              disabled={topP === null}
            >
              Use Default ({defaultTopP?.toFixed(2) ?? "N/A"})
            </Button>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 items-end">
        {supportedParams.has("max_tokens") && (
          <div className="space-y-1.5">
            <Label htmlFor="param-max-tokens" className="text-xs">
              Max Tokens
            </Label>
            <Input
              id="param-max-tokens"
              type="number"
              placeholder={`Default: ${defaultMaxTokens ?? "None"}`}
              value={maxTokens ?? ""}
              onChange={(e) => handleNumberInputChange(module.setMaxTokens, e)}
              min="1"
              className="h-8 text-xs"
            />
            {showUseDefault && (
              <Button
                variant="link"
                size="sm"
                className="text-xs h-auto p-0 text-muted-foreground"
                onClick={() => handleUseDefault(module.setMaxTokens)}
                disabled={maxTokens === null}
              >
                Use Default
              </Button>
            )}
          </div>
        )}
        {supportedParams.has("top_k") && (
          <div className="space-y-1.5">
            <Label htmlFor="param-top-k" className="text-xs">
              Top K
            </Label>
            <Input
              id="param-top-k"
              type="number"
              placeholder={`Default: ${defaultTopK ?? "None"}`}
              value={topK ?? ""}
              onChange={(e) => handleNumberInputChange(module.setTopK, e)}
              min="1"
              className="h-8 text-xs"
            />
            {showUseDefault && (
              <Button
                variant="link"
                size="sm"
                className="text-xs h-auto p-0 text-muted-foreground"
                onClick={() => handleUseDefault(module.setTopK)}
                disabled={topK === null}
              >
                Use Default
              </Button>
            )}
          </div>
        )}
      </div>

      {supportedParams.has("presence_penalty") && (
        <div className="space-y-1.5">
          <Label htmlFor="param-presence-penalty" className="text-xs">
            Presence Penalty ({(localPresence ?? 0).toFixed(2)})
          </Label>
          <Slider
            id="param-presence-penalty"
            min={-2}
            max={2}
            step={0.01}
            value={[localPresence ?? 0]}
            onValueChange={(v) => setLocalPresence(v[0])}
            onValueCommit={(v) =>
              handleSliderCommit(module.setPresencePenalty, v)
            }
          />
          {showUseDefault && (
            <Button
              variant="link"
              size="sm"
              className="text-xs h-auto p-0 text-muted-foreground"
              onClick={() => handleUseDefault(module.setPresencePenalty)}
              disabled={presencePenalty === null}
            >
              Use Default ({defaultPresencePenalty?.toFixed(2) ?? "N/A"})
            </Button>
          )}
        </div>
      )}

      {supportedParams.has("frequency_penalty") && (
        <div className="space-y-1.5">
          <Label htmlFor="param-frequency-penalty" className="text-xs">
            Frequency Penalty ({(localFrequency ?? 0).toFixed(2)})
          </Label>
          <Slider
            id="param-frequency-penalty"
            min={-2}
            max={2}
            step={0.01}
            value={[localFrequency ?? 0]}
            onValueChange={(v) => setLocalFrequency(v[0])}
            onValueCommit={(v) =>
              handleSliderCommit(module.setFrequencyPenalty, v)
            }
          />
          {showUseDefault && (
            <Button
              variant="link"
              size="sm"
              className="text-xs h-auto p-0 text-muted-foreground"
              onClick={() => handleUseDefault(module.setFrequencyPenalty)}
              disabled={frequencyPenalty === null}
            >
              Use Default ({defaultFrequencyPenalty?.toFixed(2) ?? "N/A"})
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
