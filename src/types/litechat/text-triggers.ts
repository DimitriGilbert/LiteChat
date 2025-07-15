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
  argTypes: ('string' | 'number' | 'boolean' | 'tool-id' | 'rule-id' | 'model-id')[];
  suggestions?: (context: TriggerExecutionContext) => string[];
}

export interface TriggerNamespace {
  id: string;
  name: string;
  methods: Record<string, TriggerMethod>;
  moduleId: string; // Which control module registered this
}