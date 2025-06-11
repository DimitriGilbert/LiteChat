// src/types/litechat/modding.ts
// FULL FILE
import type { Interaction } from "./interaction";
import type { Tool } from "ai";
import type { z } from "zod";
import type { fs } from "@zenfs/core";
import { type AppEventPayloads } from "./events/app.events";
import { type SettingsEventPayloads } from "./events/settings.events";
import { type ProviderEventPayloads } from "./events/provider.events";
import { type RulesEventPayloads } from "./events/rules.events";
import { type ConversationEventPayloads } from "./events/conversation.events";
import { type ProjectEventPayloads } from "./events/project.events";
import { type InteractionEventPayloads } from "./events/interaction.events";
import { type ControlRegistryEventPayloads } from "./events/control.registry.events";
import { type InputEventPayloads } from "./events/input.events";
import { type PromptEventPayloads } from "./events/prompt.events";
import { type PromptTemplateEventPayloads } from "./events/prompt-template.events";
import { type SettingsState } from "@/store/settings.store";
import { type ModEventPayloads as ModSpecificEventPayloads } from "./events/mod.events";
import { type SyncEventPayloads } from "./events/sync.events";
import { type UiEventPayloads } from "./events/ui.events";
import { type VfsEventPayloads } from "./events/vfs.events";
import type { CanvasControl as CoreCanvasControlFromTypes } from "./canvas/control";

import {
  type ModMiddlewareHookName,
  type ModMiddlewarePayloadMap,
  type ModMiddlewareReturnMap,
} from "./middleware.types";

export type {
  ModMiddlewareHookName,
  ModMiddlewarePayloadMap,
  ModMiddlewareReturnMap,
};
export { ModMiddlewareHook } from "./middleware.types";

export interface DbMod {
  id: string;
  name: string;
  sourceUrl: string | null;
  scriptContent: string | null;
  enabled: boolean;
  loadOrder: number;
  createdAt: Date;
}

export interface ModInstance {
  id: string;
  name: string;
  api: LiteChatModApi;
  error?: Error | string | null;
}

export interface ModState {
  dbMods: DbMod[];
  loadedMods: ModInstance[];
  modSettingsTabs: CustomSettingTab[];
  isLoading: boolean;
  error: string | null;
}

export interface ModActions {
  loadDbMods: () => Promise<void>;
  addDbMod: (
    modData: Omit<DbMod, "id" | "createdAt">
  ) => Promise<string | undefined>;
  updateDbMod: (id: string, changes: Partial<DbMod>) => Promise<void>;
  deleteDbMod: (id: string) => Promise<void>;
  setLoadedMods: (loadedMods: ModInstance[]) => void;
  _addSettingsTab: (tab: CustomSettingTab) => void;
  _removeSettingsTab: (tabId: string) => void;
}

export interface ReadonlyChatContextSnapshot {
  readonly selectedConversationId: string | null;
  readonly interactions: ReadonlyArray<Readonly<Interaction>>;
  readonly isStreaming: boolean;
  readonly selectedProviderId: string | null;
  readonly selectedModelId: string | null;
  readonly activeSystemPrompt: string | null;
  readonly temperature: number;
  readonly maxTokens: number | null;
  readonly theme: SettingsState["theme"];
  readonly gitUserName: string | null;
  readonly gitUserEmail: string | null;
}

export interface LiteChatModApi {
  readonly modId: string;
  readonly modName: string;
  registerPromptControl: (control: ModPromptControl) => () => void;
  registerChatControl: (control: ModChatControl) => () => void;
  registerCanvasControl: (control: CoreCanvasControlFromTypes) => () => void; // Added
  registerTool: <P extends z.ZodSchema<any>>(
    toolName: string,
    definition: Tool<P>,
    implementation?: ToolImplementation<P>
  ) => () => void;
  on: <K extends keyof ModEventPayloadMap>(
    eventName: K,
    callback: (payload: ModEventPayloadMap[K]) => void
  ) => () => void;
  emit: <K extends keyof ModEventPayloadMap>(
    eventName: K,
    payload: ModEventPayloadMap[K]
  ) => void;
  addMiddleware: <H extends ModMiddlewareHookName>(
    hookName: H,
    callback: (
      payload: ModMiddlewarePayloadMap[H]
    ) => ModMiddlewareReturnMap[H] | Promise<ModMiddlewareReturnMap[H]>
  ) => () => void;
  registerSettingsTab: (tab: CustomSettingTab) => () => void;
  getContextSnapshot: () => ReadonlyChatContextSnapshot;
  showToast: (
    type: "success" | "info" | "warning" | "error",
    message: string
  ) => void;
  log: (
    level: "log" | "warn" | "error" | "info" | "debug",
    ...args: any[]
  ) => void;
  registerModalProvider: (
    modalId: string,
    provider: ModalProvider
  ) => () => void;
  getVfsInstance: (vfsKey: string) => Promise<typeof fs | null>;
}

export type ToolImplementation<P extends z.ZodSchema<any>> = (
  params: z.infer<P>,
  context: ReadonlyChatContextSnapshot & { fsInstance?: typeof fs }
) => Promise<any>;

export interface CustomSettingTab {
  id: string;
  title: string;
  component: React.ComponentType<any>;
  order?: number;
}

export interface ModalProviderProps<P = any> {
  isOpen: boolean;
  onClose: () => void;
  modalProps?: P;
  targetId?: string | null;
  initialTab?: string | null;
  initialSubTab?: string | null;
}
export type ModalProvider<P = any> = React.ComponentType<ModalProviderProps<P>>;

export type ModEventPayloadMap = AppEventPayloads &
  SettingsEventPayloads &
  ProviderEventPayloads &
  RulesEventPayloads &
  ConversationEventPayloads &
  ProjectEventPayloads &
  InteractionEventPayloads &
  InputEventPayloads &
  PromptEventPayloads &
  PromptTemplateEventPayloads &
  ModSpecificEventPayloads &
  UiEventPayloads &
  VfsEventPayloads &
  SyncEventPayloads &
  ControlRegistryEventPayloads &
  Record<string, any>;

interface BaseControl {
  id: string;
  status?: () => "ready" | "loading" | "error";
}

export interface ModPromptControl extends BaseControl {
  triggerRenderer?: () => React.ReactNode;
  renderer?: () => React.ReactNode;
  getParameters?: () =>
    | Record<string, any>
    | undefined
    | Promise<Record<string, any> | undefined>;
  getMetadata?: () =>
    | Record<string, any>
    | undefined
    | Promise<Record<string, any> | undefined>;
  clearOnSubmit?: () => void;
}

export interface ModChatControl extends BaseControl {
  panel?: "sidebar" | "sidebar-footer" | "header" | "drawer_right" | "main";
  renderer?: () => React.ReactElement | null;
  iconRenderer?: () => React.ReactElement | null;
  settingsRenderer?: () => React.ReactElement | null;
  show?: () => boolean;
}

// Re-export CanvasControlRenderContext from its correct location
export type { CanvasControlRenderContext } from "./canvas/control";
