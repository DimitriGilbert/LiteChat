// src/store/control.store.ts
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { PromptControl } from "@/types/litechat/prompt";
import type { ChatControl } from "@/types/litechat/chat";
import type {
  ModMiddlewareHookName,
  ModMiddlewarePayloadMap,
  ModMiddlewareReturnMap,
  Tool,
  ToolImplementation,
} from "@/types/litechat/modding";
import type { z } from "zod";

interface RegisteredMiddleware<H extends ModMiddlewareHookName> {
  modId: string;
  callback: (
    payload: ModMiddlewarePayloadMap[H],
  ) => ModMiddlewareReturnMap[H] | Promise<ModMiddlewareReturnMap[H]>;
  order?: number; // Order for middleware execution
}

// Type for the registry, mapping hook names to arrays of registered middleware
type MiddlewareRegistry = {
  [H in ModMiddlewareHookName]?: RegisteredMiddleware<H>[];
};

interface ControlState {
  promptControls: Record<string, PromptControl>;
  chatControls: Record<string, ChatControl>;
  middlewareRegistry: MiddlewareRegistry;
  // Add state for tools
  tools: Record<
    string,
    {
      definition: Tool<any>;
      implementation?: ToolImplementation<any>;
      modId: string; // Track which mod registered the tool
    }
  >;
}

interface ControlActions {
  registerPromptControl: (control: PromptControl) => () => void; // Returns unregister function
  unregisterPromptControl: (id: string) => void;
  registerChatControl: (control: ChatControl) => () => void; // Returns unregister function
  unregisterChatControl: (id: string) => void;
  registerMiddleware: <H extends ModMiddlewareHookName>(
    hookName: H,
    modId: string,
    callback: RegisteredMiddleware<H>["callback"],
    order?: number, // Optional order parameter
  ) => () => void; // Returns unregister function
  unregisterMiddleware: <H extends ModMiddlewareHookName>(
    hookName: H,
    modId: string,
    callback: RegisteredMiddleware<H>["callback"], // Need callback to identify which one to remove
  ) => void;
  getMiddlewareForHook: <H extends ModMiddlewareHookName>(
    hookName: H,
  ) => ReadonlyArray<RegisteredMiddleware<H>>; // Return a readonly sorted copy
  // Add actions for tools
  registerTool: <P extends z.ZodSchema<any>>(
    modId: string,
    toolName: string,
    definition: Tool<P>,
    implementation?: ToolImplementation<P>,
  ) => () => void;
  unregisterTool: (toolName: string) => void;
  getRegisteredTools: () => Readonly<ControlState["tools"]>;
}

export const useControlRegistryStore = create(
  immer<ControlState & ControlActions>((set, get) => ({
    // Initial State
    promptControls: {},
    chatControls: {},
    middlewareRegistry: {},
    tools: {}, // Initialize tools state

    // Actions
    registerPromptControl: (control) => {
      set((state) => {
        if (state.promptControls[control.id]) {
          console.warn(
            `ControlRegistryStore: PromptControl with ID "${control.id}" already registered. Overwriting.`,
          );
        }
        state.promptControls[control.id] = control;
      });
      // Return the unregister function
      return () => get().unregisterPromptControl(control.id);
    },

    unregisterPromptControl: (id) => {
      set((state) => {
        if (state.promptControls[id]) {
          delete state.promptControls[id];
        } else {
          console.warn(
            `ControlRegistryStore: PromptControl with ID "${id}" not found for unregistration.`,
          );
        }
      });
    },

    registerChatControl: (control) => {
      set((state) => {
        if (state.chatControls[control.id]) {
          console.warn(
            `ControlRegistryStore: ChatControl with ID "${control.id}" already registered. Overwriting.`,
          );
        }
        state.chatControls[control.id] = control;
      });
      // Return the unregister function
      return () => get().unregisterChatControl(control.id);
    },

    unregisterChatControl: (id) => {
      set((state) => {
        if (state.chatControls[id]) {
          delete state.chatControls[id];
        } else {
          console.warn(
            `ControlRegistryStore: ChatControl with ID "${id}" not found for unregistration.`,
          );
        }
      });
    },

    registerMiddleware: (hookName, modId, callback, order = 0) => {
      const registration: RegisteredMiddleware<any> = {
        modId,
        callback,
        order,
      };
      set((state) => {
        if (!state.middlewareRegistry[hookName]) {
          state.middlewareRegistry[hookName] = [];
        }
        // Add the new middleware
        (
          state.middlewareRegistry[hookName] as RegisteredMiddleware<any>[]
        ).push(registration);
        // Sort the middleware array by order after adding
        (
          state.middlewareRegistry[hookName] as RegisteredMiddleware<any>[]
        ).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      });
      // Return the unregister function
      return () => get().unregisterMiddleware(hookName, modId, callback);
    },

    unregisterMiddleware: (hookName, modId, callback) => {
      set((state) => {
        if (state.middlewareRegistry[hookName]) {
          // Filter out the specific middleware by modId and callback reference
          state.middlewareRegistry[hookName] = (
            state.middlewareRegistry[hookName] as RegisteredMiddleware<any>[]
          ).filter(
            (reg) => !(reg.modId === modId && reg.callback === callback),
          );
          // Clean up the array if it becomes empty
          if (state.middlewareRegistry[hookName]?.length === 0) {
            delete state.middlewareRegistry[hookName];
          }
        } else {
          console.warn(
            `ControlRegistryStore: Middleware hook "${hookName}" not found for unregistration.`,
          );
        }
      });
    },

    getMiddlewareForHook: (hookName) => {
      // Return a readonly copy of the sorted array, or an empty array if none exist
      const middleware = get().middlewareRegistry[hookName] ?? [];
      // Ensure sorting just in case (though registerMiddleware should maintain it)
      return Object.freeze(
        [...(middleware as RegisteredMiddleware<any>[])].sort(
          (a, b) => (a.order ?? 0) - (b.order ?? 0),
        ),
      );
    },

    // Tool Actions
    registerTool: (modId, toolName, definition, implementation) => {
      set((state) => {
        if (state.tools[toolName]) {
          console.warn(
            `ControlRegistryStore: Tool "${toolName}" already registered by mod "${state.tools[toolName].modId}". Overwriting with registration from mod "${modId}".`,
          );
        }
        state.tools[toolName] = { definition, implementation, modId };
      });
      return () => get().unregisterTool(toolName);
    },

    unregisterTool: (toolName) => {
      set((state) => {
        if (state.tools[toolName]) {
          delete state.tools[toolName];
        } else {
          console.warn(
            `ControlRegistryStore: Tool "${toolName}" not found for unregistration.`,
          );
        }
      });
    },

    getRegisteredTools: () => {
      // Return a readonly shallow copy of the tools object
      return Object.freeze({ ...get().tools });
    },
  })),
);
