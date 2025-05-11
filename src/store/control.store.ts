// src/store/control.store.ts
// FULL FILE
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { emitter } from "@/lib/litechat/event-emitter";
import { controlRegistryEvent } from "@/types/litechat/events/control.registry.events";
import type {
  ControlState as ControlStateInterface,
  ControlActions as ControlActionsInterface,
  RegisteredActionHandler,
} from "@/types/litechat/control";
import type {
  ModalProvider,
  ModMiddlewareHookName,
  ToolImplementation,
} from "@/types/litechat/modding";
import type { Tool } from "ai";

export const useControlRegistryStore = create(
  immer<ControlStateInterface & ControlActionsInterface>((set, get) => ({
    // Initial State
    promptControls: {},
    chatControls: {},
    middlewareRegistry: {},
    tools: {},
    modalProviders: {},

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
      emitter.emit(controlRegistryEvent.promptControlsChanged, {
        controls: get().promptControls,
      });
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
      emitter.emit(controlRegistryEvent.promptControlsChanged, {
        controls: get().promptControls,
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
      emitter.emit(controlRegistryEvent.chatControlsChanged, {
        controls: get().chatControls,
      });
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
      emitter.emit(controlRegistryEvent.chatControlsChanged, {
        controls: get().chatControls,
      });
    },

    registerMiddleware: (hookName, modId, callback, order = 0) => {
      const registration: any = {
        modId,
        callback,
        order,
      };
      set((state) => {
        if (!state.middlewareRegistry[hookName]) {
          state.middlewareRegistry[hookName] = [];
        }
        (state.middlewareRegistry[hookName] as any[]).push(registration);
        (state.middlewareRegistry[hookName] as any[]).sort(
          (a, b) => (a.order ?? 0) - (b.order ?? 0)
        );
      });
      emitter.emit(controlRegistryEvent.middlewareChanged, {
        middleware: get().middlewareRegistry,
      });
      return () => get().unregisterMiddleware(hookName, modId, callback);
    },

    unregisterMiddleware: (hookName, modId, callback) => {
      set((state) => {
        if (state.middlewareRegistry[hookName]) {
          state.middlewareRegistry[hookName] = (
            state.middlewareRegistry[hookName] as any[]
          ).filter(
            (reg) => !(reg.modId === modId && reg.callback === callback)
          );
          if (state.middlewareRegistry[hookName]?.length === 0) {
            delete state.middlewareRegistry[hookName];
          }
        } else {
          console.warn(
            `ControlRegistryStore: Middleware hook "${hookName}" not found for unregistration.`
          );
        }
      });
      emitter.emit(controlRegistryEvent.middlewareChanged, {
        middleware: get().middlewareRegistry,
      });
    },

    getMiddlewareForHook: (hookName) => {
      const middleware = get().middlewareRegistry[hookName] ?? [];
      return Object.freeze(
        [...(middleware as any[])].sort(
          (a, b) => (a.order ?? 0) - (b.order ?? 0)
        )
      );
    },

    registerTool: (modId, toolName, definition, implementation) => {
      set((state) => {
        if (state.tools[toolName]) {
          console.warn(
            `ControlRegistryStore: Tool "${toolName}" already registered by mod "${state.tools[toolName].modId}". Overwriting with registration from mod "${modId}".`
          );
        }
        state.tools[toolName] = { definition, implementation, modId };
      });
      emitter.emit(controlRegistryEvent.toolsChanged, {
        tools: get().tools,
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
      emitter.emit(controlRegistryEvent.toolsChanged, {
        tools: get().tools,
      });
    },

    getRegisteredTools: () => {
      return Object.freeze({ ...get().tools });
    },

    registerModalProvider: (modalId, provider) => {
      set((state) => {
        if (state.modalProviders[modalId]) {
          console.warn(
            `ControlRegistryStore: ModalProvider with ID "${modalId}" already registered. Overwriting.`
          );
        }
        state.modalProviders[modalId] = provider;
      });
      emitter.emit(controlRegistryEvent.modalProvidersChanged, {
        providers: get().modalProviders,
      });
      return () => get().unregisterModalProvider(modalId);
    },

    unregisterModalProvider: (modalId) => {
      set((state) => {
        if (state.modalProviders[modalId]) {
          delete state.modalProviders[modalId];
        } else {
          console.warn(
            `ControlRegistryStore: ModalProvider with ID "${modalId}" not found for unregistration.`
          );
        }
      });
      emitter.emit(controlRegistryEvent.modalProvidersChanged, {
        providers: get().modalProviders,
      });
    },
    getRegisteredActionHandlers: (): RegisteredActionHandler[] => {
      const storeId = "controlRegistryStore";
      const actions = get();
      return [
        {
          eventName: controlRegistryEvent.registerPromptControlRequest,
          handler: (payload) => {
            actions.registerPromptControl(payload.control);
          },
          storeId,
        },
        {
          eventName: controlRegistryEvent.unregisterPromptControlRequest,
          handler: (payload) => {
            actions.unregisterPromptControl(payload.id);
          },
          storeId,
        },
        {
          eventName: controlRegistryEvent.registerChatControlRequest,
          handler: (payload) => {
            actions.registerChatControl(payload.control);
          },
          storeId,
        },
        {
          eventName: controlRegistryEvent.unregisterChatControlRequest,
          handler: (payload) => {
            actions.unregisterChatControl(payload.id);
          },
          storeId,
        },
        {
          eventName: controlRegistryEvent.registerMiddlewareRequest,
          handler: (payload) => {
            actions.registerMiddleware(
              payload.hookName as ModMiddlewareHookName,
              payload.modId,
              payload.callback,
              payload.order
            );
          },
          storeId,
        },
        {
          eventName: controlRegistryEvent.unregisterMiddlewareRequest,
          handler: (payload) => {
            actions.unregisterMiddleware(
              payload.hookName as ModMiddlewareHookName,
              payload.modId,
              payload.callback
            );
          },
          storeId,
        },
        {
          eventName: controlRegistryEvent.registerToolRequest,
          handler: (payload) => {
            actions.registerTool(
              payload.modId,
              payload.toolName,
              payload.definition as Tool<any>,
              payload.implementation as ToolImplementation<any> | undefined
            );
          },
          storeId,
        },
        {
          eventName: controlRegistryEvent.unregisterToolRequest,
          handler: (payload) => {
            actions.unregisterTool(payload.toolName);
          },
          storeId,
        },
        {
          eventName: controlRegistryEvent.registerModalProviderRequest,
          handler: (payload) => {
            actions.registerModalProvider(
              payload.modalId,
              payload.provider as ModalProvider
            );
          },
          storeId,
        },
        {
          eventName: controlRegistryEvent.unregisterModalProviderRequest,
          handler: (payload) => {
            actions.unregisterModalProvider(payload.modalId);
          },
          storeId,
        },
      ];
    },
  }))
);
