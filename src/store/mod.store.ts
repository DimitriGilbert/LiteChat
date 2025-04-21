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

// --- Placeholder Dependencies ---
// These represent external dependencies that need proper injection (Task 8)

// Placeholder storage functions (simulating access via a service/hook result)
// TODO: Replace with actual injected storage service in Task 8
const storage = {
  addMod: async (modData: Omit<DbMod, "id" | "createdAt">): Promise<string> => {
    console.warn("Placeholder storage.addMod called", { modData });
    await new Promise((resolve) => setTimeout(resolve, 50));
    const newId = nanoid();
    // Simulate adding to a DB
    return newId;
  },
  updateMod: async (id: string, changes: Partial<DbMod>): Promise<void> => {
    console.warn("Placeholder storage.updateMod called", { id, changes });
    await new Promise((resolve) => setTimeout(resolve, 50));
    // Simulate update
  },
  deleteMod: async (id: string): Promise<void> => {
    console.warn("Placeholder storage.deleteMod called", { id });
    await new Promise((resolve) => setTimeout(resolve, 50));
    // Simulate deletion
  },
};
// --- End Placeholder Dependencies ---

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

  addDbMod: async (modData) => {
    console.warn("addDbMod using placeholder storage implementation", {
      modData,
    });
    const newId = nanoid();
    const newMod: DbMod = {
      id: newId,
      createdAt: new Date(),
      ...modData,
      // Ensure loadOrder has a default if not provided
      loadOrder: modData.loadOrder ?? Date.now(),
    };
    // Optimistic update
    set((state) => ({ dbMods: [...state.dbMods, newMod] }));
    try {
      // TODO: Replace with actual storage call in Task 8
      const confirmedId = await storage.addMod(modData);
      // If storage returns a different ID (shouldn't happen with nanoid), update state?
      if (confirmedId !== newId) {
        console.warn(
          `Mod Store: Storage returned different ID (${confirmedId}) than optimistic (${newId})`,
        );
        set((state) => ({
          dbMods: state.dbMods.map((m) =>
            m.id === newId ? { ...m, id: confirmedId } : m,
          ),
        }));
        return confirmedId;
      }
      toast.success(`Mod "${newMod.name}" added.`);
      return newId;
    } catch (error) {
      console.error("Failed to add mod:", error);
      toast.error(
        `Failed to add Mod: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Rollback optimistic update
      set((state) => ({ dbMods: state.dbMods.filter((m) => m.id !== newId) }));
      throw error;
    }
  },

  updateDbMod: async (id, changes) => {
    console.warn("updateDbMod using placeholder storage implementation", {
      id,
      changes,
    });
    const originalMods = get().dbMods;
    const modToUpdate = originalMods.find((m) => m.id === id);
    if (!modToUpdate) {
      toast.error("Mod not found for update.");
      throw new Error("Mod not found");
    }
    const updatedMod = { ...modToUpdate, ...changes };
    // Optimistic update
    set({
      dbMods: originalMods.map((m) => (m.id === id ? updatedMod : m)),
    });
    try {
      // TODO: Replace with actual storage call in Task 8
      await storage.updateMod(id, changes);
      // No success toast, usually internal
    } catch (error) {
      console.error("Failed to update mod:", error);
      toast.error(
        `Failed to update Mod: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Rollback optimistic update
      set({ dbMods: originalMods });
      throw error;
    }
  },

  deleteDbMod: async (id) => {
    console.warn("deleteDbMod using placeholder storage implementation", {
      id,
    });
    const originalMods = get().dbMods;
    const modToDelete = originalMods.find((m) => m.id === id);
    if (!modToDelete) {
      toast.error("Mod not found for deletion.");
      return; // Don't throw, just inform
    }
    // Optimistic update
    set((state) => ({ dbMods: state.dbMods.filter((m) => m.id !== id) }));
    try {
      // TODO: Replace with actual storage call in Task 8
      await storage.deleteMod(id);
      toast.success(`Mod "${modToDelete.name}" deleted.`);
    } catch (error) {
      console.error("Failed to delete mod:", error);
      toast.error(
        `Failed to delete Mod: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Rollback optimistic update
      set({ dbMods: originalMods });
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
      // Potentially throw an error or skip registration? For now, just log.
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
  // TODO: Implement middleware execution logic in a separate service/hook
  // that calls these store functions or directly accesses loadedMods.
  applySubmitPromptMiddleware: async (payload) => {
    console.warn(
      "applySubmitPromptMiddleware placeholder called - needs implementation",
      payload,
    );
    // Placeholder: Iterate through loadedMods and apply relevant middleware
    // For now, just pass through
    return payload;
  },
  applyProcessResponseChunkMiddleware: async (payload) => {
    console.warn(
      "applyProcessResponseChunkMiddleware placeholder called - needs implementation",
      payload,
    );
    // Placeholder: Iterate through loadedMods and apply relevant middleware
    // For now, just pass through
    return payload.chunk;
  },
  applyRenderMessageMiddleware: async (payload) => {
    console.warn(
      "applyRenderMessageMiddleware placeholder called - needs implementation",
      payload,
    );
    // Placeholder: Iterate through loadedMods and apply relevant middleware
    // For now, just pass through
    return payload.message;
  },
  applyVfsWriteMiddleware: async (payload) => {
    console.warn(
      "applyVfsWriteMiddleware placeholder called - needs implementation",
      payload,
    );
    // Placeholder: Iterate through loadedMods and apply relevant middleware
    // For now, just pass through
    return payload;
  },
}));
