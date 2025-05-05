// src/types/litechat/modding.ts
// FULL FILE
import type { PromptObject, PromptTurnObject } from "./prompt";
import type { Interaction } from "./interaction";
import type { Tool, ToolCallPart, ToolResultPart } from "ai";
import type { z } from "zod";
import type { Conversation, SidebarItemType } from "./chat";
import type { Project } from "./project";
import type { DbProviderConfig } from "./provider"; // DbApiKey removed
import type { SyncStatus } from "./sync"; // SyncRepo removed
import type { AttachedFileMetadata } from "@/store/input.store";
import type { PromptState } from "@/store/prompt.store";
import type { InteractionState } from "@/store/interaction.store";
import type { PromptControl as ModPromptControl } from "./prompt"; // Use alias for modding PromptControl
import type { ChatControl as ModChatControl } from "./chat"; // Use alias for modding ChatControl

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
  error?: Error | string; // Error encountered during loading/execution
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
  registerPromptControl: (control: ModPromptControl) => () => void; // Use aliased type
  registerChatControl: (control: ModChatControl) => () => void; // Use aliased type

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
  id: string; // Unique ID (e.g., "my-mod-settings")
  title: string; // Tab title
  component: React.ComponentType; // React component to render
  order?: number; // Optional display order
}

// --- Event Emitter ---

/** Defines the names of events mods can subscribe to */
export enum ModEvent {
  // App Lifecycle
  APP_LOADED = "app:loaded", // Payload: undefined
  MOD_LOADED = "mod:loaded", // Payload: { id: string, name: string }
  MOD_ERROR = "mod:error", // Payload: { id: string, name: string, error: Error | string }

  // Conversation Lifecycle
  CONVERSATION_SELECTED = "conversation:selected", // Payload: { conversationId: string | null }
  CONVERSATION_ADDED = "conversation:added", // Payload: { conversation: Conversation }
  CONVERSATION_UPDATED = "conversation:updated", // Payload: { conversationId: string, updates: Partial<Conversation> }
  CONVERSATION_DELETED = "conversation:deleted", // Payload: { conversationId: string }

  // Project Lifecycle
  PROJECT_SELECTED = "project:selected", // Payload: { projectId: string | null }
  PROJECT_ADDED = "project:added", // Payload: { project: Project }
  PROJECT_UPDATED = "project:updated", // Payload: { projectId: string, updates: Partial<Project> }
  PROJECT_DELETED = "project:deleted", // Payload: { projectId: string }

  // Interaction Lifecycle
  INTERACTION_STARTED = "interaction:started", // Payload: { interactionId: string, conversationId: string, type: string }
  INTERACTION_STREAM_CHUNK = "interaction:stream_chunk", // Payload: { interactionId: string, chunk: string }
  INTERACTION_COMPLETED = "interaction:completed", // Payload: { interactionId: string, status: InteractionStatus, error?: string, toolCalls?: ToolCallPart[], toolResults?: ToolResultPart[] }

  // Prompt Lifecycle
  PROMPT_SUBMITTED = "prompt:submitted", // Payload: { turnData: PromptTurnObject }
  PROMPT_INPUT_CHANGE = "prompt:input_change", // Payload: { value: string }

  // Settings Changes
  SETTINGS_CHANGED = "settings:changed", // Payload: { key: string, value: any }

  // Provider/Model Changes
  PROVIDER_CONFIG_CHANGED = "provider:config_changed", // Payload: { providerId: string, config: DbProviderConfig }
  API_KEY_CHANGED = "provider:api_key_changed", // Payload: { keyId: string, action: 'added' | 'deleted' }
  MODEL_SELECTION_CHANGED = "provider:model_selection_changed", // Payload: { modelId: string | null }

  // VFS Events
  VFS_FILE_WRITTEN = "vfs:file_written", // Payload: { path: string }
  VFS_FILE_READ = "vfs:file_read", // Payload: { path: string }
  VFS_FILE_DELETED = "vfs:file_deleted", // Payload: { path: string }
  VFS_CONTEXT_CHANGED = "vfs:context_changed", // Payload: { vfsKey: string | null }

  // Sync Events
  SYNC_REPO_CHANGED = "sync:repo_changed", // Payload: { repoId: string, action: 'added' | 'updated' | 'deleted' }
  CONVERSATION_SYNC_STATUS_CHANGED = "sync:conversation_status_changed", // Payload: { conversationId: string, status: SyncStatus }
  REPO_INIT_STATUS_CHANGED = "sync:repo_init_status_changed", // Payload: { repoId: string, status: SyncStatus }

  // Input State Changes
  ATTACHED_FILES_CHANGED = "input:attached_files_changed", // Payload: { files: AttachedFileMetadata[] }
  PROMPT_PARAMS_CHANGED = "input:prompt_params_changed", // Payload: { params: Partial<PromptState> }

  // Interaction State Changes
  INTERACTION_STATUS_CHANGED = "interaction:status_changed", // Payload: { status: InteractionState['status'] }

  // UI State Changes
  CONTEXT_CHANGED = "ui:context_changed", // Payload: { selectedItemId: string | null, selectedItemType: SidebarItemType | null }
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
  PROMPT_TURN_FINALIZE = "middleware:prompt:turnFinalize", // Before sending to AI service
  INTERACTION_BEFORE_START = "middleware:interaction:beforeStart", // Before calling AI SDK
  INTERACTION_PROCESS_CHUNK = "middleware:interaction:processChunk", // Processing incoming stream chunk
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
  id: string; // Unique ID (e.g., "core-model-selector", "my-mod-input-enhancer")
  // order removed
  status?: () => "ready" | "loading" | "error"; // Optional status indicator
  show?: () => boolean; // Optional function to determine visibility
}

/** Definition for controls appearing in the prompt input area */
export interface PromptControl extends BaseControl {
  triggerRenderer?: () => React.ReactNode; // Renders the button/trigger in the main bar
  renderer?: () => React.ReactNode; // Renders the panel/content area above the input
  getParameters?: () =>
    | Record<string, any>
    | undefined
    | Promise<Record<string, any> | undefined>; // Contribute parameters to the AI call
  getMetadata?: () =>
    | Record<string, any>
    | undefined
    | Promise<Record<string, any> | undefined>; // Contribute metadata to the turn object
  clearOnSubmit?: () => void; // Action to clear transient state after submission
}

/** Definition for controls appearing in other chat layout areas */
export interface ChatControl extends BaseControl {
  panel?: "sidebar" | "sidebar-footer" | "header" | "drawer_right" | "main"; // Target panel ID
  renderer?: () => React.ReactNode; // Renders the full control
  iconRenderer?: () => React.ReactNode; // Renders an icon-only version (e.g., for collapsed sidebar)
  settingsRenderer?: () => React.ReactNode; // Renders content when control is used as a settings modal trigger
}
