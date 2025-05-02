// src/hooks/litechat/registerParameterControl.tsx
import React from "react";
import { Button } from "@/components/ui/button";
import { SlidersHorizontalIcon } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ParameterControlComponent,
  type ParameterControlComponentProps,
} from "@/components/LiteChat/prompt/control/ParameterControlComponent";
import { useControlRegistryStore } from "@/store/control.store";
import { useSettingsStore } from "@/store/settings.store";
import { useInteractionStore } from "@/store/interaction.store";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { usePromptStateStore } from "@/store/prompt.store";
import { useShallow } from "zustand/react/shallow";
import { useProviderStore } from "@/store/provider.store"; // Import provider store

export function registerParameterControl() {
  const registerPromptControl =
    useControlRegistryStore.getState().registerPromptControl;

  const ParameterPopoverContent: React.FC = () => {
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
      // reasoningEnabled/webSearchEnabled removed
    } = usePromptStateStore(
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
        // reasoningEnabled/webSearchEnabled removed
      })),
    );

    const globalDefaults = useSettingsStore.getState();

    const props: ParameterControlComponentProps = {
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
      // Pass null/noop for removed props
      reasoningEnabled: null,
      setReasoningEnabled: () => {},
      webSearchEnabled: null,
      setWebSearchEnabled: () => {},
      defaultTemperature: globalDefaults.temperature,
      defaultTopP: globalDefaults.topP,
      defaultMaxTokens: globalDefaults.maxTokens,
      defaultTopK: globalDefaults.topK,
      defaultPresencePenalty: globalDefaults.presencePenalty,
      defaultFrequencyPenalty: globalDefaults.frequencyPenalty,
    };

    return <ParameterControlComponent {...props} />;
  };

  const ParameterControlTrigger: React.FC = () => {
    const isStreaming = useInteractionStore.getState().status === "streaming";
    const {
      temperature,
      topP,
      maxTokens,
      topK,
      presencePenalty,
      frequencyPenalty,
      // reasoningEnabled/webSearchEnabled removed
    } = usePromptStateStore(
      useShallow((state) => ({
        temperature: state.temperature,
        topP: state.topP,
        maxTokens: state.maxTokens,
        topK: state.topK,
        presencePenalty: state.presencePenalty,
        frequencyPenalty: state.frequencyPenalty,
        // reasoningEnabled/webSearchEnabled removed
      })),
    );

    const hasNonDefaultParams =
      temperature !== null ||
      topP !== null ||
      maxTokens !== null ||
      topK !== null ||
      presencePenalty !== null ||
      frequencyPenalty !== null;
    // reasoningEnabled/webSearchEnabled removed from check

    return (
      <Popover>
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button
                  variant={hasNonDefaultParams ? "secondary" : "ghost"}
                  size="icon"
                  className="h-8 w-8"
                  disabled={isStreaming}
                  aria-label="Adjust Advanced Parameters"
                >
                  <SlidersHorizontalIcon className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent side="top">Advanced Parameters</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <PopoverContent className="w-auto p-0" align="start">
          <ParameterPopoverContent />
        </PopoverContent>
      </Popover>
    );
  };

  registerPromptControl({
    id: "core-parameters",
    // order removed
    status: () => "ready",
    triggerRenderer: () => React.createElement(ParameterControlTrigger),
    getParameters: () => {
      const {
        temperature,
        topP,
        maxTokens,
        topK,
        presencePenalty,
        frequencyPenalty,
        // reasoningEnabled/webSearchEnabled removed
      } = usePromptStateStore.getState();

      const addParam = (obj: Record<string, any>, key: string, value: any) => {
        if (value !== null) {
          obj[key] = value;
        }
      };

      const params: Record<string, any> = {};
      addParam(params, "temperature", temperature);
      addParam(params, "top_p", topP);
      addParam(params, "max_tokens", maxTokens);
      addParam(params, "top_k", topK);
      addParam(params, "presence_penalty", presencePenalty);
      addParam(params, "frequency_penalty", frequencyPenalty);
      // reasoning/webSearch removed

      return Object.keys(params).length > 0 ? params : undefined;
    },
    show: () => {
      // Show only if advanced settings are enabled AND the model supports at least one of these params
      const showAdvanced = useSettingsStore.getState().enableAdvancedSettings;
      if (!showAdvanced) return false;

      const selectedModel = useProviderStore.getState().getSelectedModel();
      const supported = selectedModel?.metadata?.supported_parameters ?? [];
      const controlledParams = [
        "temperature",
        "top_p",
        "max_tokens",
        "top_k",
        "presence_penalty",
        "frequency_penalty",
      ];
      return supported.some((p) => controlledParams.includes(p));
    },
  });

  console.log("[Function] Registered Core Parameter Control");
}
