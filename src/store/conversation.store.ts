// src/store/conversation.store.ts
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { Conversation } from "@/types/litechat/chat";
import type { Interaction } from "@/types/litechat/interaction";
import type { SyncRepo, SyncStatus } from "@/types/litechat/sync";
import { useInteractionStore } from "./interaction.store";
import { PersistenceService } from "@/services/persistence.service";
import * as VfsOps from "@/lib/litechat/vfs-operations";
import { nanoid } from "nanoid";
import { toast } from "sonner";
// Import formatBytes and path utils correctly
import {
  joinPath,
  normalizePath,
  dirname,
  formatBytes,
} from "@/lib/litechat/file-manager-utils";
import { format } from "date-fns";

interface ConversationState {
  conversations: Conversation[];
  selectedConversationId: string | null;
  syncRepos: SyncRepo[];
  conversationSyncStatus: Record<string, SyncStatus>;
  isLoading: boolean;
  error: string | null;
}
interface ConversationActions {
  loadConversations: () => Promise<void>;
  addConversation: (
    conversationData: Partial<Omit<Conversation, "id" | "createdAt">> & {
      title: string;
    },
  ) => Promise<string>;
  updateConversation: (
    id: string,
    updates: Partial<Omit<Conversation, "id" | "createdAt">>,
  ) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  selectConversation: (id: string | null) => void;
  importConversation: (file: File) => Promise<void>;
  exportConversation: (
    conversationId: string,
    format: "json" | "md",
  ) => Promise<void>;
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
  _setConversationSyncStatus: (
    conversationId: string,
    status: SyncStatus,
    error?: string | null,
  ) => void;
}

const CONVERSATION_DIR = ".litechat/conversations";

// Helper function to format interactions to Markdown
const formatInteractionsToMarkdown = (
  conversation: Conversation,
  interactions: Interaction[],
): string => {
  let mdString = `# ${conversation.title}\n\n`;
  mdString += `*Conversation ID: ${conversation.id}*\n`;
  mdString += `*Created: ${format(conversation.createdAt, "yyyy-MM-dd HH:mm:ss")}*\n`;
  mdString += `*Last Updated: ${format(conversation.updatedAt, "yyyy-MM-dd HH:mm:ss")}*\n\n`;
  mdString += "---\n\n";

  interactions
    .filter((i) => i.type === "message.user_assistant")
    .sort((a, b) => a.index - b.index)
    .forEach((interaction) => {
      if (
        interaction.prompt?.content ||
        interaction.prompt?.metadata?.attachedFiles?.length
      ) {
        mdString += `## User (Index: ${interaction.index})\n\n`;
        // Include file metadata if present
        if (
          interaction.prompt.metadata?.attachedFiles &&
          interaction.prompt.metadata.attachedFiles.length > 0
        ) {
          mdString += "**Attached Files:**\n";
          interaction.prompt.metadata.attachedFiles.forEach((f: any) => {
            // Use formatBytes directly
            mdString += `- ${f.name} (${f.type}, ${formatBytes(f.size)}) ${f.source === "vfs" ? `(VFS: ${f.path})` : "(Direct Upload)"}\n`;
          });
          mdString += "\n";
        }
        if (interaction.prompt.content) {
          mdString += `${interaction.prompt.content}\n\n`;
        }
      }
      if (interaction.response) {
        mdString += `## Assistant (Index: ${interaction.index})\n\n`;
        if (interaction.metadata?.modelId) {
          mdString += `*Model: ${interaction.metadata.modelId}*\n\n`;
        }
        if (typeof interaction.response === "string") {
          mdString += `${interaction.response}\n\n`;
        } else {
          mdString += "```json\n";
          mdString += `${JSON.stringify(interaction.response, null, 2)}\n`;
          mdString += "```\n\n";
        }
        if (
          interaction.metadata?.promptTokens ||
          interaction.metadata?.completionTokens
        ) {
          mdString += `*Tokens: ${interaction.metadata.promptTokens ?? "?"} (prompt) / ${interaction.metadata.completionTokens ?? "?"} (completion)*\n\n`;
        }
      }
      mdString += "---\n\n";
    });

  return mdString;
};

