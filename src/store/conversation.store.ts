// src/store/conversation.store.ts
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { Conversation, SidebarItemType } from "@/types/litechat/chat";
import type { Interaction } from "@/types/litechat/interaction";
import type { SyncRepo, SyncStatus } from "@/types/litechat/sync";
import type { Project } from "@/types/litechat/project";
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
  buildPath, // Import buildPath
} from "@/lib/litechat/file-manager-utils";
import { format } from "date-fns";

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

interface ConversationState {
  conversations: Conversation[];
  projects: Project[];
  selectedItemId: string | null;
  selectedItemType: SidebarItemType | null;
  syncRepos: SyncRepo[];
  conversationSyncStatus: Record<string, SyncStatus>;
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
  selectItem: (id: string | null, type: SidebarItemType | null) => void;
  importConversation: (file: File) => Promise<void>;
  exportConversation: (
    conversationId: string,
    format: "json" | "md",
  ) => Promise<void>;
  exportProject: (projectId: string) => Promise<void>; // Added project export
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
  getProjectById: (id: string | null) => Project | undefined;
  getConversationById: (id: string | null) => Conversation | undefined;
  getTopLevelProjectId: (
    itemId: string | null,
    itemType: SidebarItemType | null,
  ) => string | null;
  // Action to update tool settings for the current conversation
  updateCurrentConversationToolSettings: (settings: {
    enabledTools?: string[];
    toolMaxStepsOverride?: number | null;
  }) => Promise<void>;
}

const CONVERSATION_DIR = ".litechat/conversations";

