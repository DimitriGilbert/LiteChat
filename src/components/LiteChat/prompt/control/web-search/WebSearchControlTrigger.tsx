// src/components/LiteChat/prompt/control/web-search/WebSearchControlTrigger.tsx
// FULL FILE - Moved from registerWebSearchControl.tsx
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { SearchIcon } from "lucide-react";
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

interface WebSearchControlTriggerProps {
  initialEnabled: boolean | null;
  onToggle: (enabled: boolean | null) => void;
}

export const WebSearchControlTrigger: React.FC<
  WebSearchControlTriggerProps
> = ({ initialEnabled, onToggle }) => {
  const [localWebSearchEnabled, setLocalWebSearchEnabled] =
    useState(initialEnabled);
  const [isStreaming, setIsStreaming] = useState(
    () => useInteractionStore.getState().status === "streaming",
  );
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    setLocalWebSearchEnabled(initialEnabled);
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
      const supportedParams =
        selectedModel?.metadata?.supported_parameters ?? [];
      setIsVisible(
        supportedParams.includes("web_search") ||
          supportedParams.includes("web_search_options"),
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

  const isExplicitlyEnabled = localWebSearchEnabled === true;

  const handleToggleClick = () => {
    const newState = isExplicitlyEnabled ? null : true;
    setLocalWebSearchEnabled(newState);
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
                ? "Disable Web Search for Next Turn"
                : "Enable Web Search for Next Turn"
            }
          >
            <SearchIcon
              className={cn(
                "h-4 w-4",
                isExplicitlyEnabled ? "text-primary" : "text-muted-foreground",
              )}
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">
          {isExplicitlyEnabled
            ? "Web Search Enabled (Click to Disable)"
            : "Web Search Disabled (Click to Enable)"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
