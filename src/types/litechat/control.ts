// src/types/litechat/control.ts
// FULL FILE
import type { PromptControl as CorePromptControlFromTypes } from "@/types/litechat/prompt";
import type { ChatControl as CoreChatControlFromTypes } from "@/types/litechat/chat";
import type {
  ModMiddlewareHookName,
  ModMiddlewarePayloadMap,
  ModMiddlewareReturnMap,
  ToolImplementation,
  LiteChatModApi,
  ModalProvider,
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

export interface ControlState {
  promptControls: Record<string, CorePromptControlFromTypes>;
  chatControls: Record<string, CoreChatControlFromTypes>;
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
}

export interface ControlActions {
  registerPromptControl: (control: CorePromptControlFromTypes) => () => void;
  unregisterPromptControl: (id: string) => void;
  registerChatControl: (control: CoreChatControlFromTypes) => () => void;
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
