import { type ControlModule } from "@/types/litechat/control";
import { type LiteChatModApi } from "@/types/litechat/modding";
import { ModMiddlewareHook } from "@/types/litechat/modding";
import { TextTriggerParserService } from "@/services/text-trigger-parser.service";
import { textTriggerRegistry } from "@/services/text-trigger-registry.service";
import { useSettingsStore } from "@/store/settings.store";
import { useControlRegistryStore } from "@/store/control.store";
import { controlRegistryEvent } from "@/types/litechat/events/control.registry.events";

export class TextTriggerControlModule implements ControlModule {
  readonly id = "core-text-triggers";
  private unregisterCallback: (() => void) | null = null;
  private eventUnsubscribers: (() => void)[] = [];
  public parserService: TextTriggerParserService | null = null;

  async initialize(modApi: LiteChatModApi): Promise<void> {
    const settings = useSettingsStore.getState();
    this.parserService = new TextTriggerParserService(
      settings.textTriggerStartDelimiter,
      settings.textTriggerEndDelimiter
    );
    
    // Register built-in namespaces initially
    this.registerBuiltInNamespaces();

    // Listen for changes to text trigger namespaces and re-register
    const unsubscribeNamespaceChanges = modApi.on(controlRegistryEvent.textTriggerNamespacesChanged, () => {
      this.registerBuiltInNamespaces();
    });
    this.eventUnsubscribers.push(unsubscribeNamespaceChanges);
  }

  register(modApi: LiteChatModApi): void {
    if (this.unregisterCallback) {
      console.warn(`[${this.id}] Already registered. Skipping.`);
      return;
    }

    // Re-register built-in namespaces in case they were registered during the registration phase
    this.registerBuiltInNamespaces();

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

    // Get registered trigger namespaces from the control registry store
    const registeredNamespaces = useControlRegistryStore.getState().getTextTriggerNamespaces();
    
    console.log('[TextTriggerControlModule] DEBUG: Registered namespaces:', Object.keys(registeredNamespaces));
    
    Object.values(registeredNamespaces).forEach((namespace) => {
      console.log('[TextTriggerControlModule] DEBUG: Registering namespace:', namespace.id, 'with methods:', Object.keys(namespace.methods));
      this.parserService!.registerNamespace(namespace);
      textTriggerRegistry.registerNamespace(namespace);
    });
  }


  destroy(): void {
    this.eventUnsubscribers.forEach((unsub) => unsub());
    this.eventUnsubscribers = [];
    if (this.unregisterCallback) {
      this.unregisterCallback();
      this.unregisterCallback = null;
    }
    this.parserService = null;
    console.log(`[${this.id}] Destroyed.`);
  }
}