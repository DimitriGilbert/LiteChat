// src/types/litechat/events/stores/mod.events.ts
// NEW FILE
export const modStoreEvent = {
  // State Change Events
  dbModsLoaded: "stores.mod.db.mods.loaded",
  loadedInstancesChanged: "stores.mod.loaded.instances.changed",
  settingsTabsChanged: "stores.mod.settings.tabs.changed",
  loadingStateChanged: "stores.mod.loading.state.changed", // For isLoading and error
  modLoaded: "mod.loaded", // Original event, re-emit if needed
  modError: "mod.error", // Original event, re-emit if needed

  // Action Request Events
  loadDbModsRequest: "stores.mod.load.db.mods.request",
  addDbModRequest: "stores.mod.add.db.mod.request",
  updateDbModRequest: "stores.mod.update.db.mod.request",
  deleteDbModRequest: "stores.mod.delete.db.mod.request",
} as const;
