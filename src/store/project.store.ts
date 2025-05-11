// src/store/project.store.ts
// FULL FILE
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { Project } from "@/types/litechat/project";
import { PersistenceService } from "@/services/persistence.service";
import { nanoid } from "nanoid";
import { toast } from "sonner";
import { normalizePath } from "@/lib/litechat/file-manager-utils";
import { useSettingsStore } from "./settings.store";
import { useProviderStore } from "./provider.store";
import { useConversationStore } from "./conversation.store";
import { emitter } from "@/lib/litechat/event-emitter";
import {
  projectEvent,
  ProjectEventPayloads,
} from "@/types/litechat/events/project.events";
import type {
  RegisteredActionHandler,
  ActionHandler,
} from "@/types/litechat/control";

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
    }
  ) => Promise<string>;
  updateProject: (
    id: string,
    updates: Partial<Omit<Project, "id" | "createdAt" | "path">>
  ) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  getProjectById: (id: string | null) => Project | undefined;
  getTopLevelProjectId: (id: string | null) => string | null;
  getEffectiveProjectSettings: (projectId: string | null) => {
    systemPrompt: string | null;
    modelId: string | null;
    temperature: number | null;
    maxTokens: number | null;
    topP: number | null;
    topK: number | null;
    presencePenalty: number | null;
    frequencyPenalty: number | null;
    defaultTagIds: string[] | null;
    defaultRuleIds: string[] | null;
  };
  getRegisteredActionHandlers: () => RegisteredActionHandler[];
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
        emitter.emit(projectEvent.loaded, { projects: dbProjects });
      } catch (e) {
        console.error("ProjectStore: Error loading projects", e);
        set({ error: "Failed to load projects", isLoading: false });
        emitter.emit(projectEvent.loadingStateChanged, {
          isLoading: false,
          error: "Failed to load projects",
        });
      }
    },

    addProject: async (projectData) => {
      const newId = nanoid();
      const now = new Date();
      const parentPath = projectData.parentId
        ? get().getProjectById(projectData.parentId)?.path ?? "/"
        : "/";
      const newPath = normalizePath(
        `${parentPath}/${projectData.name
          .replace(/\s+/g, "-")
          .toLowerCase()}-${newId.substring(0, 4)}`
      );

      const newProject: Project = {
        id: newId,
        path: newPath,
        createdAt: now,
        updatedAt: now,
        name: projectData.name,
        parentId: projectData.parentId ?? null,
        systemPrompt: projectData.systemPrompt ?? null,
        modelId: projectData.modelId ?? null,
        temperature: projectData.temperature ?? null,
        maxTokens: projectData.maxTokens ?? null,
        topP: projectData.topP ?? null,
        topK: projectData.topK ?? null,
        presencePenalty: projectData.presencePenalty ?? null,
        frequencyPenalty: projectData.frequencyPenalty ?? null,
        defaultTagIds: projectData.defaultTagIds ?? null,
        defaultRuleIds: projectData.defaultRuleIds ?? null,
        metadata: projectData.metadata ?? {},
      };

      try {
        await PersistenceService.saveProject(newProject);
        set((state) => {
          state.projects.unshift(newProject);
          state.projects.sort(
            (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
          );
        });
        emitter.emit(projectEvent.added, { project: newProject });
        return newId;
      } catch (e) {
        console.error("ProjectStore: Error adding project", e);
        set({ error: "Failed to save new project" });
        throw e;
      }
    },

    updateProject: async (id, updates) => {
      const originalProject = get().getProjectById(id);
      if (!originalProject) {
        console.warn(`ProjectStore: Project ${id} not found for update.`);
        return;
      }

      const updatedProjectData: Project = {
        ...originalProject,
        ...updates,
        updatedAt: new Date(),
      };

      if (updates.name && updates.name !== originalProject.name) {
        const parentPath = originalProject.parentId
          ? get().getProjectById(originalProject.parentId)?.path ?? "/"
          : "/";
        updatedProjectData.path = normalizePath(
          `${parentPath}/${updates.name
            .replace(/\s+/g, "-")
            .toLowerCase()}-${id.substring(0, 4)}`
        );
      }

      try {
        await PersistenceService.saveProject(updatedProjectData);
        set((state) => {
          const index = state.projects.findIndex((p) => p.id === id);
          if (index !== -1) {
            state.projects[index] = updatedProjectData;
            state.projects.sort(
              (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
            );
          }
        });
        emitter.emit(projectEvent.updated, {
          projectId: id,
          updates: updatedProjectData,
        });
      } catch (e) {
        console.error("ProjectStore: Error updating project", e);
        set({ error: "Failed to save project update" });
        throw e;
      }
    },

    deleteProject: async (id) => {
      const projectToDelete = get().projects.find((p) => p.id === id);
      if (!projectToDelete) return;

      const projectsToDeleteIds = new Set<string>();
      const findDescendants = (currentId: string) => {
        projectsToDeleteIds.add(currentId);
        get()
          .projects.filter((p) => p.parentId === currentId)
          .forEach((child) => findDescendants(child.id));
      };
      findDescendants(id);

      try {
        await PersistenceService.deleteProject(id);
        set((state) => ({
          projects: state.projects.filter(
            (p) => !projectsToDeleteIds.has(p.id)
          ),
        }));
        useConversationStore
          .getState()
          ._unlinkConversationsFromProjects(Array.from(projectsToDeleteIds));
        emitter.emit(projectEvent.deleted, { projectId: id });
        toast.success(
          `Project "${projectToDelete.name}" and its contents deleted.`
        );
      } catch (e) {
        console.error("ProjectStore: Error deleting project", e);
        set({ error: "Failed to delete project" });
        throw e;
      }
    },

    getProjectById: (id) => {
      if (!id) return undefined;
      return get().projects.find((p) => p.id === id);
    },

    getTopLevelProjectId: (id) => {
      if (!id) return null;
      let current = get().getProjectById(id);
      if (!current) return null;
      while (current.parentId) {
        const parent = get().getProjectById(current.parentId);
        if (!parent) break;
        current = parent;
      }
      return current.id;
    },

    getEffectiveProjectSettings: (projectId) => {
      const globalSettings = useSettingsStore.getState();
      const globalModelId = useProviderStore.getState().selectedModelId;

      const defaults = {
        systemPrompt: globalSettings.globalSystemPrompt,
        modelId: globalModelId,
        temperature: globalSettings.temperature,
        maxTokens: globalSettings.maxTokens,
        topP: globalSettings.topP,
        topK: globalSettings.topK,
        presencePenalty: globalSettings.presencePenalty,
        frequencyPenalty: globalSettings.frequencyPenalty,
        defaultTagIds: null,
        defaultRuleIds: null,
      };

      if (!projectId) {
        return defaults;
      }

      const project = get().getProjectById(projectId);
      if (!project) {
        return defaults;
      }

      const parentSettings = project.parentId
        ? get().getEffectiveProjectSettings(project.parentId)
        : defaults;

      return {
        systemPrompt:
          project.systemPrompt !== null && project.systemPrompt !== undefined
            ? project.systemPrompt
            : parentSettings.systemPrompt,
        modelId:
          project.modelId !== null && project.modelId !== undefined
            ? project.modelId
            : parentSettings.modelId,
        temperature:
          project.temperature !== null && project.temperature !== undefined
            ? project.temperature
            : parentSettings.temperature,
        maxTokens:
          project.maxTokens !== null && project.maxTokens !== undefined
            ? project.maxTokens
            : parentSettings.maxTokens,
        topP:
          project.topP !== null && project.topP !== undefined
            ? project.topP
            : parentSettings.topP,
        topK:
          project.topK !== null && project.topK !== undefined
            ? project.topK
            : parentSettings.topK,
        presencePenalty:
          project.presencePenalty !== null &&
          project.presencePenalty !== undefined
            ? project.presencePenalty
            : parentSettings.presencePenalty,
        frequencyPenalty:
          project.frequencyPenalty !== null &&
          project.frequencyPenalty !== undefined
            ? project.frequencyPenalty
            : parentSettings.frequencyPenalty,
        defaultTagIds:
          project.defaultTagIds !== null && project.defaultTagIds !== undefined
            ? project.defaultTagIds
            : parentSettings.defaultTagIds,
        defaultRuleIds:
          project.defaultRuleIds !== null &&
          project.defaultRuleIds !== undefined
            ? project.defaultRuleIds
            : parentSettings.defaultRuleIds,
      };
    },
    getRegisteredActionHandlers: (): RegisteredActionHandler[] => {
      const storeId = "projectStore";
      const actions = get();
      const wrapPromiseString =
        <P>(fn: (payload: P) => Promise<string>): ActionHandler<P> =>
        async (payload: P) => {
          await fn(payload);
        };

      return [
        {
          eventName: projectEvent.loadProjectsRequest,
          handler: actions.loadProjects,
          storeId,
        },
        {
          eventName: projectEvent.addProjectRequest,
          handler: wrapPromiseString(actions.addProject),
          storeId,
        },
        {
          eventName: projectEvent.updateProjectRequest,
          handler: (
            p: ProjectEventPayloads[typeof projectEvent.updateProjectRequest]
          ) => actions.updateProject(p.id, p.updates),
          storeId,
        },
        {
          eventName: projectEvent.deleteProjectRequest,
          handler: (
            p: ProjectEventPayloads[typeof projectEvent.deleteProjectRequest]
          ) => actions.deleteProject(p.id),
          storeId,
        },
      ];
    },
  }))
);
