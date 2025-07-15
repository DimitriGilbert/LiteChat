import { type ControlModule } from "@/types/litechat/control";
import { type LiteChatModApi } from "@/types/litechat/modding";
import { ModMiddlewareHook } from "@/types/litechat/modding";
import { TextTriggerParserService } from "@/services/text-trigger-parser.service";
import { useSettingsStore } from "@/store/settings.store";
import type { TriggerExecutionContext } from "@/types/litechat/text-triggers";

export class TextTriggerControlModule implements ControlModule {
  readonly id = "core-text-triggers";
  private unregisterCallback: (() => void) | null = null;
  private parserService: TextTriggerParserService | null = null;

  async initialize(): Promise<void> {
    const settings = useSettingsStore.getState();
    this.parserService = new TextTriggerParserService(
      settings.textTriggerStartDelimiter,
      settings.textTriggerEndDelimiter
    );
    
    // Register built-in namespaces
    this.registerBuiltInNamespaces();
  }

  register(modApi: LiteChatModApi): void {
    if (this.unregisterCallback) {
      console.warn(`[${this.id}] Already registered. Skipping.`);
      return;
    }

    // Register middleware to process text triggers during prompt finalization
    const unregisterMiddleware = modApi.addMiddleware(
      ModMiddlewareHook.PROMPT_TURN_FINALIZE,
      async (payload) => {
        const { turnData } = payload;
        
        if (!turnData.content || typeof turnData.content !== 'string' || !this.parserService) {
          return payload;
        }

        const settings = useSettingsStore.getState();
        if (!settings.textTriggersEnabled) {
          return payload;
        }

        try {
          // Parse and execute triggers, get cleaned text
          const cleanedContent = await this.parserService.executeTriggersAndCleanText(
            turnData.content,
            { turnData, promptText: turnData.content }
          );

          // Return modified turnData with cleaned content
          return {
            turnData: {
              ...turnData,
              content: cleanedContent
            }
          };
        } catch (error) {
          console.error('[TextTriggerControlModule] Error processing triggers:', error);
          return payload; // Return original on error
        }
      }
    );

    this.unregisterCallback = unregisterMiddleware;
  }

  private registerBuiltInNamespaces(): void {
    if (!this.parserService) return;

    // Register tools namespace
    this.parserService.registerNamespace({
      id: 'tools',
      name: 'Tools',
      methods: {
        activate: {
          id: 'activate',
          name: 'Activate Tools',
          description: 'Activate specific tools for this prompt',
          argSchema: {
            minArgs: 1,
            maxArgs: 10,
            argTypes: ['tool-id']
          },
          handler: this.handleToolsActivate
        },
        auto: {
          id: 'auto',
          name: 'Auto Select Tools',
          description: 'Automatically select relevant tools',
          argSchema: { minArgs: 0, maxArgs: 0, argTypes: [] },
          handler: this.handleToolsAuto
        }
      },
      moduleId: this.id
    });

    // Register rules namespace
    this.parserService.registerNamespace({
      id: 'rules',
      name: 'Rules',
      methods: {
        select: {
          id: 'select',
          name: 'Select Rules',
          description: 'Activate specific rules for this prompt',
          argSchema: {
            minArgs: 1,
            maxArgs: 10,
            argTypes: ['rule-id']
          },
          handler: this.handleRulesSelect
        },
        auto: {
          id: 'auto',
          name: 'Auto Select Rules',
          description: 'Automatically select relevant rules',
          argSchema: { minArgs: 0, maxArgs: 0, argTypes: [] },
          handler: this.handleRulesAuto
        }
      },
      moduleId: this.id
    });
  }

  private handleToolsActivate = async (args: string[], context: TriggerExecutionContext) => {
    if (!context.turnData.metadata.enabledTools) {
      context.turnData.metadata.enabledTools = [];
    }
    context.turnData.metadata.enabledTools.push(...args);
  };

  private handleToolsAuto = async (_args: string[], context: TriggerExecutionContext) => {
    context.turnData.metadata.autoSelectTools = true;
  };

  private handleRulesSelect = async (args: string[], context: TriggerExecutionContext) => {
    if (!context.turnData.metadata.activeRuleIds) {
      context.turnData.metadata.activeRuleIds = [];
    }
    context.turnData.metadata.activeRuleIds.push(...args);
  };

  private handleRulesAuto = async (_args: string[], context: TriggerExecutionContext) => {
    context.turnData.metadata.autoSelectRules = true;
  };

  destroy(): void {
    if (this.unregisterCallback) {
      this.unregisterCallback();
      this.unregisterCallback = null;
    }
    this.parserService = null;
    console.log(`[${this.id}] Destroyed.`);
  }
}