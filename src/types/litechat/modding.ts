// src/types/litechat/modding.ts
// FULL FILE
import type { PromptObject, PromptTurnObject } from "./prompt";
import type { Interaction } from "./interaction";
import type { Tool, ToolCallPart, ToolResultPart } from "ai";
import type { z } from "zod";
import type { Conversation, SidebarItemType } from "./chat";
import type { Project } from "./project";
import type { DbProviderConfig } from "./provider";
import type { SyncStatus } from "./sync";
import type { AttachedFileMetadata } from "@/store/input.store";
import type { PromptState } from "@/store/prompt.store";
import type { InteractionState } from "@/store/interaction.store";
import type { PromptControl as ModPromptControl } from "./prompt";
import type { ChatControl as ModChatControl } from "./chat";

// --- Mod Definition & Instance ---

/** Mod definition stored in the database */
export interface DbMod {
  id: string;
  name: string;
  sourceUrl: string | null;
  scriptContent: string | null;
  enabled: boolean;
  loadOrder: number;
  createdAt: Date;
}

/** Represents a loaded mod instance at runtime */
export interface ModInstance {
  id: string;
  name: string;
  api: LiteChatModApi;
  error?: Error | string;
}

// --- Mod Store State & Actions ---

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
    modData: Omit<DbMod, "id" | "createdAt">,
  ) => Promise<string | undefined>;
  updateDbMod: (id: string, changes: Partial<DbMod>) => Promise<void>;
  deleteDbMod: (id: string) => Promise<void>;
  setLoadedMods: (loadedMods: ModInstance[]) => void;
  _addSettingsTab: (tab: CustomSettingTab) => void;
  _removeSettingsTab: (tabId: string) => void;
}

// --- Mod API ---

/** Read-only snapshot of the application state provided to mods */
export interface ReadonlyChatContextSnapshot {
  readonly selectedConversationId: string | null;
  readonly interactions: ReadonlyArray<Readonly<Interaction>>;
  readonly isStreaming: boolean;
  readonly selectedProviderId: string | null;
  readonly selectedModelId: string | null;
  readonly activeSystemPrompt: string | null;
  readonly temperature: number;
  readonly maxTokens: number | null;
  readonly theme:
    | "light"
    | "dark"
    | "system"
    | "TijuLight"
    | "TijuDark"
    | "custom";
}

/** The API surface exposed to loaded mods */
export interface LiteChatModApi {
  readonly modId: string;
  readonly modName: string;

  // Control Registration
  registerPromptControl: (control: ModPromptControl) => () => void;
  registerChatControl: (control: ModChatControl) => () => void;

  // Tool Registration
  registerTool: <P extends z.ZodSchema<any>>(
    toolName: string,
    definition: Tool<P>,
    implementation?: ToolImplementation<P>,
  ) => () => void;

  // Event Bus
  on: <K extends ModEventName>(
    eventName: K,
    callback: (payload: ModEventPayloadMap[K]) => void,
  ) => () => void;

  // Middleware
  addMiddleware: <H extends ModMiddlewareHookName>(
    hookName: H,
    callback: (
      payload: ModMiddlewarePayloadMap[H],
    ) => ModMiddlewareReturnMap[H] | Promise<ModMiddlewareReturnMap[H]>,
  ) => () => void;

  // Settings
  registerSettingsTab: (tab: CustomSettingTab) => () => void;

  // Utilities
  getContextSnapshot: () => ReadonlyChatContextSnapshot;
  showToast: (
    type: "success" | "info" | "warning" | "error",
    message: string,
  ) => void;
  log: (
    level: "log" | "warn" | "error" | "info" | "debug",
    ...args: any[]
  ) => void;
}

// --- Tool Implementation ---

/** Function signature for tool execution logic */
export type ToolImplementation<P extends z.ZodSchema<any>> = (
  params: z.infer<P>,
  context: ReadonlyChatContextSnapshot,
) => Promise<any>;

// --- Custom Settings Tab ---

