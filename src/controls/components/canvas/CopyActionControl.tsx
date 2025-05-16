// src/controls/components/canvas/CopyActionControl.tsx
// FULL FILE
import React, { useState, useCallback } from "react";
import { ActionTooltipButton } from "@/components/LiteChat/common/ActionTooltipButton";
import { ClipboardIcon, CheckIcon } from "lucide-react";
import { toast } from "sonner";
import { emitter } from "@/lib/litechat/event-emitter";
import { canvasEvent } from "@/types/litechat/events/canvas.events";

interface CopyActionControlProps {
  interactionId: string;
  contentToCopy: string;
  disabled?: boolean;
}

export const CopyActionControl: React.FC<CopyActionControlProps> = ({
  interactionId,
  contentToCopy,
  disabled,
}) => {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (disabled || !contentToCopy) {
        toast.info("No content to copy or action disabled.");
        return;
      }

      emitter.emit(canvasEvent.copyInteractionResponseRequest, {
        interactionId,
      });

      // Simulating success for UI feedback until proper event handling is in place for outcomes.
      // In a fully event-driven system, a listener to 'interactionResponseCopied' would set this.
      //setIsCopied(true);
      //toast.success("Copy request sent!"); // Or let the handler show the toast.
      //setTimeout(() => setIsCopied(false), 1500);

      // Actual copy logic is now moved to an event handler.
    },
    [interactionId, contentToCopy, disabled]
  );

  return (
    <ActionTooltipButton
      tooltipText="Copy"
      onClick={handleCopy}
      aria-label="Copy content"
      disabled={disabled || !contentToCopy}
      icon={
        isCopied ? <CheckIcon className="text-green-500" /> : <ClipboardIcon />
      }
      className="h-5 w-5"
    />
  );
};
