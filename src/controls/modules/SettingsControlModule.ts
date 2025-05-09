// src/controls/modules/SettingsControlModule.ts
// FULL FILE
import React from "react";
import { type ControlModule } from "@/types/litechat/control";
import { type LiteChatModApi } from "@/types/litechat/modding";
import { SettingsTriggerComponent } from "@/controls/components/settings/SettingsTriggerComponent";
import { SettingsModal } from "@/controls/components/settings/SettingsModal";
import { useUIStateStore } from "@/store/ui.store";

export class SettingsControlModule implements ControlModule {
  readonly id = "core-settings-trigger";
  private unregisterCallback: (() => void) | null = null;

  async initialize(_modApi: LiteChatModApi): Promise<void> {
    // modApi parameter is available here if needed for initialization logic
    console.log(`[${this.id}] Initialized.`);
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
    if (this.unregisterCallback) {
      this.unregisterCallback();
      this.unregisterCallback = null;
    }
    console.log(`[${this.id}] Destroyed.`);
  }
}
