// src/controls/components/canvas/RegenerateActionControl.tsx
// FULL FILE
import React from "react";
import { ActionTooltipButton } from "@/components/LiteChat/common/ActionTooltipButton";
import { RefreshCwIcon } from "lucide-react";
import { emitter } from "@/lib/litechat/event-emitter";
import { canvasEvent } from "@/types/litechat/events/canvas.events";
import { toast } from "sonner";

interface RegenerateActionControlProps {
  interactionId: string;
  disabled?: boolean;
}

export const RegenerateActionControl: React.FC<
  RegenerateActionControlProps
> = ({ interactionId, disabled }) => {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) {
      toast.info("Regeneration is currently disabled.");
      return;
    }
    emitter.emit(canvasEvent.regenerateInteractionRequest, { interactionId });
  };
  return (
    <ActionTooltipButton
      tooltipText="Regenerate"
      onClick={handleClick}
      aria-label="Regenerate Response"
      disabled={disabled}
      icon={<RefreshCwIcon />}
      className="h-5 w-5 md:h-6 md:w-6"
    />
  );
};
