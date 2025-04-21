// src/store/mod.store.ts
import { create } from "zustand";
import type {
  CustomPromptAction,
  CustomMessageAction,
  CustomSettingTab,
} from "@/lib/types";
import type {
  DbMod,
  ModInstance,
  Tool,
  ToolImplementation,
  SubmitPromptPayload,
  SubmitPromptReturn,
  ProcessResponseChunkPayload,
  ProcessResponseChunkReturn,
  RenderMessagePayload,
  RenderMessageReturn,
  VfsWritePayload,
  VfsWriteReturn,
} from "@/mods/types";
// Import from mod-context temporarily, ideally move this type
import type { RegisteredToolEntry } from "@/context/mod-context";
import { nanoid } from "nanoid";
import { z } from "zod"; // Import Zod
import { toast } from "sonner"; // Import toast for feedback
import { db } from "@/lib/db"; // Import Dexie instance

// --- REMOVE Placeholder Dependencies ---

export interface ModState {
  dbMods: DbMod[];
  loadedMods: ModInstance[];
  modPromptActions: CustomPromptAction[];
  modMessageActions: CustomMessageAction[];
  modSettingsTabs: CustomSettingTab[];
  modTools: Map<string, RegisteredToolEntry>; // Use Map for mutability within Zustand
}

export interface ModActions {
  setDbMods: (mods: DbMod[]) => void; // Needed if fetched async
  addDbMod: (modData: Omit<DbMod, "id" | "createdAt">) => Promise<string>; // Needs storage access
  updateDbMod: (id: string, changes: Partial<DbMod>) => Promise<void>; // Needs storage access
  deleteDbMod: (id: string) => Promise<void>; // Needs storage access
  setLoadedMods: (mods: ModInstance[]) => void; // Set by the mod loading service
  // Registration functions called by mods via API
  _registerModPromptAction: (action: CustomPromptAction) => () => void;
  _registerModMessageAction: (action: CustomMessageAction) => () => void;
  _registerModSettingsTab: (tab: CustomSettingTab) => () => void;
  _registerModTool: <PARAMETERS extends z.ZodSchema<any>>(
    toolName: string,
    definition: Tool<PARAMETERS>,
    implementation?: ToolImplementation<PARAMETERS>,
  ) => () => void;
  _clearRegisteredModItems: () => void; // Called when mods are reloaded
  _clearRegisteredModTools: () => void; // Called when mods are reloaded
  // Middleware hooks (called by core services)
  applySubmitPromptMiddleware: (
    payload: SubmitPromptPayload,
  ) => Promise<SubmitPromptReturn>;
  applyProcessResponseChunkMiddleware: (
    payload: ProcessResponseChunkPayload,
  ) => Promise<ProcessResponseChunkReturn>;
  applyRenderMessageMiddleware: (
    payload: RenderMessagePayload,
  ) => Promise<RenderMessageReturn>;
  applyVfsWriteMiddleware: (
    payload: VfsWritePayload,
  ) => Promise<VfsWriteReturn>;
  initializeFromDb: () => Promise<void>; // Action to load initial data
}

