// src/components/lite-chat/message-actions-container.tsx
import React from "react";
import type { Message } from "@/lib/types";
import { MessageActions } from "./message-actions"; // Assumes MessageActions is in the same directory

interface MessageActionsContainerProps {
  message: Message;
  onRegenerate?: (messageId: string) => void;
}

export const MessageActionsContainer: React.FC<MessageActionsContainerProps> =
  React.memo(({ message, onRegenerate }) => {
    // Hide actions for system messages
    if (message.role === "system") {
      return null;
    }

    const isUser = message.role === "user";
    const handleRegenerate =
      !isUser &&
      onRegenerate &&
      message.id &&
      !message.isStreaming &&
      !message.error
        ? () => onRegenerate(message.id!)
        : undefined;

    return (
      <div className="absolute right-4 h-full top-0">
        {/* Adjust sticky positioning if needed, especially with folding */}
        <div className="sticky top-3.5 z-[1]">
          <MessageActions message={message} onRegenerate={handleRegenerate} />
        </div>
      </div>
    );
  });
MessageActionsContainer.displayName = "MessageActionsContainer";
