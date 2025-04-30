// src/components/LiteChat/common/StopButton.tsx
import React from "react";
import { Button } from "@/components/ui/button";
import { SquareIcon } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface StopButtonProps {
  // Changed prop name from 'onClick' to 'onStop'
  onStop: () => void;
  className?: string;
  size?: "sm" | "icon" | "default" | "lg";
  variant?:
    | "default"
    | "destructive"
    | "outline"
    | "secondary"
    | "ghost"
    | "link";
  "aria-label"?: string;
}

export const StopButton: React.FC<StopButtonProps> = ({
  onStop,
  className,
  size = "icon",
  variant = "ghost",
  "aria-label": ariaLabel = "Stop Generation",
}) => {
  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={variant}
            size={size}
            onClick={onStop} // Use the onStop prop here
            className={className}
            aria-label={ariaLabel}
          >
            <SquareIcon className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">Stop</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
