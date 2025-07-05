// src/types/litechat/events/control.registry.events.ts
// FULL FILE
import type {
  ControlState,
  PromptControl as CorePromptControlAliased,
  ChatControl as CoreChatControlAliased,
  CanvasControl as CoreCanvasControlAliased, // Added
} from "@/types/litechat/control";
import type {
  ToolImplementation,
  ModalProvider,
  ModControlRule, // Added
} from "@/types/litechat/modding";
import type { ModMiddlewareHookName } from "@/types/litechat/middleware.types";
import type { Tool } from "ai";

export const controlRegistryEvent = {
  // State Change Events
  promptControlsChanged: "control.registry.prompt.controls.changed",
  chatControlsChanged: "control.registry.chat.controls.changed",
  canvasControlsChanged: "control.registry.canvas.controls.changed", // Added
  middlewareChanged: "control.registry.middleware.changed",
  toolsChanged: "control.registry.tools.changed",
  modalProvidersChanged: "control.registry.modal.providers.changed",
  controlRulesChanged: "control.registry.control.rules.changed", // Added for control rules

  // Action Request Events
  registerPromptControlRequest:
    "control.registry.register.prompt.control.request",
  unregisterPromptControlRequest:
    "control.registry.unregister.prompt.control.request",
  registerChatControlRequest: "control.registry.register.chat.control.request",
  unregisterChatControlRequest:
    "control.registry.unregister.chat.control.request",
  registerCanvasControlRequest:
    "control.registry.register.canvas.control.request", // Added
  unregisterCanvasControlRequest:
    "control.registry.unregister.canvas.control.request", // Added
  registerMiddlewareRequest: "control.registry.register.middleware.request",
  unregisterMiddlewareRequest: "control.registry.unregister.middleware.request",
  registerToolRequest: "control.registry.register.tool.request",
  unregisterToolRequest: "control.registry.unregister.tool.request",
  registerModalProviderRequest:
    "control.registry.register.modal.provider.request",
  unregisterModalProviderRequest:
    "control.registry.unregister.modal.provider.request",
  registerControlRuleRequest: "control.registry.register.control.rule.request", // Added for control rules
  unregisterControlRuleRequest: "control.registry.unregister.control.rule.request", // Added for control rules
} as const;

export interface ControlRegistryEventPayloads {
  [controlRegistryEvent.promptControlsChanged]: {
    controls: Record<string, CorePromptControlAliased>;
  };
  [controlRegistryEvent.chatControlsChanged]: {
    controls: Record<string, CoreChatControlAliased>;
  };
  [controlRegistryEvent.canvasControlsChanged]: {
    // Added
    controls: Record<string, CoreCanvasControlAliased>;
  };
  [controlRegistryEvent.middlewareChanged]: {
    middleware: ControlState["middlewareRegistry"];
  };
  [controlRegistryEvent.toolsChanged]: { tools: ControlState["tools"] };
  [controlRegistryEvent.modalProvidersChanged]: {
    providers: Record<string, ModalProvider>;
  };
  [controlRegistryEvent.controlRulesChanged]: { // Added for control rules
    controlRules: Record<string, ModControlRule>;
  };
  [controlRegistryEvent.registerPromptControlRequest]: {
    control: CorePromptControlAliased;
  };
  [controlRegistryEvent.unregisterPromptControlRequest]: { id: string };
  [controlRegistryEvent.registerChatControlRequest]: {
    control: CoreChatControlAliased;
  };
  [controlRegistryEvent.unregisterChatControlRequest]: { id: string };
  [controlRegistryEvent.registerCanvasControlRequest]: {
    // Added
    control: CoreCanvasControlAliased;
  };
  [controlRegistryEvent.unregisterCanvasControlRequest]: { id: string }; // Added
  [controlRegistryEvent.registerMiddlewareRequest]: {
    hookName: ModMiddlewareHookName;
    modId: string;
    callback: (payload: any) => any | Promise<any>;
    order?: number;
  };
  [controlRegistryEvent.unregisterMiddlewareRequest]: {
    hookName: ModMiddlewareHookName;
    modId: string;
    callback: (payload: any) => any | Promise<any>;
  };
  [controlRegistryEvent.registerToolRequest]: {
    modId: string;
    toolName: string;
    definition: Tool<any>;
    implementation?: ToolImplementation<any>;
  };
  [controlRegistryEvent.unregisterToolRequest]: { toolName: string };
  [controlRegistryEvent.registerModalProviderRequest]: {
    modalId: string;
    provider: ModalProvider;
  };
  [controlRegistryEvent.unregisterModalProviderRequest]: { modalId: string };
  [controlRegistryEvent.registerControlRuleRequest]: { // Added for control rules
    rule: ModControlRule;
  };
  [controlRegistryEvent.unregisterControlRuleRequest]: { id: string }; // Added for control rules
}
