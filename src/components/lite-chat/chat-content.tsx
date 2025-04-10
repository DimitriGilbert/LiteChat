// src/components/lite-chat/chat-content.tsx
import React, { useRef, useEffect, useState, useCallback } from "react"; // Keep useEffect
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { MemoizedMessageBubble } from "./message-bubble";
import { useChatContext } from "@/hooks/use-chat-context";
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
}

// Helper function to find the viewport
const getViewport = (root: HTMLDivElement | null): HTMLDivElement | null => {
  if (!root) return null;
  // Radix typically adds this data attribute to the viewport
  return root.querySelector("[data-radix-scroll-area-viewport]");
};

export const ChatContent: React.FC<ChatContentProps> = ({ className }) => {
  // Destructure 'isLoading' directly, which corresponds to 'isLoadingMessages' in the provider
  const { messages, isLoading, isStreaming, regenerateMessage } =
    useChatContext();
  const scrollAreaRootRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [isAtBottom, setIsAtBottom] = useState(true);
  const [newMessagesWhileScrolledUp, setNewMessagesWhileScrolledUp] =
    useState(false);

  // --- Add Diagnostic Logging ---
  useEffect(() => {
    console.log("[ChatContent] Received messages:", messages);
    console.log("[ChatContent] Received isLoading:", isLoading);
  }, [messages, isLoading]);
  // --- End Diagnostic Logging ---

  // Effect to check if new messages arrived while scrolled up
  useEffect(() => {
    if (!isAtBottom && messages.length > 0) {
      if (!newMessagesWhileScrolledUp) {
        setNewMessagesWhileScrolledUp(true);
      }
    }
  }, [messages, isAtBottom, newMessagesWhileScrolledUp]);

  // Manual scroll function using the viewport found via root ref
  const scrollToBottom = useCallback(() => {
    const viewport = getViewport(scrollAreaRootRef.current);
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
      setIsAtBottom(true);
      setNewMessagesWhileScrolledUp(false);
    }
  }, []); // No dependencies needed

  // Scroll handler attached to the viewport (found via root ref)
  const handleScroll = useCallback(
    throttle(() => {
      const viewport = getViewport(scrollAreaRootRef.current);
      if (viewport) {
        const threshold = 50;
        const atBottom =
          viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <
          threshold;
        setIsAtBottom(atBottom);
        if (atBottom && newMessagesWhileScrolledUp) {
          setNewMessagesWhileScrolledUp(false);
        }
      }
    }, 100),
    [newMessagesWhileScrolledUp],
  );

  // Effect to scroll down automatically ONLY if already at the bottom when new messages arrive
  useEffect(() => {
    const viewport = getViewport(scrollAreaRootRef.current);
    if (viewport && isAtBottom) {
      const timer = setTimeout(() => {
        viewport.scrollTop = viewport.scrollHeight;
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [messages, isAtBottom]); // Run if messages change or if we reach the bottom

  const handleRegenerate = (messageId: string) => {
    regenerateMessage(messageId);
  };

  return (
    <div className={cn("relative flex flex-col", className)}>
      <ScrollArea
        className={cn("flex-grow bg-gray-900", className)}
        onScroll={handleScroll}
        ref={scrollAreaRootRef}
      >
        <div className="py-6 px-4 md:px-6 space-y-6 min-h-full">
          {/* --- Loading / Empty State --- */}
          {/* Check isLoading FIRST */}
          {isLoading && (
            <div className="space-y-4 mt-4">
              <Skeleton className="h-16 w-3/4 bg-gray-800" />
              <Skeleton className="h-20 w-1/2 ml-auto bg-gray-800" />
              <Skeleton className="h-16 w-2/3 bg-gray-800" />
            </div>
          )}
          {/* Check for empty messages only AFTER loading is false */}
          {!isLoading && messages.length === 0 && (
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

          {/* --- Messages Map --- */}
          {/* Map only AFTER loading is false and messages exist */}
          {!isLoading &&
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
                {message.error && (
                  <div className="flex items-center gap-2 text-xs text-red-400 ml-12 -mt-2 mb-2">
                    <AlertCircle className="h-4 w-4" />
                    <span>{message.error}</span>
                  </div>
                )}
              </div>
            ))}
          {/* Target div for scrolling */}
          <div ref={messagesEndRef} className="h-1" />
        </div>
        <ScrollBar orientation="vertical" />
      </ScrollArea>
      {/* --- Scroll Button --- */}
      {(!isAtBottom || newMessagesWhileScrolledUp) && (
        <div className="absolute bottom-4 right-4 z-10">
          <Button
            variant="outline"
            size="icon"
            className="rounded-full h-10 w-10 bg-gray-700/80 hover:bg-gray-600/90 border-gray-600 text-gray-200 backdrop-blur-sm"
            onClick={scrollToBottom}
            title="Scroll to bottom"
          >
            <ArrowDownCircle className="h-5 w-5" />
            {newMessagesWhileScrolledUp && (
              <span className="absolute -top-1 -right-1 block h-3 w-3 rounded-full bg-blue-500 border-2 border-gray-700" />
            )}
          </Button>
        </div>
      )}
    </div>
  );
};
