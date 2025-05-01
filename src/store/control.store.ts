// src/store/control.store.ts
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { PromptControl } from "@/types/litechat/prompt";
import type { ChatControl } from "@/types/litechat/chat";
import type {
  ModMiddlewareHookName,
  ModMiddlewarePayloadMap,
  ModMiddlewareReturnMap,
  ToolImplementation,
} from "@/types/litechat/modding";
import { Tool } from "ai";
import type { z } from "zod";

interface RegisteredMiddleware<H extends ModMiddlewareHookName> {
  modId: string;
  callback: (
    payload: ModMiddlewarePayloadMap[H],
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
    order?: number,
  ) => () => void;
  unregisterMiddleware: <H extends ModMiddlewareHookName>(
    hookName: H,
    modId: string,
    callback: RegisteredMiddleware<H>["callback"],
  ) => void;
  getMiddlewareForHook: <H extends ModMiddlewareHookName>(
    hookName: H,
  ) => ReadonlyArray<RegisteredMiddleware<H>>;
  registerTool: <P extends z.ZodSchema<any>>(
    modId: string,
    toolName: string,
    definition: Tool<P>,
    implementation?: ToolImplementation<P>,
  ) => () => void;
  unregisterTool: (toolName: string) => void;
  getRegisteredTools: () => Readonly<ControlState["tools"]>
}

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
            `ControlRegistryStore: PromptControl with ID "${control.id}" already registered. Overwriting.`,
          );
        }
        state.promptControls[control.id] = control;
      });
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
        (
          state.middlewareRegistry[hookName] as RegisteredMiddleware<any>[]
        ).push(registration);
        (
          state.middlewareRegistry[hookName] as RegisteredMiddleware<any>[]
        ).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      });
      return () => get().unregisterMiddleware(hookName, modId, callback);
    },

    unregisterMiddleware: (hookName, modId, callback) => {
      set((state) => {
        if (state.middlewareRegistry[hookName]) {
          state.middlewareRegistry[hookName] = (
            state.middlewareRegistry[hookName] as RegisteredMiddleware<any>[]
          ).filter(
            (reg) => !(reg.modId === modId && reg.callback === callback),
          );
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
      const middleware = get().middlewareRegistry[hookName] ?? [];
      // Return a frozen copy to prevent mutation
      return Object.freeze(
        [...(middleware as RegisteredMiddleware<any>[])].sort(
          (a, b) => (a.order ?? 0) - (b.order ?? 0),
        ),
      );
    },

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

    // Correctly implement and return getRegisteredTools
    getRegisteredTools: () => {
      // Return a frozen shallow copy
      return Object.freeze({ ...get().tools });
    },
  })),
);
