// src/controls/components/auto-title/AutoTitleControlTrigger.tsx
// FULL FILE
import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Captions, RefreshCw } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
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
  const autoTitleAlwaysOn = module.getAutoTitleAlwaysOn();
  const isFirstInteraction = module.getIsFirstInteraction();
  const isMultipleInteractions = module.getIsMultipleInteractions();
  const globalAutoTitleEnabled = module.getGlobalAutoTitleEnabled();
  const isUpdatingTitle = module.getIsUpdatingTitle();

  // Show first interaction toggle when it's the first interaction and auto-title is enabled and not always-on
  const showFirstInteractionToggle =
    globalAutoTitleEnabled && isFirstInteraction && !autoTitleAlwaysOn;

  // Show update button when there are multiple interactions and auto-title is enabled
  const showUpdateButton =
    globalAutoTitleEnabled && isMultipleInteractions && !isStreaming;

  const handleToggle = useCallback(() => {
    const newState = !localAutoTitleEnabled;
    module.setTurnEnabled(newState);
  }, [localAutoTitleEnabled, module]);

  const handleUpdateTitle = useCallback(async () => {
    await module.updateConversationTitle();
  }, [module]);

  if (!showFirstInteractionToggle && !showUpdateButton) {
    return null;
  }

  return (
    <div className="flex items-center">
      {showFirstInteractionToggle && (
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
                    localAutoTitleEnabled
                      ? "text-primary"
                      : "text-muted-foreground"
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
      )}

      {showUpdateButton && (
        <HoverCard>
          <HoverCardTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <div className="relative h-4 w-4">
                <RefreshCw
                  className={cn(
                    "absolute inset-0 h-4 w-4 text-muted-foreground",
                    isUpdatingTitle && "animate-spin"
                  )}
                />
                <Captions className="absolute inset-0 h-4 w-4" />
              </div>
            </Button>
          </HoverCardTrigger>
          <HoverCardContent align="end" className="w-auto p-2">
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={handleUpdateTitle}
                disabled={isUpdatingTitle}
              >
                {isUpdatingTitle ? "Updating..." : "Update Title"}
              </Button>
            </div>
          </HoverCardContent>
        </HoverCard>
      )}
    </div>
  );
};
