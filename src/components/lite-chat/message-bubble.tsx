// src/components/lite-chat/message-bubble.tsx
import React, { useState } from "react";
import type { Message } from "@/lib/types";
import { cn } from "@/lib/utils";
import { MessageHeader } from "./message-header";
import { MessageBody } from "./message-body";
import { MessageActionsContainer } from "./message-actions-container";

interface MessageBubbleProps {
  message: Message;
  onRegenerate?: (messageId: string) => void;
  className?: string;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  onRegenerate,
  className,
}) => {
  // System messages might not need folding state or have different behavior
  const initialFoldState = message.role === "system" ? true : false; // Example: Fold system by default
  const [isMessageFolded, setIsMessageFolded] = useState(initialFoldState);

  const toggleMessageFold = () => setIsMessageFolded((prev) => !prev);

  // Skip rendering entirely for system messages if they have no content and no error
  if (message.role === "system" && !message.content && !message.error) {
    return null;
  }

  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  return (
    <div
      className={cn(
        "group/message flex gap-3 px-4 py-3 transition-colors relative rounded-lg",
        isUser
          ? "bg-gray-900/50"
          : isSystem
            ? "bg-gray-800/30 border border-dashed border-gray-700/50" // Example style for system
            : "bg-gray-800/60",
        !isSystem && "hover:bg-gray-800", // Don't apply hover to system messages
        className,
      )}
    >
      <MessageHeader
        role={message.role}
        isFolded={isMessageFolded}
        onToggleFold={toggleMessageFold}
      />
      <MessageBody message={message} isFolded={isMessageFolded} />
      <MessageActionsContainer message={message} onRegenerate={onRegenerate} />
    </div>
  );
};

// --- Memoization Comparison Function (Adjusted for potential role changes) ---
const messagesAreEqual = (
  prevProps: MessageBubbleProps,
  nextProps: MessageBubbleProps,
): boolean => {
  const prevMsg = prevProps.message;
  const nextMsg = nextProps.message;

  // Basic checks for changes that always warrant a rerender
  if (
    prevMsg.id !== nextMsg.id ||
    prevMsg.role !== nextMsg.role || // Role change is significant
    prevMsg.error !== nextMsg.error ||
    prevMsg.isStreaming !== nextMsg.isStreaming ||
    // Deep compare VFS paths array if it exists
    JSON.stringify(prevMsg.vfsContextPaths) !==
      JSON.stringify(nextMsg.vfsContextPaths) ||
    // Compare metadata that might change after streaming finishes
    prevMsg.providerId !== nextMsg.providerId ||
    prevMsg.modelId !== nextMsg.modelId ||
    prevMsg.tokensInput !== nextMsg.tokensInput ||
    prevMsg.tokensOutput !== nextMsg.tokensOutput ||
    prevMsg.tokensPerSecond !== nextMsg.tokensPerSecond
  ) {
    return false;
  }

  // If streaming, compare streamedContent
  if (nextMsg.isStreaming) {
    return prevMsg.streamedContent === nextMsg.streamedContent;
  }

  // If not streaming, compare final content
  return prevMsg.content === nextMsg.content;
};

export const MemoizedMessageBubble = React.memo(
  MessageBubble,
  messagesAreEqual,
);
