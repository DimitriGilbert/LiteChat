// src/store/mod.store.ts
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type {
  DbMod,
  ModInstance,
  ModState as ModStoreState,
  ModActions as ModStoreActions,
  CustomSettingTab,
} from "@/types/litechat/modding"; // Correct path
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
          originalMod = { ...state.dbMods[index] }; // Capture original state
          // Apply changes to a temporary object first to ensure type safety
          const updatedModData = { ...state.dbMods[index], ...changes };
          state.dbMods[index] = updatedModData; // Assign the updated object
          modToUpdate = state.dbMods[index]; // Reference the updated object in state
          if (changes.loadOrder !== undefined) {
            state.dbMods.sort((a, b) => a.loadOrder - b.loadOrder);
          }
        } else {
          console.warn(`ModStore: Mod ${id} not found for update.`);
        }
      });

      if (modToUpdate) {
        try {
          // Use the guaranteed valid modToUpdate reference here
          await PersistenceService.saveMod(modToUpdate);
          toast.success(`Mod "${modToUpdate.name}" updated.`); // Safe to access name
        } catch (e) {
          const errorMsg = "Failed to save mod update";
          console.error("ModStore: Error updating mod", e);
          set((state) => {
            const index = state.dbMods.findIndex((m) => m.id === id);
            // Use originalMod for reverting, as modToUpdate might be stale if save failed
            if (index !== -1 && originalMod) {
              state.dbMods[index] = originalMod; // Revert to original
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
