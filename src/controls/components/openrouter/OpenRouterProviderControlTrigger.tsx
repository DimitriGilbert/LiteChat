// src/controls/components/openrouter/OpenRouterProviderControlTrigger.tsx
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ServerIcon } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { OpenRouterProviderDialogContent } from "./OpenRouterProviderDialogContent";
import type { OpenRouterProviderControlModule } from "@/controls/modules/OpenRouterProviderControlModule";

interface OpenRouterProviderControlTriggerProps {
  module: OpenRouterProviderControlModule;
}

export const OpenRouterProviderControlTrigger: React.FC<OpenRouterProviderControlTriggerProps> = ({
  module,
}) => {
  const [, forceUpdate] = useState({});
  const [popoverOpen, setPopoverOpen] = useState(false);

  useEffect(() => {
    // Listen to module notifications
    module.setNotifyCallback(() => forceUpdate({}));
    
    return () => {
      module.setNotifyCallback(null);
    };
  }, [module]);

  const selectedProviders = module.getSelectedProviders();
  const isStreaming = module.getIsStreaming();
  const isLoading = module.getIsLoading();
  const shouldShowControl = module.getShouldShowControl();

  if (!shouldShowControl) {
    return null;
  }

  const hasActiveProviders = selectedProviders.size > 0;
  const isDisabled = isStreaming;

  const handleTriggerClick = async () => {
    // If opening and not fetched yet, fetch endpoints
    if (!popoverOpen && !module.getAvailableProviders().length) {
      await module.fetchEndpoints();
    }
  };

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                variant={hasActiveProviders ? "secondary" : "ghost"}
                size="icon"
                className="h-8 w-8"
                disabled={isDisabled}
                aria-label="Configure OpenRouter inference providers"
                onClick={handleTriggerClick}
              >
                <ServerIcon className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="top">
            {hasActiveProviders
              ? `${selectedProviders.size} inference provider${selectedProviders.size > 1 ? 's' : ''} selected`
              : isLoading
              ? "Loading inference providers..."
              : "Select inference providers"}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <PopoverContent className="w-auto p-0" align="start">
        <OpenRouterProviderDialogContent
          module={module}
        />
      </PopoverContent>
    </Popover>
  );
};