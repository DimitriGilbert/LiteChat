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
import { toast } from "sonner";
import { emitter } from "@/lib/litechat/event-emitter";
import { settingsEvent } from "@/types/litechat/events/settings.events";
import { controlRegistryEvent } from "@/types/litechat/events/control.registry.events";

interface RulesControlTriggerProps {
  module: RulesControlModule;
}

export const RulesControlTrigger: React.FC<RulesControlTriggerProps> = ({
  module,
}) => {
  const [, forceUpdate] = useState({});
  
  useEffect(() => {
    // Listen to module notifications
    module.setNotifyCallback(() => forceUpdate({}));
    
    // Listen to settings changes AND control rule changes
    const handleSettingsChanged = () => forceUpdate({});
    const handleControlRulesChanged = () => forceUpdate({});
    
    emitter.on(settingsEvent.loaded, handleSettingsChanged);
    emitter.on(controlRegistryEvent.controlRulesChanged, handleControlRulesChanged);
    
    return () => {
      module.setNotifyCallback(null);
      emitter.off(settingsEvent.loaded, handleSettingsChanged);
      emitter.off(controlRegistryEvent.controlRulesChanged, handleControlRulesChanged);
    };
  }, [module]);

  const [popoverOpen, setPopoverOpen] = useState(false);

  const activeTagIds = module.getActiveTagIds();
  const activeRuleIds = module.getActiveRuleIds();
  const isStreaming = module.getIsStreaming();
  const hasRulesOrTags = module.getHasRulesOrTags();

  // Get data from module for the dialog
  const allRules = module.getAllRules();
  const allTags = module.getAllTags();
  const getRulesForTag = module.getRulesForTag;

  // console.log('RulesControlTrigger render, allRules:', allRules.map(r => ({ id: r.id, name: r.name, alwaysOn: r.alwaysOn, type: r.type })));
  // console.log('RulesControlTrigger render, activeRuleIds:', Array.from(activeRuleIds));

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

  const handleAutoSelectRules = useCallback(async () => {
    // TODO: Implement AI-powered rule selection
    // This would analyze the current prompt and suggest relevant rules
    console.log('Auto-selecting rules based on prompt context...');
    // Use toast instead of alert for better UX
    toast.info('Auto-select rules feature coming soon!', {
      description: 'This feature will be implemented in Issue #40 to automatically suggest relevant rules based on your prompt context.',
      duration: 4000,
    });
  }, []);

  const handleTriggerClick = () => {
    if (!hasRulesOrTags) {
      const settingsOpened = module.handleTriggerClick();
      if (settingsOpened) {
        setPopoverOpen(false);
      }
    } else {
      setPopoverOpen((prev) => !prev);
    }
  };

  const hasActiveSettings = activeTagIds.size > 0 || activeRuleIds.size > 0;
  const isDisabled = isStreaming;

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            {hasRulesOrTags ? (
              <PopoverTrigger asChild>
                <Button
                  variant={hasActiveSettings ? "secondary" : "ghost"}
                  size="icon"
                  className="h-8 w-8"
                  disabled={isDisabled}
                  aria-label="Configure Rules & Tags for Next Turn"
                  onClick={handleTriggerClick}
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
      {hasRulesOrTags && (
        <PopoverContent className="w-auto p-0" align="start">
          <RulesControlDialogContent
            activeTagIds={activeTagIds}
            activeRuleIds={activeRuleIds}
            onToggleTag={handleToggleTag}
            onToggleRule={handleToggleRule}
            allRules={allRules}
            allTags={allTags}
            getRulesForTag={getRulesForTag}
            onAutoSelectRules={module.autoSelectRules}
          />
        </PopoverContent>
      )}
    </Popover>
  );
};
