// src/components/LiteChat/canvas/empty-states/SetupStep.tsx
// FULL FILE
import React, { useState, useEffect } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2Icon,
  CircleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SetupStepProps {
  stepNumber: number;
  title: string;
  description: string | React.ReactNode;
  isComplete: boolean;
  isActive: boolean;
  children?: React.ReactNode;
  contentClassName?: string;
  openOnComplete?: boolean;
}

export const SetupStep: React.FC<SetupStepProps> = ({
  stepNumber,
  title,
  description,
  isComplete,
  isActive,
  children,
  contentClassName,
  openOnComplete,
}) => {
  // Default to folded if complete, unfolded if active (and not complete)
  const [isOpen, setIsOpen] = useState(isActive && !isComplete);

  // Ensure the active step opens if it becomes active later
  useEffect(() => {
    if (isActive && (!isComplete || openOnComplete)) {
      setIsOpen(true);
    }
    // Optionally close if it becomes inactive? Decided against for now.
  }, [isActive, isComplete, openOnComplete]);

  const Icon = isComplete ? CheckCircle2Icon : CircleIcon;
  const iconColor = isComplete
    ? "text-green-500"
    : isActive
      ? "text-primary"
      : "text-muted-foreground";

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="space-y-2">
      <div className="flex items-center justify-between space-x-4 px-1">
        <div className="flex items-center space-x-3">
          <Icon className={cn("h-5 w-5 flex-shrink-0", iconColor)} />
          <h4
            className={cn(
              "text-sm font-semibold",
              isComplete
                ? "text-muted-foreground line-through"
                : "text-primary",
            )}
          >
            Step {stepNumber}: {title}
          </h4>
        </div>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="w-9 p-0">
            {isOpen ? (
              <ChevronDownIcon className="h-4 w-4" />
            ) : (
              <ChevronRightIcon className="h-4 w-4" />
            )}
            <span className="sr-only">Toggle {title}</span>
          </Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent className="space-y-2">
        <div
          className={cn(
            "rounded-md border px-4 py-3 font-mono text-sm shadow-sm bg-card ml-8",
            contentClassName,
          )}
        >
          <p className={"text-sm mb-3 text-card-foreground"}>{description}</p>
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};
