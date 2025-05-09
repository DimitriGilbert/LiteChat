// src/types/litechat/control.ts
// FULL FILE
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { PromptControl } from "@/types/litechat/prompt";
import type { ChatControl } from "@/types/litechat/chat";
import type {
  ModMiddlewareHookName,
  ModMiddlewarePayloadMap,
  ModMiddlewareReturnMap,
  ToolImplementation,
  LiteChatModApi, // Added for initialize method
} from "@/types/litechat/modding";
import { Tool } from "ai";
import type { z } from "zod";

// --- Existing Types ---

interface RegisteredMiddleware<H extends ModMiddlewareHookName> {
  modId: string;
  callback: (
    payload: ModMiddlewarePayloadMap[H]
  ) => ModMiddlewareReturnMap[H] | Promise<ModMiddlewareReturnMap[H]>;
  order?: number;
}

type MiddlewareRegistry = {
  [H in ModMiddlewareHookName]?: RegisteredMiddleware<H>[];
};

interface ControlState {
  promptControls: Record<string, PromptControl>;
  chatControls: Record<string, ChatControl>;
  middlewareRegistry: MiddlewareRegistry;
  tools: Record<
    string,
    {
      definition: Tool<any>;
      implementation?: ToolImplementation<any>;
      modId: string;
    }
  >;
}

interface ControlActions {
  registerPromptControl: (control: PromptControl) => () => void;
  unregisterPromptControl: (id: string) => void;
  registerChatControl: (control: ChatControl) => () => void;
  unregisterChatControl: (id: string) => void;
  registerMiddleware: <H extends ModMiddlewareHookName>(
    hookName: H,
    modId: string,
    callback: RegisteredMiddleware<H>["callback"],
    order?: number
  ) => () => void;
  unregisterMiddleware: <H extends ModMiddlewareHookName>(
    hookName: H,
    modId: string,
    callback: RegisteredMiddleware<H>["callback"]
  ) => void;
  getMiddlewareForHook: <H extends ModMiddlewareHookName>(
    hookName: H
  ) => ReadonlyArray<RegisteredMiddleware<H>>;
  registerTool: <P extends z.ZodSchema<any>>(
    modId: string,
    toolName: string,
    definition: Tool<P>,
    implementation?: ToolImplementation<P>
  ) => () => void;
  unregisterTool: (toolName: string) => void;
  getRegisteredTools: () => Readonly<ControlState["tools"]>;
}

// --- New Control Module Interface ---

/**
 * Defines the standard interface for a self-contained control module.
 */
export interface ControlModule {
  /** Unique identifier for this control module. */
  readonly id: string;
  /** List of control module IDs that this module depends on. */
  readonly dependencies?: string[];

  /**
   * Initializes the control module. Called once during application startup
   * in the correct dependency order. Use this to load data, subscribe to
   * events, and prepare the module.
   * @param modApi - The LiteChat Modding API instance for interaction.
   * @returns A promise that resolves when initialization is complete.
   */
  initialize(modApi: LiteChatModApi): Promise<void>;

  /**
   * Registers the control's UI components, tools, middleware, etc., using
   * the provided Modding API. Called after `initialize`.
   * @param modApi - The LiteChat Modding API instance for interaction.
   */
  register(modApi: LiteChatModApi): void;

  /**
   * Cleans up resources used by the control module. Called during shutdown
   * or when the module is unloaded. Use this to unsubscribe from events,
   * unregister components, etc.
   * @param modApi - The LiteChat Modding API instance for interaction.
   */
  destroy(modApi: LiteChatModApi): void;
}

/**
 * Type alias for a constructor that creates a ControlModule instance.
 */
export type ControlModuleConstructor = new () => ControlModule;

// --- Existing Store Definition (No changes needed here for this step) ---
// import { create } from "zustand";
// import { immer } from "zustand/middleware/immer";
// export const useControlRegistryStore = create(...)

export const useControlRegistryStore = create(
  immer<ControlState & ControlActions>((set, get) => ({
    // Initial State
    promptControls: {},
    chatControls: {},
    middlewareRegistry: {},
    tools: {},

    // Actions
    registerPromptControl: (control) => {
      set((state) => {
        if (state.promptControls[control.id]) {
          console.warn(
            `ControlRegistryStore: PromptControl with ID "${control.id}" already registered. Overwriting.`
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
            `ControlRegistryStore: PromptControl with ID "${id}" not found for unregistration.`
          );
        }
      });
    },

    registerChatControl: (control) => {
      set((state) => {
        if (state.chatControls[control.id]) {
          console.warn(
            `ControlRegistryStore: ChatControl with ID "${control.id}" already registered. Overwriting.`
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
            `ControlRegistryStore: ChatControl with ID "${id}" not found for unregistration.`
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
            (reg) => !(reg.modId === modId && reg.callback === callback)
          );
          // Clean up the array if it becomes empty
          if (state.middlewareRegistry[hookName]?.length === 0) {
            delete state.middlewareRegistry[hookName];
          }
        } else {
          console.warn(
            `ControlRegistryStore: Middleware hook "${hookName}" not found for unregistration.`
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
          (a, b) => (a.order ?? 0) - (b.order ?? 0)
        )
      );
    },

    // Tool Actions
    registerTool: (modId, toolName, definition, implementation) => {
      set((state) => {
        if (state.tools[toolName]) {
          console.warn(
            `ControlRegistryStore: Tool "${toolName}" already registered by mod "${state.tools[toolName].modId}". Overwriting with registration from mod "${modId}".`
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
            `ControlRegistryStore: Tool "${toolName}" not found for unregistration.`
          );
        }
      });
    },

    getRegisteredTools: () => {
      // Return a readonly shallow copy of the tools object
      return Object.freeze({ ...get().tools });
    },
  }))
);
