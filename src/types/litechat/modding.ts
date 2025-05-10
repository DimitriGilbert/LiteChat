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
import type { SettingsState } from "@/store/settings.store";
import type { DbRule, DbTag } from "@/types/litechat/rules";

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
    modData: Omit<DbMod, "id" | "createdAt">
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
    implementation?: ToolImplementation<P>
  ) => () => void;

  // Event Bus
  on: <K extends keyof ModEventPayloadMap>(
    eventName: K,
    callback: (payload: ModEventPayloadMap[K]) => void
  ) => () => void;

  // Middleware
  addMiddleware: <H extends ModMiddlewareHookName>(
    hookName: H,
    callback: (
      payload: ModMiddlewarePayloadMap[H]
    ) => ModMiddlewareReturnMap[H] | Promise<ModMiddlewareReturnMap[H]>
  ) => () => void;

  // Settings
  registerSettingsTab: (tab: CustomSettingTab) => () => void;

  // Utilities
  getContextSnapshot: () => ReadonlyChatContextSnapshot;
  showToast: (
    type: "success" | "info" | "warning" | "error",
    message: string
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
  context: ReadonlyChatContextSnapshot & { fsInstance?: any }
) => Promise<any>;

// --- Custom Settings Tab ---

export interface CustomSettingTab {
  id: string;
  title: string;
  component: React.ComponentType;
  order?: number;
}

// --- Event Emitter ---

// Event names changed to dot.case
export const appEvent = {
  loaded: "app.loaded",
} as const;

export const modEvent = {
  loaded: "mod.loaded",
  error: "mod.error",
} as const;

export const conversationEvent = {
  selected: "conversation.selected",
  added: "conversation.added",
  updated: "conversation.updated",
  deleted: "conversation.deleted",
  syncStatusChanged: "conversation.syncStatusChanged",
} as const;

export const projectEvent = {
  selected: "project.selected",
  added: "project.added",
  updated: "project.updated",
  deleted: "project.deleted",
} as const;

export const interactionEvent = {
  started: "interaction.started",
  streamChunk: "interaction.streamChunk",
  completed: "interaction.completed",
  statusChanged: "interaction.statusChanged",
} as const;

export const promptEvent = {
  submitted: "prompt.submitted",
  inputChanged: "prompt.inputChanged",
  paramsChanged: "prompt.paramsChanged",
} as const;

export const settingsEvent = {
  themeChanged: "settings.themeChanged",
  globalSystemPromptChanged: "settings.globalSystemPromptChanged",
  temperatureChanged: "settings.temperatureChanged",
  maxTokensChanged: "settings.maxTokensChanged",
  topPChanged: "settings.topPChanged",
  topKChanged: "settings.topKChanged",
  presencePenaltyChanged: "settings.presencePenaltyChanged",
  frequencyPenaltyChanged: "settings.frequencyPenaltyChanged",
  enableAdvancedSettingsChanged: "settings.enableAdvancedSettingsChanged",
  enableStreamingMarkdownChanged: "settings.enableStreamingMarkdownChanged",
  enableStreamingCodeBlockParsingChanged:
    "settings.enableStreamingCodeBlockParsingChanged",
  foldStreamingCodeBlocksChanged: "settings.foldStreamingCodeBlocksChanged",
  foldUserMessagesOnCompletionChanged:
    "settings.foldUserMessagesOnCompletionChanged",
  streamingRenderFpsChanged: "settings.streamingRenderFpsChanged",
  gitUserNameChanged: "settings.gitUserNameChanged",
  gitUserEmailChanged: "settings.gitUserEmailChanged",
  toolMaxStepsChanged: "settings.toolMaxStepsChanged",
  prismThemeUrlChanged: "settings.prismThemeUrlChanged",
  autoTitleEnabledChanged: "settings.autoTitleEnabledChanged",
  autoTitleModelIdChanged: "settings.autoTitleModelIdChanged",
  autoTitlePromptMaxLengthChanged: "settings.autoTitlePromptMaxLengthChanged",
  autoTitleIncludeFilesChanged: "settings.autoTitleIncludeFilesChanged",
  autoTitleIncludeRulesChanged: "settings.autoTitleIncludeRulesChanged",
  customFontFamilyChanged: "settings.customFontFamilyChanged",
  customFontSizeChanged: "settings.customFontSizeChanged",
  chatMaxWidthChanged: "settings.chatMaxWidthChanged",
  customThemeColorsChanged: "settings.customThemeColorsChanged",
  autoScrollIntervalChanged: "settings.autoScrollIntervalChanged",
  enableAutoScrollOnStreamChanged: "settings.enableAutoScrollOnStreamChanged",
  enableApiKeyManagementChanged: "settings.enableApiKeyManagementChanged",
} as const;

