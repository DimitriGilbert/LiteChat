// src/controls/modules/UsageDashboardModule.ts
// Module for usage dashboard functionality

import React from "react";
import { type ControlModule } from "@/types/litechat/control";
import { type LiteChatModApi } from "@/types/litechat/modding";
import { UsageDashboard } from "@/controls/components/usage/UsageDashboard";

export class UsageDashboardModule implements ControlModule {
  readonly id = "core-usage-dashboard";
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
      id: this.id,
      title: "Usage",
      component: () => React.createElement(UsageDashboard),
    });

    console.log(`[${this.id}] Registered.`);
  }

  destroy(): void {
    if (this.unregisterCallback) {
      this.unregisterCallback();
      this.unregisterCallback = null;
    }
    console.log(`[${this.id}] Destroyed.`);
  }
} 