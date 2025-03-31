import React, { useRef, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area"; // Assuming shadcn/ui
import { MemoizedMessageBubble } from "./message-bubble";
import { useChatContext } from "@/context/chat-context";
import { Skeleton } from "@/components/ui/skeleton"; // Assuming shadcn/ui
import { AlertCircle } from "lucide-react";

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

  // Scroll to bottom when messages change or streaming starts/stops
  useEffect(() => {
    scrollToBottom();
  }, [messages, isStreaming]);

  // Handle regeneration (example)
  const handleRegenerate = (messageId: string) => {
    regenerateMessage(messageId);
  };

  return (
    <ScrollArea className={`flex-grow h-0 ${className}`} ref={scrollAreaRef}>
      <div className="p-4 space-y-4">
        {isLoading && (
          <>
            <Skeleton className="h-16 w-3/4 mb-2" />
            <Skeleton className="h-20 w-1/2 mb-2 ml-auto" />
            <Skeleton className="h-12 w-2/3 mb-2" />
          </>
        )}
        {!isLoading && messages.length === 0 && (
          <div className="text-center text-muted-foreground mt-8">
            No messages yet. Start chatting!
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
              {/* Display message-specific error */}
              {message.error && (
                <div className="flex items-center gap-2 text-xs text-destructive ml-10 -mt-2 mb-2">
                  <AlertCircle className="h-4 w-4" />
                  <span>{message.error}</span>
                </div>
              )}
            </div>
          ))}
        <div ref={messagesEndRef} />
      </div>
    </ScrollArea>
  );
};
