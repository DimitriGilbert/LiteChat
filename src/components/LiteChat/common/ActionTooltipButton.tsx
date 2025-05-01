// src/components/LiteChat/common/ActionTooltipButton.tsx
// Entire file content provided
import React from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { VariantProps } from "class-variance-authority";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type ActionTooltipButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  } & {
    tooltipText: string;
    icon: LucideIcon | React.ReactNode;
    iconClassName?: string;
    tooltipSide?: "top" | "bottom" | "left" | "right";
    "aria-label": string;
  };

export const ActionTooltipButton: React.FC<ActionTooltipButtonProps> = ({
  tooltipText,
  icon: IconProp,
  iconClassName,
  tooltipSide = "top",
  onClick,
  disabled,
  variant = "ghost",
  size = "icon",
  className,
  "aria-label": ariaLabel,
  ...rest
}) => {
  // Check if IconProp is a valid React component type (function or class)
  const isIconComponent = typeof IconProp === "function";

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={variant}
            size={size}
            onClick={onClick}
            disabled={disabled}
            className={cn("h-6 w-6", className)} // Default size, can be overridden
            aria-label={ariaLabel}
            {...rest}
          >
            {/* Conditionally render the icon */}
            {isIconComponent ? (
              // If it's a component, render it as JSX
              <IconProp className={cn("h-3.5 w-3.5", iconClassName)} />
            ) : (
              // Otherwise, render it directly (assuming it's a node)
              IconProp
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side={tooltipSide}>
          <p>{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
