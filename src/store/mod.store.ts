// src/store/mod.store.ts
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type {
  DbMod,
  ModInstance, // Added back ModInstance
  ModState as ModStoreState,
  ModActions as ModStoreActions,
  CustomSettingTab, // Import CustomSettingTab
} from "@/types/litechat/modding";
import { PersistenceService } from "@/services/persistence.service";
import { nanoid } from "nanoid";
import { toast } from "sonner";

export const useModStore = create(
  immer<ModStoreState & ModStoreActions>((set, get) => ({
    // Initial State
    dbMods: [],
    loadedMods: [],
    modSettingsTabs: [], // Initialize tabs state
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
      let modToUpdate: DbMod | null = null;

      set((state) => {
        const index = state.dbMods.findIndex((m) => m.id === id);
        if (index !== -1) {
          originalMod = { ...state.dbMods[index] };
          Object.assign(state.dbMods[index], changes);
          modToUpdate = state.dbMods[index];
          if (changes.loadOrder !== undefined) {
            state.dbMods.sort((a, b) => a.loadOrder - b.loadOrder);
          }
        } else {
          console.warn(`ModStore: Mod ${id} not found for update.`);
        }
      });

      if (modToUpdate) {
        try {
          await PersistenceService.saveMod(modToUpdate);
          toast.success(`Mod "${modToUpdate.name}" updated.`);
        } catch (e) {
          const errorMsg = "Failed to save mod update";
          console.error("ModStore: Error updating mod", e);
          set((state) => {
            const index = state.dbMods.findIndex((m) => m.id === id);
            if (index !== -1 && originalMod) {
              state.dbMods[index] = originalMod;
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
        (m: DbMod) => m.id === id,
      );
      if (!modToDelete) {
        console.warn(`ModStore: Mod ${id} not found for deletion.`);
        return;
      }

      set((state) => ({
        dbMods: state.dbMods.filter((m: DbMod) => m.id !== id),
      }));

      try {
        await PersistenceService.deleteMod(id);
        toast.success(`Mod "${modToDelete.name}" deleted.`);
      } catch (e) {
        const errorMsg = "Failed to delete mod";
        console.error("ModStore: Error deleting mod", e);
        set((state) => {
          // Ensure modToDelete is available here
          if (modToDelete) {
            state.dbMods.push(modToDelete);
            state.dbMods.sort((a, b) => a.loadOrder - b.loadOrder);
          }
          state.error = errorMsg;
        });
        toast.error(errorMsg);
        throw e;
      }
    },

    setLoadedMods: (loadedMods) => {
      set({ loadedMods });
    },

    // Added tab actions
    _addSettingsTab: (tab) => {
      set((state) => {
        // Avoid duplicates
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
