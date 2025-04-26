// src/components/LiteChat/common/StopButton.tsx
import React from "react";
import { Button } from "@/components/ui/button";
import { SquareIcon } from "lucide-react"; // Using SquareIcon for stop
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface StopButtonProps {
  interactionId: string;
  onStop: (id: string) => void;
  className?: string;
}

export const StopButton: React.FC<StopButtonProps> = ({
  interactionId,
  onStop,
  className,
}) => {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent clicks propagating to parent elements
    onStop(interactionId);
  };

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="destructive" // Use destructive variant for stop
            size="icon"
            className={cn("h-6 w-6", className)} // Smaller size for inline use
            onClick={handleClick}
            aria-label="Stop generation"
          >
            <SquareIcon className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p>Stop Generation</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
