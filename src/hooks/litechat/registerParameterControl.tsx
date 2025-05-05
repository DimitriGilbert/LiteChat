// src/hooks/litechat/registerParameterControl.tsx
// FULL FILE
import React, { useState, useEffect } from "react";
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
import { useProviderStore } from "@/store/provider.store";
import { emitter } from "@/lib/litechat/event-emitter";
import { ModEvent } from "@/types/litechat/modding";
import type { PromptState } from "@/store/prompt.store";

// --- Popover Content Component ---
const ParameterPopoverContent: React.FC = () => {
  // Get setters from PromptStateStore
  const {
    setTemperature,
    setTopP,
    setMaxTokens,
    setTopK,
    setPresencePenalty,
    setFrequencyPenalty,
  } = usePromptStateStore(
    useShallow((state) => ({
      setTemperature: state.setTemperature,
      setTopP: state.setTopP,
      setMaxTokens: state.setMaxTokens,
      setTopK: state.setTopK,
      setPresencePenalty: state.setPresencePenalty,
      setFrequencyPenalty: state.setFrequencyPenalty,
    })),
  );

  // Get global defaults from SettingsStore
  const globalDefaults = useSettingsStore.getState();

  // Local state to hold current prompt parameters, updated by events
  const [currentParams, setCurrentParams] = useState<Partial<PromptState>>(
    () => usePromptStateStore.getState(), // Initial state
  );

  // Subscribe to parameter changes
  useEffect(() => {
    const handleParamsChanged = (payload: { params: Partial<PromptState> }) => {
      setCurrentParams((prev) => ({ ...prev, ...payload.params }));
    };
    emitter.on(ModEvent.PROMPT_PARAMS_CHANGED, handleParamsChanged);
    return () => {
      emitter.off(ModEvent.PROMPT_PARAMS_CHANGED, handleParamsChanged);
    };
  }, []);

  // Props for the ParameterControlComponent, using local state
  const props: ParameterControlComponentProps = {
    temperature: currentParams.temperature ?? null,
    setTemperature,
    topP: currentParams.topP ?? null,
    setTopP,
    maxTokens: currentParams.maxTokens ?? null,
    setMaxTokens,
    topK: currentParams.topK ?? null,
    setTopK,
    presencePenalty: currentParams.presencePenalty ?? null,
    setPresencePenalty,
    frequencyPenalty: currentParams.frequencyPenalty ?? null,
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

// --- Trigger Button Component ---
const ParameterControlTrigger: React.FC = () => {
  // Local state for button appearance and interaction status
  // const [hasNonDefaultParams, setHasNonDefaultParams] = useState(false);
  const [isStreaming, setIsStreaming] = useState(
    () => useInteractionStore.getState().status === "streaming",
  );
  const [isVisible, setIsVisible] = useState(true); // Start visible, update based on model

  // Subscribe to relevant events
  useEffect(() => {
    // Update button variant based on param changes
    // const handleParamsChanged = (payload: { params: Partial<PromptState> }) => {
    //   // Get the full current state directly from the store
    //   // No need to merge with payload here, as the store is the source of truth
    //   // const currentState = usePromptStateStore.getState();
    //   // Check if any parameter *in the store* is explicitly set (not null)
    //   // const nonDefault =
    //   //   currentState.temperature !== null ||
    //   //   currentState.topP !== null ||
    //   //   currentState.maxTokens !== null ||
    //   //   currentState.topK !== null ||
    //   //   currentState.presencePenalty !== null ||
    //   //   currentState.frequencyPenalty !== null;
    //   // setHasNonDefaultParams(nonDefault);
    // };

    // Update streaming status
    const handleStatusChange = (payload: {
      status: "idle" | "loading" | "streaming" | "error";
    }) => {
      setIsStreaming(payload.status === "streaming");
    };

    // Update visibility based on model support
    const handleModelChange = (payload: { modelId: string | null }) => {
      if (!payload.modelId) {
        setIsVisible(false);
        return;
      }
      const { getSelectedModel } = useProviderStore.getState();
      const selectedModel = getSelectedModel(); // Get current model details
      const supported = selectedModel?.metadata?.supported_parameters ?? [];
      const controlledParams = [
        "temperature",
        "top_p",
        "max_tokens",
        "top_k",
        "presence_penalty",
        "frequency_penalty",
      ];
      const showAdvanced = useSettingsStore.getState().enableAdvancedSettings;
      setIsVisible(
        showAdvanced && supported.some((p) => controlledParams.includes(p)),
      );
    };

    // Handler for settings changes (specifically enableAdvancedSettings)
    const handleSettingsChange = (payload: { key: string; value: any }) => {
      if (payload.key === "enableAdvancedSettings") {
        handleModelChange({
          modelId: useProviderStore.getState().selectedModelId,
        }); // Re-check visibility
      }
    };

    // Initial check
    // handleParamsChanged({ params: {} }); // Check initial state
    handleModelChange({ modelId: useProviderStore.getState().selectedModelId }); // Check initial model

    // Subscriptions
    // emitter.on(ModEvent.PROMPT_PARAMS_CHANGED, handleParamsChanged);
    emitter.on(ModEvent.INTERACTION_STATUS_CHANGED, handleStatusChange);
    emitter.on(ModEvent.MODEL_SELECTION_CHANGED, handleModelChange);
    emitter.on(ModEvent.SETTINGS_CHANGED, handleSettingsChange);

    // Cleanup
    return () => {
      // emitter.off(ModEvent.PROMPT_PARAMS_CHANGED, handleParamsChanged);
      emitter.off(ModEvent.INTERACTION_STATUS_CHANGED, handleStatusChange);
      emitter.off(ModEvent.MODEL_SELECTION_CHANGED, handleModelChange);
      emitter.off(ModEvent.SETTINGS_CHANGED, handleSettingsChange);
    };
  }, []);

  if (!isVisible) {
    return null; // Don't render the button if not visible
  }

  return (
    <Popover>
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                variant={"ghost"}
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

// --- Registration Function ---
export function registerParameterControl() {
  const registerPromptControl =
    useControlRegistryStore.getState().registerPromptControl;

  registerPromptControl({
    id: "core-parameters",
    status: () => "ready",
    triggerRenderer: () => React.createElement(ParameterControlTrigger),
    // getParameters still reads directly from the store at submission time
    getParameters: () => {
      const {
        temperature,
        topP,
        maxTokens,
        topK,
        presencePenalty,
        frequencyPenalty,
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

      return Object.keys(params).length > 0 ? params : undefined;
    },
  });

  console.log("[Function] Registered Core Parameter Control");
}
