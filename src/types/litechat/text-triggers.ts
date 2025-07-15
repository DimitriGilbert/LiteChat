// src/types/litechat/text-triggers.ts
import type { PromptTurnObject } from './prompt';

export interface TextTrigger {
  id: string;
  namespace: string;
  method: string;
  args: string[];
  startIndex: number;
  endIndex: number;
  isValid: boolean;
  errorMessage?: string;
}

export interface TriggerParseResult {
  triggers: TextTrigger[];
  cleanedText: string; // Text with triggers removed
  hasInvalidTriggers: boolean;
}

export interface TriggerExecutionContext {
  turnData: PromptTurnObject;
  promptText: string;
}

export interface TriggerMethod {
  id: string;
  name: string;
  description: string;
  argSchema: TriggerArgSchema;
  handler: (args: string[], context: TriggerExecutionContext) => Promise<void>;
}

export interface TriggerArgSchema {
  minArgs: number;
  maxArgs: number;
  argTypes: readonly ('string' | 'number' | 'boolean' | 'tool-id' | 'rule-id' | 'model-id')[];
  /**
   * Provide suggestions for the current argument position.
   * @param context - The trigger execution context (prompt, turn, etc.)
   * @param argumentIndex - The index of the argument being completed (0-based)
   * @param currentArgs - The arguments already typed so far
   */
  suggestions?: (context: TriggerExecutionContext, argumentIndex: number, currentArgs: string[]) => string[];
}

export interface TriggerNamespace {
  id: string;
  name: string;
  methods: Record<string, TriggerMethod>;
  moduleId: string; // Which control module registered this
}

// Shared autocomplete suggestion types for text trigger argument completion
export type MethodSuggestion = {
  type: 'method';
  namespace: string;
  method: string;
  description: string;
};
export type ArgSuggestion = {
  type: 'arg';
  value: string;
  description: string;
};
export type AutocompleteSuggestion = MethodSuggestion | ArgSuggestion;