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
// Import the prompt state store
import { usePromptStateStore } from "@/store/prompt.store";
import { useShallow } from "zustand/react/shallow"; // Import useShallow

export function registerParameterControl() {
  const registerPromptControl =
    useControlRegistryStore.getState().registerPromptControl;

  // Component to render inside the Popover, fetching state and passing props
  const ParameterPopoverContent: React.FC = () => {
    // Get current prompt state values and setters from the store hook using useShallow
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
      reasoningEnabled, // Get new state
      setReasoningEnabled, // Get new setter
      webSearchEnabled, // Get new state
      setWebSearchEnabled, // Get new setter
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
        reasoningEnabled: state.reasoningEnabled, // Select new state
        setReasoningEnabled: state.setReasoningEnabled, // Select new setter
        webSearchEnabled: state.webSearchEnabled, // Select new state
        setWebSearchEnabled: state.setWebSearchEnabled, // Select new setter
      })),
    );

    // Get global defaults from SettingsStore to display in "Use Default" buttons
    const globalDefaults = useSettingsStore.getState();

    // Prepare props for ParameterControlComponent
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
      reasoningEnabled, // Pass new state
      setReasoningEnabled, // Pass new setter
      webSearchEnabled, // Pass new state
      setWebSearchEnabled, // Pass new setter
      // Pass global defaults for the "Use Default" display
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
    // Read from prompt state store to determine if non-default values are set
    const {
      temperature,
      topP,
      maxTokens,
      topK,
      presencePenalty,
      frequencyPenalty,
      reasoningEnabled, // Read new state
      webSearchEnabled, // Read new state
    } = usePromptStateStore(
      useShallow((state) => ({
        temperature: state.temperature,
        topP: state.topP,
        maxTokens: state.maxTokens,
        topK: state.topK,
        presencePenalty: state.presencePenalty,
        frequencyPenalty: state.frequencyPenalty,
        reasoningEnabled: state.reasoningEnabled, // Select new state
        webSearchEnabled: state.webSearchEnabled, // Select new state
      })),
    );

    // Check if any parameter in the prompt state is explicitly set (not null)
    const hasNonDefaultParams =
      temperature !== null ||
      topP !== null ||
      maxTokens !== null ||
      topK !== null ||
      presencePenalty !== null ||
      frequencyPenalty !== null ||
      reasoningEnabled !== null || // Check new state
      webSearchEnabled !== null; // Check new state

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
                  aria-label="Adjust Parameters"
                >
                  <SlidersHorizontalIcon className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent side="top">Parameters</TooltipContent>
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
    order: 30,
    status: () => "ready",
    triggerRenderer: () => React.createElement(ParameterControlTrigger),
    // getParameters reads directly from the prompt state store
    getParameters: () => {
      // Use getState() here as this function is outside React components
      const {
        temperature,
        topP,
        maxTokens,
        topK,
        presencePenalty,
        frequencyPenalty,
        reasoningEnabled, // Get new state
        webSearchEnabled, // Get new state
      } = usePromptStateStore.getState();

      // Helper to add param if not null
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
      addParam(params, "reasoning", reasoningEnabled); // Add new param
      addParam(params, "web_search", webSearchEnabled); // Add new param

      return Object.keys(params).length > 0 ? params : undefined;
    },
    // No metadata or clearOnSubmit needed for this control
    show: () => useSettingsStore.getState().enableAdvancedSettings,
  });

  console.log("[Function] Registered Core Parameter Control");
}
