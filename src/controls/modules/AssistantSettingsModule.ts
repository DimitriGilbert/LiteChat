// src/controls/modules/AssistantSettingsModule.ts
// FULL FILE
import { type ControlModule } from "@/types/litechat/control";
import { type LiteChatModApi } from "@/types/litechat/modding";
import { SettingsAssistant } from "@/controls/components/assistant-settings/SettingsAssistant";
import { useSettingsStore } from "@/store/settings.store";
import { settingsEvent } from "@/types/litechat/events/settings.events";

export class AssistantSettingsModule implements ControlModule {
  readonly id = "core-settings-assistant";
  private unregisterCallback: (() => void) | null = null;
  private modApiRef: LiteChatModApi | null = null;
  private eventUnsubscribers: (() => void)[] = [];
  private isVisible = false;

  async initialize(modApi: LiteChatModApi): Promise<void> {
    this.modApiRef = modApi;
    // Initialize visibility based on the current state of enableAdvancedSettings
    this.isVisible = useSettingsStore.getState().enableAdvancedSettings;

    const unsubSettings = modApi.on(
      settingsEvent.enableAdvancedSettingsChanged,
      (payload) => {
        if (this.isVisible !== payload.enabled) {
          this.isVisible = payload.enabled;
          this.reregisterTab();
        }
      }
    );
    this.eventUnsubscribers.push(unsubSettings);
    console.log(`[${this.id}] Initialized. Visible: ${this.isVisible}`);
  }

  private reregisterTab() {
    // Always unregister if a callback exists, then re-evaluate registration
    if (this.unregisterCallback) {
      this.unregisterCallback();
      this.unregisterCallback = null;
    }
    if (this.modApiRef) {
      this.register(this.modApiRef); // register will check isVisible
    }
  }

  register(modApi: LiteChatModApi): void {
    this.modApiRef = modApi; // Ensure modApiRef is set

    if (this.isVisible) {
      // Only register if visible and not already registered by this call instance
      if (!this.unregisterCallback) {
        this.unregisterCallback = modApi.registerSettingsTab({
          id: "assistant",
          title: "Assistant",
          component: SettingsAssistant,
          order: 40,
        });
        console.log(`[${this.id}] Settings tab registered.`);
      }
    } else {
      // If not visible, ensure it's unregistered if it was previously
      if (this.unregisterCallback) {
        this.unregisterCallback();
        this.unregisterCallback = null;
        console.log(
          `[${this.id}] Settings tab unregistered as it's not visible.`
        );
      } else {
        console.log(
          `[${this.id}] Settings tab not registered as it's not visible.`
        );
      }
    }
  }

  destroy(): void {
    this.eventUnsubscribers.forEach((unsub) => unsub());
    this.eventUnsubscribers = [];
    if (this.unregisterCallback) {
      this.unregisterCallback();
      this.unregisterCallback = null;
    }
    this.modApiRef = null;
    console.log(`[${this.id}] Destroyed.`);
  }
}
