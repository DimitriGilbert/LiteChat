// src/controls/components/auto-title/AutoTitleControlTrigger.tsx
// FULL FILE
import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { SparklesIcon } from "lucide-react";
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
  // Local state for UI responsiveness, synced with module state
  const [localAutoTitleEnabled, setLocalAutoTitleEnabled] = useState(
    module.getTurnEnabled()
  );
  const [, forceUpdate] = useState({}); // For re-rendering when module state changes

  // Read derived state from module for rendering
  const isStreaming = module.getIsStreaming();
  const isVisible =
    module.getGlobalAutoTitleEnabled() && module.getIsFirstInteraction();

  // Effect to register a callback with the module for updates
  useEffect(() => {
    module.setNotifyCallback(() => forceUpdate({}));
    return () => module.setNotifyCallback(null); // Cleanup
  }, [module]);

  // Effect to sync local state if module's state changes
  useEffect(() => {
    const moduleEnabled = module.getTurnEnabled();
    if (localAutoTitleEnabled !== moduleEnabled) {
      setLocalAutoTitleEnabled(moduleEnabled);
    }
  }, [module, localAutoTitleEnabled]); // Re-run if module instance or local state changes

  const handleToggle = useCallback(() => {
    const newState = !localAutoTitleEnabled;
    setLocalAutoTitleEnabled(newState); // Update local state for immediate UI feedback
    module.setTurnEnabled(newState); // Call module method to update module state
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
            <SparklesIcon
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
