// src/components/lite-chat/message/message-bubble.tsx
import React, { useState } from "react";
import type { Message, CustomMessageAction } from "@/lib/types";
import { cn } from "@/lib/utils";
import { MessageHeader } from "./message-header";
import { MessageBody } from "./message-body";
import { MessageActionsContainer } from "./message-actions-container";
import type { ReadonlyChatContextSnapshot } from "@/mods/api";

interface MessageBubbleProps {
  message: Message;
  onRegenerate?: (messageId: string) => void;
  className?: string;
  getContextSnapshotForMod: () => ReadonlyChatContextSnapshot;
  modMessageActions: CustomMessageAction[];
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  onRegenerate,
  className,
  getContextSnapshotForMod,
  modMessageActions,
}) => {
  const initialFoldState = message.role === "system" ? true : false;
  const [isMessageFolded, setIsMessageFolded] = useState(initialFoldState);

  const toggleMessageFold = () => setIsMessageFolded((prev) => !prev);

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
          ? "bg-background/50"
          : isSystem
            ? "bg-muted/30 border border-dashed border-border"
            : "bg-muted/60",
        !isSystem && "hover:bg-muted/80 transition-all duration-200",
        className,
      )}
    >
      <MessageHeader
        role={message.role}
        isFolded={isMessageFolded}
        onToggleFold={toggleMessageFold}
      />
      <MessageBody message={message} isFolded={isMessageFolded} />
      <MessageActionsContainer
        message={message}
        onRegenerate={onRegenerate}
        getContextSnapshotForMod={getContextSnapshotForMod}
        modMessageActions={modMessageActions}
      />
    </div>
  );
};

const messagesAreEqual = (
  prevProps: MessageBubbleProps,
  nextProps: MessageBubbleProps,
): boolean => {
  const prevMsg = prevProps.message;
  const nextMsg = nextProps.message;

  if (prevMsg === nextMsg) return true;

  if (
    prevMsg.id !== nextMsg.id ||
    prevMsg.role !== nextMsg.role ||
    prevMsg.isStreaming !== nextMsg.isStreaming ||
    prevMsg.error !== nextMsg.error
  ) {
    return false;
  }

  if (nextMsg.isStreaming) {
    if (prevMsg.streamedContent !== nextMsg.streamedContent) {
      return false;
    }
  } else {
    if (JSON.stringify(prevMsg.content) !== JSON.stringify(nextMsg.content)) {
      return false;
    }
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

  if (
    prevProps.getContextSnapshotForMod !== nextProps.getContextSnapshotForMod
  ) {
    return false;
  }

  if (prevProps.modMessageActions !== nextProps.modMessageActions) {
    return false;
  }

  return true;
};

export const MemoizedMessageBubble = React.memo(
  MessageBubble,
  messagesAreEqual,
);
