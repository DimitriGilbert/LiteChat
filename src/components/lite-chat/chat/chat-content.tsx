// src/components/lite-chat/chat/chat-content.tsx
import React, { useRef, useState, useEffect, useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
// Use MemoizedMessageBubble if that's the intended export, otherwise use MessageBubble
// Assuming MemoizedMessageBubble is the correct one based on the user's file content
import { MemoizedMessageBubble } from "../message/message-bubble";
import { EmptyContent } from "./empty-content";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  Message,
  CustomMessageAction,
  ReadonlyChatContextSnapshot,
} from "@/lib/types";

interface ChatContentProps {
  className?: string;
  messages: Message[];
  isLoadingMessages: boolean;
  isStreaming: boolean; // Keep isStreaming prop for logic within ChatContent
  regenerateMessage: (messageId: string) => Promise<void>;
  getContextSnapshotForMod: () => ReadonlyChatContextSnapshot;
  modMessageActions: CustomMessageAction[];
  enableStreamingMarkdown: boolean;
}

const ChatContentComponent: React.FC<ChatContentProps> = ({
  className,
  messages,
  isLoadingMessages,
  isStreaming, // Keep isStreaming prop for internal logic if needed
  regenerateMessage,
  getContextSnapshotForMod,
  modMessageActions,
  enableStreamingMarkdown,
}) => {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [userScrolledUp, setUserScrolledUp] = useState(false);

  const getViewport = () => {
    return scrollAreaRef.current?.querySelector<HTMLDivElement>(
      "[data-radix-scroll-area-viewport]",
    );
  };

  useEffect(() => {
    const viewport = getViewport();
    if (viewport && isAtBottom && !userScrolledUp) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }, [messages, isStreaming, isAtBottom, userScrolledUp]);

  const handleScroll = () => {
    const viewport = getViewport();
    if (viewport) {
      const threshold = 50;
      const atBottom =
        viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <
        threshold;
      setIsAtBottom(atBottom);
      if (!atBottom && viewport.scrollTop > 0) {
        setUserScrolledUp(true);
      } else if (atBottom) {
        setUserScrolledUp(false);
      }
    }
  };

  const scrollToBottom = () => {
    const viewport = getViewport();
    if (viewport) {
      viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
      setUserScrolledUp(false);
      setIsAtBottom(true);
    }
  };

  const safeMessages = useMemo(
    () => (Array.isArray(messages) ? messages : []),
    [messages],
  );
  const safeModMessageActions = useMemo(
    () => (Array.isArray(modMessageActions) ? modMessageActions : []),
    [modMessageActions],
  );

  const renderedMessages = useMemo(() => {
    return safeMessages.map((message, index) => (
      // Use MemoizedMessageBubble if that's the correct export
      <MemoizedMessageBubble
        key={message.id || `msg-${index}`}
        message={message}
        // REMOVE isStreaming prop as it's not accepted by MessageBubbleProps
        // isStreaming={
        //   isStreaming &&
        //   index === safeMessages.length - 1 &&
        //   message.role === "assistant"
        // }
        onRegenerate={regenerateMessage} // Pass regenerate as onRegenerate
        getContextSnapshotForMod={getContextSnapshotForMod}
        modMessageActions={safeModMessageActions}
        enableStreamingMarkdown={enableStreamingMarkdown}
        // level prop is optional in MessageBubble, defaults to 0
      />
    ));
  }, [
    safeMessages,
    // isStreaming, // Remove dependency if prop is removed
    regenerateMessage,
    getContextSnapshotForMod,
    safeModMessageActions,
    enableStreamingMarkdown,
  ]);

  return (
    <div className={cn("relative flex-1 overflow-hidden", className)}>
      <ScrollArea
        className="h-full w-full"
        ref={scrollAreaRef}
        onScroll={handleScroll}
      >
        <div className="px-4 py-4 md:px-6 md:py-6 space-y-4">
          {isLoadingMessages ? (
            <div className="space-y-4">
              <Skeleton className="h-16 w-3/4" />
              <Skeleton className="h-16 w-1/2 ml-auto" />
              <Skeleton className="h-24 w-3/4" />
            </div>
          ) : safeMessages.length === 0 ? (
            <EmptyContent />
          ) : (
            renderedMessages
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>
      {!isAtBottom && userScrolledUp && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-4 right-4 z-10 bg-primary text-primary-foreground rounded-full p-2 shadow-lg hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-opacity animate-fadeIn"
          aria-label="Scroll to bottom"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="w-5 h-5"
          >
            <path
              fillRule="evenodd"
              d="M10 3a.75.75 0 01.75.75v10.532l2.47-2.47a.75.75 0 111.06 1.06l-3.75 3.75a.75.75 0 01-1.06 0l-3.75-3.75a.75.75 0 111.06-1.06l2.47 2.47V3.75A.75.75 0 0110 3z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      )}
    </div>
  );
};

export const ChatContent = React.memo(ChatContentComponent);
