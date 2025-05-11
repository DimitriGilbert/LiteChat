// src/controls/modules/SettingsControlModule.ts
// FULL FILE
import React from "react";
import { type ControlModule } from "@/types/litechat/control";
import { type LiteChatModApi } from "@/types/litechat/modding";
import { uiEvent } from "@/types/litechat/events/ui.events";
import { SettingsTriggerComponent } from "@/controls/components/settings/SettingsTriggerComponent";
import { SettingsModal } from "@/controls/components/settings/SettingsModal";
// No direct store access needed for modal state here anymore

export class SettingsControlModule implements ControlModule {
  readonly id = "core-settings-trigger"; // This ID is for the trigger control
  public readonly modalId = "settingsModal"; // Unique ID for the modal content
  private unregisterChatControlCallback: (() => void) | null = null;
  private unregisterModalProviderCallback: (() => void) | null = null;
  private eventUnsubscribers: (() => void)[] = [];
  private modApiRef: LiteChatModApi | null = null;

  async initialize(modApi: LiteChatModApi): Promise<void> {
    this.modApiRef = modApi;
    const unsubOpenRequest = modApi.on(uiEvent.openModalRequest, (payload) => {
      if (payload.modalId === this.modalId) {
        // This module is responsible for opening its own modal type
        // The ModalManager will handle the actual display.
        // We don't need to call useUIStateStore here.
        console.log(
          `[${this.id}] Received open request for modal: ${payload.modalId}`
        );
      }
    });
    this.eventUnsubscribers.push(unsubOpenRequest);
    console.log(`[${this.id}] Initialized and listening for open requests.`);
  }

  // This method is now called by its UI trigger component
  public openSettingsModal = (initialTab?: string, initialSubTab?: string) => {
    this.modApiRef?.emit(uiEvent.openModalRequest, {
      modalId: this.modalId,
      initialTab: initialTab || "general", // Default to general if not provided
      initialSubTab: initialSubTab,
    });
  };

  // This method is now called by the ModalProvider via ModalManager
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

    // Register the trigger button as a chat control
    if (!this.unregisterChatControlCallback) {
      this.unregisterChatControlCallback = modApi.registerChatControl({
        id: this.id, // ID for the trigger
        panel: "sidebar-footer",
        status: () => "ready",
        renderer: () =>
          React.createElement(SettingsTriggerComponent, { module: this }),
        iconRenderer: () =>
          React.createElement(SettingsTriggerComponent, { module: this }),
        show: () => true,
      });
      console.log(`[${this.id}] Trigger registered.`);
    }

    // Register the modal content provider
    if (!this.unregisterModalProviderCallback) {
      this.unregisterModalProviderCallback = modApi.registerModalProvider(
        this.modalId, // Use the unique modalId
        (props) =>
          React.createElement(SettingsModal, {
            isOpen: props.isOpen,
            onClose: props.onClose,
            // initialTab and initialSubTab will be passed by ModalManager
          })
      );
      console.log(
        `[${this.id}] Modal provider registered for ${this.modalId}.`
      );
    }
  }

  destroy(): void {
    this.eventUnsubscribers.forEach((unsub) => unsub());
    this.eventUnsubscribers = [];
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
