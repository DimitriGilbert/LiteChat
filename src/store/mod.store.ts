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

import type { RegisteredToolEntry } from "@/context/mod-context";
import { nanoid } from "nanoid";
import { z } from "zod";
import { toast } from "sonner";
import { db } from "@/lib/db";

export interface ModState {
  // REMOVED: dbMods: DbMod[];
  loadedMods: ModInstance[];
  modPromptActions: CustomPromptAction[];
  modMessageActions: CustomMessageAction[];
  modSettingsTabs: CustomSettingTab[];
  modTools: Map<string, RegisteredToolEntry>;
}

export interface ModActions {
  // REMOVED: setDbMods
  addDbMod: (modData: Omit<DbMod, "id" | "createdAt">) => Promise<string>;
  updateDbMod: (id: string, changes: Partial<DbMod>) => Promise<void>;
  deleteDbMod: (id: string) => Promise<void>;
  setLoadedMods: (mods: ModInstance[]) => void;
  _registerModPromptAction: (action: CustomPromptAction) => () => void;
  _registerModMessageAction: (action: CustomMessageAction) => () => void;
  _registerModSettingsTab: (tab: CustomSettingTab) => () => void;
  _registerModTool: <PARAMETERS extends z.ZodSchema<any>>(
    toolName: string,
    definition: Tool<PARAMETERS>,
    implementation?: ToolImplementation<PARAMETERS>,
  ) => () => void;
  _clearRegisteredModItems: () => void;
  _clearRegisteredModTools: () => void;
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

export const useModStore = create<ModState & ModActions>()((set) => ({
  // Initial State
  // REMOVED: dbMods: [],
  loadedMods: [],
  modPromptActions: [],
  modMessageActions: [],
  modSettingsTabs: [],
  modTools: new Map(),
  addDbMod: async (modData) => {
    try {
      const newId = nanoid();
      const newMod: DbMod = {
        id: newId,
        createdAt: new Date(),
        ...modData,
        loadOrder: modData.loadOrder ?? Date.now(),
      };
      await db.mods.add(newMod);
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
      await db.mods.update(id, changes);
    } catch (error) {
      console.error("Failed to update mod:", error);
      toast.error(
        `Failed to update Mod: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  },

  deleteDbMod: async (id) => {
    const modToDelete = await db.mods.get(id);
    try {
      await db.mods.delete(id);
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
