// src/store/conversation.store.ts
// Entire file content provided - Significantly reduced
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { Conversation, SidebarItemType } from "@/types/litechat/chat";
import type { SyncRepo, SyncStatus } from "@/types/litechat/sync";
import type { Project } from "@/types/litechat/project";
import { useInteractionStore } from "./interaction.store";
import { PersistenceService } from "@/services/persistence.service";
import { nanoid } from "nanoid";
import { toast } from "sonner";
import { normalizePath } from "@/lib/litechat/file-manager-utils";
// Import sync logic helpers from the service file
import {
  initializeOrSyncRepoLogic,
  syncConversationLogic,
} from "@/services/sync.service";
// Import import/export service
import { ImportExportService } from "@/services/import-export.service";
// Import the key from the constants file
import { SYNC_VFS_KEY } from "@/lib/litechat/constants"
import { useVfsStore } from "./vfs.store";
import type { fs as FsType } from "@zenfs/core";
import * as VfsOps from "@/lib/litechat/vfs-operations";
// Import ProjectStore for interaction
import { useProjectStore } from "./project.store";

// Define a union type for items in the sidebar (now includes Project from ProjectStore)
export type SidebarItem =
  | (Conversation & { itemType: "conversation" })
  | (Project & { itemType: "project" });

interface ConversationState {
  conversations: Conversation[];
  // projects removed - managed by ProjectStore
  selectedItemId: string | null;
  selectedItemType: SidebarItemType | null;
  syncRepos: SyncRepo[];
  conversationSyncStatus: Record<string, SyncStatus>;
  repoInitializationStatus: Record<string, SyncStatus>;
  isLoading: boolean;
  error: string | null;
}
interface ConversationActions {
  loadSidebarItems: () => Promise<void>
  addConversation: (
    conversationData: Partial<Omit<Conversation, "id" | "createdAt">> & {
      title: string;
      projectId?: string | null;
    },
  ) => Promise<string>;
  updateConversation: (
    id: string,
    updates: Partial<Omit<Conversation, "id" | "createdAt">>,
  ) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  // Project actions removed
  selectItem: (
    id: string | null,
    type: SidebarItemType | null,
  ) => Promise<void>;
  importConversation: (file: File) => Promise<void>;
  exportConversation: (
    conversationId: string,
    format: "json" | "md",
  ) => Promise<void>;
  exportProject: (projectId: string) => Promise<void>;
  exportAllConversations: () => Promise<void>;
  loadSyncRepos: () => Promise<void>;
  addSyncRepo: (
    repoData: Omit<SyncRepo, "id" | "createdAt" | "updatedAt">,
  ) => Promise<string>;
  updateSyncRepo: (
    id: string,
    updates: Partial<Omit<SyncRepo, "id" | "createdAt">>,
  ) => Promise<void>;
  deleteSyncRepo: (id: string) => Promise<void>;
  linkConversationToRepo: (
    conversationId: string,
    repoId: string | null,
  ) => Promise<void>;
  syncConversation: (conversationId: string) => Promise<void>;
  initializeOrSyncRepo: (repoId: string) => Promise<void>;
  _setConversationSyncStatus: (
    conversationId: string,
    status: SyncStatus,
    error?: string | null,
  ) => void;
  _setRepoInitializationStatus: (repoId: string, status: SyncStatus) => void;
  // getProjectById removed - use ProjectStore
  getConversationById: (id: string | null) => Conversation | undefined;
  // getTopLevelProjectId removed - use ProjectStore
  updateCurrentConversationToolSettings: (settings: {
    enabledTools?: string[];
    toolMaxStepsOverride?: number | null;
  }) => Promise<void>;
  _ensureSyncVfsReady: () => Promise<typeof FsType | null>;
  // getEffectiveProjectSettings removed - use ProjectStore
  // Internal action for project deletion side effects
  _unlinkConversationsFromProjects: (projectIds: string[]) => void;
}

const SYNC_REPO_BASE_DIR = "/synced_repos";

