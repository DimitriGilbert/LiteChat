// src/controls/modules/ProjectSettingsControlModule.ts
// FULL FILE
import React from "react";
import { type ControlModule } from "@/types/litechat/control";
import { type LiteChatModApi } from "@/types/litechat/modding";
import { ProjectSettingsModal } from "@/controls/components/project-settings/ProjectSettingsModal";
import { uiEvent } from "@/types/litechat/events/ui.events"; // For emitting open/close requests

export class ProjectSettingsControlModule implements ControlModule {
  readonly id = "core-project-settings"; // Changed ID to reflect its purpose
  public readonly modalId = "projectSettingsModal"; // Unique ID for this modal
  private unregisterModalProviderCallback: (() => void) | null = null;
  private modApiRef: LiteChatModApi | null = null; // To store modApi for emitting events

  async initialize(modApi: LiteChatModApi): Promise<void> {
    this.modApiRef = modApi;
    // No trigger component to register as a chat control.
    // Opening will be handled by other parts of the UI emitting openModalRequest.
    console.log(`[${this.id}] Initialized.`);
  }

  // Method to be called by other UI elements (e.g., context menu on a project item)
  public openModal = (projectId: string, initialTab?: string) => {
    this.modApiRef?.emit(uiEvent.openModalRequest, {
      modalId: this.modalId,
      targetId: projectId, // Pass projectId as targetId
      initialTab: initialTab,
    });
  };

  // This method is now called by the ModalProvider via ModalManager
  public closeModal = () => {
    this.modApiRef?.emit(uiEvent.closeModalRequest, {
      modalId: this.modalId,
    });
  };

  register(modApi: LiteChatModApi): void {
    this.modApiRef = modApi;
    if (this.unregisterModalProviderCallback) {
      console.warn(`[${this.id}] Modal provider already registered. Skipping.`);
      return;
    }

    // Register only the modal content provider.
    // The trigger for this modal will be elsewhere (e.g., context menu in ConversationList).
    this.unregisterModalProviderCallback = modApi.registerModalProvider(
      this.modalId,
      (props) => {
        // The props (isOpen, onClose, targetId, initialTab) will be passed by ModalManager
        return React.createElement(ProjectSettingsModal, {
          isOpen: props.isOpen,
          onClose: props.onClose,
          projectId: props.targetId || null, // Use targetId as projectId
          // initialTab: props.initialTab, // If ProjectSettingsModal supports it
        });
      }
    );
    console.log(`[${this.id}] Modal provider registered for ${this.modalId}.`);
  }

  destroy(): void {
    if (this.unregisterModalProviderCallback) {
      this.unregisterModalProviderCallback();
      this.unregisterModalProviderCallback = null;
    }
    this.modApiRef = null;
    console.log(`[${this.id}] Destroyed.`);
  }
}
