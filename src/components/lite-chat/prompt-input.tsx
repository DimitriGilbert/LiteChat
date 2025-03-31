import React, { useRef, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea"; // Assuming shadcn/ui
import { useChatContext } from "@/context/chat-context";
import { cn } from "@/lib/utils"; // Assuming shadcn/ui utils

interface PromptInputProps {
  className?: string;
}

export const PromptInput: React.FC<PromptInputProps> = ({ className }) => {
  const { prompt, setPrompt, handleSubmit, isStreaming } = useChatContext();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Enter (not Shift+Enter) when not streaming
    if (e.key === "Enter" && !e.shiftKey && !isStreaming) {
      e.preventDefault();
      // Check if prompt is not just whitespace before submitting
      if (prompt.trim()) {
        handleSubmit();
      }
    }
  };

  // Auto-resize textarea height based on content
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      // Reset height to auto to shrink if needed
      textarea.style.height = "auto";
      // Set height based on scroll height, capped at a reasonable max
      const scrollHeight = textarea.scrollHeight;
      const maxHeight = 200; // Example max height (pixels)
      textarea.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
    }
  }, [prompt]); // Re-run when prompt changes

  return (
    <Textarea
      ref={textareaRef}
      value={prompt}
      onChange={(e) => setPrompt(e.target.value)}
      onKeyDown={handleKeyDown}
      placeholder="Type your message here... (Shift+Enter for new line)"
      className={cn(
        "flex-grow resize-none overflow-y-auto rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        "min-h-[60px]", // Ensure a minimum height
        className,
      )}
      rows={1} // Start with one row, auto-resizing will handle expansion
      disabled={isStreaming} // Disable input while AI is responding
      aria-label="Chat input"
    />
  );
};