export interface CustomSettingTab {
  id: string;
  title: string;
  component: React.ComponentType;
  order?: number;
}

// --- Event Emitter ---

/** Defines the names of events mods can subscribe to */
export enum ModEvent {
  // App Lifecycle
  APP_LOADED = "app:loaded",
  MOD_LOADED = "mod:loaded",
  MOD_ERROR = "mod:error",

  // Conversation Lifecycle
  CONVERSATION_SELECTED = "conversation:selected",
  CONVERSATION_ADDED = "conversation:added",
  CONVERSATION_UPDATED = "conversation:updated",
  CONVERSATION_DELETED = "conversation:deleted",

  // Project Lifecycle
  PROJECT_SELECTED = "project:selected",
  PROJECT_ADDED = "project:added",
  PROJECT_UPDATED = "project:updated",
  PROJECT_DELETED = "project:deleted",

  // Interaction Lifecycle
  INTERACTION_STARTED = "interaction:started",
  INTERACTION_STREAM_CHUNK = "interaction:stream_chunk",
  INTERACTION_COMPLETED = "interaction:completed",

  // Prompt Lifecycle
  PROMPT_SUBMITTED = "prompt:submitted",
  PROMPT_INPUT_CHANGE = "prompt:input_change",

  // Settings Changes
  SETTINGS_CHANGED = "settings:changed",

  // Provider/Model Changes
  PROVIDER_CONFIG_CHANGED = "provider:config_changed",
  API_KEY_CHANGED = "provider:api_key_changed",
  MODEL_SELECTION_CHANGED = "provider:model_selection_changed",

  // VFS Events
  VFS_FILE_WRITTEN = "vfs:file_written",
  VFS_FILE_READ = "vfs:file_read",
  VFS_FILE_DELETED = "vfs:file_deleted",
  VFS_CONTEXT_CHANGED = "vfs:context_changed",

  // Sync Events
  SYNC_REPO_CHANGED = "sync:repo_changed",
  CONVERSATION_SYNC_STATUS_CHANGED = "sync:conversation_status_changed",
  REPO_INIT_STATUS_CHANGED = "sync:repo_init_status_changed",

  // Input State Changes
  ATTACHED_FILES_CHANGED = "input:attached_files_changed",
  PROMPT_PARAMS_CHANGED = "input:prompt_params_changed",

  // Interaction State Changes
  INTERACTION_STATUS_CHANGED = "interaction:status_changed",

  // UI State Changes
  CONTEXT_CHANGED = "ui:context_changed",
}