// Helper function to trigger browser download
const triggerDownload = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const useConversationStore = create(
  immer<ConversationState & ConversationActions>((set, get) => ({
    conversations: [],
    selectedConversationId: null,
    syncRepos: [],
    conversationSyncStatus: {},
    isLoading: false,
    error: null,

    loadConversations: async () => {
      set({ isLoading: true, error: null });
      try {
        const dbConvos = await PersistenceService.loadConversations();
        set({ conversations: dbConvos, isLoading: false });
        const initialStatus: Record<string, SyncStatus> = {};
        dbConvos.forEach((c) => {
          initialStatus[c.id] = "idle";
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
        title: conversationData.title,
        metadata: conversationData.metadata ?? {},
        syncRepoId: conversationData.syncRepoId ?? null,
        lastSyncedAt: conversationData.lastSyncedAt ?? null,
      };
      set((state) => {
        if (!state.conversations.some((c) => c.id === newConversation.id)) {
          state.conversations.unshift(newConversation);
          state.conversationSyncStatus[newId] = "idle";
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
          if (
            updates.title !== undefined ||
            updates.metadata !== undefined ||
            updates.syncRepoId !== undefined
          ) {
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
            state.conversationSyncStatus[id] = "idle";
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
        if (
          !data ||
          typeof data !== "object" ||
          !data.conversation ||
          !Array.isArray(data.interactions)
        ) {
          throw new Error(
            "Invalid import file format. Expected { conversation: {}, interactions: [] }.",
          );
        }
        const importedConversation: Conversation = data.conversation;
        const importedInteractions: Interaction[] = data.interactions;
        if (
          !importedConversation.id ||
          !importedConversation.title ||
          !importedConversation.createdAt ||
          !importedConversation.updatedAt
        ) {
          throw new Error("Invalid conversation data in import file.");
        }
        const newId = await get().addConversation({
          title: importedConversation.title || "Imported Chat",
          metadata: importedConversation.metadata,
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

    exportConversation: async (conversationId, format) => {
      try {
        const conversation = get().conversations.find(
          (c) => c.id === conversationId,
        );
        if (!conversation) {
          throw new Error("Conversation not found.");
        }
        const interactions =
          await PersistenceService.loadInteractionsForConversation(
            conversationId,
          );
        let blob: Blob;
        let filename: string;
        const safeTitle =
          conversation.title.replace(/[^a-z0-9]/gi, "_").toLowerCase() ||
          "conversation";
        if (format === "json") {
          const exportData = { conversation, interactions };
          const jsonString = JSON.stringify(exportData, null, 2);
          blob = new Blob([jsonString], { type: "application/json" });
          filename = `litechat_${safeTitle}_${conversationId.substring(0, 6)}.json`;
        } else if (format === "md") {
          const mdString = formatInteractionsToMarkdown(
            conversation,
            interactions,
          );
          blob = new Blob([mdString], { type: "text/markdown" });
          filename = `litechat_${safeTitle}_${conversationId.substring(0, 6)}.md`;
        } else {
          throw new Error("Invalid export format specified.");
        }
        triggerDownload(blob, filename);
        toast.success(`Conversation exported as ${format.toUpperCase()}.`);
      } catch (error) {
        console.error("ConversationStore: Error exporting conversation", error);
        toast.error(
          `Export failed: ${error instanceof Error ? error.message : String(error)}`,
        );
        throw error;
      }
    },

    exportAllConversations: async () => {
      try {
        const conversations = get().conversations;
        const exportData = [];
        for (const convo of conversations) {
          const interactions =
            await PersistenceService.loadInteractionsForConversation(convo.id);
          exportData.push({ conversation: convo, interactions });
        }
        const jsonString = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonString], { type: "application/json" });
        const filename = `litechat_all_export_${new Date().toISOString().split("T")[0]}.json`;
        triggerDownload(blob, filename);
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
      }));

      try {
        await PersistenceService.deleteSyncRepo(id);
        toast.success(`Sync repository "${repoToDelete.name}" deleted.`);
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
      get()._setConversationSyncStatus(conversationId, "idle");
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
      const repoDir = normalizePath(`/synced_convos/${repo.id}`);
      const convoFilePath = joinPath(
        repoDir,
        CONVERSATION_DIR,
        `${conversationId}.json`,
      );

      try {
        let repoExists = false;
        try {
          await VfsOps.VFS.promises.stat(joinPath(repoDir, ".git"));
          repoExists = true;
        } catch (e: any) {
          if (e.code !== "ENOENT") throw e;
        }

        if (!repoExists) {
          toast.info(`Cloning repository "${repo.name}" for first sync...`);
          // Use dirname correctly
          await VfsOps.gitCloneOp(
            dirname(repoDir),
            repo.remoteUrl,
            repo.branch,
          );
          try {
            await VfsOps.VFS.promises.stat(joinPath(repoDir, ".git"));
          } catch (verifyError) {
            throw new Error(
              `Clone seemed successful but repo dir "${repoDir}" not found.`,
            );
          }
        } else {
          toast.info(`Pulling latest changes for "${repo.name}"...`);
          await VfsOps.gitPullOp(repoDir);
        }

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

        const localTimestamp = conversation.updatedAt.getTime();
        const lastSyncTimestamp = conversation.lastSyncedAt?.getTime() ?? 0;

        if (
          !remoteConvoData ||
          localTimestamp > (remoteTimestamp ?? 0) ||
          localTimestamp > lastSyncTimestamp
        ) {
          toast.info("Local changes detected. Pushing to remote...");
          const interactions =
            await PersistenceService.loadInteractionsForConversation(
              conversationId,
            );
          const conversationToSave = { ...conversation, lastSyncedAt: null };
          const localData = JSON.stringify(
            { conversation: conversationToSave, interactions },
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
          _setConversationSyncStatus(conversationId, "idle");
          toast.success("Conversation synced successfully (pushed).");
        } else if (remoteTimestamp && remoteTimestamp > localTimestamp) {
          toast.info("Remote changes detected. Updating local conversation...");
          const syncedConversation = {
            ...remoteConvoData!.conversation,
            lastSyncedAt: new Date(),
          };
          await PersistenceService.saveConversation(syncedConversation);
          await PersistenceService.deleteInteractionsForConversation(
            conversationId,
          );
          const interactionPromises = remoteConvoData!.interactions.map((i) =>
            PersistenceService.saveInteraction({ ...i, conversationId }),
          );
          await Promise.all(interactionPromises);

          set((state) => {
            const index = state.conversations.findIndex(
              (c) => c.id === conversationId,
            );
            if (index !== -1) {
              state.conversations[index] = syncedConversation;
            }
            state.conversations.sort(
              (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
            );
          });
          if (get().selectedConversationId === conversationId) {
            useInteractionStore.getState().loadInteractions(conversationId);
          }
          _setConversationSyncStatus(conversationId, "idle");
          toast.success("Conversation synced successfully (pulled).");
        } else {
          toast.info("Conversation already up-to-date.");
          await updateConversation(conversationId, {
            lastSyncedAt: new Date(),
          });
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
