// src/components/lite-chat/message/message-actions-container.tsx
import React from "react";
import type { Message } from "@/lib/types";
import { MessageActions } from "./message-actions";
import type { ReadonlyChatContextSnapshot } from "@/mods/api";
import { useModStore } from "@/store/mod.store"; // Import store

interface MessageActionsContainerProps {
  message: Message;
  onRegenerate?: (messageId: string) => void;
  getContextSnapshotForMod: () => ReadonlyChatContextSnapshot;
}

export const MessageActionsContainer: React.FC<MessageActionsContainerProps> =
  React.memo(({ message, onRegenerate, getContextSnapshotForMod }) => {
    // Select custom actions here, outside MessageActions
    const customMessageActions = useModStore((s) => s.modMessageActions);

    console.log(
      `[MessageActionsContainer] Rendering for msg ${message.id}. Custom actions count: ${customMessageActions.length}`,
    );

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
        <div className="sticky top-3.5 z-[1]">
          {/* Pass custom actions and snapshot function as props */}
          <MessageActions
            message={message}
            onRegenerate={handleRegenerate}
            getContextSnapshotForMod={getContextSnapshotForMod}
            customMessageActions={customMessageActions} // Pass as prop
          />
        </div>
      </div>
    );
  });
MessageActionsContainer.displayName = "MessageActionsContainer";
