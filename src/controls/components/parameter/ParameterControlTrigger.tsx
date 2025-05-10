// src/controls/components/parameter/ParameterControlTrigger.tsx
// FULL FILE
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { SlidersHorizontalIcon } from "lucide-react";
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
import type { ParameterControlModule } from "@/controls/modules/ParameterControlModule";
import { ParameterControlComponent } from "./ParameterControlComponent";

interface ParameterControlTriggerProps {
  module: ParameterControlModule;
}

export const ParameterControlTrigger: React.FC<
  ParameterControlTriggerProps
> = ({ module }) => {
  const [, forceUpdate] = useState({});
  useEffect(() => {
    module.setNotifyCallback(() => forceUpdate({}));
    return () => module.setNotifyCallback(null);
  }, [module]);

  const isStreaming = module.getIsStreaming();
  const isVisible = module.getIsVisible();

  if (!isVisible) {
    return null;
  }

  return (
    <Popover>
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                variant={"ghost"}
                size="icon"
                className="h-8 w-8"
                disabled={isStreaming}
                aria-label="Adjust Advanced Parameters"
              >
                <SlidersHorizontalIcon className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="top">Advanced Parameters</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <PopoverContent className="w-auto p-0" align="start">
        <ParameterControlComponent module={module} />
      </PopoverContent>
    </Popover>
  );
};
