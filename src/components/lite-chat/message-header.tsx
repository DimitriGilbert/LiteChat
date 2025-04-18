// src/components/lite-chat/message-header.tsx
import React from "react";
import { MessageAvatar } from "./message-avatar";
import { MessageFoldButton } from "./message-fold-button";
import type { Message } from "@/lib/types";

interface MessageHeaderProps {
  role: Message["role"];
  isFolded: boolean;
  onToggleFold: () => void;
}

export const MessageHeader: React.FC<MessageHeaderProps> = React.memo(
  ({ role, isFolded, onToggleFold }) => {
    // Hide fold button for system messages if desired
    const showFoldButton = role !== "system";

    return (
      <div className="flex-shrink-0 flex flex-col items-center gap-1.5 mt-1">
        <MessageAvatar role={role} />
        {showFoldButton && (
          <MessageFoldButton isFolded={isFolded} onToggleFold={onToggleFold} />
        )}
      </div>
    );
  },
);
MessageHeader.displayName = "MessageHeader";