/** Maps event names to their expected payload types */
export interface ModEventPayloadMap {
  [ModEvent.APP_LOADED]: undefined;
  [ModEvent.MOD_LOADED]: { id: string; name: string };
  [ModEvent.MOD_ERROR]: { id: string; name: string; error: Error | string };
  [ModEvent.CONVERSATION_SELECTED]: { conversationId: string | null };
  [ModEvent.CONVERSATION_ADDED]: { conversation: Conversation };
  [ModEvent.CONVERSATION_UPDATED]: {
    conversationId: string;
    updates: Partial<Conversation>;
  };
  [ModEvent.CONVERSATION_DELETED]: { conversationId: string };
  [ModEvent.PROJECT_SELECTED]: { projectId: string | null };
  [ModEvent.PROJECT_ADDED]: { project: Project };
  [ModEvent.PROJECT_UPDATED]: { projectId: string; updates: Partial<Project> };
  [ModEvent.PROJECT_DELETED]: { projectId: string };
  [ModEvent.INTERACTION_STARTED]: {
    interactionId: string;
    conversationId: string;
    type: string;
  };
  [ModEvent.INTERACTION_STREAM_CHUNK]: {
    interactionId: string;
    chunk: string;
  };
  [ModEvent.INTERACTION_COMPLETED]: {
    interactionId: string;
    status: Interaction["status"];
    error?: string;
    toolCalls?: ToolCallPart[];
    toolResults?: ToolResultPart[];
  };
  [ModEvent.PROMPT_SUBMITTED]: { turnData: PromptTurnObject };
  [ModEvent.PROMPT_INPUT_CHANGE]: { value: string };
  [ModEvent.SETTINGS_CHANGED]: { key: string; value: any };
  [ModEvent.PROVIDER_CONFIG_CHANGED]: {
    providerId: string;
    config: DbProviderConfig;
  };
  [ModEvent.API_KEY_CHANGED]: { keyId: string; action: "added" | "deleted" };
  [ModEvent.MODEL_SELECTION_CHANGED]: { modelId: string | null };
  [ModEvent.VFS_FILE_WRITTEN]: { path: string };
  [ModEvent.VFS_FILE_READ]: { path: string };
  [ModEvent.VFS_FILE_DELETED]: { path: string };
  [ModEvent.VFS_CONTEXT_CHANGED]: { vfsKey: string | null };
  [ModEvent.SYNC_REPO_CHANGED]: {
    repoId: string;
    action: "added" | "updated" | "deleted";
  };
  [ModEvent.CONVERSATION_SYNC_STATUS_CHANGED]: {
    conversationId: string;
    status: SyncStatus;
  };
  [ModEvent.REPO_INIT_STATUS_CHANGED]: { repoId: string; status: SyncStatus };
  [ModEvent.ATTACHED_FILES_CHANGED]: { files: AttachedFileMetadata[] };
  [ModEvent.PROMPT_PARAMS_CHANGED]: { params: Partial<PromptState> };
  [ModEvent.INTERACTION_STATUS_CHANGED]: {
    status: InteractionState["status"];
  };
  [ModEvent.CONTEXT_CHANGED]: {
    selectedItemId: string | null;
    selectedItemType: SidebarItemType | null;
  };
}

export type ModEventName = ModEvent;

// --- Middleware ---

/** Defines the names of available middleware hooks */
export enum ModMiddlewareHook {
  PROMPT_TURN_FINALIZE = "middleware:prompt:turnFinalize",
  INTERACTION_BEFORE_START = "middleware:interaction:beforeStart",
  INTERACTION_PROCESS_CHUNK = "middleware:interaction:processChunk",
}

/** Maps middleware hook names to their expected payload types */
export interface ModMiddlewarePayloadMap {
  [ModMiddlewareHook.PROMPT_TURN_FINALIZE]: { turnData: PromptTurnObject };
  [ModMiddlewareHook.INTERACTION_BEFORE_START]: {
    prompt: PromptObject;
    conversationId: string;
  };
  [ModMiddlewareHook.INTERACTION_PROCESS_CHUNK]: {
    interactionId: string;
    chunk: string;
  };
}

/** Maps middleware hook names to their expected return types */
export interface ModMiddlewareReturnMap {
  [ModMiddlewareHook.PROMPT_TURN_FINALIZE]:
    | { turnData: PromptTurnObject }
    | false;
  [ModMiddlewareHook.INTERACTION_BEFORE_START]:
    | { prompt: PromptObject }
    | false;
  [ModMiddlewareHook.INTERACTION_PROCESS_CHUNK]: { chunk: string } | false;
}

export type ModMiddlewareHookName = ModMiddlewareHook;

// --- Controls ---
// Note: These are the types used by the Mod API. The core application might use
// slightly stricter types (e.g., requiring status function). The API factory
// handles the mapping/defaults.

/** Base definition for UI controls registered by mods or core */
interface BaseControl {
  id: string;
  // order removed
  status?: () => "ready" | "loading" | "error";
  show?: () => boolean;
}

/** Definition for controls appearing in the prompt input area */
export interface PromptControl extends BaseControl {
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

/** Definition for controls appearing in other chat layout areas */
export interface ChatControl extends BaseControl {
  panel?: "sidebar" | "sidebar-footer" | "header" | "drawer_right" | "main";
  renderer?: () => React.ReactNode;
  iconRenderer?: () => React.ReactNode;
  settingsRenderer?: () => React.ReactNode;
}
