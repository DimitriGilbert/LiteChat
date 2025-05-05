// src/components/LiteChat/prompt/control/reasoning/ReasoningControlTrigger.tsx

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { BrainCircuitIcon } from "lucide-react";
import { useProviderStore } from "@/store/provider.store";
import { useInteractionStore } from "@/store/interaction.store";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { emitter } from "@/lib/litechat/event-emitter";
import { ModEvent } from "@/types/litechat/modding";

interface ReasoningControlTriggerProps {
  initialEnabled: boolean | null;
  onToggle: (enabled: boolean | null) => void;
}

export const ReasoningControlTrigger: React.FC<
  ReasoningControlTriggerProps
> = ({ initialEnabled, onToggle }) => {
  const [localReasoningEnabled, setLocalReasoningEnabled] =
    useState(initialEnabled);
  const [isStreaming, setIsStreaming] = useState(
    () => useInteractionStore.getState().status === "streaming",
  );
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    setLocalReasoningEnabled(initialEnabled);
  }, [initialEnabled]);

  useEffect(() => {
    const handleStatusChange = (payload: {
      status: "idle" | "loading" | "streaming" | "error";
    }) => {
      setIsStreaming(payload.status === "streaming");
    };
    const handleModelChange = (payload: { modelId: string | null }) => {
      if (!payload.modelId) {
        setIsVisible(false);
        return;
      }
      const { getSelectedModel } = useProviderStore.getState();
      const selectedModel = getSelectedModel();
      setIsVisible(
        selectedModel?.metadata?.supported_parameters?.includes("reasoning") ??
          false,
      );
    };

    handleModelChange({ modelId: useProviderStore.getState().selectedModelId });

    emitter.on(ModEvent.INTERACTION_STATUS_CHANGED, handleStatusChange);
    emitter.on(ModEvent.MODEL_SELECTION_CHANGED, handleModelChange);

    return () => {
      emitter.off(ModEvent.INTERACTION_STATUS_CHANGED, handleStatusChange);
      emitter.off(ModEvent.MODEL_SELECTION_CHANGED, handleModelChange);
    };
  }, []);

  const isExplicitlyEnabled = localReasoningEnabled === true;

  const handleToggleClick = () => {
    const newState = isExplicitlyEnabled ? null : true;
    setLocalReasoningEnabled(newState);
    onToggle(newState);
  };

  if (!isVisible) {
    return null;
  }

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={isExplicitlyEnabled ? "secondary" : "ghost"}
            size="icon"
            className="h-8 w-8"
            onClick={handleToggleClick}
            disabled={isStreaming}
            aria-label={
              isExplicitlyEnabled
                ? "Disable Reasoning for Next Turn"
                : "Enable Reasoning for Next Turn"
            }
          >
            <BrainCircuitIcon
              className={cn(
                "h-4 w-4",
                isExplicitlyEnabled ? "text-primary" : "text-muted-foreground",
              )}
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">
          {isExplicitlyEnabled
            ? "Reasoning Enabled (Click to Disable)"
            : "Reasoning Disabled (Click to Enable)"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
