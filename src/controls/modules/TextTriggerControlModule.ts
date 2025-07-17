import { type ControlModule } from "@/types/litechat/control";
import { type LiteChatModApi } from "@/types/litechat/modding";
import { TextTriggerParserService } from "@/services/text-trigger-parser.service";
import { useSettingsStore } from "@/store/settings.store";
// import { useControlRegistryStore } from "@/store/control.store";
import { controlRegistryEvent } from "@/types/litechat/events/control.registry.events";
import { promptEvent } from "@/types/litechat/events/prompt.events";

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

    // Listen for prompt submission events to process text triggers BEFORE middleware
    const unregisterPromptListener = modApi.on(promptEvent.submitted, async (payload) => {
      const { turnData } = payload;
      
      if (!turnData.content || typeof turnData.content !== 'string' || !this.parserService) {
        return;
      }

      const settings = useSettingsStore.getState();
      if (!settings.textTriggersEnabled) {
        return;
      }

      try {
        // Parse and execute triggers, get cleaned text
        const cleanedContent = await this.parserService.executeTriggersAndCleanText(
          turnData.content,
          { turnData, promptText: turnData.content }
        );

        // Update the turnData content directly (this happens before middleware)
        turnData.content = cleanedContent;
      } catch (error) {
        console.error('[TextTriggerControlModule] Error processing triggers:', error);
      }
    });

    this.unregisterCallback = unregisterPromptListener;
  }

  private registerBuiltInNamespaces(): void {
    if (!this.parserService) return;

    // Get registered trigger namespaces from the control registry store
    // const registeredNamespaces = useControlRegistryStore.getState().getTextTriggerNamespaces();
    
    // console.log('[TextTriggerControlModule] DEBUG: Registered namespaces:', Object.keys(registeredNamespaces));
    
    // // Namespaces are now managed directly by the control registry store
    // // The parser service will fetch them directly when needed
    // console.log('[TextTriggerControlModule] DEBUG: Found registered namespaces:', Object.keys(registeredNamespaces));
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