// src/store/conversation.store.ts
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { Conversation, SidebarItemType } from "@/types/litechat/chat";
import type { Interaction } from "@/types/litechat/interaction";
import type { SyncRepo, SyncStatus } from "@/types/litechat/sync";
import type { Project } from "@/types/litechat/project";
import { useInteractionStore } from "./interaction.store";
import { PersistenceService } from "@/services/persistence.service";
import { nanoid } from "nanoid";
import { toast } from "sonner";
import {
  formatBytes,
  buildPath,
  normalizePath, // Import normalizePath
} from "@/lib/litechat/file-manager-utils";
import { format } from "date-fns";
// Import sync logic helpers and the key
import {
  initializeOrSyncRepoLogic,
  syncConversationLogic,
  SYNC_VFS_KEY, // Import the key
} from "@/lib/litechat/conversation-sync-logic";
import { useVfsStore } from "./vfs.store"; // Import VFS store
import type { fs as FsType } from "@zenfs/core"; // Import fs type
import * as VfsOps from "@/lib/litechat/vfs-operations"; // Import VFS Ops
import { useSettingsStore } from "./settings.store"; // Import settings store for defaults
import { useProviderStore } from "./provider.store"; // Import provider store for default model

// Define a union type for items in the sidebar
export type SidebarItem =
  | (Conversation & { itemType: "conversation" })
  | (Project & { itemType: "project" });

// Structure for project export
interface ProjectExportNode {
  project: Project;
  children: (ProjectExportNode | ConversationExportNode)[];
}

interface ConversationExportNode {
  conversation: Conversation;
  interactions: Interaction[];
}

// Interface for effective project settings
interface EffectiveProjectSettings {
  systemPrompt: string | null;
  modelId: string | null;
  temperature: number | null;
  maxTokens: number | null;
  topP: number | null;
  topK: number | null;
  presencePenalty: number | null;
  frequencyPenalty: number | null;
}

