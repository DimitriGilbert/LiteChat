import React from "react";
import { type ControlModule } from "@/types/litechat/control";
import { type LiteChatModApi } from "@/types/litechat/modding";
import { conversationEvent } from "@/types/litechat/events/conversation.events";
import { syncEvent } from "@/types/litechat/events/sync.events";
import { ManualSyncSidebarControl } from "@/controls/components/git-sync/ManualSyncSidebarControl";
import { useConversationStore } from "@/store/conversation.store";
import type { SyncRepo, SyncStatus } from "@/types/litechat/sync";

export class ManualSyncSidebarControlModule implements ControlModule {
  readonly id = "core-manual-git-sync-sidebar";
  private unregisterCallback: (() => void) | null = null;
  private eventUnsubscribers: (() => void)[] = [];
  private modApiRef: LiteChatModApi | null = null;

  public syncRepos: SyncRepo[] = [];
  public repoInitializationStatus: Record<string, SyncStatus> = {};
  public isSyncing = false;
  private notifyComponentUpdate: (() => void) | null = null;

  async initialize(modApi: LiteChatModApi): Promise<void> {
    this.modApiRef = modApi;
    this.loadInitialState();

    const unsubRepoChanged = modApi.on(syncEvent.repoChanged, () => {
      this.syncRepos = useConversationStore.getState().syncRepos;
      this.notifyComponentUpdate?.();
    });

    const unsubRepoInitStatus = modApi.on(
      syncEvent.repoInitStatusChanged,
      (payload) => {
        if (
          typeof payload === "object" &&
          payload &&
          "repoId" in payload &&
          "status" in payload
        ) {
          this.repoInitializationStatus = {
            ...this.repoInitializationStatus,
            [payload.repoId]: payload.status,
          };
          this.notifyComponentUpdate?.();
        }
      }
    );

    const unsubSyncReposLoaded = modApi.on(
      conversationEvent.syncReposLoaded,
      () => {
        this.loadInitialState();
        this.notifyComponentUpdate?.();
      }
    );

    this.eventUnsubscribers.push(
      unsubRepoChanged,
      unsubRepoInitStatus,
      unsubSyncReposLoaded
    );
  }

  private loadInitialState() {
    const convState = useConversationStore.getState();
    this.syncRepos = convState.syncRepos;
    this.repoInitializationStatus = convState.repoInitializationStatus;
  }

  public syncAllRepos = async () => {
    if (this.isSyncing || this.syncRepos.length === 0) {
      return;
    }

    this.isSyncing = true;
    this.notifyComponentUpdate?.();

    try {
      console.log("[ManualSyncSidebarControlModule] Starting sync for all repositories");
      
      // Sync all repos in parallel
      const syncPromises = this.syncRepos.map((repo) => 
        this.modApiRef?.emit(conversationEvent.initializeOrSyncRepoRequest, {
          repoId: repo.id,
        })
      );

      await Promise.allSettled(syncPromises);
      console.log("[ManualSyncSidebarControlModule] Completed sync for all repositories");
    } catch (error) {
      console.error("[ManualSyncSidebarControlModule] Error syncing all repos:", error);
    } finally {
      this.isSyncing = false;
      this.notifyComponentUpdate?.();
    }
  };

  public syncRepo = async (repoId: string) => {
    const repo = this.syncRepos.find(r => r.id === repoId);
    if (!repo) {
      console.warn(`[ManualSyncSidebarControlModule] Repository ${repoId} not found`);
      return;
    }

    console.log(`[ManualSyncSidebarControlModule] Starting sync for repository: ${repo.name}`);
    this.modApiRef?.emit(conversationEvent.initializeOrSyncRepoRequest, {
      repoId,
    });
  };

  public setNotifyCallback = (cb: (() => void) | null) => {
    this.notifyComponentUpdate = cb;
  };

  register(modApi: LiteChatModApi): void {
    this.modApiRef = modApi;
    if (this.unregisterCallback) {
      console.warn(`[${this.id}] Already registered. Skipping.`);
      return;
    }

    const renderer = () =>
      React.createElement(ManualSyncSidebarControl, { module: this });

    this.unregisterCallback = modApi.registerChatControl({
      id: this.id,
      panel: "sidebar-footer",
      status: () => "ready",
      renderer: renderer,
      iconRenderer: renderer,
      show: () => true,
    });
  }

  destroy(): void {
    this.eventUnsubscribers.forEach((unsub) => unsub());
    this.eventUnsubscribers = [];
    if (this.unregisterCallback) {
      this.unregisterCallback();
      this.unregisterCallback = null;
    }
    this.notifyComponentUpdate = null;
    this.modApiRef = null;
    console.log(`[${this.id}] Destroyed.`);
  }
} 