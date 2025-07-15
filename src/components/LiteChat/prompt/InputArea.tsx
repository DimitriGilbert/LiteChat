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
import { usePromptInputValueStore } from "@/store/prompt-input-value.store";
import { useTranslation } from "react-i18next";
import { useSettingsStore } from "@/store/settings.store";
import { TextTriggerParserService } from "@/services/text-trigger-parser.service";
import type { TextTrigger, TriggerNamespace } from "@/types/litechat/text-triggers";
import { useControlRegistryStore } from "@/store/control.store";

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
        placeholder = "",
        className,
        onValueChange,
        ...rest
      },
      ref
    ) => {
      const internalTextareaRef = useRef<HTMLTextAreaElement>(null);
      const highlightRef = useRef<HTMLDivElement>(null);
      const [internalValue, setInternalValue] = useState(initialValue);
      const [triggers, setTriggers] = useState<TextTrigger[]>([]);
      const [showAutocomplete, setShowAutocomplete] = useState(false);
      const [cursorPosition, setCursorPosition] = useState(0);
      const setPromptInputValue = usePromptInputValueStore((state) => state.setValue);
      const settings = useSettingsStore();
      const controlRegistry = useControlRegistryStore();
      const { t } = useTranslation('prompt');
      if (!placeholder || placeholder === "") {
        placeholder = t('inputAreaPlaceholder');
      }

      // Initialize parser service and get registered namespaces
      const parserService = new TextTriggerParserService(
        settings.textTriggerStartDelimiter,
        settings.textTriggerEndDelimiter
      );

      // Get the text trigger control module to access registered namespaces
      const getRegisteredNamespaces = (): TriggerNamespace[] => {
        const textTriggerModule = controlRegistry.registeredModules.find(
          m => m.id === "core-text-triggers"
        );
        
        if (!textTriggerModule?.instance) {
          return [];
        }

        // Access the parser service from the module to get registered namespaces
        try {
          return (textTriggerModule.instance as any)?.parserService?.getRegisteredNamespaces?.() || [];
        } catch {
          return [];
        }
      };

      useImperativeHandle(ref, () => ({
        
        getValue: () => internalValue,
        setValue: (value: string) => {
          setInternalValue(value);
          setPromptInputValue(value);
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
          setPromptInputValue("");
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
        if (showAutocomplete && e.key === "Escape") {
          e.preventDefault();
          setShowAutocomplete(false);
          return;
        }

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

      const parseTriggers = (text: string) => {
        if (!settings.textTriggersEnabled) {
          setTriggers([]);
          return;
        }

        try {
          const parseResult = parserService.parseText(text);
          setTriggers(parseResult.triggers);
        } catch (error) {
          console.warn('Error parsing triggers:', error);
          setTriggers([]);
        }
      };

      const handleTextareaChange = (
        e: React.ChangeEvent<HTMLTextAreaElement>
      ) => {
        const newValue = e.target.value;
        const cursorPos = e.target.selectionStart;
        
        setInternalValue(newValue);
        setPromptInputValue(newValue);
        setCursorPosition(cursorPos);
        parseTriggers(newValue);
        
        if (onValueChange) {
          onValueChange(newValue);
        }
        emitter.emit(promptEvent.inputChanged, { value: newValue });

        // Check for autocomplete - show when typing after @.
        const textBeforeCursor = newValue.slice(0, cursorPos);
        const triggerMatch = textBeforeCursor.match(/@\.([a-zA-Z]*)$/);
        setShowAutocomplete(!!triggerMatch && triggerMatch[1].length >= 0);
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
          setPromptInputValue(initialValue);
          if (onValueChange) {
            onValueChange(initialValue);
          }
        }
      }, [initialValue, onValueChange, setPromptInputValue]);

      // Parse triggers when value changes
      useEffect(() => {
        parseTriggers(internalValue);
      }, [internalValue, settings.textTriggersEnabled]);

      const renderHighlightedText = () => {
        if (!settings.textTriggersEnabled || triggers.length === 0) {
          return null;
        }

        let lastIndex = 0;
        const parts: React.ReactNode[] = [];

        triggers.forEach((trigger, index) => {
          // Add text before trigger
          if (trigger.startIndex > lastIndex) {
            parts.push(
              <span key={`text-${index}`}>
                {internalValue.slice(lastIndex, trigger.startIndex)}
              </span>
            );
          }

          // Add highlighted trigger
          const triggerText = internalValue.slice(trigger.startIndex, trigger.endIndex);
          parts.push(
            <span
              key={`trigger-${index}`}
              className={cn(
                "rounded px-1",
                trigger.isValid 
                  ? "bg-primary/20 text-primary border border-primary/30" 
                  : "bg-destructive/20 text-destructive border border-destructive/30"
              )}
              title={trigger.errorMessage || `${trigger.namespace}.${trigger.method}`}
            >
              {triggerText}
            </span>
          );

          lastIndex = trigger.endIndex;
        });

        // Add remaining text
        if (lastIndex < internalValue.length) {
          parts.push(
            <span key="text-end">
              {internalValue.slice(lastIndex)}
            </span>
          );
        }

        return parts;
      };

      const getAutocompleteSuggestions = () => {
        const textBeforeCursor = internalValue.slice(0, cursorPosition);
        const triggerMatch = textBeforeCursor.match(/@\.([a-zA-Z]*)$/);
        
        if (!triggerMatch) return [];

        const partial = triggerMatch[1].toLowerCase();
        const namespaces = getRegisteredNamespaces();
        
        const suggestions: Array<{ namespace: string; method: string; description: string }> = [];
        
        // Build suggestions from registered namespaces
        namespaces.forEach(namespace => {
          Object.values(namespace.methods).forEach(method => {
            suggestions.push({
              namespace: namespace.id,
              method: method.id,
              description: method.description
            });
          });
        });

        if (partial === '') {
          return suggestions; // Show all when just typed @.
        }

        return suggestions.filter(s => 
          s.namespace.startsWith(partial) || 
          s.method.startsWith(partial) ||
          `${s.namespace}.${s.method}`.includes(partial)
        );
      };

      // Listen for setInputTextRequest events
      useEffect(() => {
        const handleSetInputText = (payload: { text: string }) => {
          setInternalValue(payload.text);
          setPromptInputValue(payload.text);
          if (onValueChange) {
            onValueChange(payload.text);
          }
          emitter.emit(promptEvent.inputChanged, { value: payload.text });
          requestAnimationFrame(() => {
            const textarea = internalTextareaRef.current;
            if (textarea) {
              textarea.style.height = "auto";
              textarea.style.height = `${textarea.scrollHeight}px`;
              textarea.style.overflowY =
                textarea.scrollHeight > 250 ? "auto" : "hidden";
            }
          });
        };

        emitter.on(promptEvent.setInputTextRequest, handleSetInputText);
        
        return () => {
          emitter.off(promptEvent.setInputTextRequest, handleSetInputText);
        };
      }, [onValueChange, setPromptInputValue]);

      const handleAutocompleteSelect = (suggestion: { namespace: string; method: string }) => {
        const textBeforeCursor = internalValue.slice(0, cursorPosition);
        const triggerMatch = textBeforeCursor.match(/@\.([a-zA-Z]*)$/);
        
        if (triggerMatch && triggerMatch.index !== undefined) {
          const beforeTrigger = textBeforeCursor.slice(0, triggerMatch.index);
          const afterCursor = internalValue.slice(cursorPosition);
          const newValue = `${beforeTrigger}@.${suggestion.namespace}.${suggestion.method} ${afterCursor}`;
          
          setInternalValue(newValue);
          setPromptInputValue(newValue);
          parseTriggers(newValue);
          if (onValueChange) {
            onValueChange(newValue);
          }
          setShowAutocomplete(false);
          
          // Focus and set cursor position
          setTimeout(() => {
            const textarea = internalTextareaRef.current;
            if (textarea) {
              const newCursorPos = beforeTrigger.length + `@.${suggestion.namespace}.${suggestion.method} `.length;
              textarea.setSelectionRange(newCursorPos, newCursorPos);
              textarea.focus();
            }
          }, 0);
        }
      };

      return (
        <div className="relative">
          {/* Highlighting overlay */}
          {settings.textTriggersEnabled && triggers.length > 0 && (
            <div
              ref={highlightRef}
              className={cn(
                "absolute inset-0 p-3 pointer-events-none whitespace-pre-wrap break-words z-0",
                "min-h-[40px] max-h-[250px] overflow-y-auto",
                "text-transparent bg-transparent border border-transparent rounded"
              )}
              style={{
                font: "inherit",
                lineHeight: "inherit",
                letterSpacing: "inherit",
                wordSpacing: "inherit",
              }}
            >
              {renderHighlightedText()}
            </div>
          )}
          
          {/* Main textarea */}
          <Textarea
            ref={internalTextareaRef}
            value={internalValue}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={placeholder}
            rows={1}
            className={cn(
              "w-full p-3 border rounded resize-none focus:ring-2 focus:ring-primary outline-none disabled:opacity-50 overflow-y-auto relative z-10",
              "min-h-[40px] max-h-[250px]",
              settings.textTriggersEnabled && triggers.length > 0 
                ? "bg-transparent text-foreground" 
                : "bg-input text-foreground",
              className
            )}
            aria-label={t('chatInputAriaLabel')}
            onSelect={(e) => {
              const target = e.target as HTMLTextAreaElement;
              setCursorPosition(target.selectionStart);
            }}
            {...rest}
          />

          {/* Autocomplete dropdown */}
          {showAutocomplete && settings.textTriggersEnabled && (
            <div className="absolute bottom-full left-0 w-full max-w-md mb-1 bg-popover border border-border rounded-md shadow-lg z-20 max-h-48 overflow-y-auto">
              {getAutocompleteSuggestions().map((suggestion) => (
                <div
                  key={`${suggestion.namespace}.${suggestion.method}`}
                  className="p-2 hover:bg-accent cursor-pointer border-b border-border last:border-b-0"
                  onClick={() => handleAutocompleteSelect(suggestion)}
                >
                  <div className="font-medium text-sm">
                    @.{suggestion.namespace}.{suggestion.method}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {suggestion.description}
                  </div>
                </div>
              ))}
              {getAutocompleteSuggestions().length === 0 && (
                <div className="p-2 text-sm text-muted-foreground">
                  No suggestions found
                </div>
              )}
            </div>
          )}
        </div>
      );
    }
  )
);

InputArea.displayName = "InputArea";
