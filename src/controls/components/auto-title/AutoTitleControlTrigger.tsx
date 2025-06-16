// src/controls/components/auto-title/AutoTitleControlTrigger.tsx
// FULL FILE
import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Captions } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { AutoTitleControlModule } from "@/controls/modules/AutoTitleControlModule";

interface AutoTitleControlTriggerProps {
  module: AutoTitleControlModule;
}

export const AutoTitleControlTrigger: React.FC<
  AutoTitleControlTriggerProps
> = ({ module }) => {
  const [, forceUpdate] = useState({});
  useEffect(() => {
    module.setNotifyCallback(() => forceUpdate({}));
    return () => module.setNotifyCallback(null);
  }, [module]);

  const localAutoTitleEnabled = module.getTurnEnabled();
  const isStreaming = module.getIsStreaming();
  const isVisible =
    module.getGlobalAutoTitleEnabled() && module.getIsFirstInteraction();

  const handleToggle = useCallback(() => {
    const newState = !localAutoTitleEnabled;
    module.setTurnEnabled(newState);
  }, [localAutoTitleEnabled, module]);

  if (!isVisible) {
    return null;
  }

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={localAutoTitleEnabled ? "secondary" : "ghost"}
            size="icon"
            className="h-8 w-8"
            onClick={handleToggle}
            disabled={isStreaming}
            aria-label={
              localAutoTitleEnabled
                ? "Disable Auto-Title for this Chat"
                : "Enable Auto-Title for this Chat"
            }
          >
            <Captions
              className={cn(
                "h-4 w-4",
                localAutoTitleEnabled ? "text-primary" : "text-muted-foreground"
              )}
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">
          {localAutoTitleEnabled
            ? "Auto-Title Enabled (Click to Disable)"
            : "Auto-Title Disabled (Click to Enable)"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
