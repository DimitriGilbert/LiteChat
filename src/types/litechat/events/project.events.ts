// src/types/litechat/events/project.events.ts
// FULL FILE
import type { Project } from "@/types/litechat/project";

export const projectEvent = {
  // State Change Events
  loaded: "project.loaded", // Emitted when projects are loaded/reloaded
  added: "project.added",
  updated: "project.updated",
  deleted: "project.deleted",
  loadingStateChanged: "project.loading.state.changed",

  // Action Request Events
  loadProjectsRequest: "project.load.projects.request",
  addProjectRequest: "project.add.project.request",
  updateProjectRequest: "project.update.project.request",
  deleteProjectRequest: "project.delete.project.request",
} as const;

export interface ProjectEventPayloads {
  [projectEvent.loaded]: { projects: Project[] };
  [projectEvent.added]: { project: Project };
  [projectEvent.updated]: { projectId: string; updates: Partial<Project> };
  [projectEvent.deleted]: { projectId: string };
  [projectEvent.loadingStateChanged]: {
    isLoading: boolean;
    error: string | null;
  };
  [projectEvent.loadProjectsRequest]: undefined;
  [projectEvent.addProjectRequest]: Partial<
    Omit<Project, "id" | "createdAt" | "path">
  > & { name: string; parentId?: string | null };
  [projectEvent.updateProjectRequest]: {
    id: string;
    updates: Partial<Omit<Project, "id" | "createdAt" | "path">>;
  };
  [projectEvent.deleteProjectRequest]: { id: string };
}
