// src/components/LiteChat/prompt/InputArea.tsx
// FULL FILE
import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useEffect,
  useState,
  memo,
} from "react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useInputStore } from "@/store/input.store";
import type { InputAreaRef } from "@/types/litechat/prompt";
import { emitter } from "@/lib/litechat/event-emitter";
import { ModEvent } from "@/types/litechat/modding";

interface InputAreaProps {
  initialValue?: string;
  onSubmit: () => void;
  disabled?: boolean;
  placeholder?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  [key: string]: any;
}

export const InputArea = memo(
  forwardRef<InputAreaRef, InputAreaProps>(
    (
      {
        initialValue = "",
        onSubmit,
        disabled,
        placeholder = "Type message... (Shift+Enter for new line)",
        className,
        onValueChange,
        ...rest
      },
      ref,
    ) => {
      const internalTextareaRef = useRef<HTMLTextAreaElement>(null);
      const [internalValue, setInternalValue] = useState(initialValue);

      // Expose methods via ref
      useImperativeHandle(ref, () => ({
        getValue: () => internalValue,
        focus: () => internalTextareaRef.current?.focus(),
        // Implement clearValue
        clearValue: () => {
          setInternalValue("");
          if (onValueChange) {
            onValueChange(""); // Notify parent about the change
          }
          // Manually trigger resize after clearing
          requestAnimationFrame(() => {
            const textarea = internalTextareaRef.current;
            if (textarea) {
              textarea.style.height = "auto"; // Reset height before calculating
              textarea.style.height = `${textarea.scrollHeight}px`;
              textarea.style.overflowY = "hidden"; // Reset overflow
            }
          });
        },
      }));

      const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey && !disabled) {
          e.preventDefault();
          const hasFiles =
            useInputStore.getState().attachedFilesMetadata.length > 0;
          if (internalValue.trim().length > 0 || hasFiles) {
            onSubmit();
            // Clear value using the ref's method to ensure consistency
            // @ts-expect-error yeah sure !
            ref?.current?.clearValue();
          }
        }
      };

      const handleTextareaChange = (
        e: React.ChangeEvent<HTMLTextAreaElement>,
      ) => {
        const newValue = e.target.value;
        setInternalValue(newValue);
        if (onValueChange) {
          onValueChange(newValue);
        }
        // Emit event on every change
        emitter.emit(ModEvent.PROMPT_INPUT_CHANGE, { value: newValue });
      };

      // Auto-resize logic
      useEffect(() => {
        const textarea = internalTextareaRef.current;
        if (textarea) {
          textarea.style.height = "auto"; // Reset height
          const scrollHeight = textarea.scrollHeight;
          const maxHeight = 250; // Max height in pixels
          textarea.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
          textarea.style.overflowY =
            scrollHeight > maxHeight ? "auto" : "hidden";
        }
      }, [internalValue]); // Re-run only when internalValue changes

      // Sync with initialValue prop if it changes externally
      useEffect(() => {
        if (initialValue !== internalValue) {
          setInternalValue(initialValue);
          if (onValueChange) {
            onValueChange(initialValue);
          }
        }
        // Only run when initialValue changes
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [initialValue]);

      return (
        <Textarea
          ref={internalTextareaRef}
          value={internalValue}
          onChange={handleTextareaChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder}
          rows={1}
          className={cn(
            "w-full p-3 border rounded bg-input text-foreground resize-none focus:ring-2 focus:ring-primary outline-none disabled:opacity-50 overflow-y-auto",
            "min-h-[40px] max-h-[250px]", // Use min/max height for control
            className,
          )}
          aria-label="Chat input"
          {...rest}
        />
      );
    },
  ),
);

InputArea.displayName = "InputArea";
