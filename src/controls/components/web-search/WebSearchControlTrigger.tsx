// src/controls/components/web-search/WebSearchControlTrigger.tsx
// FULL FILE
import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { SearchIcon } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { WebSearchControlModule } from "@/controls/modules/WebSearchControlModule";

interface WebSearchControlTriggerProps {
  module: WebSearchControlModule;
}

export const WebSearchControlTrigger: React.FC<
  WebSearchControlTriggerProps
> = ({ module }) => {
  const [, forceUpdate] = useState({});
  useEffect(() => {
    module.setNotifyCallback(() => forceUpdate({}));
    return () => module.setNotifyCallback(null);
  }, [module]);

  const localWebSearchEnabled = module.getWebSearchEnabled();
  const isStreaming = module.getIsStreaming();
  const isVisible = module.getIsVisible(); // Get visibility from module

  const isExplicitlyEnabled = localWebSearchEnabled === true;

  const handleToggleClick = useCallback(() => {
    const newState = isExplicitlyEnabled ? null : true;
    module.setWebSearchEnabled(newState);
  }, [isExplicitlyEnabled, module]);

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
                isExplicitlyEnabled ? "text-primary" : "text-muted-foreground"
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
