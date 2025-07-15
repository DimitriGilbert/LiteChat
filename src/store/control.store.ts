// src/store/control.store.ts
// FULL FILE
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { emitter } from "@/lib/litechat/event-emitter";
import {
  controlRegistryEvent,
  ControlRegistryEventPayloads,
} from "@/types/litechat/events/control.registry.events";
import {
  blockRendererEvent,
  BlockRendererEventPayloads,
} from "@/types/litechat/events/block-renderer.events";
import type {
  ControlState as ControlStateInterface,
  ControlActions as ControlActionsInterface,
  RegisteredActionHandler,
  CanvasControl as CoreCanvasControlAliased, // Added alias
} from "@/types/litechat/control";
import type { SelectionControl } from "@/types/litechat/canvas/control";
import type {
  ModalProvider,
  ModMiddlewareHookName,
  ToolImplementation,
} from "@/types/litechat/modding";
import type { Tool } from "ai";
import type { TriggerNamespace } from "@/types/litechat/text-triggers";

export const useControlRegistryStore = create(
  immer<ControlStateInterface & ControlActionsInterface>((set, get) => ({
    // Initial State
    promptControls: {},
    chatControls: {},
    canvasControls: {}, // Added
    selectionControls: {},
    blockRenderers: {},
    middlewareRegistry: {},
    tools: {},
    modalProviders: {},
    controlRules: {}, // Added for control rules
    textTriggerNamespaces: {}, // Added for text trigger namespaces

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

    registerCanvasControl: (control) => {
      // Added
      set((state) => {
        if (state.canvasControls[control.id]) {
          console.warn(
            `ControlRegistryStore: CanvasControl with ID "${control.id}" already registered. Overwriting.`
          );
        }
        state.canvasControls[control.id] = control;
      });
      emitter.emit(controlRegistryEvent.canvasControlsChanged, {
        controls: get().canvasControls,
      });
      return () => get().unregisterCanvasControl(control.id);
    },

    unregisterCanvasControl: (id) => {
      // Added
      set((state) => {
        if (state.canvasControls[id]) {
          delete state.canvasControls[id];
        } else {
          console.warn(
            `ControlRegistryStore: CanvasControl with ID "${id}" not found for unregistration.`
          );
        }
      });
      emitter.emit(controlRegistryEvent.canvasControlsChanged, {
        controls: get().canvasControls,
      });
    },

    registerSelectionControl: (control: SelectionControl) => {
      set((state) => {
        if (state.selectionControls[control.id]) {
          console.warn(
            `ControlRegistryStore: SelectionControl with ID "${control.id}" already registered. Overwriting.`
          );
        }
        state.selectionControls[control.id] = control;
      });
      emitter.emit(controlRegistryEvent.selectionControlsChanged, {
        controls: get().selectionControls,
      });
      return () => get().unregisterSelectionControl(control.id);
    },

    unregisterSelectionControl: (id: string) => {
      set((state) => {
        if (state.selectionControls[id]) {
          delete state.selectionControls[id];
        } else {
          console.warn(
            `ControlRegistryStore: SelectionControl with ID "${id}" not found for unregistration.`
          );
        }
      });
      emitter.emit(controlRegistryEvent.selectionControlsChanged, {
        controls: get().selectionControls,
      });
    },

    registerBlockRenderer: (renderer) => {
      set((state) => {
        if (state.blockRenderers[renderer.id]) {
          console.warn(
            `ControlRegistryStore: BlockRenderer with ID "${renderer.id}" already registered. Overwriting.`
          );
        }
        state.blockRenderers[renderer.id] = renderer;
      });
      emitter.emit(blockRendererEvent.blockRenderersChanged, {
        renderers: get().blockRenderers,
      });
      return () => get().unregisterBlockRenderer(renderer.id);
    },

    unregisterBlockRenderer: (id) => {
      set((state) => {
        if (state.blockRenderers[id]) {
          delete state.blockRenderers[id];
        } else {
          console.warn(
            `ControlRegistryStore: BlockRenderer with ID "${id}" not found for unregistration.`
          );
        }
      });
      emitter.emit(blockRendererEvent.blockRenderersChanged, {
        renderers: get().blockRenderers,
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

    registerControlRule: (rule) => {
      set((state) => {
        if (state.controlRules[rule.id]) {
          console.warn(
            `ControlRegistryStore: ControlRule with ID "${rule.id}" already registered. Overwriting.`
          );
        }
        state.controlRules[rule.id] = rule;
      });
      emitter.emit(controlRegistryEvent.controlRulesChanged, {
        controlRules: get().controlRules,
      });
      return () => get().unregisterControlRule(rule.id);
    },

    unregisterControlRule: (id) => {
      set((state) => {
        if (state.controlRules[id]) {
          delete state.controlRules[id];
        } else {
          console.warn(
            `ControlRegistryStore: ControlRule with ID "${id}" not found for unregistration.`
          );
        }
      });
      emitter.emit(controlRegistryEvent.controlRulesChanged, {
        controlRules: get().controlRules,
      });
    },

    getControlRules: () => {
      return Object.freeze({ ...get().controlRules });
    },

    registerTextTriggerNamespace: (namespace: TriggerNamespace) => {
      set((state) => {
        if (state.textTriggerNamespaces[namespace.id]) {
          console.warn(
            `ControlRegistryStore: TextTriggerNamespace with ID "${namespace.id}" already registered. Overwriting.`
          );
        }
        state.textTriggerNamespaces[namespace.id] = namespace as any;
      });
      emitter.emit(controlRegistryEvent.textTriggerNamespacesChanged, {
        namespaces: get().textTriggerNamespaces,
      });
      return () => get().unregisterTextTriggerNamespace(namespace.id);
    },

    unregisterTextTriggerNamespace: (id: string) => {
      set((state) => {
        if (state.textTriggerNamespaces[id]) {
          delete state.textTriggerNamespaces[id];
        } else {
          console.warn(
            `ControlRegistryStore: TextTriggerNamespace with ID "${id}" not found for unregistration.`
          );
        }
      });
      emitter.emit(controlRegistryEvent.textTriggerNamespacesChanged, {
        namespaces: get().textTriggerNamespaces,
      });
    },

    getTextTriggerNamespaces: () => {
      return Object.freeze({ ...get().textTriggerNamespaces });
    },

    getRegisteredActionHandlers: (): RegisteredActionHandler[] => {
      const storeId = "controlRegistryStore";
      const actions = get();
      return [
        {
          eventName: controlRegistryEvent.registerPromptControlRequest,
          handler: (
            payload: ControlRegistryEventPayloads[typeof controlRegistryEvent.registerPromptControlRequest]
          ) => {
            actions.registerPromptControl(payload.control);
          },
          storeId,
        },
        {
          eventName: controlRegistryEvent.unregisterPromptControlRequest,
          handler: (
            payload: ControlRegistryEventPayloads[typeof controlRegistryEvent.unregisterPromptControlRequest]
          ) => {
            actions.unregisterPromptControl(payload.id);
          },
          storeId,
        },
        {
          eventName: controlRegistryEvent.registerChatControlRequest,
          handler: (
            payload: ControlRegistryEventPayloads[typeof controlRegistryEvent.registerChatControlRequest]
          ) => {
            actions.registerChatControl(payload.control);
          },
          storeId,
        },
        {
          eventName: controlRegistryEvent.unregisterChatControlRequest,
          handler: (
            payload: ControlRegistryEventPayloads[typeof controlRegistryEvent.unregisterChatControlRequest]
          ) => {
            actions.unregisterChatControl(payload.id);
          },
          storeId,
        },
        {
          // Added handler for canvas control registration
          eventName: controlRegistryEvent.registerCanvasControlRequest,
          handler: (
            payload: ControlRegistryEventPayloads[typeof controlRegistryEvent.registerCanvasControlRequest]
          ) => {
            actions.registerCanvasControl(
              payload.control as CoreCanvasControlAliased
            );
          },
          storeId,
        },
        {
          // Added handler for canvas control unregistration
          eventName: controlRegistryEvent.unregisterCanvasControlRequest,
          handler: (
            payload: ControlRegistryEventPayloads[typeof controlRegistryEvent.unregisterCanvasControlRequest]
          ) => {
            actions.unregisterCanvasControl(payload.id);
          },
          storeId,
        },
        {
          eventName: blockRendererEvent.registerBlockRendererRequest,
          handler: (
            payload: BlockRendererEventPayloads[typeof blockRendererEvent.registerBlockRendererRequest]
          ) => {
            actions.registerBlockRenderer(payload.renderer);
          },
          storeId,
        },
        {
          eventName: blockRendererEvent.unregisterBlockRendererRequest,
          handler: (
            payload: BlockRendererEventPayloads[typeof blockRendererEvent.unregisterBlockRendererRequest]
          ) => {
            actions.unregisterBlockRenderer(payload.id);
          },
          storeId,
        },
        {
          eventName: controlRegistryEvent.registerMiddlewareRequest,
          handler: (
            payload: ControlRegistryEventPayloads[typeof controlRegistryEvent.registerMiddlewareRequest]
          ) => {
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
          handler: (
            payload: ControlRegistryEventPayloads[typeof controlRegistryEvent.unregisterMiddlewareRequest]
          ) => {
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
          handler: (
            payload: ControlRegistryEventPayloads[typeof controlRegistryEvent.registerToolRequest]
          ) => {
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
          handler: (
            payload: ControlRegistryEventPayloads[typeof controlRegistryEvent.unregisterToolRequest]
          ) => {
            actions.unregisterTool(payload.toolName);
          },
          storeId,
        },
        {
          eventName: controlRegistryEvent.registerModalProviderRequest,
          handler: (
            payload: ControlRegistryEventPayloads[typeof controlRegistryEvent.registerModalProviderRequest]
          ) => {
            actions.registerModalProvider(
              payload.modalId,
              payload.provider as ModalProvider
            );
          },
          storeId,
        },
        {
          eventName: controlRegistryEvent.unregisterModalProviderRequest,
          handler: (
            payload: ControlRegistryEventPayloads[typeof controlRegistryEvent.unregisterModalProviderRequest]
          ) => {
            actions.unregisterModalProvider(payload.modalId);
          },
          storeId,
        },
        {
          eventName: controlRegistryEvent.registerControlRuleRequest,
          handler: (
            payload: ControlRegistryEventPayloads[typeof controlRegistryEvent.registerControlRuleRequest]
          ) => {
            actions.registerControlRule(payload.rule);
          },
          storeId,
        },
        {
          eventName: controlRegistryEvent.unregisterControlRuleRequest,
          handler: (
            payload: ControlRegistryEventPayloads[typeof controlRegistryEvent.unregisterControlRuleRequest]
          ) => {
            actions.unregisterControlRule(payload.id);
          },
          storeId,
        },
        {
          eventName: controlRegistryEvent.registerSelectionControlRequest,
          handler: (
            payload: ControlRegistryEventPayloads[typeof controlRegistryEvent.registerSelectionControlRequest]
          ) => {
            actions.registerSelectionControl(payload.control);
          },
          storeId,
        },
        {
          eventName: controlRegistryEvent.unregisterSelectionControlRequest,
          handler: (
            payload: ControlRegistryEventPayloads[typeof controlRegistryEvent.unregisterSelectionControlRequest]
          ) => {
            actions.unregisterSelectionControl(payload.id);
          },
          storeId,
        },
        {
          eventName: controlRegistryEvent.registerTextTriggerNamespaceRequest,
          handler: (
            payload: ControlRegistryEventPayloads[typeof controlRegistryEvent.registerTextTriggerNamespaceRequest]
          ) => {
            actions.registerTextTriggerNamespace(payload.namespace);
          },
          storeId,
        },
        {
          eventName: controlRegistryEvent.unregisterTextTriggerNamespaceRequest,
          handler: (
            payload: ControlRegistryEventPayloads[typeof controlRegistryEvent.unregisterTextTriggerNamespaceRequest]
          ) => {
            actions.unregisterTextTriggerNamespace(payload.id);
          },
          storeId,
        },
      ];
    },
  }))
);
