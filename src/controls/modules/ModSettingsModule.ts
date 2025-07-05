// src/controls/modules/ModSettingsModule.ts
// FULL FILE
import { type ControlModule } from "@/types/litechat/control";
import { type LiteChatModApi } from "@/types/litechat/modding";
import { SettingsMods } from "@/controls/components/mod-settings/SettingsMods";
import { useSettingsStore } from "@/store/settings.store";
import { settingsEvent } from "@/types/litechat/events/settings.events";

export class ModSettingsModule implements ControlModule {
  readonly id = "core-settings-mods";
  private unregisterCallback: (() => void) | null = null;
  private eventUnsubscribers: (() => void)[] = [];
  private isVisible = false;

  async initialize(modApi: LiteChatModApi): Promise<void> {
    // Tab is visible when advanced settings is enabled (since mods is an advanced feature)
    this.isVisible = useSettingsStore.getState().enableAdvancedSettings;

    const unsubSettings = modApi.on(
      settingsEvent.enableAdvancedSettingsChanged,
      (payload) => {
        if (typeof payload === "object" && payload && "enabled" in payload) {
          if (this.isVisible !== payload.enabled) {
            this.isVisible = payload.enabled;
            // Update registration without destroying event subscriptions
            if (this.isVisible && !this.unregisterCallback) {
              this.register(modApi);
            } else if (!this.isVisible && this.unregisterCallback) {
              this.unregisterCallback();
              this.unregisterCallback = null;
            }
          }
        }
      }
    );
    this.eventUnsubscribers.push(unsubSettings);
    
    // Initial registration if visible
    if (this.isVisible) {
      this.register(modApi);
    }
  }

  register(modApi: LiteChatModApi): void {
    if (this.unregisterCallback) {
      console.warn(`[${this.id}] Already registered. Skipping.`);
      return;
    }
    if (this.isVisible) {
      this.unregisterCallback = modApi.registerSettingsTab({
        id: "mods",
        title: "Mods",
        component: SettingsMods,
        order: 80,
      });
      // console.log(`[${this.id}] Settings tab registered.`);
    }
  }

  destroy(): void {
    this.eventUnsubscribers.forEach((unsub) => unsub());
    this.eventUnsubscribers = [];
    
    if (this.unregisterCallback) {
      this.unregisterCallback();
      this.unregisterCallback = null;
    }
    console.log(`[${this.id}] Destroyed.`);
  }
}
