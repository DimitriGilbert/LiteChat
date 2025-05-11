// src/types/litechat/events/stores/project.events.ts
// FULL FILE
export const projectStoreEvent = {
  // State Change Events
  loaded: "stores.project.loaded",
  added: "stores.project.added",
  updated: "stores.project.updated",
  deleted: "stores.project.deleted",
  loadingStateChanged: "stores.project.loading.state.changed", // Added this event

  // Action Request Events
  loadProjectsRequest: "stores.project.load.projects.request",
  addProjectRequest: "stores.project.add.project.request",
  updateProjectRequest: "stores.project.update.project.request",
  deleteProjectRequest: "stores.project.delete.project.request",
} as const;
