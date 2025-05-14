// src/controls/modules/VfsControlModule.ts
// FULL FILE
import React from "react";
import { type ControlModule } from "@/types/litechat/control";
import { type LiteChatModApi } from "@/types/litechat/modding";
import { uiEvent, UiEventPayloads } from "@/types/litechat/events/ui.events";
import { vfsEvent } from "@/types/litechat/events/vfs.events";
import { VfsTriggerButton } from "@/controls/components/vfs/VfsTriggerButton";
import { VfsModalPanel } from "@/controls/components/vfs/VfsModalPanel";
import { useVfsStore } from "@/store/vfs.store";
import { useConversationStore } from "@/store/conversation.store";

export class VfsControlModule implements ControlModule {
  readonly id = "core-vfs";
  public readonly modalId = "core-vfs-modal-panel";
  private unregisterCallbacks: (() => void)[] = [];
  private eventUnsubscribers: (() => void)[] = [];
  private modApiRef: LiteChatModApi | null = null;

  private notifyTriggerUpdate: (() => void) | null = null;
  private isModalOpenByManager: boolean = false;

  async initialize(modApi: LiteChatModApi): Promise<void> {
    this.modApiRef = modApi;
    this.updateVfsKeyBasedOnContext(); // Initial key update

    const unsubUiContext = modApi.on(uiEvent.contextChanged, () => {
      this.updateVfsKeyBasedOnContext();
      this.notifyTriggerUpdate?.();
    });

    const unsubModalState = modApi.on(
      uiEvent.modalStateChanged,
      (payload: UiEventPayloads[typeof uiEvent.modalStateChanged]) => {
        if (payload.modalId === this.modalId) {
          const newOpenState = payload.isOpen;
          if (this.isModalOpenByManager !== newOpenState) {
            this.isModalOpenByManager = newOpenState;
            this.notifyTriggerUpdate?.();
            // If modal is opening, ensure VFS key is correct
            if (newOpenState) {
              this.updateVfsKeyBasedOnContext();
            }
          }
        }
      }
    );

    this.eventUnsubscribers.push(unsubUiContext, unsubModalState);
  }

  private updateVfsKeyBasedOnContext() {
    const { selectedItemId, selectedItemType } =
      useConversationStore.getState();
    const currentVfsStoreKey = useVfsStore.getState().vfsKey;

    let targetVfsKey: string | null = null;

    // Prioritize VFS key based on modal state if it's open for this module
    if (this.isModalOpenByManager) {
      if (selectedItemType === "project") {
        targetVfsKey = selectedItemId;
      } else if (selectedItemType === "conversation") {
        const convo = useConversationStore
          .getState()
          .getConversationById(selectedItemId);
        targetVfsKey = convo?.projectId ?? "orphan";
      } else {
        targetVfsKey = "orphan"; // Default if modal is open without specific context
      }
    } else {
      // If modal is not open, VFS key might still be relevant for background tasks or prompt attachments
      if (selectedItemType === "project") {
        targetVfsKey = selectedItemId;
      } else if (selectedItemType === "conversation") {
        const convo = useConversationStore
          .getState()
          .getConversationById(selectedItemId);
        targetVfsKey = convo?.projectId ?? "orphan";
      } else {
        // If no project/conversation selected, and modal is closed,
        // what should the VFS key be? "orphan" or null?
        // Let's stick to "orphan" if VFS is generally enabled.
        targetVfsKey = "orphan";
      }
    }

    if (currentVfsStoreKey !== targetVfsKey) {
      console.log(
        `[${this.id}] Updating VFS key from "${currentVfsStoreKey}" to "${targetVfsKey}"`
      );
      this.modApiRef?.emit(vfsEvent.setVfsKeyRequest, { key: targetVfsKey });
    }
  }

  public getEnableVfs = (): boolean => useVfsStore.getState().enableVfs;
  public getIsVfsModalOpen = (): boolean => this.isModalOpenByManager;
  public getSelectedFileIdsCount = (): number =>
    useVfsStore.getState().selectedFileIds.size;

  public toggleVfsModal = () => {
    if (this.isModalOpenByManager) {
      this.modApiRef?.emit(uiEvent.closeModalRequest, {
        modalId: this.modalId,
      });
    } else {
      this.modApiRef?.emit(uiEvent.openModalRequest, {
        modalId: this.modalId,
      });
    }
    // State update and notification will be handled by the modalStateChanged listener
  };

  public clearVfsSelection = () => {
    this.modApiRef?.emit(vfsEvent.clearSelectionRequest, undefined);
  };
  public getVfsNodes = () => useVfsStore.getState().nodes;

  public setNotifyTriggerUpdate = (cb: (() => void) | null) => {
    this.notifyTriggerUpdate = cb;
  };

  register(modApi: LiteChatModApi): void {
    this.modApiRef = modApi;
    if (this.unregisterCallbacks.length > 0) {
      console.warn(`[${this.id}] Already registered. Skipping.`);
      return;
    }

    const unregisterTrigger = modApi.registerPromptControl({
      id: "core-vfs-prompt-trigger",
      triggerRenderer: () =>
        React.createElement(VfsTriggerButton, { module: this }),
    });
    this.unregisterCallbacks.push(unregisterTrigger);

    const unregisterModalProvider = modApi.registerModalProvider(
      this.modalId,
      (props) => React.createElement(VfsModalPanel, { module: this, ...props })
    );
    this.unregisterCallbacks.push(unregisterModalProvider);
  }

  destroy(): void {
    this.eventUnsubscribers.forEach((unsub) => unsub());
    this.eventUnsubscribers = [];
    this.unregisterCallbacks.forEach((unsub) => unsub());
    this.unregisterCallbacks = [];
    this.notifyTriggerUpdate = null;
    this.modApiRef = null;
    console.log(`[${this.id}] Destroyed.`);
  }
}
