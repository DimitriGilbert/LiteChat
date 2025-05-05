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
// UIStateStore import removed
import { useInputStore } from "@/store/input.store";
// useShallow removed
import type { InputAreaRef } from "@/types/litechat/prompt";

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
      }));

      // focusInputOnNextRender logic removed

      const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey && !disabled) {
          e.preventDefault();
          const hasFiles =
            useInputStore.getState().attachedFilesMetadata.length > 0;
          if (internalValue.trim().length > 0 || hasFiles) {
            onSubmit();
            setInternalValue("");
            if (onValueChange) {
              onValueChange("");
            }
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
      };

      useEffect(() => {
        const textarea = internalTextareaRef.current;
        if (textarea) {
          textarea.style.height = "auto";
          const scrollHeight = textarea.scrollHeight;
          const maxHeight = 250;
          textarea.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
          textarea.style.overflowY =
            scrollHeight > maxHeight ? "auto" : "hidden";
        }
      }, [internalValue]);

      useEffect(() => {
        setInternalValue(initialValue);
        if (onValueChange) {
          onValueChange(initialValue);
        }
      }, [initialValue, onValueChange]);

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
            "min-h-[40px] max-h-[250px]",
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
