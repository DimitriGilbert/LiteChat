// src/controls/components/canvas/codeblock/CopyCodeBlockControl.tsx
// FULL FILE
import React, { useState, useCallback } from "react";
import { ActionTooltipButton } from "@/components/LiteChat/common/ActionTooltipButton";
import { ClipboardIcon, CheckIcon } from "lucide-react";
// import { toast } from "sonner"; // Removed, feedback will be handled by event listener or globally
import { emitter } from "@/lib/litechat/event-emitter"; // Added
import { canvasEvent } from "@/types/litechat/events/canvas.events"; // Added
import { useTranslation } from "react-i18next";

interface CopyCodeBlockControlProps {
  interactionId?: string; // Added: ID of the interaction, if available
  codeBlockId?: string; // Added: ID of the code block, if available
  language?: string; // Added: Language of the code block
  codeToCopy: string;
  disabled?: boolean;
}

export const CopyCodeBlockControl: React.FC<CopyCodeBlockControlProps> = ({
  interactionId,
  codeBlockId,
  language,
  codeToCopy,
  disabled,
}) => {
  const { t } = useTranslation('canvas');
  const [isCopied, setIsCopied] = useState(false); // Local state for immediate UI feedback

  const handleCopy = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      
      // Mark as codeblock button interaction to prevent scroll interference
      const viewport = document.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
      if (viewport) {
        (viewport as any)._isCodeblockButtonInteraction = true;
        setTimeout(() => {
          (viewport as any)._isCodeblockButtonInteraction = false;
        }, 100);
      }
      
      if (disabled || !codeToCopy) return;

      emitter.emit(canvasEvent.copyCodeBlockRequest, {
        interactionId,
        codeBlockId,
        language,
        content: codeToCopy, // Use 'content' to match event payload
      });

      // Immediate feedback can remain, or be driven by a response event if preferred
      setIsCopied(true);
      // toast.success("Code copied!"); // Consider moving toast to the event handler
      setTimeout(() => setIsCopied(false), 1500);
    },
    [interactionId, codeBlockId, language, codeToCopy, disabled]
  );

  return (
    <ActionTooltipButton
      tooltipText={t('actions.copyCode', 'Copy Code')}
      onClick={handleCopy}
      aria-label={t('actions.copyCodeAriaLabel', 'Copy code block')}
      disabled={disabled || !codeToCopy}
      icon={
        isCopied ? <CheckIcon className="text-green-500" /> : <ClipboardIcon />
      }
      className="h-6 w-6 text-muted-foreground hover:text-foreground"
      tabIndex={-1}
    />
  );
};
