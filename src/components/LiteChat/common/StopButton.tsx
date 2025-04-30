// src/components/LiteChat/common/StopButton.tsx
// Entire file content provided
import React from "react";
import { SquareIcon } from "lucide-react";
import { ActionTooltipButton } from "./ActionTooltipButton"; // Import ActionTooltipButton

interface StopButtonProps {
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
    <ActionTooltipButton
      tooltipText="Stop"
      onClick={onStop}
      aria-label={ariaLabel}
      icon={<SquareIcon />}
      variant={variant}
      size={size}
      className={className}
    />
  );
};
