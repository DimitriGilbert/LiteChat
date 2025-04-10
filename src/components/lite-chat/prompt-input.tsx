import React, { useRef, useEffect, useCallback } from "react";
import { Textarea } from "@/components/ui/textarea";
import { useCoreChatContext } from "@/context/core-chat-context";
import { cn } from "@/lib/utils";

interface PromptInputProps {
  className?: string;
  selectedConversationId: string | null;
  handleSubmit: () => void;
}

export const PromptInput: React.FC<PromptInputProps> = ({
  className,
  selectedConversationId,
  handleSubmit,
}) => {
  const { prompt, setPrompt, isStreaming, messages } = useCoreChatContext();

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const isModKey = e.metaKey || e.ctrlKey;

      if (e.key === "Enter" && (isModKey || !e.shiftKey) && !isStreaming) {
        e.preventDefault();
        if (prompt.trim()) {
          handleSubmit();
        }
        return;
      }

      if (
        e.key === "ArrowUp" &&
        !prompt &&
        selectedConversationId &&
        messages.length > 0
      ) {
        const lastUserMessage = [...messages]
          .reverse()
          .find((m) => m.role === "user");
        if (lastUserMessage) {
          e.preventDefault();
          setPrompt(lastUserMessage.content);
        }
      }

      if (
        e.key === "Escape" &&
        document.activeElement !== textareaRef.current
      ) {
        e.preventDefault();
        textareaRef.current?.focus();
      }
    },
    [
      prompt,
      isStreaming,
      handleSubmit,
      setPrompt,
      messages,
      selectedConversationId,
    ],
  );

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      const scrollHeight = textarea.scrollHeight;
      const maxHeight = 200;
      textarea.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
    }
  }, [prompt]);

  return (
    <Textarea
      ref={textareaRef}
      value={prompt}
      onChange={(e) => setPrompt(e.target.value)}
      onKeyDown={handleKeyDown}
      placeholder="Type a message... (Shift+Enter for new line)"
      className={cn(
        "flex-grow resize-none rounded-md border border-gray-700 bg-gray-800 px-4 py-3 text-base shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 disabled:cursor-not-allowed disabled:opacity-50 text-gray-200",
        "min-h-[60px] max-h-[200px]",
        className,
      )}
      rows={3}
      disabled={isStreaming}
      aria-label="Chat input"
    />
  );
};
