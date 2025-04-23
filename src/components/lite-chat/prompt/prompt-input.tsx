
import React, { useRef, useEffect, useCallback } from "react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface PromptInputProps {
  className?: string;
  prompt: string;
  setPrompt: (value: string) => void;
  isStreaming: boolean;
}

const PromptInputComponent: React.FC<PromptInputProps> = ({
  className,
  prompt,
  setPrompt,
  isStreaming,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
        "flex-grow resize-none rounded-md border border-border bg-background px-4 py-3 text-base shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 text-foreground transition-all",
        "min-h-[60px] max-h-[200px]",
        className,
      )}
      rows={3}
      disabled={isStreaming}
      aria-label="Chat input"
    />
  );
};

export const PromptInput = React.memo(PromptInputComponent);
