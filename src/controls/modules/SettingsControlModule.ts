// src/controls/modules/SettingsControlModule.ts
// FULL FILE
import React from "react";
import { type ControlModule } from "@/types/litechat/control";
import { type LiteChatModApi } from "@/types/litechat/modding";
import { uiEvent } from "@/types/litechat/events/ui.events";
import { SettingsTriggerComponent } from "@/controls/components/settings/SettingsTriggerComponent";
import { SettingsModal } from "@/controls/components/settings/SettingsModal";
import { useUIStateStore } from "@/store/ui.store";

export class SettingsControlModule implements ControlModule {
  readonly id = "core-settings-trigger";
  private unregisterCallback: (() => void) | null = null;
  private eventUnsubscribers: (() => void)[] = [];

  async initialize(modApi: LiteChatModApi): Promise<void> {
    const unsubOpenRequest = modApi.on(
      uiEvent.openSettingsModalRequest,
      (payload) => {
        this.openSettingsModal(payload.tabId, payload.subTabId);
      }
    );
    this.eventUnsubscribers.push(unsubOpenRequest);
    console.log(`[${this.id}] Initialized and listening for open requests.`);
  }

  public openSettingsModal = (initialTab?: string, initialSubTab?: string) => {
    useUIStateStore
      .getState()
      .setInitialSettingsTabs(initialTab || null, initialSubTab || null);
    useUIStateStore.getState().toggleChatControlPanel("settingsModal", true);
  };

  public closeSettingsModal = () => {
    useUIStateStore.getState().toggleChatControlPanel("settingsModal", false);
    useUIStateStore.getState().clearInitialSettingsTabs();
  };

  public getIsSettingsModalOpen = (): boolean => {
    return (
      useUIStateStore.getState().isChatControlPanelOpen["settingsModal"] ??
      false
    );
  };

  register(modApi: LiteChatModApi): void {
    if (this.unregisterCallback) {
      console.warn(`[${this.id}] Already registered. Skipping.`);
      return;
    }

    const settingsTriggerRenderer = () =>
      React.createElement(SettingsTriggerComponent, { module: this });

    const settingsModalRenderer = () =>
      React.createElement(SettingsModal, {
        isOpen: this.getIsSettingsModalOpen(),
        onClose: this.closeSettingsModal,
      });

    this.unregisterCallback = modApi.registerChatControl({
      id: this.id,
      panel: "sidebar-footer",
      status: () => "ready",
      renderer: settingsTriggerRenderer,
      iconRenderer: settingsTriggerRenderer,
      settingsRenderer: settingsModalRenderer,
      show: () => true,
    });
    console.log(`[${this.id}] Registered.`);
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
