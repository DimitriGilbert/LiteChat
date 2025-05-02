// src/hooks/litechat/registerWebSearchControl.tsx
// FULL FILE
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { SearchIcon } from "lucide-react";
import { useControlRegistryStore } from "@/store/control.store";
import { usePromptStateStore } from "@/store/prompt.store";
import { useProviderStore } from "@/store/provider.store";
import { useInteractionStore } from "@/store/interaction.store";
import { useShallow } from "zustand/react/shallow";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { emitter } from "@/lib/litechat/event-emitter";
import { ModEvent } from "@/types/litechat/modding";

// --- Trigger Component ---
const WebSearchControlTrigger: React.FC = () => {
  // Get setter from store
  const { setWebSearchEnabled } = usePromptStateStore(
    useShallow((state) => ({
      setWebSearchEnabled: state.setWebSearchEnabled,
    })),
  );

  // Local state managed by events
  const [webSearchEnabled, setLocalWebSearchEnabled] = useState<boolean | null>(
    () => usePromptStateStore.getState().webSearchEnabled,
  );
  const [isStreaming, setIsStreaming] = useState(
    () => useInteractionStore.getState().status === "streaming",
  );
  const [isVisible, setIsVisible] = useState(true); // Assume visible initially

  // Subscribe to events
  useEffect(() => {
    const handleParamsChanged = (payload: {
      params: Partial<import("@/store/prompt.store").PromptState>;
    }) => {
      if (payload.params.webSearchEnabled !== undefined) {
        setLocalWebSearchEnabled(payload.params.webSearchEnabled);
      }
    };
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

    // Initial check
    handleModelChange({ modelId: useProviderStore.getState().selectedModelId });

    // Subscriptions
    emitter.on(ModEvent.PROMPT_PARAMS_CHANGED, handleParamsChanged);
    emitter.on(ModEvent.INTERACTION_STATUS_CHANGED, handleStatusChange);
    emitter.on(ModEvent.MODEL_SELECTION_CHANGED, handleModelChange);

    // Cleanup
    return () => {
      emitter.off(ModEvent.PROMPT_PARAMS_CHANGED, handleParamsChanged);
      emitter.off(ModEvent.INTERACTION_STATUS_CHANGED, handleStatusChange);
      emitter.off(ModEvent.MODEL_SELECTION_CHANGED, handleModelChange);
    };
  }, []);

  const isExplicitlyEnabled = webSearchEnabled === true;

  const handleToggle = () => {
    // Toggle behavior: null -> true, true -> null
    // Call the store action to update state and trigger event
    setWebSearchEnabled(isExplicitlyEnabled ? null : true);
  };

  if (!isVisible) {
    return null; // Don't render if not supported by model
  }

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={isExplicitlyEnabled ? "secondary" : "ghost"}
            size="icon"
            className="h-8 w-8"
            onClick={handleToggle}
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

// --- Registration Function ---
export function registerWebSearchControl() {
  const registerPromptControl =
    useControlRegistryStore.getState().registerPromptControl;

  registerPromptControl({
    id: "core-web-search",
    // order removed
    status: () => "ready",
    triggerRenderer: () => React.createElement(WebSearchControlTrigger),
    // getParameters reads directly from store at submission time
    getParameters: () => {
      const { webSearchEnabled } = usePromptStateStore.getState();
      // Only add parameter if explicitly enabled (true), not null
      // Parameter name might be 'web_search' or 'web_search_options' depending on provider
      return webSearchEnabled === true ? { web_search: true } : undefined;
    },
    // clearOnSubmit calls store action which emits event
    clearOnSubmit: () => {
      usePromptStateStore.getState().setWebSearchEnabled(null);
    },
    // show function removed - component handles visibility
    // show: () => { ... }
  });

  console.log("[Function] Registered Core Web Search Control");
}
