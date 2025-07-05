// src/components/LiteChat/common/StopButton.tsx

import React from "react";
import { useTranslation } from "react-i18next";
import { SquareIcon } from "lucide-react";
import { ActionTooltipButton } from "./ActionTooltipButton";

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
  "aria-label": ariaLabel,
}) => {
  const { t } = useTranslation('common');
  
  return (
    <ActionTooltipButton
      tooltipText={t('stopButton.stop')}
      onClick={onStop}
      aria-label={ariaLabel || t('stopButton.stopGeneration')}
      icon={<SquareIcon />}
      variant={variant}
      size={size}
      className={className}
    />
  );
};
