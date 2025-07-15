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

import type { TextTrigger, MethodSuggestion, AutocompleteSuggestion } from '@/types/litechat/text-triggers';
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
      const { t } = useTranslation('prompt');
      if (!placeholder || placeholder === "") {
        placeholder = t('inputAreaPlaceholder');
      }

      // Initialize parser service and register namespaces
      const parserService = new TextTriggerParserService(
        settings.textTriggerStartDelimiter,
        settings.textTriggerEndDelimiter
      );
      
      // Parser service now gets namespaces directly from the control registry
      const controlRegistry = useControlRegistryStore();

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
              const minHeight = 84; // 3 lines
              const maxHeight = 250;
              
              textarea.style.height = "auto";
              const scrollHeight = Math.max(textarea.scrollHeight, minHeight);
              textarea.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
              textarea.style.overflowY =
                scrollHeight > maxHeight ? "auto" : "hidden";
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
              const minHeight = 84; // 3 lines
              
              textarea.style.height = "auto";
              textarea.style.height = `${minHeight}px`;
              textarea.style.overflowY = "hidden";
            }
          });
        },
      }));

      // Keyboard navigation state for autocomplete
      const [autocompleteIndex, setAutocompleteIndex] = useState(0);

      const getAutocompleteSuggestions = (): AutocompleteSuggestion[] => {
        const textBeforeCursor = internalValue.slice(0, cursorPosition);
        // Pattern for argument completion: @.namespace.method arg1 arg2 ...
        const argPattern = /@\.([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)\s+([^;]*)$/;
        const argMatch = textBeforeCursor.match(argPattern);
        if (argMatch) {
          const namespaceId = argMatch[1];
          const methodId = argMatch[2];
          const argsStr = argMatch[3] || '';
          const registeredNamespaces = controlRegistry.getTextTriggerNamespaces();
          const namespace = Object.values(registeredNamespaces).find(ns => ns.id === namespaceId);
          if (!namespace) return [];
          const method = namespace.methods[methodId];
          if (!method) return [];
          const args = argsStr.trim().length > 0 ? argsStr.split(/\s+/) : [];
          if (method.argSchema && method.argSchema.suggestions) {
            const suggestions = method.argSchema.suggestions(
              { turnData: { id: '', content: internalValue, parameters: {}, metadata: {} }, promptText: internalValue },
              args.length,
              args
            );
            
            // Filter suggestions based on the current partial argument being typed
            let filteredSuggestions = suggestions;
            if (args.length > 0) {
              const currentArg = args[args.length - 1].toLowerCase();
              filteredSuggestions = suggestions.filter(s => 
                s.toLowerCase().startsWith(currentArg)
              );
            }
            
            return filteredSuggestions.map(s => ({
              type: 'arg' as const,
              value: s,
              description: '',
            }));
          }
        }
        // Fallback: method/namespace completion
        const triggerMatch = textBeforeCursor.match(/@\.([a-zA-Z]*)$/);
        if (!triggerMatch) return [];
        const partial = triggerMatch[1].toLowerCase();
        const registeredNamespaces = controlRegistry.getTextTriggerNamespaces();
        const namespaces = Object.values(registeredNamespaces);
        const suggestions: Array<MethodSuggestion> = [];
        namespaces.forEach(namespace => {
          Object.values(namespace.methods).forEach(method => {
            const argExample = method.argSchema.minArgs > 0 
              ? ` ${method.argSchema.argTypes.slice(0, method.argSchema.minArgs).join(' ')}`
              : '';
            suggestions.push({
              type: 'method',
              namespace: namespace.id,
              method: method.id,
              description: `${method.description}${argExample ? ` | Example: @.${namespace.id}.${method.id}${argExample};` : ` | Example: @.${namespace.id}.${method.id};`}`
            });
          });
        });
        if (partial === '') {
          return suggestions;
        }
        return suggestions.filter(s => 
          s.namespace.startsWith(partial) || 
          s.method.startsWith(partial) ||
          `${s.namespace}.${s.method}`.includes(partial)
        );
      };

      const autocompleteSuggestions = getAutocompleteSuggestions();
      useEffect(() => {
        setAutocompleteIndex(0);
      }, [showAutocomplete, internalValue, cursorPosition]);

      const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (showAutocomplete && autocompleteSuggestions.length > 0) {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setAutocompleteIndex((prev) => (prev + 1) % autocompleteSuggestions.length);
            return;
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            setAutocompleteIndex((prev) => (prev - 1 + autocompleteSuggestions.length) % autocompleteSuggestions.length);
            return;
          }
          if (e.key === "Enter" || e.key === "Tab") {
            e.preventDefault();
            const suggestion = autocompleteSuggestions[autocompleteIndex];
            if (suggestion) {
              if (suggestion.type === 'method') {
                handleAutocompleteSelect(suggestion);
              } else if (suggestion.type === 'arg') {
                // Insert argument suggestion at cursor (same as keyboard handler)
                const textBeforeCursor = internalValue.slice(0, cursorPosition);
                const argPattern = /@\.[a-zA-Z0-9_]+\.[a-zA-Z0-9_]+\s+([^;]*)$/;
                const argMatch = textBeforeCursor.match(argPattern);
                let insertPos = cursorPosition;
                if (argMatch) {
                  const argsStr = argMatch[1] || '';
                  const args = argsStr.split(/\s+/);
                  const lastArg = args[args.length - 1];
                  if (lastArg && !textBeforeCursor.endsWith(' ')) {
                    insertPos = cursorPosition - lastArg.length;
                  }
                }
                const newValue =
                  internalValue.slice(0, insertPos) +
                  suggestion.value +
                  ' ' +
                  internalValue.slice(cursorPosition);
                setInternalValue(newValue);
                setPromptInputValue(newValue);
                parseTriggers(newValue);
                if (onValueChange) {
                  onValueChange(newValue);
                }
                setShowAutocomplete(false);
                setTimeout(() => {
                  const textarea = internalTextareaRef.current;
                  if (textarea) {
                    const newCursorPos = insertPos + suggestion.value.length + 1;
                    textarea.setSelectionRange(newCursorPos, newCursorPos);
                    textarea.focus();
                  }
                }, 0);
              }
            }
            return;
          }
          if (e.key === "Escape") {
            e.preventDefault();
            setShowAutocomplete(false);
            return;
          }
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

        // Check for autocomplete - show when typing after @. OR when typing arguments
        const textBeforeCursor = newValue.slice(0, cursorPos);
        const triggerMatch = textBeforeCursor.match(/@\.([a-zA-Z]*)$/);
        const argMatch = textBeforeCursor.match(/@\.([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)\s+([^;]*)$/);
        setShowAutocomplete((!!triggerMatch && triggerMatch[1].length >= 0) || !!argMatch);
      };

      useEffect(() => {
        const textarea = internalTextareaRef.current;
        if (textarea) {
          const minHeight = 84; // 3 lines
          const maxHeight = 250;
          
          textarea.style.height = "auto";
          const scrollHeight = Math.max(textarea.scrollHeight, minHeight);
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

      // Listen for setInputTextRequest events (restore main branch pattern)
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
              const minHeight = 84; // 3 lines
              const maxHeight = 250;
              textarea.style.height = "auto";
              const scrollHeight = Math.max(textarea.scrollHeight, minHeight);
              textarea.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
              textarea.style.overflowY =
                scrollHeight > maxHeight ? "auto" : "hidden";
            }
          });
        };
        emitter.on(promptEvent.setInputTextRequest, handleSetInputText);
        return () => {
          emitter.off(promptEvent.setInputTextRequest, handleSetInputText);
        };
      }, [onValueChange, setPromptInputValue]);

      const renderHighlightedText = () => {
        if (!settings.textTriggersEnabled || triggers.length === 0) {
          return null;
        }

        let lastIndex = 0;
        const parts: React.ReactNode[] = [];

        triggers.forEach((trigger, index) => {
          // Add text before trigger (transparent)
          if (trigger.startIndex > lastIndex) {
            parts.push(
              <span key={`text-${index}`} className="text-transparent">
                {internalValue.slice(lastIndex, trigger.startIndex)}
              </span>
            );
          }

          // Add highlighted trigger with underline styling
          const triggerText = internalValue.slice(trigger.startIndex, trigger.endIndex);
          parts.push(
            <span
              key={`trigger-${index}`}
              className={cn(
                "relative",
                trigger.isValid 
                  ? "text-transparent underline decoration-primary decoration-2 underline-offset-2" 
                  : "text-transparent underline decoration-destructive decoration-2 underline-offset-2"
              )}
              title={trigger.errorMessage || `${trigger.namespace}.${trigger.method}`}
            >
              {triggerText}
            </span>
          );

          lastIndex = trigger.endIndex;
        });

        // Add remaining text (transparent)
        if (lastIndex < internalValue.length) {
          parts.push(
            <span key="text-end" className="text-transparent">
              {internalValue.slice(lastIndex)}
            </span>
          );
        }

        return parts;
      };

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
        <div className="relative w-full flex-grow">
          {/* Highlighting overlay */}
          {settings.textTriggersEnabled && triggers.length > 0 && (
            <div
              ref={highlightRef}
              style={{
                height: '84px',
                minHeight: '84px',
                maxHeight: '250px',
                fontSize: 'inherit',
                fontFamily: 'inherit',
                lineHeight: 'inherit',
                letterSpacing: 'inherit',
                wordSpacing: 'inherit',
                padding: '12px',
                margin: '0',
                border: '1px solid transparent',
                borderRadius: '6px',
              }}
              className={cn(
                "absolute inset-0 pointer-events-none whitespace-pre-wrap break-words z-0",
                "overflow-y-auto overflow-x-hidden",
                "bg-transparent"
              )}
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
            rows={3}
            style={{
              height: '84px',
              minHeight: '84px',
              maxHeight: '250px',
              width: '100%'
            }}
            className={cn(
              "w-full p-3 border rounded resize-none focus:ring-2 focus:ring-primary outline-none disabled:opacity-50 overflow-y-auto relative z-10",
              "bg-input text-foreground",
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
            <div
              className="absolute bottom-full left-0 w-full max-w-md mb-1 bg-popover border border-border rounded-md shadow-lg z-20 max-h-64 overflow-y-auto"
              role="listbox"
              aria-label="Text trigger suggestions"
            >
              {autocompleteSuggestions.map((suggestion, idx) => (
                <div
                  key={suggestion.type === 'method' ? `${suggestion.namespace}.${suggestion.method}` : suggestion.value || idx}
                  className={cn(
                    "flex flex-col gap-0.5 p-2 cursor-pointer border-b border-border last:border-b-0 transition-colors",
                    idx === autocompleteIndex ? "bg-accent/80 text-primary" : "hover:bg-accent/60",
                    suggestion.type === 'arg' ? "pl-6" : ""
                  )}
                  role="option"
                  aria-selected={idx === autocompleteIndex}
                  tabIndex={-1}
                  onMouseEnter={() => setAutocompleteIndex(idx)}
                  onClick={() => {
                    if (suggestion.type === 'method') {
                      handleAutocompleteSelect(suggestion);
                    } else if (suggestion.type === 'arg') {
                      // Insert argument suggestion at cursor (same as keyboard handler)
                      const textBeforeCursor = internalValue.slice(0, cursorPosition);
                      const argPattern = /@\.[a-zA-Z0-9_]+\.[a-zA-Z0-9_]+\s+([^;]*)$/;
                      const argMatch = textBeforeCursor.match(argPattern);
                      let insertPos = cursorPosition;
                      if (argMatch) {
                        const argsStr = argMatch[1] || '';
                        const args = argsStr.split(/\s+/);
                        const lastArg = args[args.length - 1];
                        if (lastArg && !textBeforeCursor.endsWith(' ')) {
                          insertPos = cursorPosition - lastArg.length;
                        }
                      }
                      const newValue =
                        internalValue.slice(0, insertPos) +
                        suggestion.value +
                        ' ' +
                        internalValue.slice(cursorPosition);
                      setInternalValue(newValue);
                      setPromptInputValue(newValue);
                      parseTriggers(newValue);
                      if (onValueChange) {
                        onValueChange(newValue);
                      }
                      setShowAutocomplete(false);
                      setTimeout(() => {
                        const textarea = internalTextareaRef.current;
                        if (textarea) {
                          const newCursorPos = insertPos + suggestion.value.length + 1;
                          textarea.setSelectionRange(newCursorPos, newCursorPos);
                          textarea.focus();
                        }
                      }, 0);
                    }
                  }}
                >
                  {suggestion.type === 'method' ? (
                    <>
                      <div className="font-medium text-sm">
                        @.{suggestion.namespace}.{suggestion.method}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {suggestion.description}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="font-semibold text-sm truncate">{suggestion.value}</div>
                      <div className="text-xs text-muted-foreground truncate">{suggestion.description}</div>
                      {/* Optionally, add a preview or context here if available */}
                    </>
                  )}
                </div>
              ))}
              {autocompleteSuggestions.length === 0 && (
                <div className="p-2 text-sm text-muted-foreground">
                  No suggestions found
                </div>
              )}
              {/* Footer/help for argument suggestions */}
              {autocompleteSuggestions.length > 0 && autocompleteSuggestions[0].type === 'arg' && (
                <div className="px-3 py-1 text-xs text-muted-foreground border-t border-border bg-popover/80 rounded-b-md">
                  Tab/Enter to insert, Esc to close, ↑/↓ to navigate
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
