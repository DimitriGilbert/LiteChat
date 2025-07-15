// src/services/text-trigger-parser.service.ts
import type { 
  TextTrigger, 
  TriggerParseResult, 
  TriggerExecutionContext, 
  TriggerNamespace 
} from '@/types/litechat/text-triggers';

export class TextTriggerParserService {
  private triggerPattern!: RegExp;
  private registeredNamespaces: Map<string, TriggerNamespace> = new Map();

  constructor(
    private startDelimiter = "@.",
    private endDelimiter = ";"
  ) {
    this.updatePattern();
  }

  private updatePattern(): void {
    // Escape special regex characters
    const escapedStart = this.startDelimiter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escapedEnd = this.endDelimiter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // Pattern: @.namespace.method args;
    this.triggerPattern = new RegExp(
      `${escapedStart}([a-zA-Z][a-zA-Z0-9_]*)\\.([a-zA-Z][a-zA-Z0-9_]*)(?:\\s+([^${escapedEnd}]*))?${escapedEnd}`,
      'g'
    );
  }

  parseText(text: string): TriggerParseResult {
    const triggers: TextTrigger[] = [];
    let hasInvalidTriggers = false;
    let match;

    this.triggerPattern.lastIndex = 0; // Reset regex state

    while ((match = this.triggerPattern.exec(text)) !== null) {
      const [fullMatch, namespace, method, argsStr] = match;
      const args = argsStr ? argsStr.trim().split(/\s+/).filter(arg => arg.length > 0) : [];
      
      const trigger: TextTrigger = {
        id: `${namespace}.${method}_${match.index}`,
        namespace,
        method,
        args,
        startIndex: match.index,
        endIndex: match.index + fullMatch.length,
        isValid: true,
        errorMessage: undefined
      };

      // Validate trigger
      const validationResult = this.validateTrigger(trigger);
      trigger.isValid = validationResult.isValid;
      trigger.errorMessage = validationResult.errorMessage;

      if (!trigger.isValid) {
        hasInvalidTriggers = true;
      }

      triggers.push(trigger);
    }

    // Remove triggers from text (from end to start to preserve indices)
    let cleanedText = text;
    for (let i = triggers.length - 1; i >= 0; i--) {
      const trigger = triggers[i];
      cleanedText = cleanedText.slice(0, trigger.startIndex) + cleanedText.slice(trigger.endIndex);
    }

    return {
      triggers,
      cleanedText: cleanedText.trim(),
      hasInvalidTriggers
    };
  }

  private validateTrigger(trigger: TextTrigger): { isValid: boolean; errorMessage?: string } {
    const namespace = this.registeredNamespaces.get(trigger.namespace);
    
    if (!namespace) {
      return { 
        isValid: false, 
        errorMessage: `Unknown namespace: ${trigger.namespace}` 
      };
    }

    const method = namespace.methods[trigger.method];
    if (!method) {
      return { 
        isValid: false, 
        errorMessage: `Unknown method: ${trigger.method} in namespace ${trigger.namespace}` 
      };
    }

    const { argSchema } = method;
    if (trigger.args.length < argSchema.minArgs) {
      return { 
        isValid: false, 
        errorMessage: `Too few arguments. Expected at least ${argSchema.minArgs}, got ${trigger.args.length}` 
      };
    }

    if (trigger.args.length > argSchema.maxArgs) {
      return { 
        isValid: false, 
        errorMessage: `Too many arguments. Expected at most ${argSchema.maxArgs}, got ${trigger.args.length}` 
      };
    }

    return { isValid: true };
  }

  registerNamespace(namespace: TriggerNamespace): void {
    this.registeredNamespaces.set(namespace.id, namespace);
  }

  unregisterNamespace(namespaceId: string): void {
    this.registeredNamespaces.delete(namespaceId);
  }

  async executeTriggersAndCleanText(text: string, context: TriggerExecutionContext): Promise<string> {
    const parseResult = this.parseText(text);
    
    if (parseResult.triggers.length === 0) {
      return text;
    }

    // Execute triggers
    for (const trigger of parseResult.triggers) {
      if (!trigger.isValid) {
        console.warn(`[TextTriggerParser] Skipping invalid trigger: ${trigger.errorMessage}`);
        continue;
      }

      try {
        await this.executeTrigger(trigger, context);
      } catch (error) {
        console.error(`[TextTriggerParser] Error executing trigger ${trigger.id}:`, error);
      }
    }

    return parseResult.cleanedText;
  }

  private async executeTrigger(trigger: TextTrigger, context: TriggerExecutionContext): Promise<void> {
    const namespace = this.registeredNamespaces.get(trigger.namespace);
    if (!namespace) {
      throw new Error(`Namespace ${trigger.namespace} not found`);
    }

    const method = namespace.methods[trigger.method];
    if (!method) {
      throw new Error(`Method ${trigger.method} not found in namespace ${trigger.namespace}`);
    }

    await method.handler(trigger.args, context);
  }

  updateDelimiters(start: string, end: string): void {
    this.startDelimiter = start;
    this.endDelimiter = end;
    this.updatePattern();
  }

  getRegisteredNamespaces(): TriggerNamespace[] {
    return Array.from(this.registeredNamespaces.values());
  }
}