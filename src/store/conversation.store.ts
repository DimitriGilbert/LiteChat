// src/store/conversation.store.ts
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { Conversation } from "@/types/litechat/chat";
import type { Interaction } from "@/types/litechat/interaction";
import type { SyncRepo, SyncStatus } from "@/types/litechat/sync"; // Import sync types
import { useInteractionStore } from "./interaction.store";
import { PersistenceService } from "@/services/persistence.service";
import * as VfsOps from "@/lib/litechat/vfs-operations"; // Import VFS Ops
import { nanoid } from "nanoid";
import { toast } from "sonner";
import { joinPath, normalizePath } from "@/lib/litechat/file-manager-utils"; // Import path utils

interface ConversationState {
  conversations: Conversation[];
  selectedConversationId: string | null;
  syncRepos: SyncRepo[]; // Add sync repo state
  conversationSyncStatus: Record<string, SyncStatus>; // Track status per convo
  isLoading: boolean;
  error: string | null;
}
interface ConversationActions {
  loadConversations: () => Promise<void>;
  addConversation: (
    conversationData: Partial<Omit<Conversation, "id" | "createdAt">> & {
      title: string;
    }, // Ensure title is required
  ) => Promise<string>;
  updateConversation: (
    id: string,
    updates: Partial<Omit<Conversation, "id" | "createdAt">>,
  ) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  selectConversation: (id: string | null) => void;
  importConversation: (file: File) => Promise<void>;
  exportAllConversations: () => Promise<void>;
  // Sync Repo Actions
  loadSyncRepos: () => Promise<void>;
  addSyncRepo: (
    repoData: Omit<SyncRepo, "id" | "createdAt" | "updatedAt">,
  ) => Promise<string>;
  updateSyncRepo: (
    id: string,
    updates: Partial<Omit<SyncRepo, "id" | "createdAt">>,
  ) => Promise<void>;
  deleteSyncRepo: (id: string) => Promise<void>;
  // Conversation Sync Actions
  linkConversationToRepo: (
    conversationId: string,
    repoId: string | null,
  ) => Promise<void>;
  syncConversation: (conversationId: string) => Promise<void>;
  _setConversationSyncStatus: (
    conversationId: string,
    status: SyncStatus,
    error?: string | null,
  ) => void;
}

const CONVERSATION_DIR = ".litechat/conversations"; // Directory within repo

