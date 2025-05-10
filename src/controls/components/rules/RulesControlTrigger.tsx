// src/controls/components/rules/RulesControlTrigger.tsx
// FULL FILE
import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ShieldAlertIcon } from "lucide-react";
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
import { RulesControlDialogContent } from "./RulesControlDialogContent";
import type { RulesControlModule } from "@/controls/modules/RulesControlModule";

interface RulesControlTriggerProps {
  module: RulesControlModule;
}

export const RulesControlTrigger: React.FC<RulesControlTriggerProps> = ({
  module,
}) => {
  const [, forceUpdate] = useState({});
  useEffect(() => {
    module.setNotifyCallback(() => forceUpdate({}));
    return () => module.setNotifyCallback(null);
  }, [module]);

  const [popoverOpen, setPopoverOpen] = useState(false);

  const activeTagIds = module.getActiveTagIds();
  const activeRuleIds = module.getActiveRuleIds();
  const isStreaming = module.getIsStreaming();
  const hasRulesOrTags = module.getHasRulesOrTags(); // For conditional behavior

  const handleToggleTag = useCallback(
    (tagId: string, isActive: boolean) => {
      module.setActiveTagIds((prev) => {
        const nextTags = new Set(prev);
        if (isActive) nextTags.add(tagId);
        else nextTags.delete(tagId);
        return nextTags;
      });
    },
    [module]
  );

  const handleToggleRule = useCallback(
    (ruleId: string, isActive: boolean) => {
      module.setActiveRuleIds((prev) => {
        const nextRules = new Set(prev);
        if (isActive) nextRules.add(ruleId);
        else nextRules.delete(ruleId);
        return nextRules;
      });
    },
    [module]
  );

  const handleTriggerClick = () => {
    if (!hasRulesOrTags) {
      const settingsOpened = module.handleTriggerClick();
      if (settingsOpened) {
        setPopoverOpen(false); // Ensure popover doesn't open if settings modal is triggered
      }
    } else {
      setPopoverOpen((prev) => !prev); // Default popover toggle
    }
  };

  const hasActiveSettings = activeTagIds.size > 0 || activeRuleIds.size > 0;
  const isDisabled = isStreaming;

  // This control is always visible if registered.
  // The behavior of the click changes based on whether rules/tags exist.

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            {/*
              If rules/tags exist, PopoverTrigger wraps the button.
              If not, the button directly calls handleTriggerClick.
            */}
            {hasRulesOrTags ? (
              <PopoverTrigger asChild>
                <Button
                  variant={hasActiveSettings ? "secondary" : "ghost"}
                  size="icon"
                  className="h-8 w-8"
                  disabled={isDisabled}
                  aria-label="Configure Rules & Tags for Next Turn"
                  onClick={handleTriggerClick} // Still call this to allow popover to open
                >
                  <ShieldAlertIcon className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                disabled={isDisabled}
                aria-label="Add Rules & Tags (Opens Settings)"
                onClick={handleTriggerClick}
              >
                <ShieldAlertIcon className="h-4 w-4" />
              </Button>
            )}
          </TooltipTrigger>
          <TooltipContent side="top">
            {hasRulesOrTags
              ? hasActiveSettings
                ? `Rules/Tags Active (${activeTagIds.size} tags, ${activeRuleIds.size} rules)`
                : "Activate Rules/Tags (Next Turn)"
              : "Add Rules/Tags (Opens Settings)"}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      {hasRulesOrTags && ( // Only render PopoverContent if there are rules/tags
        <PopoverContent className="w-auto p-0" align="start">
          <RulesControlDialogContent
            activeTagIds={activeTagIds}
            activeRuleIds={activeRuleIds}
            onToggleTag={handleToggleTag}
            onToggleRule={handleToggleRule}
          />
        </PopoverContent>
      )}
    </Popover>
  );
};
