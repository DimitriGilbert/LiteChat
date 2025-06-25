import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Captions, RefreshCw } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { EnhancedAutoTitleControlModule } from "@/controls/modules/EnhancedAutoTitleControlModule";

interface EnhancedAutoTitleControlTriggerProps {
  module: EnhancedAutoTitleControlModule;
}

export const EnhancedAutoTitleControlTrigger: React.FC<
  EnhancedAutoTitleControlTriggerProps
> = ({ module }) => {
  const [, forceUpdate] = useState({});
  const [isHovered, setIsHovered] = useState(false);

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
    globalAutoTitleEnabled && 
    isFirstInteraction && 
    !autoTitleAlwaysOn;

  // Show update button when there are multiple interactions and auto-title is enabled
  const showUpdateButton = 
    globalAutoTitleEnabled && 
    isMultipleInteractions && 
    !isStreaming;

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
    <TooltipProvider delayDuration={100}>
      {showFirstInteractionToggle && (
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
      )}

      {showUpdateButton && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-8 w-8 transition-opacity duration-200",
                isHovered ? "opacity-100" : "opacity-0"
              )}
              onClick={handleUpdateTitle}
              disabled={isStreaming || isUpdatingTitle}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              aria-label="Update conversation title with AI"
            >
              <RefreshCw
                className={cn(
                  "h-4 w-4 text-muted-foreground hover:text-primary",
                  isUpdatingTitle && "animate-spin"
                )}
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            {isUpdatingTitle
              ? "Updating title..."
              : "Update conversation title based on last message"}
          </TooltipContent>
        </Tooltip>
      )}
    </TooltipProvider>
  );
}; 