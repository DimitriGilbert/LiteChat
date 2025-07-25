// src/types/litechat/control.ts
// FULL FILE
import type { PromptControl as CorePromptControlFromTypes } from "@/types/litechat/prompt";
import type { ChatControl as CoreChatControlFromTypes } from "@/types/litechat/chat";
import type { CanvasControl as CoreCanvasControlFromTypes, SelectionControl } from "@/types/litechat/canvas/control"; // Added
import type { BlockRenderer } from "@/types/litechat/canvas/block-renderer";
import type {
  ModMiddlewareHookName,
  ModMiddlewarePayloadMap,
  ModMiddlewareReturnMap,
  ToolImplementation,
  LiteChatModApi,
  ModalProvider,
  ModEventPayloadMap, // Import ModEventPayloadMap
  ModControlRule, // Added for control rules
} from "@/types/litechat/modding";
import { Tool } from "ai";
import type { z } from "zod";
import type { TriggerNamespace } from "./text-triggers";

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

// New types for dynamic action handling
export type ActionHandler<P = any> = (payload: P) => void | Promise<void>;

export interface RegisteredActionHandler<
  K extends keyof ModEventPayloadMap = any
> {
  eventName: K;
  handler: ActionHandler<ModEventPayloadMap[K]>;
  storeId: string; // Identifier for the store registering the handler
}

export interface ControlState {
  promptControls: Record<string, CorePromptControlFromTypes>;
  chatControls: Record<string, CoreChatControlFromTypes>;
  canvasControls: Record<string, CoreCanvasControlFromTypes>; // Added
  selectionControls: Record<string, SelectionControl>;
  blockRenderers: Record<string, BlockRenderer>;
  middlewareRegistry: MiddlewareRegistry;
  tools: Record<
    string,
    {
      definition: Tool<any>;
      implementation?: ToolImplementation<any>;
      modId: string;
    }
  >;
  modalProviders: Record<string, ModalProvider>;
  controlRules: Record<string, ModControlRule>; // Added for control rules
  textTriggerNamespaces: Record<string, TriggerNamespace>; // Added for text trigger namespaces
  // No need to store actionHandlers here, they are registered by stores directly with the coordinator
}

export interface ControlActions {
  registerPromptControl: (control: CorePromptControlFromTypes) => () => void;
  unregisterPromptControl: (id: string) => void;
  registerChatControl: (control: CoreChatControlFromTypes) => () => void;
  unregisterChatControl: (id: string) => void;
  registerCanvasControl: (control: CoreCanvasControlFromTypes) => () => void; // Added
  unregisterCanvasControl: (id: string) => void; // Added
  registerSelectionControl: (control: SelectionControl) => () => void;
  unregisterSelectionControl: (id: string) => void;
  registerBlockRenderer: (renderer: BlockRenderer) => () => void;
  unregisterBlockRenderer: (id: string) => void;
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
  registerModalProvider: (
    modalId: string,
    provider: ModalProvider
  ) => () => void;
  unregisterModalProvider: (modalId: string) => void;
  registerControlRule: (rule: ModControlRule) => () => void; // Added for control rules
  unregisterControlRule: (id: string) => void; // Added for control rules
  getControlRules: () => Readonly<ControlState["controlRules"]>; // Added for control rules
  registerTextTriggerNamespace: (namespace: TriggerNamespace) => () => void; // Added for text trigger namespaces
  unregisterTextTriggerNamespace: (id: string) => void; // Added for text trigger namespaces
  getTextTriggerNamespaces: () => Readonly<ControlState["textTriggerNamespaces"]>; // Added for text trigger namespaces
}

export interface ControlModule {
  readonly id: string;
  readonly dependencies?: string[];
  initialize(modApi: LiteChatModApi): Promise<void>;
  register(modApi: LiteChatModApi): void;
  destroy(modApi: LiteChatModApi): void;
  // Optional: modules can declare text trigger namespaces
  getTextTriggerNamespaces?(): import('./text-triggers').TriggerNamespace[];
}

export type { CorePromptControlFromTypes as PromptControl };
export type { CoreChatControlFromTypes as ChatControl };
export type { CoreCanvasControlFromTypes as CanvasControl }; // Added

export interface ControlTranslations {
  [lang: string]: {
    [namespace: string]: Record<string, string>;
  };
}

export interface ControlModuleConstructor {
  new (): ControlModule;
  translations?: ControlTranslations;
}
