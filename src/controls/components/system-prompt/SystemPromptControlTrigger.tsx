// src/controls/components/system-prompt/SystemPromptControlTrigger.tsx
// FULL FILE
import React, { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { TextIcon } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { SystemPromptControlModule } from "@/controls/modules/SystemPromptControlModule";

interface SystemPromptControlTriggerProps {
  module: SystemPromptControlModule;
}

export const SystemPromptControlTrigger: React.FC<
  SystemPromptControlTriggerProps
> = ({ module }) => {
  const [, forceUpdate] = useState({});
  useEffect(() => {
    module.setNotifyCallback(() => forceUpdate({}));
    return () => module.setNotifyCallback(null);
  }, [module]);

  const [popoverOpen, setPopoverOpen] = useState(false);
  // Local state for textarea, synced with module on open/save
  const [localPrompt, setLocalPrompt] = useState(module.getTurnSystemPrompt());

  // Read derived state from module
  const effectiveSystemPrompt = module.getEffectiveSystemPrompt();
  const isStreaming = module.getIsStreaming();
  const turnSystemPromptValue = module.getTurnSystemPrompt(); // For hasTurnPrompt check

  // Sync localPrompt when popover opens or module's turn prompt changes
  useEffect(() => {
    if (popoverOpen) {
      setLocalPrompt(module.getTurnSystemPrompt());
    }
  }, [popoverOpen, module]); // module as dep to catch external changes

  useEffect(() => {
    // This effect syncs localPrompt if the module's turnSystemPromptValue changes
    // while the popover might not be open (e.g., due to clearOnSubmit)
    const currentModulePrompt = module.getTurnSystemPrompt();
    if (localPrompt !== currentModulePrompt) {
      setLocalPrompt(currentModulePrompt);
    }
  }, [module.getTurnSystemPrompt(), localPrompt]);

  const handleSave = useCallback(() => {
    module.setTurnSystemPrompt(localPrompt.trim());
    setPopoverOpen(false);
  }, [localPrompt, module]);

  const handleClear = useCallback(() => {
    setLocalPrompt(""); // Clear local input
    module.setTurnSystemPrompt(""); // Update module state
    setPopoverOpen(false);
  }, [module]);

  const handleOpenChange = (open: boolean) => {
    if (open) {
      setLocalPrompt(module.getTurnSystemPrompt()); // Sync on open
    }
    setPopoverOpen(open);
  };

  const hasTurnPrompt = turnSystemPromptValue.trim().length > 0;

  return (
    <Popover open={popoverOpen} onOpenChange={handleOpenChange}>
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                variant={hasTurnPrompt ? "secondary" : "ghost"}
                size="icon"
                className="h-8 w-8"
                disabled={isStreaming}
                aria-label="Set System Prompt for Next Turn"
              >
                <TextIcon className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="top">
            {hasTurnPrompt
              ? "System Prompt Override Active"
              : "Set System Prompt (Next Turn)"}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <PopoverContent className="w-80 p-4 space-y-3" align="start">
        <Label htmlFor="turn-system-prompt">
          System Prompt (Overrides Project/Global for Next Turn)
        </Label>
        <Textarea
          id="turn-system-prompt"
          placeholder={`Inherited: ${
            effectiveSystemPrompt?.substring(0, 50) || "Default"
          }${
            effectiveSystemPrompt && effectiveSystemPrompt.length > 50
              ? "..."
              : ""
          }`}
          value={localPrompt}
          onChange={(e) => setLocalPrompt(e.target.value)}
          rows={5}
          className="text-sm"
        />
        <div className="flex justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={handleClear}
            disabled={!localPrompt.trim()}
          >
            Clear Override
          </Button>
          <Button size="sm" onClick={handleSave}>
            Set for Next Turn
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};
