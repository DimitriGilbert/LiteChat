// src/components/lite-chat/message/message-bubble.tsx
import React, { useState } from "react";
import type { Message, CustomMessageAction } from "@/lib/types"; // Added CustomMessageAction
import { cn } from "@/lib/utils";
import { MessageHeader } from "./message-header";
import { MessageBody } from "./message-body";
import { MessageActionsContainer } from "./message-actions-container";
import type { ReadonlyChatContextSnapshot } from "@/mods/api"; // Import snapshot type

interface MessageBubbleProps {
  message: Message;
  onRegenerate?: (messageId: string) => void;
  className?: string;
  getContextSnapshotForMod: () => ReadonlyChatContextSnapshot; // Add prop
  modMessageActions: CustomMessageAction[]; // Add prop for custom actions
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  onRegenerate,
  className,
  getContextSnapshotForMod, // Destructure prop
  modMessageActions, // Destructure prop
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
      {/* Pass getContextSnapshotForMod and modMessageActions down */}
      <MessageActionsContainer
        message={message}
        onRegenerate={onRegenerate}
        getContextSnapshotForMod={getContextSnapshotForMod} // Pass prop
        modMessageActions={modMessageActions} // Pass prop
      />
    </div>
  );
};

// --- Memoization Comparison Function (Revised) ---
const messagesAreEqual = (
  prevProps: MessageBubbleProps,
  nextProps: MessageBubbleProps,
): boolean => {
  const prevMsg = prevProps.message;
  const nextMsg = nextProps.message;

  // Quick exit for identical objects
  if (prevMsg === nextMsg) return true;

  // Check fields that determine fundamental state or identity
  if (
    prevMsg.id !== nextMsg.id ||
    prevMsg.role !== nextMsg.role ||
    prevMsg.isStreaming !== nextMsg.isStreaming || // Crucial for detecting stream end/start
    prevMsg.error !== nextMsg.error // Check for error changes
  ) {
    return false;
  }

  // If streaming, compare streamedContent
  if (nextMsg.isStreaming) {
    if (prevMsg.streamedContent !== nextMsg.streamedContent) {
      return false;
    }
  } else {
    // If not streaming, compare final content
    if (JSON.stringify(prevMsg.content) !== JSON.stringify(nextMsg.content)) {
      return false;
    }
    // Compare other potentially changing metadata only when not streaming
    if (
      JSON.stringify(prevMsg.tool_calls) !==
        JSON.stringify(nextMsg.tool_calls) ||
      prevMsg.tool_call_id !== nextMsg.tool_call_id ||
      prevMsg.providerId !== nextMsg.providerId ||
      prevMsg.modelId !== nextMsg.modelId ||
      prevMsg.tokensInput !== nextMsg.tokensInput ||
      prevMsg.tokensOutput !== nextMsg.tokensOutput ||
      prevMsg.tokensPerSecond !== nextMsg.tokensPerSecond ||
      JSON.stringify(prevMsg.vfsContextPaths) !==
        JSON.stringify(nextMsg.vfsContextPaths)
    ) {
      return false;
    }
  }

  // Compare getContextSnapshotForMod function reference
  if (
    prevProps.getContextSnapshotForMod !== nextProps.getContextSnapshotForMod
  ) {
    return false;
  }

  // Compare custom message actions reference (important for mods)
  if (prevProps.modMessageActions !== nextProps.modMessageActions) {
    return false;
  }

  // If none of the above differences were found, the props are considered equal
  return true;
};

export const MemoizedMessageBubble = React.memo(
  MessageBubble,
  messagesAreEqual,
);
