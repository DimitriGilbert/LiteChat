// src/controls/modules/ProviderSettingsModule.ts
// FULL FILE
import { type ControlModule } from "@/types/litechat/control";
import { type LiteChatModApi } from "@/types/litechat/modding";
import { SettingsProviders } from "@/controls/components/provider-settings/SettingsProviders";

export class ProviderSettingsModule implements ControlModule {
  readonly id = "core-settings-providers";
  private unregisterSettingsTabCallback: (() => void) | null = null;

  async initialize(_modApi: LiteChatModApi): Promise<void> {
    // Initialization logic if needed
  }

  register(modApi: LiteChatModApi): void {
    if (this.unregisterSettingsTabCallback) {
      console.warn(`[${this.id}] Settings tab already registered. Skipping.`);
      return;
    }
    this.unregisterSettingsTabCallback = modApi.registerSettingsTab({
      id: "providers",
      title: "Providers & Models",
      component: SettingsProviders,
      order: 30,
    });
  }

  destroy(): void {
    if (this.unregisterSettingsTabCallback) {
      this.unregisterSettingsTabCallback();
      this.unregisterSettingsTabCallback = null;
    }
    console.log(`[${this.id}] Destroyed.`);
  }
}
