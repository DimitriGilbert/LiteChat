// src/store/mod.store.ts
// FULL FILE
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type {
  DbMod,
  ModState as ModStoreState,
  ModActions as ModStoreActions,
} from "@/types/litechat/modding";
import { PersistenceService } from "@/services/persistence.service";
import { nanoid } from "nanoid";
import { toast } from "sonner";
// No direct event emissions from this store in this iteration,
// but if added, they would use the new `modEvent` constants.

export const useModStore = create(
  immer<ModStoreState & ModStoreActions>((set, get) => ({
    // Initial State
    dbMods: [],
    loadedMods: [],
    modSettingsTabs: [], // Initialize new state field
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

      set((state) => {
        modIndex = state.dbMods.findIndex((m) => m.id === id);
        if (modIndex !== -1) {
          originalMod = { ...state.dbMods[modIndex] };
          state.dbMods[modIndex] = { ...state.dbMods[modIndex], ...changes };
          if (changes.loadOrder !== undefined) {
            state.dbMods.sort((a, b) => a.loadOrder - b.loadOrder);
          }
        } else {
          console.warn(`ModStore: Mod ${id} not found for update.`);
        }
      });

      const updatedMod = modIndex !== -1 ? get().dbMods[modIndex] : undefined;

      if (updatedMod) {
        try {
          await PersistenceService.saveMod(updatedMod);
          toast.success(`Mod "${updatedMod.name}" updated.`);
        } catch (e) {
          const errorMsg = "Failed to save mod update";
          console.error("ModStore: Error updating mod", e);
          set((state) => {
            const revertIndex = state.dbMods.findIndex((m) => m.id === id);
            if (revertIndex !== -1 && originalMod) {
              state.dbMods[revertIndex] = originalMod;
              state.dbMods.sort((a, b) => a.loadOrder - b.loadOrder);
            }
            state.error = errorMsg;
          });
          toast.error(errorMsg);
          throw e;
        }
      }
    },

    deleteDbMod: async (id) => {
      const modToDelete: DbMod | undefined = get().dbMods.find(
        (m: DbMod) => m.id === id
      );
      if (!modToDelete) {
        console.warn(`ModStore: Mod ${id} not found for deletion.`);
        return;
      }
      const modName = modToDelete.name;

      set((state) => ({
        dbMods: state.dbMods.filter((m: DbMod) => m.id !== id),
      }));

      try {
        await PersistenceService.deleteMod(id);
        toast.success(`Mod "${modName}" deleted.`);
      } catch (e) {
        const errorMsg = "Failed to delete mod";
        console.error("ModStore: Error deleting mod", e);
        set((state) => {
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
            (a, b) => (a.order ?? 999) - (b.order ?? 999)
          );
        } else {
          console.warn(
            `ModStore: Settings tab with ID "${tab.id}" already registered. Overwriting.`
          );
          const index = state.modSettingsTabs.findIndex((t) => t.id === tab.id);
          state.modSettingsTabs[index] = tab;
          state.modSettingsTabs.sort(
            (a, b) => (a.order ?? 999) - (b.order ?? 999)
          );
        }
      });
    },
    _removeSettingsTab: (tabId) => {
      set((state) => {
        state.modSettingsTabs = state.modSettingsTabs.filter(
          (t) => t.id !== tabId
        );
      });
    },
  }))
);
