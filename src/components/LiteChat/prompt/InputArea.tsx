// src/components/LiteChat/prompt/InputArea.tsx
import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useEffect,
  useState, // Added useState for internal value management
  memo,
} from "react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useUIStateStore } from "@/store/ui.store";
import { useShallow } from "zustand/react/shallow";

// Define the Ref handle type
export interface InputAreaRef {
  getValue: () => string;
  focus: () => void;
}

interface InputAreaProps {
  // value prop removed - managed internally
  // onChange prop removed - managed internally, value exposed via ref
  initialValue?: string; // Optional initial value
  onSubmit: () => void;
  disabled?: boolean;
  placeholder?: string;
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
      },
      ref,
    ) => {
      const internalTextareaRef = useRef<HTMLTextAreaElement>(null);
      // Internal state for the input value
      const [internalValue, setInternalValue] = useState(initialValue);

      // Expose methods via ref
      useImperativeHandle(ref, () => ({
        getValue: () => internalValue,
        focus: () => internalTextareaRef.current?.focus(),
      }));

      const { focusInputOnNextRender, setFocusInputFlag } = useUIStateStore(
        useShallow((state) => ({
          focusInputOnNextRender: state.focusInputOnNextRender,
          setFocusInputFlag: state.setFocusInputFlag,
        })),
      );

      // Effect to focus the textarea when the flag becomes true
      useEffect(() => {
        if (focusInputOnNextRender && internalTextareaRef.current) {
          setFocusInputFlag(false);
          requestAnimationFrame(() => {
            internalTextareaRef.current?.focus();
          });
        }
      }, [focusInputOnNextRender, setFocusInputFlag]);

      const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey && !disabled) {
          e.preventDefault();
          onSubmit(); // Trigger submit
        }
      };

      // Update internal state on change
      const handleTextareaChange = (
        e: React.ChangeEvent<HTMLTextAreaElement>,
      ) => {
        setInternalValue(e.target.value);
      };

      // Auto-resize effect based on internal value
      useEffect(() => {
        const textarea = internalTextareaRef.current;
        if (textarea) {
          textarea.style.height = "auto";
          const scrollHeight = textarea.scrollHeight;
          const maxHeight = 250;
          textarea.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
        }
      }, [internalValue]); // Depend on internalValue

      // Effect to reset internal value if initialValue changes externally (e.g., after submit clear)
      // This might not be strictly necessary if PromptWrapper clears via ref, but good practice.
      useEffect(() => {
        setInternalValue(initialValue);
      }, [initialValue]);

      return (
        <Textarea
          ref={internalTextareaRef}
          value={internalValue} // Use internal state
          onChange={handleTextareaChange} // Use internal handler
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder}
          rows={3}
          className={cn(
            "w-full p-3 border border-[--border] rounded bg-input text-foreground resize-none focus:ring-2 focus:ring-[--primary] outline-none disabled:opacity-50 overflow-y-auto",
            "min-h-[80px] max-h-[250px]",
          )}
          aria-label="Chat input"
        />
      );
    },
  ),
);

InputArea.displayName = "InputArea";
