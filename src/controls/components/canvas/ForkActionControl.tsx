import React from "react";
import { ActionTooltipButton } from "@/components/LiteChat/common/ActionTooltipButton";
import { GitForkIcon } from "lucide-react";
import { emitter } from "@/lib/litechat/event-emitter";
import { canvasEvent } from "@/types/litechat/events/canvas.events";
import { toast } from "sonner";

interface ForkActionControlProps {
  interactionId: string;
  disabled?: boolean;
}

export const ForkActionControl: React.FC<
  ForkActionControlProps
> = ({ interactionId, disabled }) => {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) {
      toast.info("Fork is currently disabled.");
      return;
    }
    emitter.emit(canvasEvent.forkConversationRequest, { interactionId });
  };
  return (
    <ActionTooltipButton
      tooltipText="Fork"
      onClick={handleClick}
      aria-label="Fork Conversation"
      disabled={disabled}
      icon={<GitForkIcon />}
      className="h-5 w-5 md:h-6 md:w-6"
    />
  );
}; 