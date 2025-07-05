// src/controls/components/canvas/codeblock/FoldCodeBlockControl.tsx
// NEW FILE
import React from "react";
import { ActionTooltipButton } from "@/components/LiteChat/common/ActionTooltipButton";
import { ChevronsUpDownIcon } from "lucide-react";
import { createCodeblockButtonHandler } from "@/lib/litechat/codeblock-button-utils";
import { useTranslation } from "react-i18next";

interface FoldCodeBlockControlProps {
  isFolded: boolean;
  toggleFold: () => void;
}

export const FoldCodeBlockControl: React.FC<FoldCodeBlockControlProps> = ({
  isFolded,
  toggleFold,
}) => {
  const { t } = useTranslation('canvas');
  const handleClick = createCodeblockButtonHandler(() => {
    toggleFold();
  });
  
  return (
    <ActionTooltipButton
      tooltipText={isFolded ? t('actions.unfoldCode', 'Unfold Code') : t('actions.foldCode', 'Fold Code')}
      onClick={handleClick}
      aria-label={isFolded ? t('actions.unfoldCodeAriaLabel', 'Unfold code block') : t('actions.foldCodeAriaLabel', 'Fold code block')}
      icon={<ChevronsUpDownIcon />}
      iconClassName="h-3.5 w-3.5"
      className="h-6 w-6 text-muted-foreground hover:text-foreground"
      tabIndex={-1}
    />
  );
};
