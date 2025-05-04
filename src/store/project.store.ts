// src/store/project.store.ts

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { Project } from "@/types/litechat/project";
import { PersistenceService } from "@/services/persistence.service";
import { nanoid } from "nanoid";
import { toast } from "sonner";
import { dirname, buildPath } from "@/lib/litechat/file-manager-utils";
import { useSettingsStore } from "./settings.store";
import { useConversationStore } from "./conversation.store";
import { useVfsStore } from "./vfs.store";
import { useProviderStore } from "./provider.store";

interface ProjectState {
  projects: Project[];
  isLoading: boolean;
  error: string | null;
}

interface ProjectActions {
  loadProjects: () => Promise<void>;
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
  getProjectById: (id: string | null) => Project | undefined;
  getProjectHierarchy: (
    projectId: string | null,
  ) => { id: string; name: string }[];
  getEffectiveProjectSettings: (projectId: string | null) => {
    systemPrompt: string | null;
    modelId: string | null;
    temperature: number | null;
    maxTokens: number | null;
    topP: number | null;
    topK: number | null;
    presencePenalty: number | null;
    frequencyPenalty: number | null;
  };
}

export const useProjectStore = create(
  immer<ProjectState & ProjectActions>((set, get) => ({
    projects: [],
    isLoading: false,
    error: null,

    loadProjects: async () => {
      set({ isLoading: true, error: null });
      try {
        const dbProjects = await PersistenceService.loadProjects();
        set({ projects: dbProjects, isLoading: false });
      } catch (e) {
        console.error("ProjectStore: Error loading projects", e);
        set({ error: "Failed to load projects", isLoading: false });
      }
    },

    addProject: async (projectData) => {
      const newId = nanoid();
      const now = new Date();
      const parentId = projectData.parentId ?? null;
      const parentProject = parentId ? get().getProjectById(parentId) : null;
      const parentPath = parentProject ? parentProject.path : "/";
      const newPath = buildPath(parentPath, projectData.name);

      const newProject: Project = {
        id: newId,
        createdAt: now,
        updatedAt: now,
        name: projectData.name,
        parentId: parentId,
        path: newPath,
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
        state.projects.sort(
          (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
        );
      });

      try {
        const projectToSave = get().getProjectById(newId);
        if (projectToSave) {
          await PersistenceService.saveProject(projectToSave);
          // Initialize VFS for the new project immediately
          await useVfsStore.getState().initializeVFS(newId);
        } else {
          throw new Error("Failed to retrieve newly added project state");
        }
        return newId;
      } catch (e) {
        console.error("ProjectStore: Error adding project", e);
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
        console.warn(`ProjectStore: Project ${id} not found for update.`);
        return;
      }

      let newPath = originalProject.path;
      if (updates.name && updates.name !== originalProject.name) {
        const parentPath = dirname(originalProject.path);
        newPath = buildPath(parentPath, updates.name);
      }

      const updatedProjectData: Project = {
        ...originalProject,
        ...updates,
        path: newPath,
        updatedAt: new Date(),
      };

      set((state) => {
        const index = state.projects.findIndex((p) => p.id === id);
        if (index !== -1) {
          state.projects[index] = updatedProjectData;
          state.projects.sort(
            (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
          );
        }
      });

      try {
        await PersistenceService.saveProject(updatedProjectData);
      } catch (e) {
        console.error("ProjectStore: Error updating project", e);
        set((state) => {
          const index = state.projects.findIndex((p) => p.id === id);
          if (index !== -1) {
            state.projects[index] = originalProject;
            state.projects.sort(
              (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
            );
          }
          state.error = "Failed to save project update";
        });
        throw e;
      }
    },

    deleteProject: async (id) => {
      const projectToDelete = get().getProjectById(id);
      if (!projectToDelete) return;

      const childProjectIds = get()
        .projects.filter((p) => p.parentId === id)
        .map((p) => p.id);
      const allIdsToDelete = [id, ...childProjectIds];

      set((state) => ({
        projects: state.projects.filter((p) => !allIdsToDelete.includes(p.id)),
      }));

      // Unlink conversations associated with the deleted projects
      useConversationStore
        .getState()
        ._unlinkConversationsFromProjects(allIdsToDelete);

      try {
        await PersistenceService.deleteProject(id);
        // VFS deletion should be handled separately if needed, maybe via settings
        toast.success(`Project "${projectToDelete.name}" deleted.`);
      } catch (e) {
        console.error("ProjectStore: Error deleting project", e);
        set((state) => {
          // Re-add the deleted projects if deletion failed
          const projectsToAddBack = get()
            .projects.filter((p) => allIdsToDelete.includes(p.id))
            .concat(projectToDelete); // Ensure the main one is added back too
          state.projects.push(...projectsToAddBack);
          state.projects.sort(
            (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
          );
          state.error = "Failed to delete project";
        });
        throw e;
      }
    },

    getProjectById: (id) => {
      if (!id) return undefined;
      return get().projects.find((p) => p.id === id);
    },

    getProjectHierarchy: (projectId) => {
      const hierarchy: { id: string; name: string }[] = [];
      let currentId = projectId;
      while (currentId) {
        const project = get().getProjectById(currentId);
        if (project) {
          hierarchy.unshift({ id: project.id, name: project.name });
          currentId = project.parentId;
        } else {
          break;
        }
      }
      return hierarchy;
    },

    getEffectiveProjectSettings: (projectId) => {
      const globalSettings = useSettingsStore.getState();
      // Get the globally selected model ID from ProviderStore
      const globalModelId = useProviderStore.getState().selectedModelId;

      let currentId = projectId;
      let settings = {
        systemPrompt: null as string | null,
        modelId: null as string | null,
        temperature: null as number | null,
        maxTokens: null as number | null,
        topP: null as number | null,
        topK: null as number | null,
        presencePenalty: null as number | null,
        frequencyPenalty: null as number | null,
      };

      // Traverse up the hierarchy
      while (currentId) {
        const project = get().getProjectById(currentId);
        if (project) {
          if (
            settings.systemPrompt === null &&
            project.systemPrompt !== null &&
            project.systemPrompt !== undefined
          )
            settings.systemPrompt = project.systemPrompt;
          if (
            settings.modelId === null &&
            project.modelId !== null &&
            project.modelId !== undefined
          )
            settings.modelId = project.modelId;
          if (
            settings.temperature === null &&
            project.temperature !== null &&
            project.temperature !== undefined
          )
            settings.temperature = project.temperature;
          if (
            settings.maxTokens === null &&
            project.maxTokens !== null &&
            project.maxTokens !== undefined
          )
            settings.maxTokens = project.maxTokens;
          if (
            settings.topP === null &&
            project.topP !== null &&
            project.topP !== undefined
          )
            settings.topP = project.topP;
          if (
            settings.topK === null &&
            project.topK !== null &&
            project.topK !== undefined
          )
            settings.topK = project.topK;
          if (
            settings.presencePenalty === null &&
            project.presencePenalty !== null &&
            project.presencePenalty !== undefined
          )
            settings.presencePenalty = project.presencePenalty;
          if (
            settings.frequencyPenalty === null &&
            project.frequencyPenalty !== null &&
            project.frequencyPenalty !== undefined
          )
            settings.frequencyPenalty = project.frequencyPenalty;

          currentId = project.parentId;
        } else {
          break;
        }
      }

      // Apply global defaults if still null
      if (settings.systemPrompt === null)
        settings.systemPrompt = globalSettings.globalSystemPrompt;
      // Use globalModelId from ProviderStore as the final fallback
      if (settings.modelId === null) settings.modelId = globalModelId;
      if (settings.temperature === null)
        settings.temperature = globalSettings.temperature;
      if (settings.maxTokens === null)
        settings.maxTokens = globalSettings.maxTokens;
      if (settings.topP === null) settings.topP = globalSettings.topP;
      if (settings.topK === null) settings.topK = globalSettings.topK;
      if (settings.presencePenalty === null)
        settings.presencePenalty = globalSettings.presencePenalty;
      if (settings.frequencyPenalty === null)
        settings.frequencyPenalty = globalSettings.frequencyPenalty;

      return settings;
    },
  })),
);
