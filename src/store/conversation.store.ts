// src/store/conversation.store.ts
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { Conversation, SidebarItemType } from "@/types/litechat/chat"; // Import SidebarItemType
import type { Interaction } from "@/types/litechat/interaction";
import type { SyncRepo, SyncStatus } from "@/types/litechat/sync";
import type { Project } from "@/types/litechat/project"; // Import Project type
import { useInteractionStore } from "./interaction.store";
import { PersistenceService } from "@/services/persistence.service";
import * as VfsOps from "@/lib/litechat/vfs-operations";
import { nanoid } from "nanoid";
import { toast } from "sonner";
import {
  joinPath,
  normalizePath,
  dirname,
  formatBytes,
} from "@/lib/litechat/file-manager-utils";
import { format } from "date-fns";

// Define a union type for items in the sidebar
export type SidebarItem =
  | (Conversation & { itemType: "conversation" })
  | (Project & { itemType: "project" });

interface ConversationState {
  conversations: Conversation[];
  projects: Project[]; // Add projects state
  selectedItemId: string | null; // Can be Conversation or Project ID
  selectedItemType: SidebarItemType | null; // Type of selected item
  syncRepos: SyncRepo[];
  conversationSyncStatus: Record<string, SyncStatus>;
  isLoading: boolean;
  error: string | null;
}
interface ConversationActions {
  loadSidebarItems: () => Promise<void>; // Renamed from loadConversations
  addConversation: (
    conversationData: Partial<Omit<Conversation, "id" | "createdAt">> & {
      title: string;
      projectId?: string | null; // Allow specifying project on creation
    },
  ) => Promise<string>;
  updateConversation: (
    id: string,
    updates: Partial<Omit<Conversation, "id" | "createdAt">>,
  ) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  addProject: (
    projectData: Partial<Omit<Project, "id" | "createdAt">> & {
      name: string;
      parentId?: string | null;
    },
  ) => Promise<string>;
  updateProject: (
    id: string,
    updates: Partial<Omit<Project, "id" | "createdAt">>,
  ) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  selectItem: (id: string | null, type: SidebarItemType | null) => void; // Renamed from selectConversation
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
  // Helper selectors
  getProjectById: (id: string | null) => Project | undefined;
  getConversationById: (id: string | null) => Conversation | undefined;
  getTopLevelProjectId: (
    itemId: string | null,
    itemType: SidebarItemType | null,
  ) => string | null;
}

const CONVERSATION_DIR = ".litechat/conversations";

// Helper function to format interactions to Markdown (remains the same)
const formatInteractionsToMarkdown = (
  conversation: Conversation,
  interactions: Interaction[],
): string => {
  let mdString = `# ${conversation.title}

`;
  mdString += `*Conversation ID: ${conversation.id}*
`;
  mdString += `*Created: ${format(conversation.createdAt, "yyyy-MM-dd HH:mm:ss")}*
`;
  mdString += `*Last Updated: ${format(conversation.updatedAt, "yyyy-MM-dd HH:mm:ss")}*
`;
  if (conversation.projectId) {
    mdString += `*Project ID: ${conversation.projectId}*
`;
  }
  mdString += `
---

`;

  interactions
    .filter((i) => i.type === "message.user_assistant")
    .sort((a, b) => a.index - b.index)
    .forEach((interaction) => {
      if (
        interaction.prompt?.content ||
        interaction.prompt?.metadata?.attachedFiles?.length
      ) {
        mdString += `## User (Index: ${interaction.index})

`;
        if (
          interaction.prompt.metadata?.attachedFiles &&
          interaction.prompt.metadata.attachedFiles.length > 0
        ) {
          // Corrected line: Removed extra newline after the heading
          mdString += "**Attached Files:**\n";
          interaction.prompt.metadata.attachedFiles.forEach((f: any) => {
            mdString += `- ${f.name} (${f.type}, ${formatBytes(f.size)}) ${f.source === "vfs" ? `(VFS: ${f.path})` : "(Direct Upload)"}\n`;
          });
          mdString += "\n"; // Keep newline after the list
        }
        if (interaction.prompt.content) {
          mdString += `${interaction.prompt.content}\n\n`;
        }
      }
      if (interaction.response) {
        mdString += `## Assistant (Index: ${interaction.index})

`;
        if (interaction.metadata?.modelId) {
          mdString += `*Model: ${interaction.metadata.modelId}*

`;
        }
        if (typeof interaction.response === "string") {
          mdString += `${interaction.response}

`;
        } else {
          mdString += `\`\`\`json
`;
          mdString += `${JSON.stringify(interaction.response, null, 2)}
`;
          mdString += `\`\`\`

`;
        }
        if (
          interaction.metadata?.promptTokens ||
          interaction.metadata?.completionTokens
        ) {
          mdString += `*Tokens: ${interaction.metadata.promptTokens ?? "?"} (prompt) / ${interaction.metadata.completionTokens ?? "?"} (completion)*

`;
        }
      }
      mdString += `---

`;
    });

  return mdString;
};

