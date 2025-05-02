// src/hooks/litechat/registerWebSearchControl.tsx
import React from "react";
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

export function registerWebSearchControl() {
  const registerPromptControl =
    useControlRegistryStore.getState().registerPromptControl;

  const WebSearchControlTrigger: React.FC = () => {
    const { webSearchEnabled, setWebSearchEnabled } = usePromptStateStore(
      useShallow((state) => ({
        webSearchEnabled: state.webSearchEnabled,
        setWebSearchEnabled: state.setWebSearchEnabled,
      })),
    );
    const isStreaming = useInteractionStore(
      useShallow((state) => state.status === "streaming"),
    );

    const isExplicitlyEnabled = webSearchEnabled === true;

    const handleToggle = () => {
      // Toggle behavior: null -> true, true -> null
      setWebSearchEnabled(isExplicitlyEnabled ? null : true);
    };

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

  registerPromptControl({
    id: "core-web-search",
    // order removed
    status: () => "ready",
    triggerRenderer: () => React.createElement(WebSearchControlTrigger),
    getParameters: () => {
      const { webSearchEnabled } = usePromptStateStore.getState();
      // Only add parameter if explicitly enabled (true), not null
      // Parameter name might be 'web_search' or 'web_search_options' depending on provider
      return webSearchEnabled === true ? { web_search: true } : undefined;
    },
    clearOnSubmit: () => {
      // Reset transient state after submit
      usePromptStateStore.getState().setWebSearchEnabled(null);
    },
    show: () => {
      // Show only if the selected model supports it
      const selectedModel = useProviderStore.getState().getSelectedModel();
      // Check for common parameter names related to web search
      const supportedParams =
        selectedModel?.metadata?.supported_parameters ?? [];
      return (
        supportedParams.includes("web_search") ||
        supportedParams.includes("web_search_options")
      );
    },
  });

  console.log("[Function] Registered Core Web Search Control");
}
