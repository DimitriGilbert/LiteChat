// src/hooks/litechat/registerParameterControl.tsx
// Entire file content provided
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

export function registerParameterControl() {
  const registerPromptControl =
    useControlRegistryStore.getState().registerPromptControl;

  // Component to render inside the Popover, fetching state and passing props
  const ParameterPopoverContent: React.FC = () => {
    // Get current prompt state values and setters from the store hook
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
    } = usePromptStateStore(); // Use the hook directly here

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
    // Get state directly inside the component instance
    const isStreaming = useInteractionStore.getState().status === "streaming";
    // Read from prompt state store to determine if non-default values are set
    const {
      temperature,
      topP,
      maxTokens,
      topK,
      presencePenalty,
      frequencyPenalty,
    } = usePromptStateStore(); // Use hook here
    // Read global defaults for comparison
    const globalDefaults = useSettingsStore.getState();

    // Check if any parameter in the prompt state is different from the global default
    // Note: This comparison logic might need refinement if defaults can be null
    const hasNonDefaultParams =
      (temperature !== null && temperature !== globalDefaults.temperature) ||
      (topP !== null && topP !== globalDefaults.topP) ||
      (maxTokens !== null && maxTokens !== globalDefaults.maxTokens) ||
      (topK !== null && topK !== globalDefaults.topK) ||
      (presencePenalty !== null &&
        presencePenalty !== globalDefaults.presencePenalty) ||
      (frequencyPenalty !== null &&
        frequencyPenalty !== globalDefaults.frequencyPenalty);

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
          {/* Render the component that passes props */}
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
      } = usePromptStateStore.getState();
      return {
        // Only include parameters if they are not null (i.e., explicitly set)
        ...(temperature !== null && { temperature }),
        ...(topP !== null && { top_p: topP }),
        ...(maxTokens !== null && { max_tokens: maxTokens }),
        ...(topK !== null && { top_k: topK }),
        ...(presencePenalty !== null && { presence_penalty: presencePenalty }),
        ...(frequencyPenalty !== null && {
          frequency_penalty: frequencyPenalty,
        }),
      };
    },
    // No metadata or clearOnSubmit needed for this control
    show: () => useSettingsStore.getState().enableAdvancedSettings,
  });

  console.log("[Function] Registered Core Parameter Control");
}