export const useConversationStore = create(
  immer<ConversationState & ConversationActions>((set, get) => ({
    conversations: [],
    selectedConversationId: null,
    syncRepos: [], // Initialize sync repo state
    conversationSyncStatus: {}, // Initialize sync status
    isLoading: false,
    error: null,

    loadConversations: async () => {
      set({ isLoading: true, error: null });
      try {
        const dbConvos = await PersistenceService.loadConversations();
        set({ conversations: dbConvos, isLoading: false });
        // Initialize sync status for loaded convos
        const initialStatus: Record<string, SyncStatus> = {};
        dbConvos.forEach((c) => {
          initialStatus[c.id] = "idle"; // Assume idle initially
        });
        set({ conversationSyncStatus: initialStatus });
      } catch (e) {
        console.error("ConversationStore: Error loading conversations", e);
        set({ error: "Failed load conversations", isLoading: false });
      }
    },

    addConversation: async (conversationData) => {
      const newId = nanoid();
      const now = new Date();
      const newConversation: Conversation = {
        id: newId,
        createdAt: now,
        updatedAt: now,
        title: conversationData.title, // Ensure title is set
        metadata: conversationData.metadata ?? {},
        syncRepoId: conversationData.syncRepoId ?? null,
        lastSyncedAt: conversationData.lastSyncedAt ?? null,
      };
      set((state) => {
        if (!state.conversations.some((c) => c.id === newConversation.id)) {
          state.conversations.unshift(newConversation);
          state.conversationSyncStatus[newId] = "idle"; // Set initial sync status
        }
      });
      try {
        await PersistenceService.saveConversation(newConversation);
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
      let originalConversation: Conversation | undefined;
      let updatedConversation: Conversation | null = null;
      let needsSync = false;

      set((state) => {
        const index = state.conversations.findIndex((c) => c.id === id);
        if (index !== -1) {
          originalConversation = { ...state.conversations[index] };
          // Check if sync-relevant data changed (title, metadata, etc.)
          if (
            updates.title !== undefined ||
            updates.metadata !== undefined ||
            updates.syncRepoId !== undefined
            // Add other fields that should trigger 'needs-sync'
          ) {
            // Only mark as needs-sync if it's currently linked to a repo
            if (state.conversations[index].syncRepoId) {
              needsSync = true;
            }
          }

          Object.assign(state.conversations[index], {
            ...updates,
            updatedAt: new Date(),
          });
          updatedConversation = state.conversations[index];
          state.conversations.sort(
            (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
          );
          // Update sync status if needed
          if (needsSync && state.conversationSyncStatus[id] === "idle") {
            state.conversationSyncStatus[id] = "needs-sync";
          }
        } else {
          console.warn(
            `ConversationStore: Conversation ${id} not found for update.`,
          );
        }
      });

      if (updatedConversation) {
        try {
          await PersistenceService.saveConversation(updatedConversation);
        } catch (e) {
          console.error("ConversationStore: Error updating conversation", e);
          set((state) => {
            const index = state.conversations.findIndex((c) => c.id === id);
            if (index !== -1 && originalConversation) {
              state.conversations[index] = originalConversation;
              state.conversations.sort(
                (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
              );
              // Revert sync status if needed
              if (needsSync) {
                state.conversationSyncStatus[id] = "idle";
              }
            }
            state.error = "Failed to save conversation update";
          });
          throw e;
        }
      }
    },

    deleteConversation: async (id) => {
      const currentSelectedId = get().selectedConversationId;
      const conversationToDelete = get().conversations.find((c) => c.id === id);
      if (!conversationToDelete) return;

      set((state) => ({
        conversations: state.conversations.filter((c) => c.id !== id),
        selectedConversationId:
          currentSelectedId === id ? null : currentSelectedId,
        conversationSyncStatus: Object.fromEntries(
          Object.entries(state.conversationSyncStatus).filter(
            ([convoId]) => convoId !== id,
          ),
        ),
      }));

      try {
        await PersistenceService.deleteConversation(id);
        await PersistenceService.deleteInteractionsForConversation(id);
        // TODO: Delete conversation file from Git repo if synced? (Complex)

        if (currentSelectedId === id) {
          useInteractionStore.getState().setCurrentConversationId(null);
        }
      } catch (e) {
        console.error("ConversationStore: Error deleting conversation", e);
        set((state) => {
          if (conversationToDelete) {
            state.conversations.push(conversationToDelete);
            state.conversations.sort(
              (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
            );
            state.conversationSyncStatus[id] = "idle"; // Reset status on revert
          }
          if (currentSelectedId === id) {
            state.selectedConversationId = id;
          }
          state.error = "Failed to delete conversation";
        });
        throw e;
      }
    },

    selectConversation: (id) => {
      if (get().selectedConversationId !== id) {
        set({ selectedConversationId: id });
        useInteractionStore.getState().setCurrentConversationId(id);
      } else {
        console.log(`Conversation ${id} already selected.`);
      }
    },

    importConversation: async (file) => {
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!data.conversation || !data.interactions) {
          throw new Error("Invalid import file format.");
        }
        const importedConversation: Conversation = data.conversation;
        const importedInteractions: Interaction[] = data.interactions;

        const newId = await get().addConversation({
          title: importedConversation.title || "Imported Chat",
          metadata: importedConversation.metadata,
          // Do not import sync status from file
          syncRepoId: null,
          lastSyncedAt: null,
        });

        const interactionPromises = importedInteractions.map((i) =>
          PersistenceService.saveInteraction({
            ...i,
            conversationId: newId,
            id: nanoid(),
          }),
        );
        await Promise.all(interactionPromises);

        get().selectConversation(newId);
        toast.success("Conversation imported successfully.");
      } catch (error) {
        console.error("ConversationStore: Error importing conversation", error);
        toast.error(
          `Import failed: ${error instanceof Error ? error.message : String(error)}`,
        );
        throw error;
      }
    },

    exportAllConversations: async () => {
      try {
        const conversations = await PersistenceService.loadConversations();
        const exportData = [];

        for (const convo of conversations) {
          const interactions =
            await PersistenceService.loadInteractionsForConversation(convo.id);
          exportData.push({ conversation: convo, interactions });
        }

        const jsonString = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonString], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `litechat_export_${new Date().toISOString().split("T")[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("All conversations exported.");
      } catch (error) {
        console.error(
          "ConversationStore: Error exporting conversations",
          error,
        );
        toast.error(
          `Export failed: ${error instanceof Error ? error.message : String(error)}`,
        );
        throw error;
      }
    },

    // --- Sync Repo Actions ---
    loadSyncRepos: async () => {
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
        ...repoData,
      };
      set((state) => {
        state.syncRepos.push(newRepo);
      });
      try {
        await PersistenceService.saveSyncRepo(newRepo);
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
      let originalRepo: SyncRepo | undefined;
      let updatedRepo: SyncRepo | null = null;

      set((state) => {
        const index = state.syncRepos.findIndex((r) => r.id === id);
        if (index !== -1) {
          originalRepo = { ...state.syncRepos[index] };
          Object.assign(state.syncRepos[index], {
            ...updates,
            updatedAt: new Date(),
          });
          updatedRepo = state.syncRepos[index];
        } else {
          console.warn(`ConversationStore: SyncRepo ${id} not found.`);
        }
      });

      if (updatedRepo) {
        try {
          await PersistenceService.saveSyncRepo(updatedRepo);
          toast.success(`Sync repository "${updatedRepo.name}" updated.`);
        } catch (e) {
          console.error("ConversationStore: Error updating sync repo", e);
          set((state) => {
            const index = state.syncRepos.findIndex((r) => r.id === id);
            if (index !== -1 && originalRepo) {
              state.syncRepos[index] = originalRepo;
            }
            state.error = "Failed to save sync repository update";
          });
          throw e;
        }
      }
    },

    deleteSyncRepo: async (id) => {
      const repoToDelete = get().syncRepos.find((r) => r.id === id);
      if (!repoToDelete) return;

      set((state) => ({
        syncRepos: state.syncRepos.filter((r) => r.id !== id),
        // Unlink conversations - handled by persistence service transaction now
      }));

      try {
        await PersistenceService.deleteSyncRepo(id);
        toast.success(`Sync repository "${repoToDelete.name}" deleted.`);
      } catch (e) {
        console.error("ConversationStore: Error deleting sync repo", e);
        set((state) => {
          if (repoToDelete) {
            state.syncRepos.push(repoToDelete);
            // Re-linking conversations is complex, might require manual action
          }
          state.error = "Failed to delete sync repository";
        });
        throw e;
      }
    },

    // --- Conversation Sync Actions ---
    linkConversationToRepo: async (conversationId, repoId) => {
      await get().updateConversation(conversationId, {
        syncRepoId: repoId,
        lastSyncedAt: null, // Reset sync time on link/unlink
      });
      // Reset sync status
      get()._setConversationSyncStatus(conversationId, "idle");
      toast.info(
        `Conversation ${repoId ? "linked to" : "unlinked from"} sync repository.`,
      );
    },

    _setConversationSyncStatus: (conversationId, status, error = null) => {
      set((state) => {
        state.conversationSyncStatus[conversationId] = status;
        if (status === "error" && error) {
          // Optionally store error message per conversation if needed
          console.error(`Sync error for ${conversationId}: ${error}`);
        }
      });
    },

    syncConversation: async (conversationId) => {
      const {
        conversations,
        syncRepos,
        _setConversationSyncStatus,
        updateConversation,
      } = get();
      const conversation = conversations.find((c) => c.id === conversationId);
      if (!conversation) {
        toast.error("Conversation not found for syncing.");
        return;
      }
      if (!conversation.syncRepoId) {
        toast.info("Conversation not linked to a sync repository.");
        return;
      }
      const repo = syncRepos.find((r) => r.id === conversation.syncRepoId);
      if (!repo) {
        toast.error("Sync repository configuration not found.");
        _setConversationSyncStatus(conversationId, "error", "Repo not found");
        return;
      }

      _setConversationSyncStatus(conversationId, "syncing");
      const repoDir = normalizePath(`/sync_repos/${repo.id}`); // Use unique dir per repo
      const convoFilePath = joinPath(
        repoDir,
        CONVERSATION_DIR,
        `${conversationId}.json`,
      );

      try {
        // 1. Ensure repo exists locally or clone/pull
        let repoExists = false;
        try {
          await VfsOps.fs.promises.stat(joinPath(repoDir, ".git"));
          repoExists = true;
        } catch (e: any) {
          if (e.code !== "ENOENT") throw e; // Re-throw unexpected errors
        }

        if (!repoExists) {
          toast.info(`Cloning repository "${repo.name}" for first sync...`);
          await VfsOps.gitCloneOp("/", repo.remoteUrl, repo.branch); // Clone into root, it creates subdir
          // Verify clone created the expected directory
          try {
            await VfsOps.fs.promises.stat(joinPath(repoDir, ".git"));
          } catch (verifyError) {
            throw new Error(
              `Clone seemed successful but repo dir "${repoDir}" not found.`,
            );
          }
        } else {
          toast.info(`Pulling latest changes for "${repo.name}"...`);
          await VfsOps.gitPullOp(repoDir); // Pull changes
        }

        // 2. Load remote conversation data (if exists)
        let remoteConvoData: {
          conversation: Conversation;
          interactions: Interaction[];
        } | null = null;
        let remoteTimestamp: number | null = null;
        try {
          const fileContent = await VfsOps.readFileOp(convoFilePath);
          const jsonString = new TextDecoder().decode(fileContent);
          remoteConvoData = JSON.parse(jsonString);
          remoteTimestamp = remoteConvoData?.conversation?.updatedAt
            ? new Date(remoteConvoData.conversation.updatedAt).getTime()
            : null;
        } catch (e: any) {
          if (e.code === "ENOENT") {
            console.log(
              `Conversation file ${convoFilePath} not found in repo. Will push local version.`,
            );
          } else {
            throw new Error(
              `Failed to read remote conversation file: ${e.message}`,
            );
          }
        }

        // 3. Compare timestamps and decide action
        const localTimestamp = conversation.updatedAt.getTime();
        const lastSyncTimestamp = conversation.lastSyncedAt?.getTime() ?? 0;

        if (
          !remoteConvoData ||
          localTimestamp > (remoteTimestamp ?? 0) ||
          localTimestamp > lastSyncTimestamp // Also push if local changed since last sync
        ) {
          // Push local changes
          toast.info("Local changes detected. Pushing to remote...");
          const interactions =
            await PersistenceService.loadInteractionsForConversation(
              conversationId,
            );
          const localData = JSON.stringify(
            { conversation, interactions },
            null,
            2,
          );
          await VfsOps.writeFileOp(convoFilePath, localData);
          await VfsOps.gitCommitOp(
            repoDir,
            `Sync conversation: ${conversation.title} (${conversationId})`,
          );
          await VfsOps.gitPushOp(repoDir);
          await updateConversation(conversationId, {
            lastSyncedAt: new Date(),
          });
          _setConversationSyncStatus(conversationId, "idle"); // Synced
          toast.success("Conversation synced successfully (pushed).");
        } else if (remoteTimestamp && remoteTimestamp > localTimestamp) {
          // Pull remote changes
          toast.info("Remote changes detected. Updating local conversation...");
          // Update local conversation and interactions
          await PersistenceService.saveConversation(
            remoteConvoData!.conversation,
          );
          await PersistenceService.deleteInteractionsForConversation(
            conversationId,
          );
          const interactionPromises = remoteConvoData!.interactions.map((i) =>
            PersistenceService.saveInteraction({ ...i, conversationId }),
          );
          await Promise.all(interactionPromises);

          // Update store state
          set((state) => {
            const index = state.conversations.findIndex(
              (c) => c.id === conversationId,
            );
            if (index !== -1) {
              state.conversations[index] = remoteConvoData!.conversation;
            }
            state.conversations.sort(
              (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
            );
          });
          // Reload interactions if it's the selected conversation
          if (get().selectedConversationId === conversationId) {
            useInteractionStore.getState().loadInteractions(conversationId);
          }
          _setConversationSyncStatus(conversationId, "idle"); // Synced
          toast.success("Conversation synced successfully (pulled).");
        } else {
          // Already in sync
          toast.info("Conversation already up-to-date.");
          await updateConversation(conversationId, {
            lastSyncedAt: new Date(),
          }); // Update timestamp even if no data change
          _setConversationSyncStatus(conversationId, "idle");
        }
      } catch (error: any) {
        console.error(`Sync failed for conversation ${conversationId}:`, error);
        toast.error(`Sync failed: ${error.message}`);
        _setConversationSyncStatus(conversationId, "error", error.message);
      }
    },
  })),
);
