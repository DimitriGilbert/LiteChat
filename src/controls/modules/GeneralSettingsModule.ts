// src/controls/modules/GeneralSettingsModule.ts
// FULL FILE
import { type ControlModule } from "@/types/litechat/control";
import { type LiteChatModApi } from "@/types/litechat/modding";
import { SettingsGeneral } from "@/controls/components/general-settings/SettingsGeneral";

export class GeneralSettingsModule implements ControlModule {
  readonly id = "core-settings-general";
  private unregisterCallback: (() => void) | null = null;

  async initialize(_modApi: LiteChatModApi): Promise<void> {
    // console.log(`[${this.id}] Initialized.`);
  }

  register(modApi: LiteChatModApi): void {
    if (this.unregisterCallback) {
      console.warn(`[${this.id}] Already registered. Skipping.`);
      return;
    }
    this.unregisterCallback = modApi.registerSettingsTab({
      id: "general",
      title: "General",
      component: SettingsGeneral,
      order: 10,
    });
    // console.log(`[${this.id}] Settings tab registered.`);
  }

  destroy(): void {
    if (this.unregisterCallback) {
      this.unregisterCallback();
      this.unregisterCallback = null;
    }
    console.log(`[${this.id}] Destroyed.`);
  }
}
