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
  type ParameterControlComponentProps, // Import props type
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
    // Get current prompt state values and setters
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
    } = usePromptStateStore.getState();

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
    } = usePromptStateStore.getState();
    // Read global defaults for comparison
    const globalDefaults = useSettingsStore.getState();

    // Check if any parameter in the prompt state is different from the global default
    const hasNonDefaultParams =
      temperature !== globalDefaults.temperature ||
      topP !== globalDefaults.topP ||
      maxTokens !== globalDefaults.maxTokens ||
      topK !== globalDefaults.topK ||
      presencePenalty !== globalDefaults.presencePenalty ||
      frequencyPenalty !== globalDefaults.frequencyPenalty;

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
    // getParameters reads directly from the prompt state store now
    getParameters: () => {
      const {
        temperature,
        topP,
        maxTokens,
        topK,
        presencePenalty,
        frequencyPenalty,
      } = usePromptStateStore.getState(); // Read from prompt state
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
    show: () => useSettingsStore.getState().enableAdvancedSettings, // Show based on setting
  });

  console.log("[Function] Registered Core Parameter Control");
}
