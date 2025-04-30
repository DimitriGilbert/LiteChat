// src/store/project.store.ts
// Entire file content provided - New store for projects
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { Project } from "@/types/litechat/project";
import { PersistenceService } from "@/services/persistence.service";
import { nanoid } from "nanoid";
import { toast } from "sonner";
import { buildPath } from "@/lib/litechat/file-manager-utils";
import { useSettingsStore } from "./settings.store";
import { useProviderStore } from "./provider.store";
import { useConversationStore } from "./conversation.store"; // Needed for deleting convos within project

// Interface for effective project settings (copied from conversation.store)
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
  getEffectiveProjectSettings: (
    projectId: string | null,
  ) => EffectiveProjectSettings;
  getTopLevelProjectId: (projectId: string | null) => string | null;
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
        set({
          projects: dbProjects,
          isLoading: false,
        });
      } catch (e) {
        console.error("ProjectStore: Error loading projects", e);
        set({ error: "Failed load projects", isLoading: false });
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
        console.error("ProjectStore: Error adding project", e);
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
        console.warn(`ProjectStore: Project ${id} not found.`);
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
          console.error("ProjectStore: Error updating project", e);
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
          "ProjectStore: Failed to retrieve updated project state after update.",
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
      const projectToDelete = get().projects.find((p) => p.id === id);
      if (!projectToDelete) return;

      const descendantProjectIds = new Set<string>();
      const findDescendants = (projectId: string) => {
        descendantProjectIds.add(projectId);
        get()
          .projects.filter((p) => p.parentId === projectId)
          .forEach((child) => findDescendants(child.id));
      };
      findDescendants(id);

      // Update project state
      set((state) => ({
        projects: state.projects.filter((p) => !descendantProjectIds.has(p.id)),
      }));

      // Update conversation state (unlink convos)
      useConversationStore.getState()._unlinkConversationsFromProjects(
        Array.from(descendantProjectIds), // Pass IDs to unlink
      );

      try {
        // Delete from DB (this handles recursive deletion and unlinking in persistence)
        await PersistenceService.deleteProject(id);
      } catch (e) {
        console.error("ProjectStore: Error deleting project", e);
        set({ error: "Failed to delete project. Please reload." });
        // Consider reverting state if needed, though complex with dependencies
        throw e;
      }
    },

    getProjectById: (id) => {
      if (!id) return undefined;
      return get().projects.find((p) => p.id === id);
    },

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
          projectStack.unshift(project);
          currentId = project.parentId;
        } else {
          currentId = null;
        }
      }

      const effectiveSettings = projectStack.reduce((settings, project) => {
        return {
          systemPrompt:
            project.systemPrompt !== undefined && project.systemPrompt !== null
              ? project.systemPrompt
              : settings.systemPrompt,
          modelId:
            project.modelId !== undefined && project.modelId !== null
              ? project.modelId
              : settings.modelId,
          temperature:
            project.temperature !== undefined && project.temperature !== null
              ? project.temperature
              : settings.temperature,
          maxTokens:
            project.maxTokens !== undefined && project.maxTokens !== null
              ? project.maxTokens
              : settings.maxTokens,
          topP:
            project.topP !== undefined && project.topP !== null
              ? project.topP
              : settings.topP,
          topK:
            project.topK !== undefined && project.topK !== null
              ? project.topK
              : settings.topK,
          presencePenalty:
            project.presencePenalty !== undefined &&
            project.presencePenalty !== null
              ? project.presencePenalty
              : settings.presencePenalty,
          frequencyPenalty:
            project.frequencyPenalty !== undefined &&
            project.frequencyPenalty !== null
              ? project.frequencyPenalty
              : settings.frequencyPenalty,
        };
      }, defaults);

      return effectiveSettings;
    },

    getTopLevelProjectId: (projectId) => {
      if (!projectId) return null;
      let currentProject = get().getProjectById(projectId);
      while (currentProject?.parentId) {
        const parent = get().getProjectById(currentProject.parentId);
        if (!parent) return currentProject.id;
        currentProject = parent;
      }
      return currentProject?.id ?? null;
    },
  })),
);
