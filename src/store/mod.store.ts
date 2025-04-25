import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type {
  DbMod,
  ModInstance,
  ModState,
  ModActions,
} from "@/types/litechat/modding";
import { PersistenceService } from "@/services/persistence.service";
import { nanoid } from "nanoid";

export const useModStore = create(
  immer<ModState & ModActions>((set, get) => ({
    dbMods: [],
    loadedMods: [],
    isLoading: false,
    error: null,
    loadDbMods: async () => {
      set({ isLoading: true, error: null });
      try {
        const mods = await PersistenceService.loadMods();
        set({ dbMods: mods, isLoading: false });
      } catch (e) {
        set({ error: "Failed load mods", isLoading: false });
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
      });
      await PersistenceService.saveMod(newMod);
      return newId;
    },
    updateDbMod: async (id, changes) => {
      let modToUpdate: DbMod | null = null;
      set((state) => {
        const index = state.dbMods.findIndex((m) => m.id === id);
        if (index !== -1) {
          Object.assign(state.dbMods[index], changes);
          modToUpdate = state.dbMods[index];
        }
      });
      if (modToUpdate) await PersistenceService.saveMod(modToUpdate);
    },
    deleteDbMod: async (id) => {
      set((state) => ({ dbMods: state.dbMods.filter((m) => m.id !== id) }));
      await PersistenceService.deleteMod(id);
    },
    setLoadedMods: (loadedMods) => set({ loadedMods }),
  })),
);
