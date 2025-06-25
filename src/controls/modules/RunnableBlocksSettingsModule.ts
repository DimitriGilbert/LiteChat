import React from "react";
import { type ControlModule } from "@/types/litechat/control";
import { type LiteChatModApi } from "@/types/litechat/modding";
import { SettingsRunnableBlocks } from "@/controls/components/runnable-blocks-settings/SettingsRunnableBlocks";
import { useSettingsStore } from "@/store/settings.store";
import { settingsEvent } from "@/types/litechat/events/settings.events";

export class RunnableBlocksSettingsModule implements ControlModule {
  readonly id = "core-settings-runnable-blocks";
  private unregisterCallback: (() => void) | null = null;
  private eventUnsubscribers: (() => void)[] = [];
  private isVisible = false;

  async initialize(modApi: LiteChatModApi): Promise<void> {
    // Tab is visible when advanced settings is enabled (since runnable blocks is an advanced feature)
    this.isVisible = useSettingsStore.getState().enableAdvancedSettings;

    const unsubSettings = modApi.on(
      settingsEvent.enableAdvancedSettingsChanged,
      (payload) => {
        if (typeof payload === "object" && payload && "enabled" in payload) {
          if (this.isVisible !== payload.enabled) {
            this.isVisible = payload.enabled;
            // Re-register when visibility changes
            this.destroy();
            this.register(modApi);
          }
        }
      }
    );
    this.eventUnsubscribers.push(unsubSettings);
  }

  register(modApi: LiteChatModApi): void {
    if (this.isVisible && !this.unregisterCallback) {
      this.unregisterCallback = modApi.registerSettingsTab({
        id: "runnable-blocks",
        title: "Runnable Blocks",
        component: () => React.createElement(SettingsRunnableBlocks),
        order: 45,
      });
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