interface ConversationState {
  conversations: Conversation[];
  projects: Project[];
  selectedItemId: string | null;
  selectedItemType: SidebarItemType | null;
  syncRepos: SyncRepo[];
  conversationSyncStatus: Record<string, SyncStatus>;
  repoInitializationStatus: Record<string, SyncStatus>; // Track clone/pull status per repo
  isLoading: boolean;
  error: string | null;
}
interface ConversationActions {
  loadSidebarItems: () => Promise<void>;
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
  addProject: (
    projectData: Partial<Omit<Project, "id" | "createdAt" | "path">> & {
      name: string;
      parentId?: string | null;
    },
  ) => Promise<string>;
  updateProject: (
    id: string,
    updates: Partial<Omit<Project, "id" | "createdAt" | "path">>,
  ) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
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
  getProjectById: (id: string | null) => Project | undefined;
  getConversationById: (id: string | null) => Conversation | undefined;
  getTopLevelProjectId: (
    itemId: string | null,
    itemType: SidebarItemType | null,
  ) => string | null;
  updateCurrentConversationToolSettings: (settings: {
    enabledTools?: string[];
    toolMaxStepsOverride?: number | null;
  }) => Promise<void>;
  _ensureSyncVfsReady: () => Promise<typeof FsType | null>; // Helper action
  // New helper for effective settings
  getEffectiveProjectSettings: (
    projectId: string | null,
  ) => EffectiveProjectSettings;
}

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
          mdString += `**Attached Files:**
`;
          interaction.prompt.metadata.attachedFiles.forEach((f: any) => {
            mdString += `- ${f.name} (${f.type}, ${formatBytes(f.size)}) ${f.source === "vfs" ? `(VFS: ${f.path})` : "(Direct Upload)"}
`;
          });
          mdString += `
`;
        }
        if (interaction.prompt.content) {
          mdString += `${interaction.prompt.content}

`;
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

const SYNC_REPO_BASE_DIR = "/synced_repos"; // Base directory for sync repos

export const useConversationStore = create(
  immer<ConversationState & ConversationActions>((set, get) => ({
    conversations: [],
    projects: [],
    selectedItemId: null,
    selectedItemType: null,
    syncRepos: [],
    conversationSyncStatus: {},
    repoInitializationStatus: {},
    isLoading: false,
    error: null,

    // --- Helper to ensure Sync VFS is ready ---
    _ensureSyncVfsReady: async () => {
      const vfsStore = useVfsStore.getState();
      if (
        vfsStore.fs &&
        vfsStore.configuredVfsKey === SYNC_VFS_KEY &&
        !vfsStore.loading
      ) {
        return vfsStore.fs; // Already ready
      }

      console.log(
        `[ConversationStore] Sync VFS not ready (key: ${vfsStore.configuredVfsKey}, fs: ${!!vfsStore.fs}, loading: ${vfsStore.loading}). Initializing...`,
      );
      try {
        await vfsStore.initializeVFS(SYNC_VFS_KEY);
        // Re-check state after initialization attempt
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
    // --- End Helper ---

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
          if (c.syncRepoId) {
            // Check if lastSyncedAt is a valid Date object before calling getTime()
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
          projects: dbProjects,
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

          // Check if lastSyncedAt is a valid Date object before calling getTime()
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
            // Also check if updatedTime > lastSyncTime to avoid unnecessary 'needs-sync'
            if (!lastSyncTime || updatedTime > lastSyncTime) {
              state.conversationSyncStatus[id] = "needs-sync";
            }
          }
        }
      });

      const updatedConversationData = get().getConversationById(id);

      if (updatedConversationData) {
        try {
          // Ensure dates are properly handled before saving
          const plainData = JSON.parse(JSON.stringify(updatedConversationData));
          await PersistenceService.saveConversation(plainData);
        } catch (e) {
          console.error("ConversationStore: Error updating conversation", e);
          set((state) => {
            const index = state.conversations.findIndex((c) => c.id === id);
            if (index !== -1) {
              state.conversations[index] = originalConversation;
              // Recalculate original status correctly
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
            // Recalculate original status correctly
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
            // Recalculate original status correctly
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

    addProject: async (projectData) => {
      const parentId = projectData.parentId ?? null;
      const parentProject = get().getProjectById(parentId);
      const parentPath = parentProject ? parentProject.path : "/";
      const projectName = projectData.name.trim();
      const newPath = buildPath(parentPath, projectName);

      const newId = nanoid();
      const now = new Date();
      const newProject: Project = {
        id: newId,
        path: newPath,
        createdAt: now,
        updatedAt: now,
        name: projectName,
        parentId: parentId,
        systemPrompt: projectData.systemPrompt ?? null,
        modelId: projectData.modelId ?? null,
        temperature: projectData.temperature ?? null,
        maxTokens: projectData.maxTokens ?? null,
        topP: projectData.topP ?? null,
        topK: projectData.topK ?? null,
        presencePenalty: projectData.presencePenalty ?? null,
        frequencyPenalty: projectData.frequencyPenalty ?? null,
        metadata: projectData.metadata ?? {},
      };

      set((state) => {
        state.projects.push(newProject);
      });

      try {
        const projectToSave = get().getProjectById(newId);
        if (projectToSave) {
          const plainData = JSON.parse(JSON.stringify(projectToSave));
          await PersistenceService.saveProject(plainData);
        } else {
          throw new Error("Failed to retrieve newly added project state");
        }
        return newId;
      } catch (e: any) {
        console.error("ConversationStore: Error adding project", e);
        if (e.name === "ConstraintError") {
          toast.error(
            `A project or folder named "${projectName}" already exists in this location.`,
          );
        } else {
          toast.error("Failed to save new project.");
        }
        set((state) => ({
          error: "Failed to save new project",
          projects: state.projects.filter((p) => p.id !== newId),
        }));
        throw e;
      }
    },

    updateProject: async (id, updates) => {
      const originalProject = get().getProjectById(id);
      if (!originalProject) {
        console.warn(`ConversationStore: Project ${id} not found.`);
        return;
      }

      let newPath = originalProject.path;
      let newName = originalProject.name;

      if (updates.name !== undefined && updates.name !== originalProject.name) {
        newName = updates.name.trim();
        const parentProject = get().getProjectById(originalProject.parentId);
        const parentPath = parentProject ? parentProject.path : "/";
        newPath = buildPath(parentPath, newName);
      }

      set((state) => {
        const index = state.projects.findIndex((p) => p.id === id);
        if (index !== -1) {
          Object.assign(state.projects[index], {
            ...updates,
            name: newName,
            path: newPath,
            updatedAt: new Date(),
          });
        }
      });

      const updatedProjectData = get().getProjectById(id);

      if (updatedProjectData) {
        try {
          const plainData = JSON.parse(JSON.stringify(updatedProjectData));
          await PersistenceService.saveProject(plainData);
        } catch (e: any) {
          console.error("ConversationStore: Error updating project", e);
          if (e.name === "ConstraintError") {
            toast.error(
              `A project or folder named "${newName}" already exists in this location.`,
            );
          } else {
            toast.error("Failed to save project update.");
          }
          set((state) => {
            const index = state.projects.findIndex((p) => p.id === id);
            if (index !== -1) {
              state.projects[index] = originalProject;
            }
            state.error = "Failed to save project update";
          });
          throw e;
        }
      } else {
        console.error(
          "ConversationStore: Failed to retrieve updated project state after update.",
        );
        set((state) => {
          const index = state.projects.findIndex((p) => p.id === id);
          if (index !== -1) {
            state.projects[index] = originalProject;
          }
          state.error = "Failed to save project update (state error)";
        });
      }
    },

    deleteProject: async (id) => {
      const currentSelectedId = get().selectedItemId;
      const currentSelectedType = get().selectedItemType;
      const projectToDelete = get().projects.find((p) => p.id === id);
      if (!projectToDelete) return;

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
        ),
        selectedItemId: descendantProjectIds.has(currentSelectedId ?? "")
          ? null
          : currentSelectedId,
        selectedItemType: descendantProjectIds.has(currentSelectedId ?? "")
          ? null
          : currentSelectedType,
      }));

      try {
        await PersistenceService.deleteProject(id);

        if (descendantProjectIds.has(currentSelectedId ?? "")) {
          await useInteractionStore.getState().setCurrentConversationId(null);
        }
      } catch (e) {
        console.error("ConversationStore: Error deleting project", e);
        set({ error: "Failed to delete project. Please reload." });
        throw e;
      }
    },

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
          projectId: null,
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
        await get().selectItem(newId, "conversation");
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
          filename = `litechat_conversation_${safeTitle}_${conversationId.substring(0, 6)}.json`;
        } else if (format === "md") {
          const mdString = formatInteractionsToMarkdown(
            conversation,
            interactions,
          );
          blob = new Blob([mdString], { type: "text/markdown" });
          filename = `litechat_conversation_${safeTitle}_${conversationId.substring(0, 6)}.md`;
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

    exportProject: async (projectId) => {
      try {
        const rootProject = get().getProjectById(projectId);
        if (!rootProject) {
          throw new Error("Project not found.");
        }

        const allProjects = get().projects;
        const allConversations = get().conversations;

        const buildExportTree = async (
          currentProjectId: string,
        ): Promise<ProjectExportNode> => {
          const project = allProjects.find((p) => p.id === currentProjectId);
          if (!project) {
            throw new Error(`Project ${currentProjectId} not found in state.`);
          }

          const childProjects = allProjects.filter(
            (p) => p.parentId === currentProjectId,
          );
          const childConversations = allConversations.filter(
            (c) => c.projectId === currentProjectId,
          );

          const children: (ProjectExportNode | ConversationExportNode)[] = [];

          for (const childProj of childProjects) {
            children.push(await buildExportTree(childProj.id));
          }

          for (const childConvo of childConversations) {
            const interactions =
              await PersistenceService.loadInteractionsForConversation(
                childConvo.id,
              );
            children.push({
              conversation: childConvo,
              interactions: interactions,
            });
          }

          return {
            project: project,
            children: children,
          };
        };

        const exportData = await buildExportTree(projectId);
        const jsonString = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonString], { type: "application/json" });
        const safeName =
          rootProject.name.replace(/[^a-z0-9]/gi, "_").toLowerCase() ||
          "project";
        const filename = `litechat_project_${safeName}_${projectId.substring(0, 6)}.json`;

        triggerDownload(blob, filename);
        toast.success(`Project "${rootProject.name}" exported.`);
      } catch (error) {
        console.error("ConversationStore: Error exporting project", error);
        toast.error(
          `Project export failed: ${error instanceof Error ? error.message : String(error)}`,
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
        const filename = `litechat_all_conversations_export_${new Date().toISOString().split("T")[0]}.json`;
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
        branch: repoData.branch || "main", // Default to main if not provided
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
            branch: updates.branch || state.syncRepos[index].branch || "main", // Ensure branch defaults
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

      // Ensure VFS is ready before attempting deletion
      const fsInstance = await get()._ensureSyncVfsReady();
      if (!fsInstance) {
        toast.error("Filesystem not ready, cannot delete repository folder.");
        return; // Prevent deletion if VFS isn't ready
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
        // Delete from DB first
        await PersistenceService.deleteSyncRepo(id);
        toast.success(`Sync repository "${repoToDelete.name}" deleted.`);

        // Then attempt to delete the VFS directory
        try {
          console.log(`[ConversationStore] Deleting VFS directory: ${repoDir}`);
          await VfsOps.deleteItemOp(repoDir, true); // Recursive delete
          toast.info(`Removed local sync folder for "${repoToDelete.name}".`);
        } catch (vfsError: any) {
          // Log VFS deletion error but don't revert DB deletion
          console.error(
            `[ConversationStore] Failed to delete VFS directory ${repoDir}:`,
            vfsError,
          );
          if (vfsError.code !== "ENOENT") {
            // Only show toast if it wasn't a "not found" error
            toast.warning(
              `Failed to remove local sync folder: ${vfsError.message}`,
            );
          }
        }
      } catch (e) {
        console.error("ConversationStore: Error deleting sync repo", e);
        set((state) => {
          if (repoToDelete) {
            state.syncRepos.push(repoToDelete); // Re-add to state on DB error
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
      // Ensure the correct VFS is ready before calling the logic
      const fsInstance = await get()._ensureSyncVfsReady();
      if (!fsInstance) {
        get()._setRepoInitializationStatus(repoId, "error");
        return; // Error handled by _ensureSyncVfsReady
      }
      // Pass the ready fs instance to the logic function
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

      // Ensure the correct VFS is ready before calling the logic
      const fsInstance = await get()._ensureSyncVfsReady();
      if (!fsInstance) {
        get()._setConversationSyncStatus(
          conversationId,
          "error",
          "Filesystem not ready",
        );
        return; // Error handled by _ensureSyncVfsReady
      }

      // Pass the ready fs instance to the logic function
      await syncConversationLogic(
        fsInstance,
        conversation,
        repo,
        get()._setConversationSyncStatus,
        get().updateConversation,
        () => get().selectedItemId,
        () => get().selectedItemType,
      );

      // Update state after sync logic potentially modified conversation data (e.g., pulled)
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
        itemId = convo?.projectId ?? null;
        itemType = "project";
      }

      if (itemType !== "project" || !itemId) return null;

      let currentProject = get().getProjectById(itemId);
      while (currentProject?.parentId) {
        const parent = get().getProjectById(currentProject.parentId);
        if (!parent) return currentProject.id;
        currentProject = parent;
      }
      return currentProject?.id ?? null;
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

    // --- New Helper for Effective Settings ---
    getEffectiveProjectSettings: (projectId) => {
      const globalSettings = useSettingsStore.getState();
      const globalProvider = useProviderStore.getState();

      const defaults: EffectiveProjectSettings = {
        systemPrompt: globalSettings.globalSystemPrompt,
        modelId: globalProvider.selectedModelId,
        temperature: globalSettings.temperature,
        maxTokens: globalSettings.maxTokens,
        topP: globalSettings.topP,
        topK: globalSettings.topK,
        presencePenalty: globalSettings.presencePenalty,
        frequencyPenalty: globalSettings.frequencyPenalty,
      };

      if (!projectId) {
        return defaults;
      }

      const projectStack: Project[] = [];
      let currentId: string | null = projectId;
      while (currentId) {
        const project = get().getProjectById(currentId);
        if (project) {
          projectStack.unshift(project); // Add to front to process parents first
          currentId = project.parentId;
        } else {
          currentId = null; // Stop if project not found
        }
      }

      // Apply settings from the stack, overriding defaults/parents
      const effectiveSettings = projectStack.reduce((settings, project) => {
        return {
          systemPrompt:
            project.systemPrompt !== undefined
              ? project.systemPrompt
              : settings.systemPrompt,
          modelId:
            project.modelId !== undefined ? project.modelId : settings.modelId,
          temperature:
            project.temperature !== undefined
              ? project.temperature
              : settings.temperature,
          maxTokens:
            project.maxTokens !== undefined
              ? project.maxTokens
              : settings.maxTokens,
          topP: project.topP !== undefined ? project.topP : settings.topP,
          topK: project.topK !== undefined ? project.topK : settings.topK,
          presencePenalty:
            project.presencePenalty !== undefined
              ? project.presencePenalty
              : settings.presencePenalty,
          frequencyPenalty:
            project.frequencyPenalty !== undefined
              ? project.frequencyPenalty
              : settings.frequencyPenalty,
        };
      }, defaults);

      return effectiveSettings;
    },
    // --- End New Helper ---
  })),
);
