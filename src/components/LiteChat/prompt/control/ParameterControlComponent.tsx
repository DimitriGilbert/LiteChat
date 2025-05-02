// src/components/LiteChat/prompt/control/ParameterControlComponent.tsx

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch"; // Import Switch
import { cn } from "@/lib/utils";
import { useProviderStore } from "@/store/provider.store"; // Import provider store
import { useShallow } from "zustand/react/shallow";
import {
  createAiModelConfig,
  splitModelId,
} from "@/lib/litechat/provider-helpers"; // Import helper

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
  // Add props for new parameters
  reasoningEnabled: boolean | null;
  setReasoningEnabled: (enabled: boolean | null) => void;
  webSearchEnabled: boolean | null;
  setWebSearchEnabled: (enabled: boolean | null) => void;
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
  // Destructure new props
  reasoningEnabled,
  setReasoningEnabled,
  webSearchEnabled,
  setWebSearchEnabled,
  // Use provided defaults or fallback to global typical defaults
  defaultTemperature = 0.7,
  defaultTopP = null,
  defaultMaxTokens = null,
  defaultTopK = null,
  defaultPresencePenalty = 0.0,
  defaultFrequencyPenalty = 0.0,
  className,
}) => {
  // Select primitive/stable values needed for computation
  const { selectedModelId, dbProviderConfigs, dbApiKeys } = useProviderStore(
    useShallow((state) => ({
      selectedModelId: state.selectedModelId,
      dbProviderConfigs: state.dbProviderConfigs,
      dbApiKeys: state.dbApiKeys,
    })),
  );

  // Compute selectedModel *inside* useMemo based on stable IDs/configs
  const selectedModel = useMemo(() => {
    if (!selectedModelId) return undefined;
    const { providerId, modelId: specificModelId } =
      splitModelId(selectedModelId);
    if (!providerId || !specificModelId) return undefined;
    const config = dbProviderConfigs.find((p) => p.id === providerId);
    if (!config) return undefined;
    const apiKeyRecord = dbApiKeys.find((k) => k.id === config.apiKeyId);
    return createAiModelConfig(config, specificModelId, apiKeyRecord?.value);
  }, [selectedModelId, dbProviderConfigs, dbApiKeys]); // Depend on stable values/arrays

  // Compute supportedParams based on the computed selectedModel
  const supportedParams = useMemo(
    () => new Set(selectedModel?.metadata?.supported_parameters ?? []),
    [selectedModel], // Depend on the computed model
  );

  // Local state for visual feedback during slider interaction
  const [localTemp, setLocalTemp] = useState(temperature ?? defaultTemperature);
  const [localTopP, setLocalTopP] = useState(topP ?? defaultTopP ?? 1.0);
  const [localPresence, setLocalPresence] = useState(
    presencePenalty ?? defaultPresencePenalty ?? 0.0,
  );
  const [localFrequency, setLocalFrequency] = useState(
    frequencyPenalty ?? defaultFrequencyPenalty ?? 0.0,
  );

  // Update local state if the prop value changes
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

  // Handlers remain the same
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

  const handleSliderCommit = useCallback(
    (setter: (value: number | null) => void, value: number[]) => {
      setter(value[0]);
    },
    [],
  );

  const handleUseDefault = useCallback(
    (setter: (value: number | null) => void) => {
      setter(null);
    },
    [],
  );

  // Handler for new toggles
  const handleToggleChange = useCallback(
    (setter: (value: boolean | null) => void, checked: boolean) => {
      // If toggling off, set to null (use default). If toggling on, set to true.
      setter(checked ? true : null);
    },
    [],
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
      {/* Temperature */}
      {supportedParams.has("temperature") && (
        <div className="space-y-1.5">
          <Label htmlFor="param-temperature" className="text-xs">
            Temperature ({localTemp.toFixed(2)})
          </Label>
          <Slider
            id="param-temperature"
            min={0}
            max={1} // Max might vary, 1 is common
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
      )}

      {/* Top P */}
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
      )}

      {/* Max Tokens & Top K */}
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
        )}
      </div>

      {/* Presence Penalty */}
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
      )}

      {/* Frequency Penalty */}
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
      )}

      {/* Reasoning Toggle */}
      {supportedParams.has("reasoning") && (
        <div className="flex items-center space-x-2 pt-2">
          <Switch
            id="param-reasoning"
            // Checked state is true only if the prop is explicitly true
            checked={reasoningEnabled === true}
            onCheckedChange={(checked) =>
              handleToggleChange(setReasoningEnabled, checked)
            }
            aria-labelledby="param-reasoning-label"
          />
          <Label id="param-reasoning-label" htmlFor="param-reasoning">
            Enable Reasoning (if supported)
          </Label>
        </div>
      )}

      {/* Web Search Toggle */}
      {supportedParams.has("web_search_options") && (
        <div className="flex items-center space-x-2 pt-2">
          <Switch
            id="param-web-search"
            // Checked state is true only if the prop is explicitly true
            checked={webSearchEnabled === true}
            onCheckedChange={(checked) =>
              handleToggleChange(setWebSearchEnabled, checked)
            }
            aria-labelledby="param-web-search-label"
          />
          <Label id="param-web-search-label" htmlFor="param-web-search">
            Enable Web Search (if supported)
          </Label>
        </div>
      )}
    </div>
  );
};
