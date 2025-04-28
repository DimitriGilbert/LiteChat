// src/hooks/litechat/useParameterControlRegistration.tsx
import React from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { SlidersHorizontalIcon } from "lucide-react";
import { ParameterControlComponent } from "@/components/LiteChat/prompt/control/ParameterControlComponent";
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
      enableAdvancedSettings: state.enableAdvancedSettings,
      temperature: state.temperature,
      maxTokens: state.maxTokens,
      topP: state.topP,
      topK: state.topK,
      presencePenalty: state.presencePenalty,
      frequencyPenalty: state.frequencyPenalty,
    })),
  );

  React.useEffect(() => {
    const control: PromptControl = {
      id: "core-parameter-control",
      triggerRenderer: () => (
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
      show: () => enableAdvancedSettings,
      getParameters: () => {
        const latestSettings = useSettingsStore.getState();
        const params: Record<string, any> = {};
        if (latestSettings.temperature !== 0.7)
          params.temperature = latestSettings.temperature;
        if (latestSettings.maxTokens !== null)
          params.max_tokens = latestSettings.maxTokens;
        if (latestSettings.topP !== null) params.top_p = latestSettings.topP;
        if (latestSettings.topK !== null) params.top_k = latestSettings.topK;
        if (latestSettings.presencePenalty !== 0.0)
          params.presence_penalty = latestSettings.presencePenalty;
        if (latestSettings.frequencyPenalty !== 0.0)
          params.frequency_penalty = latestSettings.frequencyPenalty;
        return Object.keys(params).length > 0 ? params : undefined;
      },
      order: 20,
    };

    const unregister = register(control);
    return unregister;
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

  return null;
};
