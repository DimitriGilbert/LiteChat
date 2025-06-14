// src/types/litechat/control.ts
// FULL FILE
import type { PromptControl as CorePromptControlFromTypes } from "@/types/litechat/prompt";
import type { ChatControl as CoreChatControlFromTypes } from "@/types/litechat/chat";
import type { CanvasControl as CoreCanvasControlFromTypes } from "@/types/litechat/canvas/control"; // Added
import type { BlockRenderer } from "@/types/litechat/canvas/block-renderer";
import type {
  ModMiddlewareHookName,
  ModMiddlewarePayloadMap,
  ModMiddlewareReturnMap,
  ToolImplementation,
  LiteChatModApi,
  ModalProvider,
  ModEventPayloadMap, // Import ModEventPayloadMap
} from "@/types/litechat/modding";
import { Tool } from "ai";
import type { z } from "zod";

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
  // No need to store actionHandlers here, they are registered by stores directly with the coordinator
}

export interface ControlActions {
  registerPromptControl: (control: CorePromptControlFromTypes) => () => void;
  unregisterPromptControl: (id: string) => void;
  registerChatControl: (control: CoreChatControlFromTypes) => () => void;
  unregisterChatControl: (id: string) => void;
  registerCanvasControl: (control: CoreCanvasControlFromTypes) => () => void; // Added
  unregisterCanvasControl: (id: string) => void; // Added
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
}

export interface ControlModule {
  readonly id: string;
  readonly dependencies?: string[];
  initialize(modApi: LiteChatModApi): Promise<void>;
  register(modApi: LiteChatModApi): void;
  destroy(modApi: LiteChatModApi): void;
}

export type ControlModuleConstructor = new () => ControlModule;

export type { CorePromptControlFromTypes as PromptControl };
export type { CoreChatControlFromTypes as ChatControl };
export type { CoreCanvasControlFromTypes as CanvasControl }; // Added
