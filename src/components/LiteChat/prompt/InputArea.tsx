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
import { promptEvent } from "@/types/litechat/events/prompt.events";

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
      ref
    ) => {
      const internalTextareaRef = useRef<HTMLTextAreaElement>(null);
      const [internalValue, setInternalValue] = useState(initialValue);

      useImperativeHandle(ref, () => ({
        getValue: () => internalValue,
        setValue: (value: string) => {
          setInternalValue(value);
          if (onValueChange) {
            onValueChange(value);
          }
          emitter.emit(promptEvent.inputChanged, { value });
          requestAnimationFrame(() => {
            const textarea = internalTextareaRef.current;
            if (textarea) {
              textarea.style.height = "auto";
              textarea.style.height = `${textarea.scrollHeight}px`;
              textarea.style.overflowY =
                textarea.scrollHeight > 250 ? "auto" : "hidden";
            }
          });
        },
        focus: () => internalTextareaRef.current?.focus(),
        clearValue: () => {
          setInternalValue("");
          if (onValueChange) {
            onValueChange("");
          }
          emitter.emit(promptEvent.inputChanged, { value: "" });
          requestAnimationFrame(() => {
            const textarea = internalTextareaRef.current;
            if (textarea) {
              textarea.style.height = "auto";
              textarea.style.height = `${textarea.scrollHeight}px`;
              textarea.style.overflowY = "hidden";
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
            // @ts-expect-error - ref.current might be null initially
            ref?.current?.clearValue();
          }
        }
      };

      const handleTextareaChange = (
        e: React.ChangeEvent<HTMLTextAreaElement>
      ) => {
        const newValue = e.target.value;
        setInternalValue(newValue);
        if (onValueChange) {
          onValueChange(newValue);
        }
        emitter.emit(promptEvent.inputChanged, { value: newValue });
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
        if (initialValue !== internalValue) {
          setInternalValue(initialValue);
          if (onValueChange) {
            onValueChange(initialValue);
          }
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
            className
          )}
          aria-label="Chat input"
          {...rest}
        />
      );
    }
  )
);

InputArea.displayName = "InputArea";
