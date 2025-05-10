// src/controls/modules/GitSyncControlModule.ts
// FULL FILE
import React from "react";
import { type ControlModule } from "@/types/litechat/control";
import { type LiteChatModApi } from "@/types/litechat/modding";
import { conversationEvent } from "@/types/litechat/events/conversation.events";
import { interactionEvent } from "@/types/litechat/events/interaction.events";
import { uiEvent } from "@/types/litechat/events/ui.events";
import { syncEvent } from "@/types/litechat/events/sync.events";
import { GitSyncControlTrigger } from "@/controls/components/git-sync/GitSyncControlTrigger";
import { SettingsGit } from "@/controls/components/git-settings/SettingsGit"; // Corrected import path
import { useConversationStore } from "@/store/conversation.store";
import { useInteractionStore } from "@/store/interaction.store";
import type { SyncRepo, SyncStatus } from "@/types/litechat/sync";
import type { SidebarItemType } from "@/types/litechat/chat";

export class GitSyncControlModule implements ControlModule {
  readonly id = "core-git-sync"; // Used for prompt control
  private unregisterPromptControlCallback: (() => void) | null = null;
  private unregisterSettingsTabCallback: (() => void) | null = null;
  private eventUnsubscribers: (() => void)[] = [];

  public selectedItemId: string | null = null;
  public selectedItemType: SidebarItemType | null = null;
  public syncRepos: SyncRepo[] = [];
  public conversationSyncStatus: Record<string, SyncStatus> = {};
  public isStreaming = false;
  private notifyComponentUpdate: (() => void) | null = null;

  async initialize(modApi: LiteChatModApi): Promise<void> {
    this.loadInitialState();

    const unsubContext = modApi.on(uiEvent.contextChanged, (payload) => {
      this.selectedItemId = payload.selectedItemId;
      this.selectedItemType = payload.selectedItemType;
      this.notifyComponentUpdate?.();
    });

    const unsubRepoChanged = modApi.on(syncEvent.repoChanged, () => {
      this.syncRepos = useConversationStore.getState().syncRepos;
      this.notifyComponentUpdate?.();
    });

    const unsubConvSync = modApi.on(
      conversationEvent.syncStatusChanged,
      (payload) => {
        this.conversationSyncStatus = {
          ...this.conversationSyncStatus,
          [payload.conversationId]: payload.status,
        };
        this.notifyComponentUpdate?.();
      }
    );
    const unsubInteractionStatus = modApi.on(
      interactionEvent.statusChanged,
      (payload) => {
        this.isStreaming = payload.status === "streaming";
        this.notifyComponentUpdate?.();
      }
    );
    const unsubConvUpdated = modApi.on(conversationEvent.updated, (payload) => {
      if (
        payload.conversationId === this.selectedItemId &&
        payload.updates.syncRepoId !== undefined
      ) {
        this.loadInitialState(); // Reload to get updated conversation details
        this.notifyComponentUpdate?.();
      }
    });

    this.eventUnsubscribers.push(
      unsubContext,
      unsubRepoChanged,
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
    if (!this.unregisterPromptControlCallback) {
      this.unregisterPromptControlCallback = modApi.registerPromptControl({
        id: this.id,
        triggerRenderer: () =>
          React.createElement(GitSyncControlTrigger, { module: this }),
      });
      console.log(`[${this.id}] Prompt control registered.`);
    }

    if (!this.unregisterSettingsTabCallback) {
      this.unregisterSettingsTabCallback = modApi.registerSettingsTab({
        id: "git", // ID for the settings tab
        title: "Git",
        component: SettingsGit,
        order: 60,
      });
      console.log(`[${this.id}] Settings tab registered.`);
    }
  }

  destroy(): void {
    this.eventUnsubscribers.forEach((unsub) => unsub());
    this.eventUnsubscribers = [];
    if (this.unregisterPromptControlCallback) {
      this.unregisterPromptControlCallback();
      this.unregisterPromptControlCallback = null;
    }
    if (this.unregisterSettingsTabCallback) {
      this.unregisterSettingsTabCallback();
      this.unregisterSettingsTabCallback = null;
    }
    this.notifyComponentUpdate = null;
    console.log(`[${this.id}] Destroyed.`);
  }
}
