// src/controls/modules/DataSettingsModule.ts
// FULL FILE
import { type ControlModule } from "@/types/litechat/control";
import { type LiteChatModApi } from "@/types/litechat/modding";
import { SettingsDataManagement } from "@/controls/components/data-settings/SettingsDataManagement";

export class DataSettingsModule implements ControlModule {
  readonly id = "core-settings-data";
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
      id: "data",
      title: "Data",
      component: SettingsDataManagement,
      order: 70,
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
