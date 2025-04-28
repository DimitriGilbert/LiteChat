// src/components/LiteChat/prompt/InputArea.tsx
import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useEffect,
} from "react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useUIStateStore } from "@/store/ui.store";
import { useShallow } from "zustand/react/shallow";

interface InputAreaProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  placeholder?: string;
  [key: string]: any;
}

// forwardRef is kept in case other features need it, but not used for this focus logic.
export const InputArea = forwardRef<HTMLTextAreaElement, InputAreaProps>(
  (
    {
      value,
      onChange,
      onSubmit,
      disabled,
      placeholder = "Type message... (Shift+Enter for new line)",
    },
    ref,
  ) => {
    const internalTextareaRef = useRef<HTMLTextAreaElement>(null);
    useImperativeHandle(ref, () => internalTextareaRef.current!, []);

    const { focusInputOnNextRender, setFocusInputFlag } = useUIStateStore(
      useShallow((state) => ({
        focusInputOnNextRender: state.focusInputOnNextRender,
        setFocusInputFlag: state.setFocusInputFlag,
      })),
    );

    // Effect to focus the textarea when the flag becomes true
    useEffect(() => {
      if (focusInputOnNextRender && internalTextareaRef.current) {
        // Reset the flag *before* focusing
        setFocusInputFlag(false);
        // Use rAF to ensure focus happens after paint
        requestAnimationFrame(() => {
          internalTextareaRef.current?.focus();
        });
      }
      // Intentionally only run when focusInputOnNextRender changes to true
    }, [focusInputOnNextRender, setFocusInputFlag]); // Added setFocusInputFlag

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey && !disabled) {
        e.preventDefault();
        onSubmit();
      }
    };

    const handleTextareaChange = (
      e: React.ChangeEvent<HTMLTextAreaElement>,
    ) => {
      onChange(e.target.value);
    };

    // Auto-resize effect
    useEffect(() => {
      const textarea = internalTextareaRef.current;
      if (textarea) {
        textarea.style.height = "auto";
        const scrollHeight = textarea.scrollHeight;
        const maxHeight = 250; // Keep max height
        // Set height based on scroll height, but ensure it respects min-h
        textarea.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
      }
    }, [value]);

    return (
      <Textarea
        ref={internalTextareaRef}
        value={value}
        onChange={handleTextareaChange}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder}
        rows={3} // Increase default rows
        className={cn(
          "w-full p-3 border border-[--border] rounded bg-input text-foreground resize-none focus:ring-2 focus:ring-[--primary] outline-none disabled:opacity-50 overflow-y-auto",
          // Set min and max height
          "min-h-[80px] max-h-[250px]",
        )}
        aria-label="Chat input"
      />
    );
  },
);

InputArea.displayName = "InputArea";