export const providerEvent = {
  configChanged: "provider.configChanged",
  apiKeyChanged: "provider.apiKeyChanged",
  modelSelectionChanged: "provider.modelSelectionChanged",
} as const;

export const vfsEvent = {
  fileWritten: "vfs.fileWritten",
  fileRead: "vfs.fileRead",
  fileDeleted: "vfs.fileDeleted",
  contextChanged: "vfs.contextChanged",
} as const;

export const syncEvent = {
  repoChanged: "sync.repoChanged",
  repoInitStatusChanged: "sync.repoInitStatusChanged",
} as const;

export const inputEvent = {
  attachedFilesChanged: "input.attachedFilesChanged",
} as const;

export const uiEvent = {
  contextChanged: "ui.contextChanged",
} as const;

export const rulesEvent = {
  rulesLoaded: "rules.rulesLoaded",
  tagsLoaded: "rules.tagsLoaded",
  linksLoaded: "rules.linksLoaded",
  ruleSaved: "rules.ruleSaved",
  ruleDeleted: "rules.ruleDeleted",
  tagSaved: "rules.tagSaved",
  tagDeleted: "rules.tagDeleted",
  linkSaved: "rules.linkSaved",
  linkDeleted: "rules.linkDeleted",
} as const;

// Combine all event types into a single map
// Keys updated to dot.case
export type ModEventPayloadMap = {
  // App
  [appEvent.loaded]: undefined;
  // Mod
  [modEvent.loaded]: { id: string; name: string };
  [modEvent.error]: { id: string; name: string; error: Error | string };
  // Conversation
  [conversationEvent.selected]: { conversationId: string | null };
  [conversationEvent.added]: { conversation: Conversation };
  [conversationEvent.updated]: {
    conversationId: string;
    updates: Partial<Conversation>;
  };
  [conversationEvent.deleted]: { conversationId: string };
  [conversationEvent.syncStatusChanged]: {
    conversationId: string;
    status: SyncStatus;
  };
  // Project
  [projectEvent.selected]: { projectId: string | null };
  [projectEvent.added]: { project: Project };
  [projectEvent.updated]: { projectId: string; updates: Partial<Project> };
  [projectEvent.deleted]: { projectId: string };
  // Interaction
  [interactionEvent.started]: {
    interactionId: string;
    conversationId: string;
    type: string;
  };
  [interactionEvent.streamChunk]: { interactionId: string; chunk: string };
  [interactionEvent.completed]: {
    interactionId: string;
    status: Interaction["status"];
    error?: string;
    toolCalls?: ToolCallPart[];
    toolResults?: ToolResultPart[];
  };
  [interactionEvent.statusChanged]: { status: InteractionState["status"] };
  // Prompt
  [promptEvent.submitted]: { turnData: PromptTurnObject };
  [promptEvent.inputChanged]: { value: string };
  [promptEvent.paramsChanged]: { params: Partial<PromptState> };
  // Settings (Specific)
  [settingsEvent.themeChanged]: {
    theme: SettingsState["theme"];
  };
  [settingsEvent.globalSystemPromptChanged]: {
    prompt: SettingsState["globalSystemPrompt"];
  };
  [settingsEvent.temperatureChanged]: {
    value: SettingsState["temperature"];
  };
  [settingsEvent.maxTokensChanged]: {
    value: SettingsState["maxTokens"];
  };
  [settingsEvent.topPChanged]: {
    value: SettingsState["topP"];
  };
  [settingsEvent.topKChanged]: {
    value: SettingsState["topK"];
  };
  [settingsEvent.presencePenaltyChanged]: {
    value: SettingsState["presencePenalty"];
  };
  [settingsEvent.frequencyPenaltyChanged]: {
    value: SettingsState["frequencyPenalty"];
  };
  [settingsEvent.enableAdvancedSettingsChanged]: {
    enabled: SettingsState["enableAdvancedSettings"];
  };
  [settingsEvent.enableStreamingMarkdownChanged]: {
    enabled: SettingsState["enableStreamingMarkdown"];
  };
  [settingsEvent.enableStreamingCodeBlockParsingChanged]: {
    enabled: SettingsState["enableStreamingCodeBlockParsing"];
  };
  [settingsEvent.foldStreamingCodeBlocksChanged]: {
    fold: SettingsState["foldStreamingCodeBlocks"];
  };
  [settingsEvent.foldUserMessagesOnCompletionChanged]: {
    fold: SettingsState["foldUserMessagesOnCompletion"];
  };
  [settingsEvent.streamingRenderFpsChanged]: {
    fps: SettingsState["streamingRenderFPS"];
  };
  [settingsEvent.gitUserNameChanged]: {
    name: SettingsState["gitUserName"];
  };
  [settingsEvent.gitUserEmailChanged]: {
    email: SettingsState["gitUserEmail"];
  };
  [settingsEvent.toolMaxStepsChanged]: {
    steps: SettingsState["toolMaxSteps"];
  };
  [settingsEvent.prismThemeUrlChanged]: {
    url: SettingsState["prismThemeUrl"];
  };
  [settingsEvent.autoTitleEnabledChanged]: {
    enabled: SettingsState["autoTitleEnabled"];
  };
  [settingsEvent.autoTitleModelIdChanged]: {
    modelId: SettingsState["autoTitleModelId"];
  };
  [settingsEvent.autoTitlePromptMaxLengthChanged]: {
    length: SettingsState["autoTitlePromptMaxLength"];
  };
  [settingsEvent.autoTitleIncludeFilesChanged]: {
    include: SettingsState["autoTitleIncludeFiles"];
  };
  [settingsEvent.autoTitleIncludeRulesChanged]: {
    include: SettingsState["autoTitleIncludeRules"];
  };
  [settingsEvent.customFontFamilyChanged]: {
    fontFamily: SettingsState["customFontFamily"];
  };
  [settingsEvent.customFontSizeChanged]: {
    fontSize: SettingsState["customFontSize"];
  };
  [settingsEvent.chatMaxWidthChanged]: {
    maxWidth: SettingsState["chatMaxWidth"];
  };
  [settingsEvent.customThemeColorsChanged]: {
    colors: SettingsState["customThemeColors"];
  };
  [settingsEvent.autoScrollIntervalChanged]: {
    interval: SettingsState["autoScrollInterval"];
  };
  [settingsEvent.enableAutoScrollOnStreamChanged]: {
    enabled: SettingsState["enableAutoScrollOnStream"];
  };
  [settingsEvent.enableApiKeyManagementChanged]: {
    enabled: boolean;
  };
  // Provider
  [providerEvent.configChanged]: {
    providerId: string;
    config: DbProviderConfig;
  };
  [providerEvent.apiKeyChanged]: {
    keyId: string;
    action: "added" | "deleted";
  };
  [providerEvent.modelSelectionChanged]: { modelId: string | null };
  // VFS
  [vfsEvent.fileWritten]: { path: string };
  [vfsEvent.fileRead]: { path: string };
  [vfsEvent.fileDeleted]: { path: string };
  [vfsEvent.contextChanged]: { vfsKey: string | null };
  // Sync
  [syncEvent.repoChanged]: {
    repoId: string;
    action: "added" | "updated" | "deleted";
  };
  [syncEvent.repoInitStatusChanged]: { repoId: string; status: SyncStatus };
  // Input
  [inputEvent.attachedFilesChanged]: { files: AttachedFileMetadata[] };
  // UI
  [uiEvent.contextChanged]: {
    selectedItemId: string | null;
    selectedItemType: SidebarItemType | null;
  };
  // Rules & Tags
  [rulesEvent.rulesLoaded]: { rules: DbRule[] };
  [rulesEvent.tagsLoaded]: { tags: DbTag[] };
  [rulesEvent.linksLoaded]: { links: any[] };
  [rulesEvent.ruleSaved]: { rule: DbRule };
  [rulesEvent.ruleDeleted]: { ruleId: string };
  [rulesEvent.tagSaved]: { tag: DbTag };
  [rulesEvent.tagDeleted]: { tagId: string };
  [rulesEvent.linkSaved]: { link: any };
  [rulesEvent.linkDeleted]: { linkId: string };
};

// --- Middleware ---

/** Defines the names of available middleware hooks */
// Changed to dot.case
export enum ModMiddlewareHook {
  PROMPT_TURN_FINALIZE = "middleware.prompt.turnFinalize",
  INTERACTION_BEFORE_START = "middleware.interaction.beforeStart",
  INTERACTION_PROCESS_CHUNK = "middleware.interaction.processChunk",
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
interface BaseControl {
  id: string;
  status?: () => "ready" | "loading" | "error";
  // show removed from ModPromptControl as per plan
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
  show?: () => boolean; // Kept for ChatControl
}
