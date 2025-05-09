// src/controls/modules/GitSyncControlModule.ts
// FULL FILE
import React from "react";
import { type ControlModule } from "@/types/litechat/control";
import {
  type LiteChatModApi,
  ConversationEvent,
  InteractionEvent,
  UiEvent,
  SyncEvent, // Added SyncEvent for repo changes
} from "@/types/litechat/modding";
import { GitSyncControlTrigger } from "@/controls/components/git-sync/GitSyncControlTrigger";
import { useConversationStore } from "@/store/conversation.store";
import { useInteractionStore } from "@/store/interaction.store";
import type { SyncRepo, SyncStatus } from "@/types/litechat/sync";
import type { SidebarItemType } from "@/types/litechat/chat";

export class GitSyncControlModule implements ControlModule {
  readonly id = "core-git-sync";
  private unregisterCallback: (() => void) | null = null;
  private eventUnsubscribers: (() => void)[] = [];

  public selectedItemId: string | null = null;
  public selectedItemType: SidebarItemType | null = null;
  public syncRepos: SyncRepo[] = [];
  public conversationSyncStatus: Record<string, SyncStatus> = {};
  public isStreaming = false;
  private notifyComponentUpdate: (() => void) | null = null;

  async initialize(modApi: LiteChatModApi): Promise<void> {
    this.loadInitialState();

    const unsubContext = modApi.on(UiEvent.CONTEXT_CHANGED, (payload) => {
      this.selectedItemId = payload.selectedItemId;
      this.selectedItemType = payload.selectedItemType;
      this.notifyComponentUpdate?.();
    });

    // Listen to SyncEvent.REPO_CHANGED to update the list of syncRepos
    const unsubRepoChanged = modApi.on(SyncEvent.REPO_CHANGED, () => {
      this.syncRepos = useConversationStore.getState().syncRepos;
      this.notifyComponentUpdate?.();
    });

    const unsubConvSync = modApi.on(
      ConversationEvent.SYNC_STATUS_CHANGED,
      (payload) => {
        this.conversationSyncStatus = {
          ...this.conversationSyncStatus,
          [payload.conversationId]: payload.status,
        };
        this.notifyComponentUpdate?.();
      }
    );
    const unsubInteractionStatus = modApi.on(
      InteractionEvent.STATUS_CHANGED,
      (payload) => {
        this.isStreaming = payload.status === "streaming";
        this.notifyComponentUpdate?.();
      }
    );
    const unsubConvUpdated = modApi.on(ConversationEvent.UPDATED, (payload) => {
      if (
        payload.conversationId === this.selectedItemId &&
        payload.updates.syncRepoId !== undefined
      ) {
        this.loadInitialState();
        this.notifyComponentUpdate?.();
      }
    });

    this.eventUnsubscribers.push(
      unsubContext,
      unsubRepoChanged, // Use the new listener
      unsubConvSync,
      unsubInteractionStatus,
      unsubConvUpdated
    );
    console.log(`[${this.id}] Initialized.`);
  }

  private loadInitialState() {
    const convState = useConversationStore.getState();
    this.selectedItemId = convState.selectedItemId;
    this.selectedItemType = convState.selectedItemType;
    this.syncRepos = convState.syncRepos;
    this.conversationSyncStatus = convState.conversationSyncStatus;
    this.isStreaming = useInteractionStore.getState().status === "streaming";
  }

  public linkConversationToRepo = (
    conversationId: string,
    repoId: string | null
  ) => {
    return useConversationStore
      .getState()
      .linkConversationToRepo(conversationId, repoId);
  };
  public syncConversation = (conversationId: string) => {
    return useConversationStore.getState().syncConversation(conversationId);
  };
  public getConversationById = (id: string | null) => {
    return useConversationStore.getState().getConversationById(id);
  };

  public setNotifyCallback = (cb: (() => void) | null) => {
    this.notifyComponentUpdate = cb;
  };

  register(modApi: LiteChatModApi): void {
    if (this.unregisterCallback) {
      console.warn(`[${this.id}] Already registered. Skipping.`);
      return;
    }
    this.unregisterCallback = modApi.registerPromptControl({
      id: this.id,
      triggerRenderer: () =>
        React.createElement(GitSyncControlTrigger, { module: this }),
      show: () =>
        this.selectedItemType === "conversation" && this.syncRepos.length > 0,
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
    this.notifyComponentUpdate = null;
    console.log(`[${this.id}] Destroyed.`);
  }
}
