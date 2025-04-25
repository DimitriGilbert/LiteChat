// src/components/LiteChat/prompt/InputArea.tsx
import React from "react";
import type { InputAreaProps } from "@/types/litechat/prompt";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils"; // Import cn for potential class merging

export const InputArea: React.FC<InputAreaProps> = ({
  value,
  onChange,
  onSubmit,
  disabled,
}) => {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !disabled) {
      e.preventDefault();
      onSubmit();
    }
  };

  // This handler receives the full event
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    // Call the passed onChange prop with the extracted value
    onChange(e.target.value);
  };

  // Auto-resize effect
  React.useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto"; // Reset height
      const scrollHeight = textarea.scrollHeight;
      const maxHeight = 200; // Define a max height
      textarea.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
    }
  }, [value]); // Re-run when the value changes

  return (
    <Textarea
      ref={textareaRef}
      value={value}
      // Use the internal handler for the Textarea's onChange
      onChange={handleTextareaChange}
      onKeyDown={handleKeyDown}
      disabled={disabled}
      placeholder="Type message... (Shift+Enter for new line)"
      rows={1}
      className={cn(
        "w-full p-2 border rounded bg-input text-foreground resize-none focus:ring-2 focus:ring-primary outline-none disabled:opacity-50 overflow-y-auto min-h-[40px] max-h-[200px]", // Use overflow-y-auto
      )}
      aria-label="Chat input" // Add accessibility label
    />
  );
};
