import React from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { VariantProps } from "class-variance-authority";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type ActionTooltipButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  } & {
    tooltipText: string;
    icon: React.ReactNode;
    iconClassName?: string;
    tooltipSide?: "top" | "bottom" | "left" | "right";
    "aria-label"?: string;
  };

export const ActionTooltipButton: React.FC<ActionTooltipButtonProps> = ({
  tooltipText,
  icon,
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
  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={variant}
            size={size}
            onClick={onClick}
            disabled={disabled}
            className={cn("h-6 w-6", className)}
            aria-label={ariaLabel ?? tooltipText}
            {...rest}
          >
            {React.isValidElement(icon) 
              ? React.cloneElement(icon as React.ReactElement<any>, {
                  className: cn("h-3.5 w-3.5", iconClassName, (icon as React.ReactElement<any>).props?.className)
                })
              : icon
            }
          </Button>
        </TooltipTrigger>
        <TooltipContent side={tooltipSide}>
          <p>{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
