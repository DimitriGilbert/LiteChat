// src/services/text-trigger-parser.service.ts
import type { 
  TextTrigger, 
  TriggerParseResult, 
  TriggerExecutionContext, 
  TriggerNamespace 
} from '@/types/litechat/text-triggers';
import { useControlRegistryStore } from '@/store/control.store';

export class TextTriggerParserService {
  private triggerPattern!: RegExp;

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
    
    // Pattern: @.namespace.method args; (args can be positional or named)
    this.triggerPattern = new RegExp(
      `${escapedStart}([a-zA-Z][a-zA-Z0-9_]*)\\.([a-zA-Z][a-zA-Z0-9_]*)(?:\\s+([^${escapedEnd}]*))?${escapedEnd}`,
      'g'
    );
  }

  private parseArguments(argsStr: string | undefined): string[] {
    if (!argsStr) return [];
    
    const trimmed = argsStr.trim();
    if (!trimmed) return [];
    
    // Check if this looks like named parameters (contains key=value)
    const namedParamPattern = /\w+\s*=\s*(?:"[^"]*"|'[^']*'|\S+)/;
    if (namedParamPattern.test(trimmed)) {
      // Parse named parameters - for now, just return as positional for compatibility
      // TODO: In the future, we can return an object for named parameters
      return trimmed.split(/\s+/).filter(arg => arg.length > 0);
    }
    
    // Parse positional parameters
    return trimmed.split(/\s+/).filter(arg => arg.length > 0);
  }

  parseText(text: string): TriggerParseResult {
    const triggers: TextTrigger[] = [];
    let hasInvalidTriggers = false;
    let match;

    this.triggerPattern.lastIndex = 0; // Reset regex state

    while ((match = this.triggerPattern.exec(text)) !== null) {
      const [fullMatch, namespace, method, argsStr] = match;
      const args = this.parseArguments(argsStr);
      
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
    const registeredNamespaces = useControlRegistryStore.getState().getTextTriggerNamespaces();
    console.log(`[TextTriggerParser] DEBUG: Validating trigger: ${trigger.namespace}.${trigger.method}`, {
      args: trigger.args,
      argsLength: trigger.args.length,
      registeredNamespaces: Object.keys(registeredNamespaces)
    });

    const namespace = registeredNamespaces[trigger.namespace];
    
    if (!namespace) {
      console.log(`[TextTriggerParser] DEBUG: Unknown namespace: ${trigger.namespace}`);
      return { 
        isValid: false, 
        errorMessage: `Unknown namespace: ${trigger.namespace}` 
      };
    }

    const method = namespace.methods[trigger.method];
    if (!method) {
      console.log(`[TextTriggerParser] DEBUG: Unknown method: ${trigger.method} in namespace ${trigger.namespace}`, {
        availableMethods: Object.keys(namespace.methods)
      });
      return { 
        isValid: false, 
        errorMessage: `Unknown method: ${trigger.method} in namespace ${trigger.namespace}` 
      };
    }

    const { argSchema } = method;
    console.log(`[TextTriggerParser] DEBUG: Method found:`, {
      method: trigger.method,
      minArgs: argSchema.minArgs,
      maxArgs: argSchema.maxArgs,
      actualArgs: trigger.args.length
    });

    if (trigger.args.length < argSchema.minArgs) {
      console.log(`[TextTriggerParser] DEBUG: Too few arguments`);
      return { 
        isValid: false, 
        errorMessage: `Too few arguments. Expected at least ${argSchema.minArgs}, got ${trigger.args.length}` 
      };
    }

    if (trigger.args.length > argSchema.maxArgs) {
      console.log(`[TextTriggerParser] DEBUG: Too many arguments`);
      return { 
        isValid: false, 
        errorMessage: `Too many arguments. Expected at most ${argSchema.maxArgs}, got ${trigger.args.length}` 
      };
    }

    console.log(`[TextTriggerParser] DEBUG: Validation passed for ${trigger.namespace}.${trigger.method}`);
    return { isValid: true };
  }



  async executeTriggersAndCleanText(text: string, context: TriggerExecutionContext): Promise<string> {
    console.log(`[TextTriggerParser] DEBUG: executeTriggersAndCleanText called with text: "${text}"`);
    const parseResult = this.parseText(text);
    
    console.log(`[TextTriggerParser] DEBUG: Found ${parseResult.triggers.length} triggers`);
    
    if (parseResult.triggers.length === 0) {
      return text;
    }

    // Execute triggers
    for (const trigger of parseResult.triggers) {
      console.log(`[TextTriggerParser] DEBUG: Processing trigger: ${trigger.namespace}.${trigger.method}, valid: ${trigger.isValid}`);
      if (!trigger.isValid) {
        console.warn(`[TextTriggerParser] Skipping invalid trigger: ${trigger.errorMessage}`);
        continue;
      }

      try {
        console.log(`[TextTriggerParser] DEBUG: Executing trigger: ${trigger.namespace}.${trigger.method}`);
        await this.executeTrigger(trigger, context);
        console.log(`[TextTriggerParser] DEBUG: Successfully executed trigger: ${trigger.namespace}.${trigger.method}`);
      } catch (error) {
        console.error(`[TextTriggerParser] Error executing trigger ${trigger.id}:`, error);
      }
    }

    return parseResult.cleanedText;
  }

  private async executeTrigger(trigger: TextTrigger, context: TriggerExecutionContext): Promise<void> {
    const registeredNamespaces = useControlRegistryStore.getState().getTextTriggerNamespaces();
    const namespace = registeredNamespaces[trigger.namespace];
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
    const registeredNamespaces = useControlRegistryStore.getState().getTextTriggerNamespaces();
    return Object.values(registeredNamespaces);
  }
}