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
import { emitter } from "@/lib/litechat/event-emitter";
import { modEvent, ModEventPayloads } from "@/types/litechat/events/mod.events";
import type {
  RegisteredActionHandler,
  ActionHandler,
} from "@/types/litechat/control";

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
        emitter.emit(modEvent.dbModsLoaded, { dbMods: mods });
      } catch (e) {
        const errorMsg = "Failed to load mods";
        console.error("ModStore: Error loading mods", e);
        set({ error: errorMsg, isLoading: false });
        emitter.emit(modEvent.loadingStateChanged, {
          isLoading: false,
          error: errorMsg,
        });
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
        emitter.emit(modEvent.dbModsLoaded, { dbMods: get().dbMods });
        return newId;
      } catch (e) {
        const errorMsg = "Failed to save new mod";
        console.error("ModStore: Error adding mod", e);
        set((state) => {
          state.dbMods = state.dbMods.filter((m) => m.id !== newId);
          state.error = errorMsg;
        });
        emitter.emit(modEvent.loadingStateChanged, {
          isLoading: get().isLoading,
          error: errorMsg,
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
          emitter.emit(modEvent.dbModsLoaded, { dbMods: get().dbMods });
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
          emitter.emit(modEvent.loadingStateChanged, {
            isLoading: get().isLoading,
            error: errorMsg,
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
        emitter.emit(modEvent.dbModsLoaded, { dbMods: get().dbMods });
      } catch (e) {
        const errorMsg = "Failed to delete mod";
        console.error("ModStore: Error deleting mod", e);
        set((state) => {
          state.dbMods.push(modToDelete);
          state.dbMods.sort((a, b) => a.loadOrder - b.loadOrder);
          state.error = errorMsg;
        });
        emitter.emit(modEvent.loadingStateChanged, {
          isLoading: get().isLoading,
          error: errorMsg,
        });
        toast.error(errorMsg);
        throw e;
      }
    },

    setLoadedMods: (loadedMods) => {
      set({ loadedMods });
      emitter.emit(modEvent.loadedInstancesChanged, { loadedMods });
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
      emitter.emit(modEvent.settingsTabsChanged, {
        tabs: get().modSettingsTabs,
      });
    },
    _removeSettingsTab: (tabId) => {
      set((state) => {
        state.modSettingsTabs = state.modSettingsTabs.filter(
          (t) => t.id !== tabId
        );
      });
      emitter.emit(modEvent.settingsTabsChanged, {
        tabs: get().modSettingsTabs,
      });
    },
    getRegisteredActionHandlers: (): RegisteredActionHandler[] => {
      const storeId = "modStore";
      const actions = get();
      const wrapPromiseStringUndefined =
        <P>(
          fn: (payload: P) => Promise<string | undefined>
        ): ActionHandler<P> =>
        async (payload: P) => {
          await fn(payload);
        };
      return [
        {
          eventName: modEvent.loadDbModsRequest,
          handler: actions.loadDbMods,
          storeId,
        },
        {
          eventName: modEvent.addDbModRequest,
          handler: wrapPromiseStringUndefined(actions.addDbMod),
          storeId,
        },
        {
          eventName: modEvent.updateDbModRequest,
          handler: (p: ModEventPayloads[typeof modEvent.updateDbModRequest]) =>
            actions.updateDbMod(p.id, p.changes),
          storeId,
        },
        {
          eventName: modEvent.deleteDbModRequest,
          handler: (p: ModEventPayloads[typeof modEvent.deleteDbModRequest]) =>
            actions.deleteDbMod(p.id),
          storeId,
        },
      ];
    },
  }))
);
