// src/controls/modules/AssistantSettingsModule.ts
// FULL FILE
import React from "react";
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
    if (this.unregisterCallback) {
      this.unregisterCallback();
      this.unregisterCallback = null;
    }
    if (this.modApiRef) {
      this.register(this.modApiRef);
    }
  }

  register(modApi: LiteChatModApi): void {
    this.modApiRef = modApi;
    if (this.unregisterCallback && this.isVisible) {
      return;
    }
    if (this.unregisterCallback && !this.isVisible) {
      this.unregisterCallback();
      this.unregisterCallback = null;
      console.log(
        `[${this.id}] Settings tab unregistered as it's not visible.`
      );
      return;
    }

    if (this.isVisible && !this.unregisterCallback) {
      this.unregisterCallback = modApi.registerSettingsTab({
        id: "assistant",
        title: "Assistant",
        component: SettingsAssistant,
        order: 40,
      });
      console.log(`[${this.id}] Settings tab registered.`);
    } else if (!this.isVisible) {
      console.log(
        `[${this.id}] Settings tab not registered as it's not visible.`
      );
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