// Helper function to format interactions to Markdown
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
    projects: [],
    selectedItemId: null,
    selectedItemType: null,
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
        projectId: conversationData.projectId ?? null,
        // Initialize tool metadata for new conversations
        metadata: {
          ...(conversationData.metadata ?? {}),
          enabledTools: [], // Start with no tools enabled
          toolMaxStepsOverride: null, // Start with no override
        },
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
          // Merge metadata carefully
          const existingMeta = state.conversations[index].metadata ?? {};
          const updateMeta = updates.metadata ?? {};
          const mergedMeta = { ...existingMeta, ...updateMeta };

          Object.assign(state.conversations[index], {
            ...updates,
            metadata: mergedMeta, // Assign merged metadata
            updatedAt: new Date(),
          });

          // Check if sync status needs update (only if relevant fields changed)
          const relevantFieldsChanged = [
            "title",
            "metadata",
            "syncRepoId",
            "projectId",
          ].some((field) => field in updates);

          if (
            relevantFieldsChanged &&
            state.conversations[index].syncRepoId &&
            state.conversationSyncStatus[id] === "idle"
          ) {
            state.conversationSyncStatus[id] = "needs-sync";
          }
          // Sort is handled later by selectors/components if needed
        }
      });

      const updatedConversationData = get().getConversationById(id);

      if (updatedConversationData) {
        try {
          // Use deep clone before saving to ensure plain object
          const plainData = JSON.parse(JSON.stringify(updatedConversationData));
          await PersistenceService.saveConversation(plainData);
        } catch (e) {
          console.error("ConversationStore: Error updating conversation", e);
          set((state) => {
            const index = state.conversations.findIndex((c) => c.id === id);
            if (index !== -1) {
              state.conversations[index] = originalConversation;
              // Re-sort might be needed if update affected order
            }
            if (state.conversationSyncStatus[id] === "needs-sync") {
              state.conversationSyncStatus[id] = "idle";
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
          }
          if (state.conversationSyncStatus[id] === "needs-sync") {
            state.conversationSyncStatus[id] = "idle";
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
          useInteractionStore.getState().setCurrentConversationId(null);
        }
      } catch (e) {
        console.error("ConversationStore: Error deleting conversation", e);
        set((state) => {
          if (conversationToDelete) {
            state.conversations.push(conversationToDelete);
            // Re-sort might be needed
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
      const parentId = projectData.parentId ?? null;
      const parentProject = get().getProjectById(parentId);
      const parentPath = parentProject ? parentProject.path : "/";
      const projectName = projectData.name.trim();
      const newPath = buildPath(parentPath, projectName);

      // No need for sibling check here, Dexie's unique index on 'path' handles it

      const newId = nanoid();
      const now = new Date();
      const newProject: Project = {
        id: newId,
        path: newPath, // Add the calculated path
        createdAt: now,
        updatedAt: now,
        name: projectName,
        parentId: parentId,
        systemPrompt: projectData.systemPrompt ?? null,
        modelId: projectData.modelId ?? null,
        temperature: projectData.temperature ?? null,
        metadata: projectData.metadata ?? {},
      };

      set((state) => {
        state.projects.push(newProject);
      });

      try {
        // Fetch the newly added project from state *after* set
        const projectToSave = get().getProjectById(newId);
        if (projectToSave) {
          // Use deep clone before saving
          const plainData = JSON.parse(JSON.stringify(projectToSave));
          await PersistenceService.saveProject(plainData);
        } else {
          throw new Error("Failed to retrieve newly added project state");
        }
        return newId;
      } catch (e: any) {
        console.error("ConversationStore: Error adding project", e);
        // Check if it's a Dexie ConstraintError (path collision)
        if (e.name === "ConstraintError") {
          toast.error(
            `A project or folder named "${projectName}" already exists in this location.`,
          );
        } else {
          toast.error("Failed to save new project.");
        }
        // Revert state
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

      // Recalculate path if name is changing
      if (updates.name !== undefined && updates.name !== originalProject.name) {
        newName = updates.name.trim();
        const parentProject = get().getProjectById(originalProject.parentId);
        const parentPath = parentProject ? parentProject.path : "/";
        newPath = buildPath(parentPath, newName);
        // No need for sibling check, Dexie handles path uniqueness
      }

      // Update state using Immer
      set((state) => {
        const index = state.projects.findIndex((p) => p.id === id);
        if (index !== -1) {
          Object.assign(state.projects[index], {
            ...updates,
            name: newName, // Ensure updated name is set
            path: newPath, // Ensure updated path is set
            updatedAt: new Date(),
          });
        }
      });

      // Fetch the updated, plain object *after* the set call
      const updatedProjectData = get().getProjectById(id);

      if (updatedProjectData) {
        try {
          // Use deep clone before saving
          const plainData = JSON.parse(JSON.stringify(updatedProjectData));
          await PersistenceService.saveProject(plainData);
        } catch (e: any) {
          console.error("ConversationStore: Error updating project", e);
          // Check if it's a Dexie ConstraintError (path collision)
          if (e.name === "ConstraintError") {
            toast.error(
              `A project or folder named "${newName}" already exists in this location.`,
            );
          } else {
            toast.error("Failed to save project update.");
          }
          // Revert state using the original copy
          set((state) => {
            const index = state.projects.findIndex((p) => p.id === id);
            if (index !== -1) {
              state.projects[index] = originalProject; // Revert
            }
            state.error = "Failed to save project update";
          });
          throw e; // Re-throw error after reverting state
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
          useInteractionStore.getState().setCurrentConversationId(null);
        }
      } catch (e) {
        console.error("ConversationStore: Error deleting project", e);
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
        get().selectItem(newId, "conversation");
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

          // Recursively build child projects
          for (const childProj of childProjects) {
            children.push(await buildExportTree(childProj.id));
          }

          // Build child conversations
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
        ...repoData,
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
          } catch (
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            verifyError
          ) {
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
            // Sort handled by component
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
        // Use type check for error message
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        toast.error(`Sync failed: ${errorMessage}`);
        _setConversationSyncStatus(conversationId, "error", errorMessage);
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

    // --- New Action ---
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

      // Only update if metadata actually changed
      if (
        JSON.stringify(newMeta) !== JSON.stringify(currentMeta) ||
        !currentConversation.metadata // Update if metadata was previously undefined
      ) {
        await updateConversation(selectedItemId, { metadata: newMeta });
      }
    },
  })),
);
