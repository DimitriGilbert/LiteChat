
import React from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface MessageFoldButtonProps {
  isFolded: boolean;
  onToggleFold: () => void;
}

export const MessageFoldButton: React.FC<MessageFoldButtonProps> = React.memo(
  ({ isFolded, onToggleFold }) => {
    return (
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 text-gray-500 hover:text-gray-300 hover:bg-gray-700/50 rounded"
              onClick={onToggleFold}
              aria-label={isFolded ? "Expand message" : "Collapse message"}
            >
              {isFolded ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>{isFolded ? "Expand message" : "Collapse message"}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  },
);
MessageFoldButton.displayName = "MessageFoldButton";
