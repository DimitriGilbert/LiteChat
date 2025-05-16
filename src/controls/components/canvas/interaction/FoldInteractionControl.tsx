// src/controls/components/canvas/interaction/FoldInteractionControl.tsx
// NEW FILE
import React from "react";
import { ActionTooltipButton } from "@/components/LiteChat/common/ActionTooltipButton";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";

interface FoldInteractionControlProps {
  isFolded: boolean;
  toggleFold: () => void;
  canFold: boolean; // In case some interactions cannot be folded
}

export const FoldInteractionControl: React.FC<FoldInteractionControlProps> = ({
  isFolded,
  toggleFold,
  canFold,
}) => {
  if (!canFold) {
    return null;
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFold();
  };

  return (
    <ActionTooltipButton
      tooltipText={isFolded ? "Unfold" : "Fold"}
      onClick={handleClick}
      aria-label={isFolded ? "Unfold response" : "Fold response"}
      icon={isFolded ? <ChevronDownIcon /> : <ChevronUpIcon />}
      iconClassName="h-3.5 w-3.5"
      className="h-5 w-5"
    />
  );
};
