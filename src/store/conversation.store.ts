// src/store/conversation.store.ts
// FULL FILE
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { Conversation, SidebarItemType } from "@/types/litechat/chat";
import type { SyncRepo, SyncStatus } from "@/types/litechat/sync";
import type { Project } from "@/types/litechat/project";
import { PersistenceService } from "@/services/persistence.service";
import { nanoid } from "nanoid";
import { toast } from "sonner";
import { normalizePath } from "@/lib/litechat/file-manager-utils";
import {
  initializeOrSyncRepoLogic,
  syncConversationLogic,
} from "@/services/sync.service";
import { ImportExportService } from "@/services/import-export.service";
import { SYNC_VFS_KEY } from "@/lib/litechat/constants";
import type { fs } from "@zenfs/core";
import * as VfsOps from "@/lib/litechat/vfs-operations";
import { emitter } from "@/lib/litechat/event-emitter";
import {
  conversationEvent,
  ConversationEventPayloads,
} from "@/types/litechat/events/conversation.events";
import { syncEvent } from "@/types/litechat/events/sync.events";
import type {
  RegisteredActionHandler,
  ActionHandler,
} from "@/types/litechat/control";
import { interactionEvent } from "@/types/litechat/events/interaction.events";
import { vfsEvent, VfsEventPayloads } from "@/types/litechat/events/vfs.events";
import { useVfsStore } from "./vfs.store";

export type SidebarItem =
  | (Conversation & { itemType: "conversation" })
  | (Project & { itemType: "project" });

interface ConversationState {
  conversations: Conversation[];
  selectedItemId: string | null;
  selectedItemType: SidebarItemType | null;
  syncRepos: SyncRepo[];
  conversationSyncStatus: Record<string, SyncStatus>;
  repoInitializationStatus: Record<string, SyncStatus>;
  isLoading: boolean;
  error: string | null;
}

interface ConversationActions {
  // Public actions
  loadConversations: () => Promise<void>;
  addConversation: (
    data: Partial<Omit<Conversation, "id" | "createdAt">> & {
      title: string;
      projectId?: string | null;
    }
  ) => Promise<string>;
  updateConversation: (
    id: string,
    updates: Partial<Omit<Conversation, "id" | "createdAt">>
  ) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  selectItem: (
    id: string | null,
    type: SidebarItemType | null
  ) => Promise<void>;
  importConversation: (file: File) => Promise<void>;
  exportConversation: (
    conversationId: string,
    format: "json" | "md"
  ) => Promise<void>;
  exportProject: (projectId: string) => Promise<void>;
  exportAllConversations: () => Promise<void>;
  loadSyncRepos: () => Promise<void>;
  addSyncRepo: (
    repoData: Omit<SyncRepo, "id" | "createdAt" | "updatedAt">
  ) => Promise<string>;
  updateSyncRepo: (
    id: string,
    updates: Partial<Omit<SyncRepo, "id" | "createdAt">>
  ) => Promise<void>;
  deleteSyncRepo: (id: string) => Promise<void>;
  linkConversationToRepo: (
    conversationId: string,
    repoId: string | null
  ) => Promise<void>;
  syncConversation: (conversationId: string) => Promise<void>;
  initializeOrSyncRepo: (repoId: string) => Promise<void>;
  getConversationById: (id: string | null) => Conversation | undefined;
  updateCurrentConversationToolSettings: (settings: {
    enabledTools?: string[];
    toolMaxStepsOverride?: number | null;
  }) => Promise<void>;

  // Internal helpers
  _setConversationSyncStatus: (
    conversationId: string,
    status: SyncStatus,
    error?: string | null
  ) => void;
  _setRepoInitializationStatus: (repoId: string, status: SyncStatus) => void;
  _ensureSyncVfsReady: () => Promise<typeof fs>;
  _unlinkConversationsFromProjects: (projectIds: string[]) => void;
  getRegisteredActionHandlers: () => RegisteredActionHandler[];
}

const SYNC_REPO_BASE_DIR = "/synced_repos";

