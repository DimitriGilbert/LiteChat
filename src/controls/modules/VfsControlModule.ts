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
import { useControlRegistryStore } from "@/store/control.store";
import type { TriggerNamespace, TriggerExecutionContext } from "@/types/litechat/text-triggers";
import { nanoid } from "nanoid";

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

    // Register text trigger namespaces
    const triggerNamespaces = this.getTextTriggerNamespaces();
    triggerNamespaces.forEach(namespace => {
      useControlRegistryStore.getState().registerTextTriggerNamespace(namespace);
    });

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

  getTextTriggerNamespaces(): TriggerNamespace[] {
    return [{
      id: 'vfs',
      name: 'VFS',
      methods: {
        add: {
          id: 'add',
          name: 'Add VFS Files',
          description: 'Add files from VFS to the current prompt',
          argSchema: {
            minArgs: 1,
            maxArgs: 10,
            argTypes: ['string' as const]
          },
          handler: this.handleVfsAdd
        },
        open: {
          id: 'open',
          name: 'Open VFS',
          description: 'Open the VFS file explorer',
          argSchema: {
            minArgs: 0,
            maxArgs: 0,
            argTypes: [] as const
          },
          handler: this.handleVfsOpen
        }
      },
      moduleId: this.id
    }];
  }

  private handleVfsAdd = async (args: string[], context: TriggerExecutionContext) => {
    // Add VFS files directly to turnData metadata
    const vfsState = useVfsStore.getState();
    const filePaths = args;
    
    if (!context.turnData.metadata.attachedFiles) {
      context.turnData.metadata.attachedFiles = [];
    }
    
    // Find the nodes by path and add them to turnData
    const filesToAdd = filePaths.map(path => {
      const node = Object.values(vfsState.nodes).find(n => n.path === path);
      return node;
    }).filter(Boolean);
    
    function isVfsFile(node: any): node is { type: 'file', name: string, mimeType?: string, size: number, path: string } {
      return node && node.type === 'file' && typeof node.name === 'string' && typeof node.size === 'number' && typeof node.path === 'string';
    }
    
    for (const node of filesToAdd) {
      if (isVfsFile(node)) {
        context.turnData.metadata.attachedFiles!.push({
          id: nanoid(),
          source: "vfs",
          name: node.name,
          type: node.mimeType || "application/octet-stream",
          size: node.size,
          path: node.path,
        });
      }
    }
  };

  private handleVfsOpen = async (_args: string[], _context: TriggerExecutionContext) => {
    // Open the VFS modal - this is a UI action, no turnData modification needed
    this.modApiRef?.emit(uiEvent.openModalRequest, { 
      modalId: this.modalId 
    });
  };

  destroy(): void {
    this.eventUnsubscribers.forEach((unsub) => unsub());
    this.eventUnsubscribers = [];
    this.unregisterCallbacks.forEach((unsub) => unsub());
    this.unregisterCallbacks = [];

    // Unregister text trigger namespaces
    const triggerNamespaces = this.getTextTriggerNamespaces();
    triggerNamespaces.forEach(namespace => {
      useControlRegistryStore.getState().unregisterTextTriggerNamespace(namespace.id);
    });

    this.notifyTriggerUpdate = null;
    this.modApiRef = null;
    console.log(`[${this.id}] Destroyed.`);
  }
}
