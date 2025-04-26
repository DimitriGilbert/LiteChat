// src/components/LiteChat/prompt/control/ParameterControlRegistration.tsx
import React from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { SlidersHorizontalIcon } from "lucide-react";
import { ParameterControlComponent } from "./ParameterControlComponent"; // Import the component
import { useControlRegistryStore } from "@/store/control.store";
import { useSettingsStore } from "@/store/settings.store";
import type { PromptControl } from "@/types/litechat/prompt";
import { useShallow } from "zustand/react/shallow";

export const useParameterControlRegistration = () => {
  const register = useControlRegistryStore(
    (state) => state.registerPromptControl,
  );
  const {
    enableAdvancedSettings,
    temperature,
    maxTokens,
    topP,
    topK,
    presencePenalty,
    frequencyPenalty,
  } = useSettingsStore(
    useShallow((state) => ({
      enableAdvancedSettings: state.enableAdvancedSettings, // Now exists
      temperature: state.temperature, // Now exists
      maxTokens: state.maxTokens, // Now exists
      topP: state.topP, // Now exists
      topK: state.topK, // Now exists
      presencePenalty: state.presencePenalty, // Now exists
      frequencyPenalty: state.frequencyPenalty, // Now exists
    })),
  );

  React.useEffect(() => {
    const control: PromptControl = {
      id: "core-parameter-control",
      status: () => "ready",
      trigger: () => (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full"
              aria-label="Adjust AI Parameters"
            >
              <SlidersHorizontalIcon className="h-5 w-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" side="top" align="end">
            <ParameterControlComponent />
          </PopoverContent>
        </Popover>
      ),
      show: () => enableAdvancedSettings, // Show based on global setting
      getParameters: () => {
        // Fetch latest values directly from store state inside the function
        const latestSettings = useSettingsStore.getState();
        const params: Record<string, any> = {};
        // Use the correct default value for temperature comparison
        if (latestSettings.temperature !== 0.7)
          params.temperature = latestSettings.temperature;
        if (latestSettings.maxTokens !== null)
          params.max_tokens = latestSettings.maxTokens;
        if (latestSettings.topP !== null) params.top_p = latestSettings.topP;
        if (latestSettings.topK !== null) params.top_k = latestSettings.topK;
        // Use the correct default value for penalty comparison
        if (latestSettings.presencePenalty !== 0.0)
          params.presence_penalty = latestSettings.presencePenalty;
        if (latestSettings.frequencyPenalty !== 0.0)
          params.frequency_penalty = latestSettings.frequencyPenalty;
        return Object.keys(params).length > 0 ? params : null;
      },
      order: 20, // Example order
    };

    const unregister = register(control);
    return unregister;
    // Re-register if enableAdvancedSettings changes or if parameter defaults change (less likely)
  }, [
    register,
    enableAdvancedSettings,
    temperature,
    maxTokens,
    topP,
    topK,
    presencePenalty,
    frequencyPenalty,
  ]);

  return null; // This hook doesn't render anything itself
};
