// src/controls/modules/VfsControlModule.ts
// FULL FILE
import React from "react";
import { type ControlModule } from "@/types/litechat/control";
import { type LiteChatModApi } from "@/types/litechat/modding";
import { uiEvent } from "@/types/litechat/events/ui.events";
import { vfsEvent } from "@/types/litechat/events/vfs.events";
import { VfsTriggerButton } from "@/controls/components/vfs/VfsTriggerButton";
import { VfsModalPanel } from "@/controls/components/vfs/VfsModalPanel";
import { useVfsStore } from "@/store/vfs.store";
import { useUIStateStore } from "@/store/ui.store";
import { useConversationStore } from "@/store/conversation.store";

export class VfsControlModule implements ControlModule {
  readonly id = "core-vfs";
  private unregisterCallbacks: (() => void)[] = [];
  private eventUnsubscribers: (() => void)[] = [];
  private modApiRef: LiteChatModApi | null = null;

  private notifyTriggerUpdate: (() => void) | null = null;
  private notifyModalUpdate: (() => void) | null = null;

  async initialize(modApi: LiteChatModApi): Promise<void> {
    this.modApiRef = modApi;
    this.updateVfsKeyBasedOnContext();

    const unsubUiContext = modApi.on(uiEvent.contextChanged, () => {
      this.updateVfsKeyBasedOnContext();
      this.notifyTriggerUpdate?.();
      this.notifyModalUpdate?.();
    });

    this.eventUnsubscribers.push(unsubUiContext);
    // console.log(`[${this.id}] Initialized.`);
  }

  private updateVfsKeyBasedOnContext() {
    const { selectedItemId, selectedItemType } =
      useConversationStore.getState();
    const isVfsModalOpen =
      useUIStateStore.getState().isChatControlPanelOpen["core-vfs-modal-panel"];
    const currentVfsStoreKey = useVfsStore.getState().vfsKey;

    let targetVfsKey: string | null = null;

    if (isVfsModalOpen || selectedItemType === "project") {
      if (selectedItemType === "project") {
        targetVfsKey = selectedItemId;
      } else if (selectedItemType === "conversation") {
        const convo = useConversationStore
          .getState()
          .getConversationById(selectedItemId);
        targetVfsKey = convo?.projectId ?? "orphan";
      } else {
        targetVfsKey = "orphan";
      }
    } else if (selectedItemType === "conversation") {
      const convo = useConversationStore
        .getState()
        .getConversationById(selectedItemId);
      targetVfsKey = convo?.projectId ?? "orphan";
    }

    if (currentVfsStoreKey !== targetVfsKey) {
      console.log(
        `[${this.id}] Updating VFS key from "${currentVfsStoreKey}" to "${targetVfsKey}"`
      );
      this.modApiRef?.emit(vfsEvent.setVfsKeyRequest, { key: targetVfsKey });
    }
  }

  public getEnableVfs = (): boolean => useVfsStore.getState().enableVfs;
  public getIsVfsModalOpen = (): boolean =>
    useUIStateStore.getState().isChatControlPanelOpen["core-vfs-modal-panel"] ??
    false;
  public getSelectedFileIdsCount = (): number =>
    useVfsStore.getState().selectedFileIds.size;

  public toggleVfsModal = (isOpen?: boolean) => {
    const currentOpenState = this.getIsVfsModalOpen();
    const newOpenState = isOpen ?? !currentOpenState;
    if (currentOpenState !== newOpenState) {
      this.modApiRef?.emit(uiEvent.toggleChatControlPanelRequest, {
        panelId: "core-vfs-modal-panel",
        isOpen: newOpenState,
      });
      this.updateVfsKeyBasedOnContext(); // Ensure key is updated when modal state changes
      this.notifyTriggerUpdate?.();
      this.notifyModalUpdate?.();
    }
  };

  public clearVfsSelection = () => {
    this.modApiRef?.emit(vfsEvent.clearSelectionRequest, undefined);
  };
  public getVfsNodes = () => useVfsStore.getState().nodes;

  public setNotifyTriggerUpdate = (cb: (() => void) | null) => {
    this.notifyTriggerUpdate = cb;
  };
  public setNotifyModalUpdate = (cb: (() => void) | null) => {
    this.notifyModalUpdate = cb;
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

    const unregisterModal = modApi.registerChatControl({
      id: "core-vfs-modal-panel",
      panel: undefined,
      show: () => this.getIsVfsModalOpen(),
      renderer: () => React.createElement(VfsModalPanel, { module: this }),
      status: () => "ready",
    });
    this.unregisterCallbacks.push(unregisterModal);

    // console.log(`[${this.id}] Registered VFS Trigger and Modal Panel.`);
  }

  destroy(): void {
    this.eventUnsubscribers.forEach((unsub) => unsub());
    this.eventUnsubscribers = [];
    this.unregisterCallbacks.forEach((unsub) => unsub());
    this.unregisterCallbacks = [];
    this.notifyTriggerUpdate = null;
    this.notifyModalUpdate = null;
    this.modApiRef = null;
    console.log(`[${this.id}] Destroyed.`);
  }
}
