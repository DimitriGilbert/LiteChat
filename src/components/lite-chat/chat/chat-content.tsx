// src/components/lite-chat/chat-content.tsx
import React, {
  useRef,
  useEffect,
  useState,
  useCallback,
  useLayoutEffect,
} from "react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { MemoizedMessageBubble } from "@/components/lite-chat/message/message-bubble";
import { useCoreChatContext } from "@/context/core-chat-context";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  MessageSquarePlusIcon,
  ArrowDownCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { throttle } from "@/lib/throttle";

interface ChatContentProps {
  className?: string;
  regenerateMessage: (messageId: string) => void;
}

// Threshold for considering the user "at the bottom"
const SCROLL_THRESHOLD = 50;

export const ChatContent: React.FC<ChatContentProps> = ({
  className,
  regenerateMessage,
}) => {
  const { messages, isLoadingMessages, isStreaming } = useCoreChatContext();

  const scrollAreaRootRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null); // Keep this for potential future use

  // Tracks if the user is scrolled near the bottom
  const [isAtBottom, setIsAtBottom] = useState(true);
  // Tracks if new messages arrived while the user was scrolled up
  const [newMessagesWhileScrolledUp, setNewMessagesWhileScrolledUp] =
    useState(false);
  // Stores the scroll height before the last message update
  const prevScrollHeightRef = useRef<number | null>(null);

  const getViewport = (root: HTMLDivElement | null): HTMLDivElement | null => {
    if (!root) return null;
    return root.querySelector("[data-radix-scroll-area-viewport]");
  };

  // --- Scroll Management ---

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const viewport = getViewport(scrollAreaRootRef.current);
    if (viewport) {
      viewport.scrollTo({ top: viewport.scrollHeight, behavior });
      // Immediately update state assuming scroll was successful
      setIsAtBottom(true);
      setNewMessagesWhileScrolledUp(false);
    }
  }, []);

  // Check scroll position and update state
  const checkScrollPosition = useCallback(() => {
    const viewport = getViewport(scrollAreaRootRef.current);
    if (viewport) {
      const atBottom =
        viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <
        SCROLL_THRESHOLD;
      setIsAtBottom(atBottom);
      // If user scrolls back to bottom manually, clear the new message indicator
      if (atBottom && newMessagesWhileScrolledUp) {
        setNewMessagesWhileScrolledUp(false);
      }
    }
  }, [newMessagesWhileScrolledUp]);

  // Throttled version for scroll event handler
  const throttledCheckScrollPosition = throttle(checkScrollPosition, 100);

  // Effect to handle automatic scrolling on new messages/streaming
  useLayoutEffect(() => {
    const viewport = getViewport(scrollAreaRootRef.current);
    if (!viewport) return;

    // Store the scroll height *before* potential DOM updates from new messages
    const currentScrollHeight = viewport.scrollHeight;

    // Determine if user was at the bottom *before* this update
    const wasAtBottom =
      (prevScrollHeightRef.current ?? currentScrollHeight) -
        viewport.scrollTop -
        viewport.clientHeight <
      SCROLL_THRESHOLD;

    // If user was at the bottom, scroll smoothly after the update
    // Use requestAnimationFrame to ensure scroll happens after paint
    if (wasAtBottom) {
      requestAnimationFrame(() => {
        scrollToBottom("smooth");
      });
    } else if (messages.length > 0) {
      // If not at bottom and messages exist, show the indicator
      setNewMessagesWhileScrolledUp(true);
    }

    // Update the previous scroll height for the next check
    prevScrollHeightRef.current = currentScrollHeight;

    // We only want this effect to run when messages change or streaming status changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, isStreaming]); // Rerun when messages array or streaming status changes

  // Effect to check scroll position on initial load or when scrolling stops
  useEffect(() => {
    const viewport = getViewport(scrollAreaRootRef.current);
    if (viewport) {
      // Initial check
      checkScrollPosition();
      // Add scroll listener
      viewport.addEventListener("scroll", throttledCheckScrollPosition);
      return () => {
        // Cleanup listener
        viewport.removeEventListener("scroll", throttledCheckScrollPosition);
      };
    }
  }, [checkScrollPosition, throttledCheckScrollPosition]); // Dependencies for setup/cleanup

  const handleRegenerate = (messageId: string) => {
    regenerateMessage(messageId);
  };

  return (
    <div className={cn("relative flex flex-col", className)}>
      <ScrollArea
        className={cn("flex-grow bg-gray-900", className)}
        // Remove onScroll prop here, handled by direct event listener in useEffect
        ref={scrollAreaRootRef}
      >
        <div className="py-6 px-4 md:px-6 space-y-6 min-h-full">
          {/* --- Loading Skeleton --- */}
          {isLoadingMessages && (
            <div className="space-y-4 mt-4">
              <Skeleton className="h-16 w-3/4 bg-gray-800" />
              <Skeleton className="h-20 w-1/2 ml-auto bg-gray-800" />
              <Skeleton className="h-16 w-2/3 bg-gray-800" />
            </div>
          )}
          {/* --- Empty State --- */}
          {!isLoadingMessages && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] text-center px-4">
              <div className="rounded-full bg-gray-800 p-5 mb-5">
                <MessageSquarePlusIcon className="h-12 w-12 text-gray-400" />
              </div>
              <h3 className="text-xl font-medium mb-3 text-gray-200">
                Start a new conversation
              </h3>
              <p className="text-sm text-gray-400 max-w-md mb-6">
                Ask questions, get information, or have a casual chat with the
                AI assistant.
              </p>
              {/* Example prompts */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-lg">
                <div className="bg-gray-800 p-3 rounded-lg border border-gray-700 text-left">
                  <p className="font-medium text-sm mb-1 text-gray-300">
                    "Explain quantum computing"
                  </p>
                  <p className="text-xs text-gray-500">
                    Get explanations on complex topics
                  </p>
                </div>
                <div className="bg-gray-800 p-3 rounded-lg border border-gray-700 text-left">
                  <p className="font-medium text-sm mb-1 text-gray-300">
                    "Write a poem about nature"
                  </p>
                  <p className="text-xs text-gray-500">
                    Generate creative content
                  </p>
                </div>
              </div>
            </div>
          )}
          {/* --- Messages --- */}
          {!isLoadingMessages &&
            messages.map((message) => (
              <div key={message.id}>
                <MemoizedMessageBubble
                  message={message}
                  onRegenerate={
                    message.role === "assistant" && !message.isStreaming
                      ? handleRegenerate
                      : undefined
                  }
                />
                {/* Error display remains unchanged */}
                {message.error && (
                  <div className="flex items-center gap-2 text-xs text-red-400 ml-12 -mt-2 mb-2">
                    <AlertCircle className="h-4 w-4" />
                    <span>{message.error}</span>
                  </div>
                )}
              </div>
            ))}
          {/* --- End Ref (optional) --- */}
          <div ref={messagesEndRef} className="h-1" />
        </div>
        <ScrollBar orientation="vertical" />
      </ScrollArea>
      {/* --- Scroll to Bottom Button --- */}
      {(!isAtBottom || newMessagesWhileScrolledUp) && (
        <div className="absolute bottom-4 right-4 z-10">
          <Button
            variant="outline"
            size="icon"
            className="rounded-full h-10 w-10 bg-gray-700/80 hover:bg-gray-600/90 border-gray-600 text-gray-200 backdrop-blur-sm"
            onClick={() => scrollToBottom("smooth")} // Use smooth scroll on click
            title="Scroll to bottom"
          >
            <ArrowDownCircle className="h-5 w-5" />
            {/* New message indicator */}
            {newMessagesWhileScrolledUp && (
              <span className="absolute -top-1 -right-1 block h-3 w-3 rounded-full bg-blue-500 border-2 border-gray-700" />
            )}
          </Button>
        </div>
      )}
    </div>
  );
};