export const useConversationStore = create(
  immer<ConversationState & ConversationActions>((set, get) => ({
    conversations: [],
    selectedItemId: null,
    selectedItemType: null,
    syncRepos: [],
    conversationSyncStatus: {},
    repoInitializationStatus: {},
    isLoading: false,
    error: null,

    _ensureSyncVfsReady: async () => {
      console.log("[ConversationStore] Ensuring Sync VFS is ready...");
      
      // Check if VFS is stuck in initializing state and reset if needed
      const vfsState = useVfsStore.getState();
      if (vfsState.initializingKey === SYNC_VFS_KEY) {
        console.warn("[ConversationStore] VFS appears stuck in initializing state, resetting...");
        useVfsStore.getState().resetStuckInitialization();
      }
      
      return new Promise<typeof fs>((resolve, reject) => {
        let timeoutId: NodeJS.Timeout | null = null;
        
        const cleanupSubscriptions = () => {
          emitter.off(vfsEvent.fsInstanceChanged, handleFsInstanceChanged);
          emitter.off(vfsEvent.loadingStateChanged, handleLoadingStateChanged);
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }
        };

        const handleFsInstanceChanged = (
          payload: VfsEventPayloads[typeof vfsEvent.fsInstanceChanged]
        ) => {
          const vfsState = useVfsStore.getState();
          if (
            vfsState.configuredVfsKey === SYNC_VFS_KEY &&
            payload.fsInstance
          ) {
            console.log(
              `[ConversationStore] Sync VFS ready via fsInstanceChanged for key ${SYNC_VFS_KEY}.`
            );
            cleanupSubscriptions();
            resolve(payload.fsInstance as typeof fs);
          }
        };

        const handleLoadingStateChanged = (
          payload: VfsEventPayloads[typeof vfsEvent.loadingStateChanged]
        ) => {
          const vfsState = useVfsStore.getState();
          if (vfsState.configuredVfsKey === SYNC_VFS_KEY) {
            if (payload.error) {
              console.error(
                `[ConversationStore] Sync VFS initialization error for key ${SYNC_VFS_KEY}: ${payload.error}`
              );
              cleanupSubscriptions();
              reject(new Error(payload.error));
            } else if (
              !payload.isLoading &&
              !payload.operationLoading &&
              vfsState.fs
            ) {
              console.log(
                `[ConversationStore] Sync VFS ready via loadingStateChanged for key ${SYNC_VFS_KEY}.`
              );
              cleanupSubscriptions();
              resolve(vfsState.fs);
            }
          }
        };

        emitter.on(vfsEvent.fsInstanceChanged, handleFsInstanceChanged);
        emitter.on(vfsEvent.loadingStateChanged, handleLoadingStateChanged);

        // Check current state first
        const currentVfsState = useVfsStore.getState();
        if (
          currentVfsState.configuredVfsKey === SYNC_VFS_KEY &&
          currentVfsState.fs &&
          !currentVfsState.loading &&
          !currentVfsState.operationLoading &&
          !currentVfsState.error
        ) {
          console.log(
            `[ConversationStore] Sync VFS already ready for key ${SYNC_VFS_KEY}.`
          );
          cleanupSubscriptions();
          resolve(currentVfsState.fs);
          return;
        }

        // Set up timeout
        timeoutId = setTimeout(() => {
          const errorMsg = `Timeout waiting for Sync VFS (${SYNC_VFS_KEY}) to become ready.`;
          console.error(`[ConversationStore] ${errorMsg}`);
          cleanupSubscriptions();
          reject(new Error(errorMsg));
        }, 30000); // 30 second timeout

        emitter.emit(vfsEvent.initializeVFSRequest, {
          vfsKey: SYNC_VFS_KEY,
          options: { force: true },
        });
      });
    },

    loadConversations: async () => {
      set({ isLoading: true, error: null });
      try {
        const [dbConvos, dbSyncRepos] = await Promise.all([
          PersistenceService.loadConversations(),
          PersistenceService.loadSyncRepos(),
        ]);

        const initialStatus: Record<string, SyncStatus> = {};
        dbConvos.forEach((c) => {
          if (c.syncRepoId) {
            const lastSyncTime =
              c.lastSyncedAt instanceof Date ? c.lastSyncedAt.getTime() : null;
            const updatedTime =
              c.updatedAt instanceof Date ? c.updatedAt.getTime() : null;

            if (!lastSyncTime) {
              initialStatus[c.id] = "needs-sync";
            } else if (updatedTime && updatedTime > lastSyncTime) {
              initialStatus[c.id] = "needs-sync";
            } else {
              initialStatus[c.id] = "idle";
            }
          } else {
            initialStatus[c.id] = "idle";
          }
        });

        set({
          conversations: dbConvos,
          syncRepos: dbSyncRepos,
          conversationSyncStatus: initialStatus,
          repoInitializationStatus: {},
          isLoading: false,
        });
        emitter.emit(conversationEvent.conversationsLoaded, {
          conversations: dbConvos,
        });
        emitter.emit(conversationEvent.syncReposLoaded, {
          repos: dbSyncRepos,
        });
      } catch (e) {
        console.error("ConversationStore: Error loading conversations", e);
        set({ error: "Failed load conversations", isLoading: false });
        emitter.emit(conversationEvent.loadingStateChanged, {
          isLoading: false,
          error: "Failed load conversations",
        });
      }
    },

    addConversation: async (conversationData) => {
      const newId = nanoid();
      const now = new Date();
      const newConversation: Conversation = {
        id: newId,
        createdAt: now,
        updatedAt: now,
        title: conversationData.title,
        projectId: conversationData.projectId ?? null,
        metadata: {
          ...(conversationData.metadata ?? {}),
          enabledTools: [],
          toolMaxStepsOverride: null,
        },
        syncRepoId: conversationData.syncRepoId ?? null,
        lastSyncedAt: conversationData.lastSyncedAt ?? null,
      };

      let savedSuccessfully = false;
      try {
        // First try to save to persistence to ensure it works
        const plainData = JSON.stringify(newConversation);
        await PersistenceService.saveConversation(JSON.parse(plainData));
        savedSuccessfully = true;

        // Then update the state
        set((state) => {
          if (!state.conversations.some((c) => c.id === newConversation.id)) {
            state.conversations.unshift(newConversation);
            state.conversationSyncStatus[newId] = newConversation.syncRepoId
              ? "needs-sync"
              : "idle";
          }
        });

        // Finally emit the event
        emitter.emit(conversationEvent.conversationAdded, {
          conversation: newConversation,
        });

        return newId;
      } catch (e) {
        console.error("ConversationStore: Error adding conversation", e);

        // Only rollback state if we managed to save but failed to update state
        if (savedSuccessfully) {
          set((state) => ({
            error: "Failed to save new conversation to state",
            conversations: state.conversations.filter((c) => c.id !== newId),
            conversationSyncStatus: Object.fromEntries(
              Object.entries(state.conversationSyncStatus).filter(
                ([id]) => id !== newId
              )
            ),
          }));
        }

        throw e;
      }
    },

    updateConversation: async (id, updates) => {
      const originalConversation = get().getConversationById(id);
      if (!originalConversation) {
        console.warn(
          `ConversationStore: Conversation ${id} not found for update.`
        );
        return;
      }

      set((state) => {
        const index = state.conversations.findIndex((c) => c.id === id);
        if (index !== -1) {
          const existingMeta = state.conversations[index].metadata ?? {};
          const updateMeta = updates.metadata ?? {};
          const mergedMeta = { ...existingMeta, ...updateMeta };

          Object.assign(state.conversations[index], {
            ...updates,
            metadata: mergedMeta,
            updatedAt: new Date(),
          });

          const relevantFieldsChanged = ["title", "metadata", "projectId"].some(
            (field) => field in updates
          );

          const lastSyncTime =
            state.conversations[index].lastSyncedAt instanceof Date
              ? state.conversations[index].lastSyncedAt!.getTime()
              : null;
          const updatedTime = state.conversations[index].updatedAt.getTime();

          if ("syncRepoId" in updates) {
            state.conversationSyncStatus[id] = updates.syncRepoId
              ? "needs-sync"
              : "idle";
          } else if (
            relevantFieldsChanged &&
            state.conversations[index].syncRepoId &&
            state.conversationSyncStatus[id] === "idle"
          ) {
            if (!lastSyncTime || updatedTime > lastSyncTime) {
              state.conversationSyncStatus[id] = "needs-sync";
            }
          }
        }
      });

      const updatedConversationData = get().getConversationById(id);

      if (updatedConversationData) {
        try {
          const plainData = JSON.parse(JSON.stringify(updatedConversationData));
          await PersistenceService.saveConversation(plainData);
          emitter.emit(conversationEvent.conversationUpdated, {
            conversationId: id,
            updates: updates,
          });
        } catch (e) {
          console.error("ConversationStore: Error updating conversation", e);
          set((state) => {
            const index = state.conversations.findIndex((c) => c.id === id);
            if (index !== -1) {
              state.conversations[index] = originalConversation;
              const originalLastSyncTime =
                originalConversation.lastSyncedAt instanceof Date
                  ? originalConversation.lastSyncedAt.getTime()
                  : null;
              const originalUpdatedTime =
                originalConversation.updatedAt.getTime();
              state.conversationSyncStatus[id] =
                originalConversation.syncRepoId &&
                originalLastSyncTime &&
                originalUpdatedTime <= originalLastSyncTime
                  ? "idle"
                  : originalConversation.syncRepoId
                  ? "needs-sync"
                  : "idle";
            }
            state.error = "Failed to save conversation update";
          });
          throw e;
        }
      } else {
        console.error(
          "ConversationStore: Failed to retrieve updated conversation state after update."
        );
        set((state) => {
          const index = state.conversations.findIndex((c) => c.id === id);
          if (index !== -1) {
            state.conversations[index] = originalConversation;
            const originalLastSyncTime =
              originalConversation.lastSyncedAt instanceof Date
                ? originalConversation.lastSyncedAt.getTime()
                : null;
            const originalUpdatedTime =
              originalConversation.updatedAt.getTime();
            state.conversationSyncStatus[id] =
              originalConversation.syncRepoId &&
              originalLastSyncTime &&
              originalUpdatedTime <= originalLastSyncTime
                ? "idle"
                : originalConversation.syncRepoId
                ? "needs-sync"
                : "idle";
          }
          state.error = "Failed to save conversation update (state error)";
        });
      }
    },

    deleteConversation: async (id) => {
      const currentSelectedId = get().selectedItemId;
      const currentSelectedType = get().selectedItemType;
      const conversationToDelete = get().conversations.find((c) => c.id === id);
      if (!conversationToDelete) return;

      set((state) => ({
        conversations: state.conversations.filter((c) => c.id !== id),
        selectedItemId:
          currentSelectedId === id && currentSelectedType === "conversation"
            ? null
            : currentSelectedId,
        selectedItemType:
          currentSelectedId === id && currentSelectedType === "conversation"
            ? null
            : currentSelectedType,
        conversationSyncStatus: Object.fromEntries(
          Object.entries(state.conversationSyncStatus).filter(
            ([convoId]) => convoId !== id
          )
        ),
      }));

      try {
        await PersistenceService.deleteConversation(id);
        await PersistenceService.deleteInteractionsForConversation(id);
        emitter.emit(conversationEvent.conversationDeleted, {
          conversationId: id,
        });

        if (
          currentSelectedId === id &&
          currentSelectedType === "conversation"
        ) {
          emitter.emit(interactionEvent.setCurrentConversationIdRequest, {
            id: null,
          });
          emitter.emit(conversationEvent.selectedItemChanged, {
            itemId: null,
            itemType: null,
          });
        }
      } catch (e) {
        console.error("ConversationStore: Error deleting conversation", e);
        set((state) => {
          if (conversationToDelete) {
            state.conversations.push(conversationToDelete);
            const originalLastSyncTime =
              conversationToDelete.lastSyncedAt instanceof Date
                ? conversationToDelete.lastSyncedAt.getTime()
                : null;
            const originalUpdatedTime =
              conversationToDelete.updatedAt.getTime();
            state.conversationSyncStatus[id] =
              conversationToDelete.syncRepoId &&
              originalLastSyncTime &&
              originalUpdatedTime <= originalLastSyncTime
                ? "idle"
                : conversationToDelete.syncRepoId
                ? "needs-sync"
                : "idle";
          }
          if (
            currentSelectedId === id &&
            currentSelectedType === "conversation"
          ) {
            state.selectedItemId = id;
            state.selectedItemType = "conversation";
          }
          state.error = "Failed to delete conversation";
        });
        throw e;
      }
    },

    selectItem: async (id, type) => {
      const currentSelId = get().selectedItemId;
      const currentSelType = get().selectedItemType;

      if (currentSelId === id && currentSelType === type) {
        return;
      }

      console.log(
        `ConversationStore: Selecting item. ID: ${id}, Type: ${type}. Previous: ${currentSelId} (${currentSelType})`
      );

      // Update interaction store first if needed
      const conversationIdForInteractions = type === "conversation" ? id : null;
      if (conversationIdForInteractions) {
        emitter.emit(interactionEvent.setCurrentConversationIdRequest, {
          id: conversationIdForInteractions,
        });
        // Ensure interactions are loaded for the selected conversation
        emitter.emit(interactionEvent.loadInteractionsRequest, {
          conversationId: conversationIdForInteractions,
        });
      }

      // Then update local state
      set({ selectedItemId: id, selectedItemType: type });

      // Finally notify about the selection change
      emitter.emit(conversationEvent.selectedItemChanged, {
        itemId: id,
        itemType: type,
      });
    },

    importConversation: async (file) => {
      await ImportExportService.importConversation(
        file,
        get().addConversation,
        get().selectItem
      );
    },
    exportConversation: async (conversationId, format) => {
      await ImportExportService.exportConversation(conversationId, format);
    },
    exportProject: async (projectId) => {
      await ImportExportService.exportProject(projectId);
    },
    exportAllConversations: async () => {
      await ImportExportService.exportAllConversations();
    },

    loadSyncRepos: async () => {
      if (get().isLoading) return;
      set({ isLoading: true, error: null });
      try {
        const repos = await PersistenceService.loadSyncRepos();
        set({ syncRepos: repos, isLoading: false });
        emitter.emit(conversationEvent.syncReposLoaded, { repos });
      } catch (e) {
        console.error("ConversationStore: Error loading sync repos", e);
        set({ error: "Failed load sync repositories", isLoading: false });
        emitter.emit(conversationEvent.loadingStateChanged, {
          isLoading: false,
          error: "Failed load sync repositories",
        });
      }
    },

    addSyncRepo: async (repoData) => {
      const newId = nanoid();
      const now = new Date();
      const newRepo: SyncRepo = {
        id: newId,
        createdAt: now,
        updatedAt: now,
        name: repoData.name,
        remoteUrl: repoData.remoteUrl,
        branch: repoData.branch || "main",
        username: repoData.username ?? null,
        password: repoData.password ?? null,
      };
      set((state) => {
        state.syncRepos.push(newRepo);
      });
      try {
        const repoToSave = get().syncRepos.find((r) => r.id === newId);
        if (repoToSave) {
          const plainData = JSON.parse(JSON.stringify(repoToSave));
          await PersistenceService.saveSyncRepo(plainData);
          emitter.emit(syncEvent.repoChanged, {
            repoId: newId,
            action: "added",
          });
        } else {
          throw new Error("Failed to retrieve newly added sync repo state");
        }
        toast.success(`Sync repository "${newRepo.name}" added.`);
        
        // Automatically initialize/clone the repository after adding it
        try {
          await get().initializeOrSyncRepo(newId);
        } catch (initError) {
          console.warn(`Failed to automatically initialize repository "${newRepo.name}":`, initError);
          toast.warning(`Repository "${newRepo.name}" added but initialization failed. You can manually sync it later.`);
          // Don't fail the entire operation if initialization fails
        }
        
        return newId;
      } catch (e) {
        console.error("ConversationStore: Error adding sync repo", e);
        set((state) => ({
          error: "Failed to save sync repository",
          syncRepos: state.syncRepos.filter((r) => r.id !== newId),
        }));
        throw e;
      }
    },

    updateSyncRepo: async (id, updates) => {
      const originalRepo = get().syncRepos.find((r) => r.id === id);
      if (!originalRepo) {
        console.warn(`ConversationStore: SyncRepo ${id} not found.`);
        return;
      }

      set((state) => {
        const index = state.syncRepos.findIndex((r) => r.id === id);
        if (index !== -1) {
          Object.assign(state.syncRepos[index], {
            ...updates,
            branch: updates.branch || state.syncRepos[index].branch || "main",
            updatedAt: new Date(),
          });
        }
      });

      const repoToSave = get().syncRepos.find((r) => r.id === id);

      if (repoToSave) {
        try {
          const plainData = JSON.parse(JSON.stringify(repoToSave));
          await PersistenceService.saveSyncRepo(plainData);
          emitter.emit(syncEvent.repoChanged, {
            repoId: id,
            action: "updated",
          });
          toast.success(`Sync repository "${repoToSave.name}" updated.`);
        } catch (e) {
          console.error("ConversationStore: Error updating sync repo", e);
          set((state) => {
            const index = state.syncRepos.findIndex((r) => r.id === id);
            if (index !== -1) {
              state.syncRepos[index] = originalRepo;
            }
            state.error = "Failed to save sync repository update";
          });
          throw e;
        }
      } else {
        console.error(
          "ConversationStore: Failed to retrieve updated sync repo state after update."
        );
        set((state) => {
          const index = state.syncRepos.findIndex((r) => r.id === id);
          if (index !== -1) {
            state.syncRepos[index] = originalRepo;
          }
          state.error = "Failed to save sync repository update (state error)";
        });
      }
    },

        deleteSyncRepo: async (id) => {
      const repoToDelete = get().syncRepos.find((r) => r.id === id);
      if (!repoToDelete) return;

      try {
        // First ensure sync VFS is ready (same pattern as sync operations)
        let fsInstance: typeof fs;
        try {
          fsInstance = await get()._ensureSyncVfsReady();
        } catch (fsError) {
          console.error("ConversationStore: Failed to initialize sync VFS for deletion", fsError);
          toast.error("Failed to initialize filesystem for deletion. Repository not deleted.");
          throw fsError;
        }

        // Delete from database
        await PersistenceService.deleteSyncRepo(id);
        
        // Delete VFS files (now we have proper VFS instance)
        const repoDir = normalizePath(`${SYNC_REPO_BASE_DIR}/${id}`);
        try {
          await VfsOps.deleteItemOp(repoDir, true, { fsInstance });
          console.log(`[ConversationStore] Successfully deleted VFS directory: ${repoDir}`);
        } catch (vfsError: any) {
          console.error(`[ConversationStore] Failed to delete VFS directory ${repoDir}:`, vfsError);
          if (vfsError.code !== "ENOENT") {
            console.warn(`Could not remove local sync folder for "${repoToDelete.name}": ${vfsError.message}`);
            // Don't fail the entire operation if VFS cleanup fails
          }
        }
        
        // Remove from state after successful operations
        set((state) => ({
          syncRepos: state.syncRepos.filter((r) => r.id !== id),
          repoInitializationStatus: Object.fromEntries(
            Object.entries(state.repoInitializationStatus).filter(
              ([repoId]) => repoId !== id
            )
          ),
        }));

        emitter.emit(syncEvent.repoChanged, {
          repoId: id,
          action: "deleted",
        });
        toast.success(`Sync repository "${repoToDelete.name}" deleted.`);
        
      } catch (e) {
        console.error("ConversationStore: Error deleting sync repo", e);
        set((state) => {
          state.error = "Failed to delete sync repository";
        });
        throw e;
      }
    },



    linkConversationToRepo: async (conversationId, repoId) => {
      await get().updateConversation(conversationId, {
        syncRepoId: repoId,
        lastSyncedAt: null,
      });
      get()._setConversationSyncStatus(
        conversationId,
        repoId ? "needs-sync" : "idle"
      );
      toast.info(
        `Conversation ${
          repoId ? "linked to" : "unlinked from"
        } sync repository.`
      );
    },

    _setConversationSyncStatus: (conversationId, status, error = null) => {
      set((state) => {
        state.conversationSyncStatus[conversationId] = status;
        if (status === "error" && error) {
          console.error(`Sync error for ${conversationId}: ${error}`);
        }
      });
      emitter.emit(conversationEvent.conversationSyncStatusChanged, {
        conversationId,
        status,
      });
    },

    _setRepoInitializationStatus: (
      repoId: string,
      status: SyncStatus
    ): void => {
      set((state) => {
        state.repoInitializationStatus[repoId] = status;
      });
      emitter.emit(syncEvent.repoInitStatusChanged, { repoId, status });
    },

    initializeOrSyncRepo: async (repoId) => {
      const repo = get().syncRepos.find((r) => r.id === repoId);
      if (!repo) {
        toast.error("Sync repsitory configuration not found.");
        return;
      }
      let fsInstance: typeof fs;
      try {
        fsInstance = await get()._ensureSyncVfsReady();
      } catch (fsError) {
        get()._setRepoInitializationStatus(repoId, "error");
        return;
      }
      await initializeOrSyncRepoLogic(
        fsInstance,
        repo,
        get()._setRepoInitializationStatus
      );
    },

    syncConversation: async (conversationId) => {
      const conversation = get().getConversationById(conversationId);
      if (!conversation) {
        toast.error("Conversation not found for syncing.");
        return;
      }
      if (!conversation.syncRepoId) {
        toast.info("Conversation not linked to a sync repository.");
        return;
      }
      const repo = get().syncRepos.find(
        (r) => r.id === conversation.syncRepoId
      );
      if (!repo) {
        toast.error("Sync repository configuration not found.");
        get()._setConversationSyncStatus(
          conversationId,
          "error",
          "Repo not found"
        );
        return;
      }

      let fsInstance: typeof fs | undefined;
      try {
        fsInstance = await get()._ensureSyncVfsReady();
      } catch (fsError) {
        get()._setConversationSyncStatus(
          conversationId,
          "error",
          "Filesystem not ready"
        );
        return;
      }

      await syncConversationLogic(
        fsInstance,
        conversation,
        repo,
        get()._setConversationSyncStatus,
        get().updateConversation,
        () => get().selectedItemId,
        () => get().selectedItemType
      );

      const potentiallyUpdatedConvo = get().getConversationById(conversationId);
      if (potentiallyUpdatedConvo) {
        set((state) => {
          const index = state.conversations.findIndex(
            (c) => c.id === conversationId
          );
          if (index !== -1) {
            state.conversations[index] = potentiallyUpdatedConvo;
          }
        });
      }
    },

    getConversationById: (id) => {
      if (!id) return undefined;
      return get().conversations.find((c) => c.id === id);
    },

    updateCurrentConversationToolSettings: async (settings) => {
      const { selectedItemId, selectedItemType, updateConversation } = get();

      if (selectedItemType !== "conversation" || !selectedItemId) {
        console.warn("Cannot update tool settings: No conversation selected.");
        return;
      }

      const currentConversation = get().getConversationById(selectedItemId);
      if (!currentConversation) {
        console.warn(
          "Cannot update tool settings: Selected conversation not found."
        );
        return;
      }

      const currentMeta = currentConversation.metadata ?? {};
      const newMeta = { ...currentMeta };

      if (settings.enabledTools !== undefined) {
        newMeta.enabledTools = settings.enabledTools;
      }
      if (settings.toolMaxStepsOverride !== undefined) {
        newMeta.toolMaxStepsOverride = settings.toolMaxStepsOverride;
      }

      if (
        JSON.stringify(newMeta) !== JSON.stringify(currentMeta) ||
        !currentConversation.metadata
      ) {
        await updateConversation(selectedItemId, { metadata: newMeta });
      }
    },

    _unlinkConversationsFromProjects: (projectIds) => {
      const idsToUnlink = new Set(projectIds);
      set((state) => {
        state.conversations = state.conversations.map((c) =>
          c.projectId && idsToUnlink.has(c.projectId)
            ? { ...c, projectId: null }
            : c
        );
      });
    },
    getRegisteredActionHandlers: (): RegisteredActionHandler[] => {
      const storeId = "conversationStore";
      const actions = get();
      // Wrap actions that return non-void promises
      const wrapPromiseString =
        <P>(fn: (payload: P) => Promise<string>): ActionHandler<P> =>
        async (payload: P) => {
          await fn(payload);
        };

      return [
        {
          eventName: conversationEvent.loadConversationsRequest,
          handler: actions.loadConversations,
          storeId,
        },
        {
          eventName: conversationEvent.addConversationRequest,
          handler: wrapPromiseString(actions.addConversation),
          storeId,
        },
        {
          eventName: conversationEvent.updateConversationRequest,
          handler: (
            p: ConversationEventPayloads[typeof conversationEvent.updateConversationRequest]
          ) => actions.updateConversation(p.id, p.updates),
          storeId,
        },
        {
          eventName: conversationEvent.deleteConversationRequest,
          handler: (
            p: ConversationEventPayloads[typeof conversationEvent.deleteConversationRequest]
          ) => actions.deleteConversation(p.id),
          storeId,
        },
        {
          eventName: conversationEvent.selectItemRequest,
          handler: (
            p: ConversationEventPayloads[typeof conversationEvent.selectItemRequest]
          ) => actions.selectItem(p.id, p.type),
          storeId,
        },
        {
          eventName: conversationEvent.importConversationRequest,
          handler: (
            p: ConversationEventPayloads[typeof conversationEvent.importConversationRequest]
          ) => actions.importConversation(p.file),
          storeId,
        },
        {
          eventName: conversationEvent.exportConversationRequest,
          handler: (
            p: ConversationEventPayloads[typeof conversationEvent.exportConversationRequest]
          ) => actions.exportConversation(p.conversationId, p.format),
          storeId,
        },
        {
          eventName: conversationEvent.exportProjectRequest,
          handler: (
            p: ConversationEventPayloads[typeof conversationEvent.exportProjectRequest]
          ) => actions.exportProject(p.projectId),
          storeId,
        },
        {
          eventName: conversationEvent.exportAllConversationsRequest,
          handler: actions.exportAllConversations,
          storeId,
        },
        {
          eventName: conversationEvent.loadSyncReposRequest,
          handler: actions.loadSyncRepos,
          storeId,
        },
        {
          eventName: conversationEvent.addSyncRepoRequest,
          handler: wrapPromiseString(actions.addSyncRepo),
          storeId,
        },
        {
          eventName: conversationEvent.updateSyncRepoRequest,
          handler: (
            p: ConversationEventPayloads[typeof conversationEvent.updateSyncRepoRequest]
          ) => actions.updateSyncRepo(p.id, p.updates),
          storeId,
        },
        {
          eventName: conversationEvent.deleteSyncRepoRequest,
          handler: (
            p: ConversationEventPayloads[typeof conversationEvent.deleteSyncRepoRequest]
          ) => actions.deleteSyncRepo(p.id),
          storeId,
        },
        {
          eventName: conversationEvent.linkConversationToRepoRequest,
          handler: (
            p: ConversationEventPayloads[typeof conversationEvent.linkConversationToRepoRequest]
          ) => actions.linkConversationToRepo(p.conversationId, p.repoId),
          storeId,
        },
        {
          eventName: conversationEvent.syncConversationRequest,
          handler: (
            p: ConversationEventPayloads[typeof conversationEvent.syncConversationRequest]
          ) => actions.syncConversation(p.conversationId),
          storeId,
        },
        {
          eventName: conversationEvent.initializeOrSyncRepoRequest,
          handler: (
            p: ConversationEventPayloads[typeof conversationEvent.initializeOrSyncRepoRequest]
          ) => actions.initializeOrSyncRepo(p.repoId),
          storeId,
        },
        {
          eventName:
            conversationEvent.updateCurrentConversationToolSettingsRequest,
          handler: (
            p: ConversationEventPayloads[typeof conversationEvent.updateCurrentConversationToolSettingsRequest]
          ) => actions.updateCurrentConversationToolSettings(p),
          storeId,
        },
      ];
    },
  }))
);
