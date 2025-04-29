// src/hooks/litechat/registerParameterControl.ts
import React from "react";
import { Button } from "@/components/ui/button";
import { SlidersHorizontalIcon } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ParameterControlComponent } from "@/components/LiteChat/prompt/control/ParameterControlComponent";
import { useControlRegistryStore } from "@/store/control.store";
import { useSettingsStore } from "@/store/settings.store";
import { useInteractionStore } from "@/store/interaction.store";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function registerParameterControl() {
  const registerPromptControl =
    useControlRegistryStore.getState().registerPromptControl;

  const ParameterControlTrigger: React.FC = () => {
    // Get state directly inside the component instance
    const isStreaming = useInteractionStore.getState().status === "streaming";
    const {
      temperature,
      topP,
      maxTokens,
      topK,
      presencePenalty,
      frequencyPenalty,
    } = useSettingsStore.getState();

    const hasNonDefaultParams =
      temperature !== 0.7 || // Check against default
      topP !== null ||
      maxTokens !== null ||
      topK !== null ||
      presencePenalty !== 0.0 ||
      frequencyPenalty !== 0.0;

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
          <ParameterControlComponent />
        </PopoverContent>
      </Popover>
    );
  };

  registerPromptControl({
    id: "core-parameters",
    order: 30,
    // status: () => "ready", // Removed status
    triggerRenderer: () => React.createElement(ParameterControlTrigger),
    getParameters: () => {
      // Get current settings state when parameters are requested
      const {
        temperature,
        topP,
        maxTokens,
        topK,
        presencePenalty,
        frequencyPenalty,
      } = useSettingsStore.getState();
      return {
        temperature,
        top_p: topP,
        max_tokens: maxTokens,
        top_k: topK,
        presence_penalty: presencePenalty,
        frequency_penalty: frequencyPenalty,
      };
    },
    show: () => useSettingsStore.getState().enableAdvancedSettings, // Show based on setting
  });

  console.log("[Function] Registered Core Parameter Control");
  // No cleanup needed or returned
}
