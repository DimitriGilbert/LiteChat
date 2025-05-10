// src/controls/modules/ProviderSettingsModule.ts
// FULL FILE (This might be new or an update depending on previous state)
import React from "react";
import { type ControlModule } from "@/types/litechat/control";
import { type LiteChatModApi } from "@/types/litechat/modding";
import { SettingsProviders } from "@/controls/components/provider-settings/SettingsProviders";

export class ProviderSettingsModule implements ControlModule {
  readonly id = "core-settings-providers";
  private unregisterCallback: (() => void) | null = null;

  async initialize(_modApi: LiteChatModApi): Promise<void> {
    console.log(`[${this.id}] Initialized.`);
  }

  register(modApi: LiteChatModApi): void {
    if (this.unregisterCallback) {
      console.warn(`[${this.id}] Already registered. Skipping.`);
      return;
    }
    this.unregisterCallback = modApi.registerSettingsTab({
      id: "providers",
      title: "Providers & Models",
      component: SettingsProviders,
      order: 30,
    });
    console.log(`[${this.id}] Settings tab registered.`);
  }

  destroy(): void {
    if (this.unregisterCallback) {
      this.unregisterCallback();
      this.unregisterCallback = null;
    }
    console.log(`[${this.id}] Destroyed.`);
  }
}
