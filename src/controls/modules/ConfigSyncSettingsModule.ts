// src/controls/modules/ConfigSyncSettingsModule.ts
// FULL FILE
import { type ControlModule } from "@/types/litechat/control";
import { type LiteChatModApi } from "@/types/litechat/modding";
import { SettingsConfigSync } from "@/controls/components/config-sync-settings/SettingsConfigSync";
import i18next from "i18next";
import type { ControlModuleConstructor } from '@/types/litechat/control';

export class ConfigSyncSettingsModule implements ControlModule {
  readonly id = "core-settings-config-sync";
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
      id: "config-sync",
      title: i18next.t("controls:settings.tabs.configSync"),
      component: SettingsConfigSync,
      order: 60,
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

(ConfigSyncSettingsModule as ControlModuleConstructor).translations = {
  en: {
    controls: {
      "settings.tabs.configSync": "Config Sync"
    }
  },
  fr: {
    controls: {
      "settings.tabs.configSync": "Sync Config"
    }
  }
};