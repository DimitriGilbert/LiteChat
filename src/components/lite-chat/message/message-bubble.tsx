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
  level?: number;
  enableStreamingMarkdown: boolean;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  onRegenerate,
  className,
  getContextSnapshotForMod,
  modMessageActions,
  level = 0,
  enableStreamingMarkdown,
}) => {
  const initialFoldState = message.role === "system" ? true : false;
  const [isMessageFolded, setIsMessageFolded] = useState(initialFoldState);

  const toggleMessageFold = () => setIsMessageFolded((prev) => !prev);

  if (message.role === "system" && !message.content && !message.error) {
    return null;
  }

  const isUser = message.role === "user";
  const isSystem = message.role === "system";
  const indentationClass = `ml-${level * 4}`;

  // Generate a unique ID for the portal target within this bubble
  // This ID is now only used internally by MessageBody and MessageContentRenderer
  const portalTargetId = `streaming-portal-${message.id}`;

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
        indentationClass,
        "max-w-full",
        "overflow-hidden",
        className,
      )}
    >
      <MessageHeader
        role={message.role}
        isFolded={isMessageFolded}
        onToggleFold={toggleMessageFold}
      />
      {/* Pass level down to MessageBody */}
      <MessageBody
        message={message}
        isFolded={isMessageFolded}
        // level={level}
        onRegenerate={onRegenerate} // Pass regenerate down if needed by children
        getContextSnapshotForMod={getContextSnapshotForMod} // Pass context snapshot down
        modMessageActions={modMessageActions} // Pass actions down
        enableStreamingMarkdown={enableStreamingMarkdown}
        portalTargetId={portalTargetId} // Pass the unique ID for the portal target
      />
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
  if (prevProps.level !== nextProps.level) return false;
  if (prevProps.enableStreamingMarkdown !== nextProps.enableStreamingMarkdown)
    return false;

  if (prevMsg === nextMsg) return true;

  if (
    prevMsg.id !== nextMsg.id ||
    prevMsg.role !== nextMsg.role ||
    prevMsg.isStreaming !== nextMsg.isStreaming ||
    prevMsg.error !== nextMsg.error
  ) {
    return false;
  }

  // Compare children array (simple reference check first, then deep compare if needed)
  if (prevMsg.children !== nextMsg.children) {
    if (
      !prevMsg.children ||
      !nextMsg.children ||
      prevMsg.children.length !== nextMsg.children.length
    ) {
      return false;
    }
    // Basic deep compare (can be improved if necessary)
    if (JSON.stringify(prevMsg.children) !== JSON.stringify(nextMsg.children)) {
      return false;
    }
  }

  // If the streaming status differs, the messages are different
  // (This handles the start and end of streaming)
  if (prevMsg.isStreaming !== nextMsg.isStreaming) {
    return false;
  }

  // If NEITHER message is streaming, compare the final content and metadata
  if (!prevMsg.isStreaming && !nextMsg.isStreaming) {
    if (JSON.stringify(prevMsg.content) !== JSON.stringify(nextMsg.content)) {
      return false;
    }
    // Compare other non-streaming fields only when not streaming
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
  // If messages ARE streaming, we don't compare content here.
  // The visual update happens via the portal and activeStreamContent state.
  // The change in isStreaming flag handles the start/end comparison.

  // Compare function references
  if (
    prevProps.getContextSnapshotForMod !== nextProps.getContextSnapshotForMod
  ) {
    return false;
  }

  if (prevProps.modMessageActions !== nextProps.modMessageActions) {
    return false;
  }

  // If all checks pass, the messages are considered equal for memoization purposes
  return true;
};

export const MemoizedMessageBubble = React.memo(
  MessageBubble,
  messagesAreEqual,
);
