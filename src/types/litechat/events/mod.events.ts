// src/types/litechat/events/mod.events.ts
// FULL FILE
import type { DbMod, ModInstance, CustomSettingTab } from "../modding"; // Use relative import

export const modEvent = {
  // State Change Events
  dbModsLoaded: "mod.db.mods.loaded",
  loadedInstancesChanged: "mod.loaded.instances.changed",
  settingsTabsChanged: "mod.settings.tabs.changed",
  loadingStateChanged: "mod.loading.state.changed",
  modLoaded: "mod.sdk.loaded", // Renamed to avoid conflict with store event
  modError: "mod.sdk.error", // Renamed to avoid conflict with store event

  // Action Request Events
  loadDbModsRequest: "mod.load.db.mods.request",
  addDbModRequest: "mod.add.db.mod.request",
  updateDbModRequest: "mod.update.db.mod.request",
  deleteDbModRequest: "mod.delete.db.mod.request",
} as const;

export interface ModEventPayloads {
  [modEvent.dbModsLoaded]: { dbMods: DbMod[] };
  [modEvent.loadedInstancesChanged]: { loadedMods: ModInstance[] };
  [modEvent.settingsTabsChanged]: { tabs: CustomSettingTab[] };
  [modEvent.loadingStateChanged]: {
    isLoading: boolean;
    error: string | null;
  };
  [modEvent.modLoaded]: { id: string; name: string };
  [modEvent.modError]: { id: string; name: string; error: Error | string };
  [modEvent.loadDbModsRequest]: undefined;
  [modEvent.addDbModRequest]: Omit<DbMod, "id" | "createdAt">;
  [modEvent.updateDbModRequest]: { id: string; changes: Partial<DbMod> };
  [modEvent.deleteDbModRequest]: { id: string };
}
