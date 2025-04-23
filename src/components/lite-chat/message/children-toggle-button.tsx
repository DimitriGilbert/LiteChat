
import React from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface ChildrenToggleButtonProps {
  isCollapsed: boolean;
  onToggle: () => void;
  childCount: number;
  className?: string;
}

export const ChildrenToggleButton: React.FC<ChildrenToggleButtonProps> =
  React.memo(({ isCollapsed, onToggle, childCount, className }) => {
    const label = isCollapsed
      ? `Expand ${childCount} alternative${childCount !== 1 ? "s" : ""}`
      : `Collapse ${childCount} alternative${childCount !== 1 ? "s" : ""}`;

    return (
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-6 px-1 text-xs text-gray-500 hover:text-gray-300 hover:bg-gray-700/50 rounded",
                className,
              )}
              onClick={(e) => {
                e.stopPropagation(); // Prevent triggering message fold
                onToggle();
              }}
              aria-label={label}
            >
              {isCollapsed ? (
                <ChevronRight className="h-3.5 w-3.5 mr-1" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 mr-1" />
              )}
              {childCount} Alternative{childCount !== 1 ? "s" : ""}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p>{label}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  });
ChildrenToggleButton.displayName = "ChildrenToggleButton";
