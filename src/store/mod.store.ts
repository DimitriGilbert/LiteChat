// src/store/mod.store.ts
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type {
  DbMod,
  ModState as ModStoreState,
  ModActions as ModStoreActions,
} from "@/types/litechat/modding"
import { PersistenceService } from "@/services/persistence.service";
import { nanoid } from "nanoid";
import { toast } from "sonner";

export const useModStore = create(
  immer<ModStoreState & ModStoreActions>((set, get) => ({
    // Initial State
    dbMods: [],
    loadedMods: [],
    modSettingsTabs: [],
    isLoading: false,
    error: null,

    // Actions
    loadDbMods: async () => {
      set({ isLoading: true, error: null });
      try {
        const mods = await PersistenceService.loadMods();
        set({ dbMods: mods, isLoading: false });
      } catch (e) {
        const errorMsg = "Failed to load mods";
        console.error("ModStore: Error loading mods", e);
        set({ error: errorMsg, isLoading: false });
        toast.error(errorMsg);
      }
    },

    addDbMod: async (modData) => {
      const newId = nanoid();
      const newMod: DbMod = {
        id: newId,
        createdAt: new Date(),
        ...modData,
        loadOrder: modData.loadOrder ?? Date.now(),
      };
      // Optimistic update
      set((state) => {
        state.dbMods.push(newMod);
        state.dbMods.sort((a, b) => a.loadOrder - b.loadOrder);
      });
      try {
        await PersistenceService.saveMod(newMod);
        toast.success(`Mod "${newMod.name}" added.`);
        return newId;
      } catch (e) {
        const errorMsg = "Failed to save new mod";
        console.error("ModStore: Error adding mod", e);
        // Revert optimistic update
        set((state) => {
          state.dbMods = state.dbMods.filter((m) => m.id !== newId);
          state.error = errorMsg;
        });
        toast.error(errorMsg);
        throw e;
      }
    },

    updateDbMod: async (id, changes) => {
      let originalMod: DbMod | undefined;
      let modIndex = -1;

      // Perform the state update using set
      set((state) => {
        modIndex = state.dbMods.findIndex((m) => m.id === id);
        if (modIndex !== -1) {
          originalMod = { ...state.dbMods[modIndex] }
          // Directly update the mod in the state array
          state.dbMods[modIndex] = { ...state.dbMods[modIndex], ...changes };
          if (changes.loadOrder !== undefined) {
            state.dbMods.sort((a, b) => a.loadOrder - b.loadOrder);
          }
        } else {
          console.warn(`ModStore: Mod ${id} not found for update.`);
        }
      });

      // After the state update, get the potentially updated mod
      const updatedMod = modIndex !== -1 ? get().dbMods[modIndex] : undefined;

      // Proceed with persistence only if the mod was found and updated in state
      if (updatedMod) {
        try {
          await PersistenceService.saveMod(updatedMod);
          // Use the name from the guaranteed updated mod object
          toast.success(`Mod "${updatedMod.name}" updated.`);
        } catch (e) {
          const errorMsg = "Failed to save mod update";
          console.error("ModStore: Error updating mod", e);
          // Revert state using the stored originalMod
          set((state) => {
            const revertIndex = state.dbMods.findIndex((m) => m.id === id);
            if (revertIndex !== -1 && originalMod) {
              state.dbMods[revertIndex] = originalMod
              state.dbMods.sort((a, b) => a.loadOrder - b.loadOrder);
            }
            state.error = errorMsg;
          });
          toast.error(errorMsg);
          throw e
        }
      }
    },

    deleteDbMod: async (id) => {
      // Get the mod details *before* modifying the state
      const modToDelete: DbMod | undefined = get().dbMods.find(
        (m: DbMod) => m.id === id,
      );
      if (!modToDelete) {
        console.warn(`ModStore: Mod ${id} not found for deletion.`);
        return;
      }
      // Capture name before potential state changes
      const modName = modToDelete.name;

      // Optimistic UI update
      set((state) => ({
        dbMods: state.dbMods.filter((m: DbMod) => m.id !== id),
      }));

      try {
        await PersistenceService.deleteMod(id);
        // Use the name captured *before* the state update
        toast.success(`Mod "${modName}" deleted.`);
      } catch (e) {
        const errorMsg = "Failed to delete mod";
        console.error("ModStore: Error deleting mod", e);
        // Revert optimistic update
        set((state) => {
          // Add the mod back if it was removed optimistically
          state.dbMods.push(modToDelete);
          state.dbMods.sort((a, b) => a.loadOrder - b.loadOrder);
          state.error = errorMsg;
        });
        toast.error(errorMsg);
        throw e;
      }
    },

    setLoadedMods: (loadedMods) => {
      set({ loadedMods });
    },

    _addSettingsTab: (tab) => {
      set((state) => {
        if (!state.modSettingsTabs.some((t) => t.id === tab.id)) {
          state.modSettingsTabs.push(tab);
          state.modSettingsTabs.sort(
            (a, b) => (a.order ?? 999) - (b.order ?? 999),
          );
        }
      });
    },
    _removeSettingsTab: (tabId) => {
      set((state) => {
        state.modSettingsTabs = state.modSettingsTabs.filter(
          (t) => t.id !== tabId,
        );
      });
    },
  })),
);
