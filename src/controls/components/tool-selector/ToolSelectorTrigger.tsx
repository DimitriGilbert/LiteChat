// src/controls/components/tool-selector/ToolSelectorTrigger.tsx
// FULL FILE
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { WrenchIcon } from "lucide-react";
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
import type { ToolSelectorControlModule } from "@/controls/modules/ToolSelectorControlModule";
import { ToolSelectorControlComponent } from "./ToolSelectorControlComponent";

interface ToolSelectorTriggerProps {
  module: ToolSelectorControlModule;
}

export const ToolSelectorTrigger: React.FC<ToolSelectorTriggerProps> = ({
  module,
}) => {
  const [, forceUpdate] = useState({});
  useEffect(() => {
    module.setNotifyCallback(() => forceUpdate({}));
    return () => module.setNotifyCallback(null);
  }, [module]);

  const [popoverOpen, setPopoverOpen] = useState(false);
  const [popoverMaxSteps, setPopoverMaxSteps] = useState<number | null>(
    module.getMaxStepsOverride()
  );

  const enabledTools = module.getEnabledTools();
  const maxStepsOverride = module.getMaxStepsOverride();
  const isStreaming = module.getIsStreaming();
  const isVisible = module.getIsVisible(); // Get visibility from module

  useEffect(() => {
    setPopoverMaxSteps(module.getMaxStepsOverride());
  }, [module.getMaxStepsOverride()]);

  const handlePopoverOpenChange = (open: boolean) => {
    setPopoverOpen(open);
    if (!open && popoverMaxSteps !== module.getMaxStepsOverride()) {
      module.setMaxStepsOverride(popoverMaxSteps);
    }
  };

  const hasActiveSettings = enabledTools.size > 0 || maxStepsOverride !== null;
  const isDisabledByStreaming = isStreaming;

  if (!isVisible) {
    return null;
  }

  return (
    <Popover open={popoverOpen} onOpenChange={handlePopoverOpenChange}>
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                variant={hasActiveSettings ? "secondary" : "ghost"}
                size="icon"
                className="h-8 w-8"
                disabled={isDisabledByStreaming} // Only disable due to streaming
                aria-label="Configure Tools"
              >
                <WrenchIcon className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="top">
            {`Tools (${enabledTools.size} enabled)`}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <PopoverContent className="w-auto p-0" align="start">
        <ToolSelectorControlComponent
          module={module}
          popoverMaxSteps={popoverMaxSteps}
          setPopoverMaxSteps={setPopoverMaxSteps}
        />
      </PopoverContent>
    </Popover>
  );
};
