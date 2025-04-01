// src/components/lite-chat/chat-content.tsx
import React, { useRef, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MemoizedMessageBubble } from "./message-bubble";
import { useChatContext } from "@/hooks/use-chat-context";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, MessageSquarePlusIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatContentProps {
  className?: string;
}

export const ChatContent: React.FC<ChatContentProps> = ({ className }) => {
  const { messages, isLoading, isStreaming, regenerateMessage } =
    useChatContext();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isStreaming]);

  const handleRegenerate = (messageId: string) => {
    regenerateMessage(messageId);
  };

  return (
    <ScrollArea
      className={cn("h-full bg-gray-900", className)}
      ref={scrollAreaRef}
    >
      <div className="py-6 px-4 md:px-6 space-y-6 min-h-full">
        {isLoading && (
          <div className="space-y-4 mt-4">
            <Skeleton className="h-16 w-3/4 bg-gray-800" />
            <Skeleton className="h-20 w-1/2 ml-auto bg-gray-800" />
            <Skeleton className="h-16 w-2/3 bg-gray-800" />
          </div>
        )}

        {!isLoading && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] text-center px-4">
            <div className="rounded-full bg-gray-800 p-5 mb-5">
              <MessageSquarePlusIcon className="h-12 w-12 text-gray-400" />
            </div>
            <h3 className="text-xl font-medium mb-3 text-gray-200">
              Start a new conversation
            </h3>
            <p className="text-sm text-gray-400 max-w-md mb-6">
              Ask questions, get information, or have a casual chat with the AI
              assistant.
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
        <div ref={messagesEndRef} className="h-10" />
      </div>
    </ScrollArea>
  );
};