export const useModStore = create<ModState & ModActions>()((set, get) => ({
  // Initial State
  dbMods: [],
  loadedMods: [],
  modPromptActions: [],
  modMessageActions: [],
  modSettingsTabs: [],
  modTools: new Map(),

  // Actions
  setDbMods: (dbMods) => set({ dbMods }), // Used to load initial mods from storage

  initializeFromDb: async () => {
    try {
      const mods = await db.mods.orderBy("loadOrder").toArray(); // Use Dexie
      set({ dbMods: mods });
      console.log("[ModStore] Initialized from DB.");
    } catch (error) {
      console.error("[ModStore] Failed to initialize from DB:", error);
      toast.error("Failed to load mod data.");
    }
  },

  addDbMod: async (modData) => {
    try {
      // FIX: Use db.mods.add
      const newId = nanoid();
      const newMod: DbMod = {
        id: newId,
        createdAt: new Date(),
        ...modData,
        loadOrder: modData.loadOrder ?? Date.now(),
      };
      await db.mods.add(newMod);
      // State update via live query
      toast.success(`Mod "${modData.name}" added.`);
      return newId;
    } catch (error) {
      console.error("Failed to add mod:", error);
      toast.error(
        `Failed to add Mod: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  },

  updateDbMod: async (id, changes) => {
    try {
      // FIX: Use db.mods.update
      await db.mods.update(id, changes);
      // State update via live query
    } catch (error) {
      console.error("Failed to update mod:", error);
      toast.error(
        `Failed to update Mod: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  },

  deleteDbMod: async (id) => {
    const modToDelete = get().dbMods.find((m) => m.id === id); // Get name before delete
    try {
      // FIX: Use db.mods.delete
      await db.mods.delete(id);
      // State update via live query
      if (modToDelete) {
        toast.success(`Mod "${modToDelete.name}" deleted.`);
      }
    } catch (error) {
      console.error("Failed to delete mod:", error);
      toast.error(
        `Failed to delete Mod: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  },

  setLoadedMods: (loadedMods) => set({ loadedMods }),

  _registerModPromptAction: (action) => {
    const actionId = action.id || nanoid();
    const actionWithId = { ...action, id: actionId };
    set((state) => ({
      modPromptActions: [...state.modPromptActions, actionWithId],
    }));
    // Return unregister function
    return () => {
      set((state) => ({
        modPromptActions: state.modPromptActions.filter(
          (a) => a.id !== actionId,
        ),
      }));
    };
  },

  _registerModMessageAction: (action) => {
    const actionId = action.id || nanoid();
    const actionWithId = { ...action, id: actionId };
    set((state) => ({
      modMessageActions: [...state.modMessageActions, actionWithId],
    }));
    // Return unregister function
    return () => {
      set((state) => ({
        modMessageActions: state.modMessageActions.filter(
          (a) => a.id !== actionId,
        ),
      }));
    };
  },

  _registerModSettingsTab: (tab) => {
    const tabId = tab.id || nanoid();
    const tabWithId = { ...tab, id: tabId };
    set((state) => ({
      modSettingsTabs: [...state.modSettingsTabs, tabWithId],
    }));
    // Return unregister function
    return () => {
      set((state) => ({
        modSettingsTabs: state.modSettingsTabs.filter((t) => t.id !== tabId),
      }));
    };
  },

  _registerModTool: (toolName, definition, implementation) => {
    if (!implementation && !definition.execute) {
      console.error(
        `Mod Store: Tool "${toolName}" registered without implementation or execute function.`,
      );
    }
    set((state) => {
      const newMap = new Map(state.modTools);
      newMap.set(toolName, { definition, implementation });
      return { modTools: newMap };
    });
    // Return unregister function
    return () => {
      set((state) => {
        const newMap = new Map(state.modTools);
        newMap.delete(toolName);
        return { modTools: newMap };
      });
    };
  },

  _clearRegisteredModItems: () => {
    console.log("[Mod Store] Clearing registered mod items (actions, tabs).");
    set({ modPromptActions: [], modMessageActions: [], modSettingsTabs: [] });
  },

  _clearRegisteredModTools: () => {
    console.log("[Mod Store] Clearing registered mod tools.");
    set({ modTools: new Map() });
  },

  // --- Placeholder Middleware ---
  applySubmitPromptMiddleware: async (payload) => {
    console.warn(
      "applySubmitPromptMiddleware placeholder called - needs implementation",
      payload,
    );
    return payload;
  },
  applyProcessResponseChunkMiddleware: async (payload) => {
    console.warn(
      "applyProcessResponseChunkMiddleware placeholder called - needs implementation",
      payload,
    );
    return payload.chunk;
  },
  applyRenderMessageMiddleware: async (payload) => {
    console.warn(
      "applyRenderMessageMiddleware placeholder called - needs implementation",
      payload,
    );
    return payload.message;
  },
  applyVfsWriteMiddleware: async (payload) => {
    console.warn(
      "applyVfsWriteMiddleware placeholder called - needs implementation",
      payload,
    );
    return payload;
  },
}));
