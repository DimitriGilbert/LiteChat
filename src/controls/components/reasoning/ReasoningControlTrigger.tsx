// src/controls/components/reasoning/ReasoningControlTrigger.tsx
// FULL FILE
import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { BrainCircuitIcon } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ReasoningControlModule } from "@/controls/modules/ReasoningControlModule";
import { useTranslation } from "react-i18next";

interface ReasoningControlTriggerProps {
  module: ReasoningControlModule;
}

export const ReasoningControlTrigger: React.FC<
  ReasoningControlTriggerProps
> = ({ module }) => {
  const { t } = useTranslation('controls');
  const [, forceUpdate] = useState({});
  useEffect(() => {
    module.setNotifyCallback(() => forceUpdate({}));
    return () => module.setNotifyCallback(null);
  }, [module]);

  const localReasoningEnabled = module.getReasoningEnabled();
  const isStreaming = module.getIsStreaming();
  const isVisible = module.getIsVisible();

  const isExplicitlyEnabled = localReasoningEnabled === true;

  const handleToggleClick = useCallback(() => {
    const newState = isExplicitlyEnabled ? null : true;
    module.setReasoningEnabled(newState);
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
                ? t('reasoningControl.disableAriaLabel')
                : t('reasoningControl.enableAriaLabel')
            }
          >
            <BrainCircuitIcon
              className={cn(
                "h-4 w-4",
                isExplicitlyEnabled ? "text-primary" : "text-muted-foreground"
              )}
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">
          {isExplicitlyEnabled
            ? t('reasoningControl.enabledTooltip')
            : t('reasoningControl.disabledTooltip')}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