export const useConversationStore = create(
  immer<ConversationState & ConversationActions>((set, get) => ({
    conversations: [],
    // projects removed
    selectedItemId: null,
    selectedItemType: null,
    syncRepos: [],
    conversationSyncStatus: {},
    repoInitializationStatus: {},
    isLoading: false,
    error: null,

    _ensureSyncVfsReady: async () => {
      const vfsStore = useVfsStore.getState();
      if (
        vfsStore.fs &&
        vfsStore.configuredVfsKey === SYNC_VFS_KEY &&
        !vfsStore.loading
      ) {
        return vfsStore.fs;
      }

      console.log(
        `[ConversationStore] Sync VFS not ready (key: ${vfsStore.configuredVfsKey}, fs: ${!!vfsStore.fs}, loading: ${vfsStore.loading}). Initializing...`,
      );
      try {
        await vfsStore.initializeVFS(SYNC_VFS_KEY);
        const updatedVfsStore = useVfsStore.getState();
        if (
          updatedVfsStore.fs &&
          updatedVfsStore.configuredVfsKey === SYNC_VFS_KEY
        ) {
          console.log("[ConversationStore] Sync VFS initialized successfully.");
          return updatedVfsStore.fs;
        } else {
          throw new Error("VFS initialization did not complete successfully.");
        }
      } catch (error) {
        console.error("[ConversationStore] Failed to ensure Sync VFS:", error);
        toast.error(
          `Filesystem error for sync: ${error instanceof Error ? error.message : String(error)}`,
        );
        return null;
      }
    },

    loadSidebarItems: async () => {
      set({ isLoading: true, error: null });
      try {
        // Load projects using ProjectStore action
        await useProjectStore.getState().loadProjects();
        // Load conversations and sync repos locally
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
          // projects removed from this store's state
          syncRepos: dbSyncRepos,
          conversationSyncStatus: initialStatus,
          repoInitializationStatus: {},
          isLoading: false,
        });
      } catch (e) {
        console.error("ConversationStore: Error loading sidebar items", e);
        set({ error: "Failed load sidebar items", isLoading: false });
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
      set((state) => {
        if (!state.conversations.some((c) => c.id === newConversation.id)) {
          state.conversations.unshift(newConversation);
          state.conversationSyncStatus[newId] = newConversation.syncRepoId
            ? "needs-sync"
            : "idle";
        }
      });
      try {
        const conversationToSave = get().getConversationById(newId);
        if (conversationToSave) {
          await PersistenceService.saveConversation(conversationToSave);
        } else {
          throw new Error("Failed to retrieve newly added conversation state");
        }
        return newId;
      } catch (e) {
        console.error("ConversationStore: Error adding conversation", e);
        set((state) => ({
          error: "Failed to save new conversation",
          conversations: state.conversations.filter((c) => c.id !== newId),
          conversationSyncStatus: Object.fromEntries(
            Object.entries(state.conversationSyncStatus).filter(
              ([id]) => id !== newId,
            ),
          ),
        }));
        throw e;
      }
    },

    updateConversation: async (id, updates) => {
      const originalConversation = get().getConversationById(id);
      if (!originalConversation) {
        console.warn(
          `ConversationStore: Conversation ${id} not found for update.`,
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
            (field) => field in updates,
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
          "ConversationStore: Failed to retrieve updated conversation state after update.",
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
            ([convoId]) => convoId !== id,
          ),
        ),
      }));

      try {
        await PersistenceService.deleteConversation(id);
        await PersistenceService.deleteInteractionsForConversation(id);

        if (
          currentSelectedId === id &&
          currentSelectedType === "conversation"
        ) {
          await useInteractionStore.getState().setCurrentConversationId(null);
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

    // Project actions removed

    selectItem: async (id, type) => {
      if (get().selectedItemId !== id || get().selectedItemType !== type) {
        set({ selectedItemId: id, selectedItemType: type });
        await useInteractionStore
          .getState()
          .setCurrentConversationId(type === "conversation" ? id : null);
      } else {
        console.log(`Item ${id} (${type}) already selected.`);
      }
    },

    // --- Import/Export Actions (Delegate to Service) ---
    importConversation: async (file) => {
      await ImportExportService.importConversation(
        file,
        get().addConversation,
        get().selectItem,
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
    // --- End Import/Export Actions ---

    loadSyncRepos: async () => {
      if (get().isLoading) return;
      set({ isLoading: true, error: null });
      try {
        const repos = await PersistenceService.loadSyncRepos();
        set({ syncRepos: repos, isLoading: false });
      } catch (e) {
        console.error("ConversationStore: Error loading sync repos", e);
        set({ error: "Failed load sync repositories", isLoading: false });
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
        } else {
          throw new Error("Failed to retrieve newly added sync repo state");
        }
        toast.success(`Sync repository "${newRepo.name}" added.`);
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
          "ConversationStore: Failed to retrieve updated sync repo state after update.",
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

      const repoDir = normalizePath(`${SYNC_REPO_BASE_DIR}/${id}`);

      const fsInstance = await get()._ensureSyncVfsReady();
      if (!fsInstance) {
        toast.error("Filesystem not ready, cannot delete repository folder.");
        return;
      }

      set((state) => ({
        syncRepos: state.syncRepos.filter((r) => r.id !== id),
        repoInitializationStatus: Object.fromEntries(
          Object.entries(state.repoInitializationStatus).filter(
            ([repoId]) => repoId !== id,
          ),
        ),
      }));

      try {
        await PersistenceService.deleteSyncRepo(id);
        toast.success(`Sync repository "${repoToDelete.name}" deleted.`);

        try {
          console.log(`[ConversationStore] Deleting VFS directory: ${repoDir}`);
          await VfsOps.deleteItemOp(repoDir, true);
          toast.info(`Removed local sync folder for "${repoToDelete.name}".`);
        } catch (vfsError: any) {
          console.error(
            `[ConversationStore] Failed to delete VFS directory ${repoDir}:`,
            vfsError,
          );
          if (vfsError.code !== "ENOENT") {
            toast.warning(
              `Failed to remove local sync folder: ${vfsError.message}`,
            );
          }
        }
      } catch (e) {
        console.error("ConversationStore: Error deleting sync repo", e);
        set((state) => {
          if (repoToDelete) {
            state.syncRepos.push(repoToDelete);
          }
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
        repoId ? "needs-sync" : "idle",
      );
      toast.info(
        `Conversation ${repoId ? "linked to" : "unlinked from"} sync repository.`,
      );
    },

    _setConversationSyncStatus: (conversationId, status, error = null) => {
      set((state) => {
        state.conversationSyncStatus[conversationId] = status;
        if (status === "error" && error) {
          console.error(`Sync error for ${conversationId}: ${error}`);
        }
      });
    },

    _setRepoInitializationStatus: (repoId, status) => {
      set((state) => {
        state.repoInitializationStatus[repoId] = status;
      });
    },

    initializeOrSyncRepo: async (repoId) => {
      const repo = get().syncRepos.find((r) => r.id === repoId);
      if (!repo) {
        toast.error("Sync repository configuration not found.");
        return;
      }
      const fsInstance = await get()._ensureSyncVfsReady();
      if (!fsInstance) {
        get()._setRepoInitializationStatus(repoId, "error");
        return;
      }
      await initializeOrSyncRepoLogic(
        fsInstance,
        repo,
        get()._setRepoInitializationStatus,
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
        (r) => r.id === conversation.syncRepoId,
      );
      if (!repo) {
        toast.error("Sync repository configuration not found.");
        get()._setConversationSyncStatus(
          conversationId,
          "error",
          "Repo not found",
        );
        return;
      }

      const fsInstance = await get()._ensureSyncVfsReady();
      if (!fsInstance) {
        get()._setConversationSyncStatus(
          conversationId,
          "error",
          "Filesystem not ready",
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
        () => get().selectedItemType,
      );

      const potentiallyUpdatedConvo = get().getConversationById(conversationId);
      if (potentiallyUpdatedConvo) {
        set((state) => {
          const index = state.conversations.findIndex(
            (c) => c.id === conversationId,
          );
          if (index !== -1) {
            state.conversations[index] = potentiallyUpdatedConvo;
          }
        });
      }
    },

    // getProjectById removed
    getConversationById: (id) => {
      if (!id) return undefined;
      return get().conversations.find((c) => c.id === id);
    },
    // getTopLevelProjectId removed

    updateCurrentConversationToolSettings: async (settings) => {
      const { selectedItemId, selectedItemType, updateConversation } = get();

      if (selectedItemType !== "conversation" || !selectedItemId) {
        console.warn("Cannot update tool settings: No conversation selected.");
        return;
      }

      const currentConversation = get().getConversationById(selectedItemId);
      if (!currentConversation) {
        console.warn(
          "Cannot update tool settings: Selected conversation not found.",
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

    // getEffectiveProjectSettings removed

    // Internal action called by ProjectStore.deleteProject
    _unlinkConversationsFromProjects: (projectIds) => {
      const idsToUnlink = new Set(projectIds);
      set((state) => {
        state.conversations = state.conversations.map((c) =>
          c.projectId && idsToUnlink.has(c.projectId)
            ? { ...c, projectId: null }
            : c,
        );
      });
      // Note: This only updates the state. PersistenceService.deleteProject handles DB updates.
    },
  })),
);
