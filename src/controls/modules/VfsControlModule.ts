// src/controls/modules/VfsControlModule.ts
// FULL FILE
import React from "react";
import { type ControlModule } from "@/types/litechat/control";
import {
  type LiteChatModApi,
  UiEvent, // Added UiEvent
} from "@/types/litechat/modding";
import { VfsTriggerButton } from "@/controls/components/vfs/VfsTriggerButton";
import { VfsModalPanel } from "@/controls/components/vfs/VfsModalPanel";
import { useVfsStore } from "@/store/vfs.store";
import { useUIStateStore } from "@/store/ui.store";
import { useConversationStore } from "@/store/conversation.store"; // To get context

export class VfsControlModule implements ControlModule {
  readonly id = "core-vfs";
  private unregisterCallbacks: (() => void)[] = [];
  private eventUnsubscribers: (() => void)[] = [];

  private notifyTriggerUpdate: (() => void) | null = null;
  private notifyModalUpdate: (() => void) | null = null;

  async initialize(modApi: LiteChatModApi): Promise<void> {
    this.updateVfsKeyBasedOnContext(); // Initial update

    // Listen to UI context changes (selected item, modal state)
    const unsubUiContext = modApi.on(UiEvent.CONTEXT_CHANGED, () => {
      this.updateVfsKeyBasedOnContext();
      this.notifyTriggerUpdate?.(); // Notify trigger if its display depends on VFS state
      this.notifyModalUpdate?.(); // Notify modal if its display depends on VFS state
    });

    // Direct subscription to UIStateStore for modal changes might be cleaner if pattern allows
    // For now, assuming UIStateStore emits an event or we poll/check it.
    // A more robust way would be for UIStateStore to emit a specific event for modal changes.
    // Let's assume for now that UiEvent.CONTEXT_CHANGED is sufficient or that
    // the modal's `show` condition re-evaluates frequently enough.
    // Alternatively, the VFS modal component itself can react to UIStateStore.

    this.eventUnsubscribers.push(unsubUiContext);
    console.log(`[${this.id}] Initialized.`);
  }

  private updateVfsKeyBasedOnContext() {
    const { selectedItemId, selectedItemType } =
      useConversationStore.getState();
    const { isVfsModalOpen } = useUIStateStore.getState();
    const { vfsKey: currentVfsStoreKey, setVfsKey } = useVfsStore.getState();

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
        // If modal is open but no specific project/convo context, default to orphan
        // This case might need refinement based on desired UX when opening VFS from a global context
        targetVfsKey = "orphan";
      }
    }
    // If neither modal is open nor a project is selected, VFS key should be null (inactive)
    // unless a conversation is selected, then it's its project or orphan.
    else if (selectedItemType === "conversation") {
      const convo = useConversationStore
        .getState()
        .getConversationById(selectedItemId);
      targetVfsKey = convo?.projectId ?? "orphan";
    }

    if (currentVfsStoreKey !== targetVfsKey) {
      console.log(
        `[${this.id}] Updating VFS key from "${currentVfsStoreKey}" to "${targetVfsKey}"`
      );
      setVfsKey(targetVfsKey);
    }
  }

  public getEnableVfs = (): boolean => useVfsStore.getState().enableVfs;
  public getIsVfsModalOpen = (): boolean =>
    useUIStateStore.getState().isVfsModalOpen;
  public getSelectedFileIdsCount = (): number =>
    useVfsStore.getState().selectedFileIds.size;

  public toggleVfsModal = (isOpen?: boolean) => {
    useUIStateStore.getState().toggleVfsModal(isOpen);
    // VFS key update will be handled by the event listener or next context check
    this.updateVfsKeyBasedOnContext(); // Explicitly update on toggle
    this.notifyTriggerUpdate?.();
    this.notifyModalUpdate?.();
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
      panel: undefined, // This means it's a modal, not in a fixed panel
      show: () => this.getIsVfsModalOpen(), // Controlled by UIStateStore
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
