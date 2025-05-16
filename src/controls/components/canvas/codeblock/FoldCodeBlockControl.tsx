// src/controls/components/canvas/codeblock/FoldCodeBlockControl.tsx
// NEW FILE
import React from "react";
import { ActionTooltipButton } from "@/components/LiteChat/common/ActionTooltipButton";
import { ChevronsUpDownIcon } from "lucide-react";

interface FoldCodeBlockControlProps {
  isFolded: boolean;
  toggleFold: () => void;
}

export const FoldCodeBlockControl: React.FC<FoldCodeBlockControlProps> = ({
  isFolded,
  toggleFold,
}) => {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFold();
  };
  return (
    <ActionTooltipButton
      tooltipText={isFolded ? "Unfold Code" : "Fold Code"}
      onClick={handleClick}
      aria-label={isFolded ? "Unfold code block" : "Fold code block"}
      icon={<ChevronsUpDownIcon />}
      iconClassName="h-3.5 w-3.5"
      className="h-6 w-6 text-muted-foreground hover:text-foreground"
    />
  );
};
