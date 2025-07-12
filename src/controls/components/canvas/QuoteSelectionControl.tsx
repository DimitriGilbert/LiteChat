// src/controls/components/canvas/QuoteSelectionControl.tsx
import React from "react";
import { ActionTooltipButton } from "@/components/LiteChat/common/ActionTooltipButton";
import { QuoteIcon } from "lucide-react";
import { emitter } from "@/lib/litechat/event-emitter";
import { promptEvent } from "@/types/litechat/events/prompt.events";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import type { SelectionControlContext } from "@/types/litechat/canvas/control";

interface QuoteSelectionControlProps {
  context: SelectionControlContext;
}

export const QuoteSelectionControl: React.FC<QuoteSelectionControlProps> = ({ context }) => {
  const { t } = useTranslation('canvas');

  const handleQuote = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    const quotedText = `> ${context.selectedText.split('\n').join('\n> ')}\n\n`;
    
    // For now, we'll just set the text. In a real implementation, 
    // you'd want to get the current prompt input and append to it
    emitter.emit(promptEvent.setInputTextRequest, { 
      text: quotedText 
    });
    
    toast.success(t('selection.quoted', 'Text quoted to input'));
    
    // Clear selection after quoting
    window.getSelection()?.removeAllRanges();
  };

  return (
    <ActionTooltipButton
      tooltipText={t('selection.quote', 'Quote')}
      onClick={handleQuote}
      aria-label={t('selection.quoteAriaLabel', 'Quote selected text')}
      icon={<QuoteIcon />}
      className="h-6 w-6 text-muted-foreground hover:text-foreground border border-primary"
    />
  );
};