// src/controls/modules/VfsControlModule.ts
// FULL FILE
import React from "react";
import { type ControlModule } from "@/types/litechat/control";
import {
  type LiteChatModApi,
  // UiEvent, // Not directly used by this module's logic
} from "@/types/litechat/modding";
import { VfsTriggerButton } from "@/controls/components/vfs/VfsTriggerButton";
import { VfsModalPanel } from "@/controls/components/vfs/VfsModalPanel";
import { useVfsStore } from "@/store/vfs.store";
import { useUIStateStore } from "@/store/ui.store";

export class VfsControlModule implements ControlModule {
  readonly id = "core-vfs";
  private unregisterCallbacks: (() => void)[] = [];
  private eventUnsubscribers: (() => void)[] = [];

  // @ts-expect-error - ts have not seeing it is used, keep it for now. **KEEP IT**
  private notifyTriggerUpdate: (() => void) | null = null;
  // @ts-expect-error - ts have not seeing it is used, keep it for now. **KEEP IT**
  private notifyModalUpdate: (() => void) | null = null;

  async initialize(_modApi: LiteChatModApi): Promise<void> {
    // modApi parameter is available here if needed for initialization logic
    // Initial state is read by getters directly from stores.
    console.log(`[${this.id}] Initialized.`);
  }

  public getEnableVfs = (): boolean => useVfsStore.getState().enableVfs;
  public getIsVfsModalOpen = (): boolean =>
    useUIStateStore.getState().isVfsModalOpen;
  public getSelectedFileIdsCount = (): number =>
    useVfsStore.getState().selectedFileIds.size;

  public toggleVfsModal = (isOpen?: boolean) => {
    useUIStateStore.getState().toggleVfsModal(isOpen);
  };

  public clearVfsSelection = () => useVfsStore.getState().clearSelection();
  public getVfsNodes = () => useVfsStore.getState().nodes;

  public setNotifyTriggerUpdate = (cb: (() => void) | null) => {
    this.notifyTriggerUpdate = cb;
  };
  public setNotifyModalUpdate = (cb: (() => void) | null) => {
    this.notifyModalUpdate = cb;
  };

  register(modApi: LiteChatModApi): void {
    if (this.unregisterCallbacks.length > 0) {
      console.warn(`[${this.id}] Already registered. Skipping.`);
      return;
    }

    const unregisterTrigger = modApi.registerPromptControl({
      id: "core-vfs-prompt-trigger",
      show: () => this.getEnableVfs(),
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

    console.log(`[${this.id}] Registered VFS Trigger and Modal Panel.`);
  }

  destroy(): void {
    this.eventUnsubscribers.forEach((unsub) => unsub());
    this.eventUnsubscribers = [];
    this.unregisterCallbacks.forEach((unsub) => unsub());
    this.unregisterCallbacks = [];
    this.notifyTriggerUpdate = null;
    this.notifyModalUpdate = null;
    console.log(`[${this.id}] Destroyed.`);
  }
}