// Helper function to trigger browser download (remains the same)
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
    projects: [], // Initialize projects
    selectedItemId: null, // Initialize selected item ID
    selectedItemType: null, // Initialize selected item type
    syncRepos: [],
    conversationSyncStatus: {},
    isLoading: false,
    error: null,

    loadSidebarItems: async () => {
      set({ isLoading: true, error: null });
      try {
        const [dbConvos, dbProjects, dbSyncRepos] = await Promise.all([
          PersistenceService.loadConversations(),
          PersistenceService.loadProjects(),
          PersistenceService.loadSyncRepos(),
        ]);

        const initialStatus: Record<string, SyncStatus> = {};
        dbConvos.forEach((c) => {
          initialStatus[c.id] = "idle";
        });

        set({
          conversations: dbConvos,
          projects: dbProjects,
          syncRepos: dbSyncRepos,
          conversationSyncStatus: initialStatus,
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
        projectId: conversationData.projectId ?? null, // Assign project ID
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
            updates.syncRepoId !== undefined ||
            updates.projectId !== undefined // Check if projectId changed
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
          // Re-sort based on parent project and then update time? (Complex UI logic)
          // For now, keep simple sort by update time
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

    addProject: async (projectData) => {
      const newId = nanoid();
      const now = new Date();
      const newProject: Project = {
        id: newId,
        createdAt: now,
        updatedAt: now,
        name: projectData.name,
        parentId: projectData.parentId ?? null,
        systemPrompt: projectData.systemPrompt ?? null,
        modelId: projectData.modelId ?? null,
        temperature: projectData.temperature ?? null,
        metadata: projectData.metadata ?? {},
      };
      set((state) => {
        state.projects.push(newProject);
        // Sort projects? Maybe by name within parent?
      });
      try {
        await PersistenceService.saveProject(newProject);
        return newId;
      } catch (e) {
        console.error("ConversationStore: Error adding project", e);
        set((state) => ({
          error: "Failed to save new project",
          projects: state.projects.filter((p) => p.id !== newId),
        }));
        throw e;
      }
    },

    updateProject: async (id, updates) => {
      let originalProject: Project | undefined;
      let updatedProject: Project | null = null;

      set((state) => {
        const index = state.projects.findIndex((p) => p.id === id);
        if (index !== -1) {
          originalProject = { ...state.projects[index] };
          Object.assign(state.projects[index], {
            ...updates,
            updatedAt: new Date(),
          });
          updatedProject = state.projects[index];
          // Re-sort?
        } else {
          console.warn(`ConversationStore: Project ${id} not found.`);
        }
      });

      if (updatedProject) {
        try {
          await PersistenceService.saveProject(updatedProject);
        } catch (e) {
          console.error("ConversationStore: Error updating project", e);
          set((state) => {
            const index = state.projects.findIndex((p) => p.id === id);
            if (index !== -1 && originalProject) {
              state.projects[index] = originalProject;
              // Re-sort?
            }
            state.error = "Failed to save project update";
          });
          throw e;
        }
      }
    },

    deleteProject: async (id) => {
      const currentSelectedId = get().selectedItemId;
      const currentSelectedType = get().selectedItemType;
      const projectToDelete = get().projects.find((p) => p.id === id);
      if (!projectToDelete) return;

      // Need to find all descendant projects and conversations to update state correctly
      const descendantProjectIds = new Set<string>();
      const descendantConversationIds = new Set<string>();
      const findDescendants = (projectId: string) => {
        descendantProjectIds.add(projectId);
        get()
          .projects.filter((p) => p.parentId === projectId)
          .forEach((child) => findDescendants(child.id));
        get()
          .conversations.filter((c) => c.projectId === projectId)
          .forEach((child) => descendantConversationIds.add(child.id));
      };
      findDescendants(id);

      set((state) => ({
        projects: state.projects.filter((p) => !descendantProjectIds.has(p.id)),
        conversations: state.conversations.map((c) =>
          descendantConversationIds.has(c.id) ? { ...c, projectId: null } : c,
        ), // Unlink conversations
        selectedItemId: descendantProjectIds.has(currentSelectedId ?? "")
          ? null
          : currentSelectedId,
        selectedItemType: descendantProjectIds.has(currentSelectedId ?? "")
          ? null
          : currentSelectedType,
      }));

      try {
        await PersistenceService.deleteProject(id); // This handles DB unlinking/deletion

        if (descendantProjectIds.has(currentSelectedId ?? "")) {
          useInteractionStore.getState().setCurrentConversationId(null);
        }
      } catch (e) {
        console.error("ConversationStore: Error deleting project", e);
        // Reverting state is complex here, might require reloading
        set({ error: "Failed to delete project. Please reload." });
        throw e;
      }
    },

    selectItem: (id, type) => {
      if (get().selectedItemId !== id || get().selectedItemType !== type) {
        set({ selectedItemId: id, selectedItemType: type });
        if (type === "conversation") {
          useInteractionStore.getState().setCurrentConversationId(id);
        } else {
          // If a project is selected, clear the interaction view
          useInteractionStore.getState().setCurrentConversationId(null);
        }
      } else {
        console.log(`Item ${id} (${type}) already selected.`);
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
        // Import conversation without linking to a project initially
        const newId = await get().addConversation({
          title: importedConversation.title || "Imported Chat",
          metadata: importedConversation.metadata,
          projectId: null, // Don't assume project context on import
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
        get().selectItem(newId, "conversation"); // Use selectItem
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
      // Avoid setting loading if already loading to prevent state flicker
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
        ...repoData,
      };
      // Perform optimistic update *before* async operation
      set((state) => {
        state.syncRepos.push(newRepo);
      });
      try {
        await PersistenceService.saveSyncRepo(newRepo);
        toast.success(`Sync repository "${newRepo.name}" added.`);
        return newId;
      } catch (e) {
        console.error("ConversationStore: Error adding sync repo", e);
        // Revert optimistic update on failure
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
          if (
            get().selectedItemId === conversationId &&
            get().selectedItemType === "conversation"
          ) {
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

    // --- Selectors ---
    getProjectById: (id) => {
      if (!id) return undefined;
      return get().projects.find((p) => p.id === id);
    },
    getConversationById: (id) => {
      if (!id) return undefined;
      return get().conversations.find((c) => c.id === id);
    },
    getTopLevelProjectId: (itemId, itemType) => {
      if (!itemId || !itemType) return null;

      if (itemType === "conversation") {
        const convo = get().getConversationById(itemId);
        itemId = convo?.projectId ?? null; // Start search from convo's project
        itemType = "project"; // Now we are looking for a project
      }

      if (itemType !== "project" || !itemId) return null;

      let currentProject = get().getProjectById(itemId);
      while (currentProject?.parentId) {
        const parent = get().getProjectById(currentProject.parentId);
        if (!parent) return currentProject.id; // Should not happen in consistent state
        currentProject = parent;
      }
      return currentProject?.id ?? null;
    },
  })),
);
