// src/controls/modules/SettingsControlModule.ts
// FULL FILE
import React from "react";
import { type ControlModule } from "@/types/litechat/control";
import { type LiteChatModApi } from "@/types/litechat/modding";
import { uiEvent } from "@/types/litechat/events/ui.events";
import { SettingsTriggerComponent } from "@/controls/components/settings/SettingsTriggerComponent";
import { SettingsModal } from "@/controls/components/settings/SettingsModal";

export class SettingsControlModule implements ControlModule {
  readonly id = "core-settings-trigger";
  public readonly modalId = "settingsModal"; // Unique ID for the settings modal
  private unregisterChatControlCallback: (() => void) | null = null;
  private unregisterModalProviderCallback: (() => void) | null = null;
  private modApiRef: LiteChatModApi | null = null;

  async initialize(modApi: LiteChatModApi): Promise<void> {
    this.modApiRef = modApi;
  }

  public openSettingsModal = (initialTab?: string, initialSubTab?: string) => {
    this.modApiRef?.emit(uiEvent.openModalRequest, {
      modalId: this.modalId,
      initialTab: initialTab || "general",
      initialSubTab: initialSubTab,
    });
  };

  public closeSettingsModal = () => {
    this.modApiRef?.emit(uiEvent.closeModalRequest, {
      modalId: this.modalId,
    });
  };

  register(modApi: LiteChatModApi): void {
    this.modApiRef = modApi;
    if (
      this.unregisterChatControlCallback &&
      this.unregisterModalProviderCallback
    ) {
      console.warn(`[${this.id}] Already registered. Skipping.`);
      return;
    }

    if (!this.unregisterChatControlCallback) {
      this.unregisterChatControlCallback = modApi.registerChatControl({
        id: this.id,
        panel: "sidebar-footer",
        status: () => "ready",
        renderer: () =>
          React.createElement(SettingsTriggerComponent, { module: this }),
        iconRenderer: () =>
          React.createElement(SettingsTriggerComponent, { module: this }),
        show: () => true,
      });
    }

    if (!this.unregisterModalProviderCallback) {
      this.unregisterModalProviderCallback = modApi.registerModalProvider(
        this.modalId,
        (props) =>
          React.createElement(SettingsModal, {
            isOpen: props.isOpen,
            onClose: props.onClose,
            initialTab: props.initialTab,
            initialSubTab: props.initialSubTab,
          })
      );
    }
  }

  destroy(): void {
    if (this.unregisterChatControlCallback) {
      this.unregisterChatControlCallback();
      this.unregisterChatControlCallback = null;
    }
    if (this.unregisterModalProviderCallback) {
      this.unregisterModalProviderCallback();
      this.unregisterModalProviderCallback = null;
    }
    this.modApiRef = null;
    console.log(`[${this.id}] Destroyed.`);
  }
}
