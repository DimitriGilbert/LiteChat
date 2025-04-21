// src/components/lite-chat/prompt/prompt-input.tsx
import React, { useRef, useEffect, useCallback } from "react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

// Define props based on what PromptForm passes down
interface PromptInputProps {
  className?: string;
  prompt: string;
  setPrompt: (value: string) => void; // Use the prop setter type
  isStreaming: boolean;
}

// Wrap component logic in a named function for React.memo
const PromptInputComponent: React.FC<PromptInputProps> = ({
  className,
  prompt, // Use prop
  setPrompt, // Use prop
  isStreaming, // Use prop
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Internal logic remains the same, uses props
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const isModKey = e.metaKey || e.ctrlKey;

      if (e.key === "Enter" && (isModKey || !e.shiftKey)) {
        e.preventDefault();
        const form = textareaRef.current?.closest("form");
        form?.requestSubmit();
        return;
      }
      if (
        e.key === "Escape" &&
        document.activeElement !== textareaRef.current
      ) {
        e.preventDefault();
        textareaRef.current?.focus();
      }
    },
    [],
  );

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      const scrollHeight = textarea.scrollHeight;
      const maxHeight = 200; // Or get from config/props if needed
      textarea.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
    }
  }, [prompt]); // Depend on prop

  return (
    <Textarea
      ref={textareaRef}
      value={prompt} // Use prop
      onChange={(e) => setPrompt(e.target.value)} // Use prop action
      onKeyDown={handleKeyDown}
      placeholder="Type a message... (Shift+Enter for new line)"
      className={cn(
        "flex-grow resize-none rounded-md border border-gray-700 bg-gray-800 px-4 py-3 text-base shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 disabled:cursor-not-allowed disabled:opacity-50 text-gray-200",
        "min-h-[60px] max-h-[200px]",
        className,
      )}
      rows={3}
      disabled={isStreaming} // Use prop
      aria-label="Chat input"
    />
  );
};

// Export the memoized component
export const PromptInput = React.memo(PromptInputComponent);
