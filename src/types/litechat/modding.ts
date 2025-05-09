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
import type { SettingsState } from "@/store/settings.store"; // Added for settings events
import type { DbRule, DbTag } from "@/types/litechat/rules"; // Added for rules/tags events
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
  registerPromptControl: (control: PromptControl) => () => void;
  registerChatControl: (control: ChatControl) => () => void;

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
  context: ReadonlyChatContextSnapshot & { fsInstance?: any } // Allow fsInstance for VFS tools
) => Promise<any>;

// --- Custom Settings Tab ---

export interface CustomSettingTab {
  id: string;
  title: string;
  component: React.ComponentType;
  order?: number;
}

// --- Event Emitter ---

// Replace Enum with string constants using dot-notation
export const AppEvent = {
  LOADED: "app.loaded",
} as const;

export const ModEvent = {
  LOADED: "mod.loaded",
  ERROR: "mod.error",
} as const;

export const ConversationEvent = {
  SELECTED: "conversation.selected",
  ADDED: "conversation.added",
  UPDATED: "conversation.updated",
  DELETED: "conversation.deleted",
  SYNC_STATUS_CHANGED: "conversation.syncStatusChanged",
} as const;

export const ProjectEvent = {
  SELECTED: "project.selected",
  ADDED: "project.added",
  UPDATED: "project.updated",
  DELETED: "project.deleted",
} as const;

export const InteractionEvent = {
  STARTED: "interaction.started",
  STREAM_CHUNK: "interaction.streamChunk",
  COMPLETED: "interaction.completed",
  STATUS_CHANGED: "interaction.statusChanged",
} as const;

export const PromptEvent = {
  SUBMITTED: "prompt.submitted",
  INPUT_CHANGED: "prompt.inputChanged",
  PARAMS_CHANGED: "prompt.paramsChanged",
} as const;

export const SettingsEvent = {
  // Specific settings changes
  THEME_CHANGED: "settings.themeChanged",
  GLOBAL_SYSTEM_PROMPT_CHANGED: "settings.globalSystemPromptChanged",
  TEMPERATURE_CHANGED: "settings.temperatureChanged",
  MAX_TOKENS_CHANGED: "settings.maxTokensChanged",
  TOP_P_CHANGED: "settings.topPChanged",
  TOP_K_CHANGED: "settings.topKChanged",
  PRESENCE_PENALTY_CHANGED: "settings.presencePenaltyChanged",
  FREQUENCY_PENALTY_CHANGED: "settings.frequencyPenaltyChanged",
  ENABLE_ADVANCED_SETTINGS_CHANGED: "settings.enableAdvancedSettingsChanged",
  ENABLE_STREAMING_MARKDOWN_CHANGED: "settings.enableStreamingMarkdownChanged",
  ENABLE_STREAMING_CODE_BLOCK_PARSING_CHANGED:
    "settings.enableStreamingCodeBlockParsingChanged",
  FOLD_STREAMING_CODE_BLOCKS_CHANGED: "settings.foldStreamingCodeBlocksChanged",
  FOLD_USER_MESSAGES_ON_COMPLETION_CHANGED:
    "settings.foldUserMessagesOnCompletionChanged",
  STREAMING_RENDER_FPS_CHANGED: "settings.streamingRenderFpsChanged",
  GIT_USER_NAME_CHANGED: "settings.gitUserNameChanged",
  GIT_USER_EMAIL_CHANGED: "settings.gitUserEmailChanged",
  TOOL_MAX_STEPS_CHANGED: "settings.toolMaxStepsChanged",
  PRISM_THEME_URL_CHANGED: "settings.prismThemeUrlChanged",
  AUTO_TITLE_ENABLED_CHANGED: "settings.autoTitleEnabledChanged",
  AUTO_TITLE_MODEL_ID_CHANGED: "settings.autoTitleModelIdChanged",
  AUTO_TITLE_PROMPT_MAX_LENGTH_CHANGED:
    "settings.autoTitlePromptMaxLengthChanged",
  AUTO_TITLE_INCLUDE_FILES_CHANGED: "settings.autoTitleIncludeFilesChanged",
  AUTO_TITLE_INCLUDE_RULES_CHANGED: "settings.autoTitleIncludeRulesChanged",
  CUSTOM_FONT_FAMILY_CHANGED: "settings.customFontFamilyChanged",
  CUSTOM_FONT_SIZE_CHANGED: "settings.customFontSizeChanged",
  CHAT_MAX_WIDTH_CHANGED: "settings.chatMaxWidthChanged",
  CUSTOM_THEME_COLORS_CHANGED: "settings.customThemeColorsChanged",
  AUTO_SCROLL_INTERVAL_CHANGED: "settings.autoScrollIntervalChanged",
  ENABLE_AUTO_SCROLL_ON_STREAM_CHANGED:
    "settings.enableAutoScrollOnStreamChanged",
  ENABLE_API_KEY_MANAGEMENT_CHANGED: "settings.enableApiKeyManagementChanged",
} as const;

export const ProviderEvent = {
  CONFIG_CHANGED: "provider.configChanged",
  API_KEY_CHANGED: "provider.apiKeyChanged",
  MODEL_SELECTION_CHANGED: "provider.modelSelectionChanged",
} as const;

export const VfsEvent = {
  FILE_WRITTEN: "vfs.fileWritten",
  FILE_READ: "vfs.fileRead",
  FILE_DELETED: "vfs.fileDeleted",
  CONTEXT_CHANGED: "vfs.contextChanged",
} as const;

export const SyncEvent = {
  REPO_CHANGED: "sync.repoChanged",
  REPO_INIT_STATUS_CHANGED: "sync.repoInitStatusChanged",
} as const;

export const InputEvent = {
  ATTACHED_FILES_CHANGED: "input.attachedFilesChanged",
} as const;

export const UiEvent = {
  CONTEXT_CHANGED: "ui.contextChanged",
} as const;

export const RulesEvent = {
  RULES_LOADED: "rules.rulesLoaded",
  TAGS_LOADED: "rules.tagsLoaded",
  LINKS_LOADED: "rules.linksLoaded",
  RULE_SAVED: "rules.ruleSaved",
  RULE_DELETED: "rules.ruleDeleted",
  TAG_SAVED: "rules.tagSaved",
  TAG_DELETED: "rules.tagDeleted",
  LINK_SAVED: "rules.linkSaved",
  LINK_DELETED: "rules.linkDeleted",
} as const;

// Combine all event types into a single map
export type ModEventPayloadMap = {
  // App
  [AppEvent.LOADED]: undefined;
  // Mod
  [ModEvent.LOADED]: { id: string; name: string };
  [ModEvent.ERROR]: { id: string; name: string; error: Error | string };
  // Conversation
  [ConversationEvent.SELECTED]: { conversationId: string | null };
  [ConversationEvent.ADDED]: { conversation: Conversation };
  [ConversationEvent.UPDATED]: {
    conversationId: string;
    updates: Partial<Conversation>;
  };
  [ConversationEvent.DELETED]: { conversationId: string };
  [ConversationEvent.SYNC_STATUS_CHANGED]: {
    conversationId: string;
    status: SyncStatus;
  };
  // Project
  [ProjectEvent.SELECTED]: { projectId: string | null };
  [ProjectEvent.ADDED]: { project: Project };
  [ProjectEvent.UPDATED]: { projectId: string; updates: Partial<Project> };
  [ProjectEvent.DELETED]: { projectId: string };
  // Interaction
  [InteractionEvent.STARTED]: {
    interactionId: string;
    conversationId: string;
    type: string;
  };
  [InteractionEvent.STREAM_CHUNK]: { interactionId: string; chunk: string };
  [InteractionEvent.COMPLETED]: {
    interactionId: string;
    status: Interaction["status"];
    error?: string;
    toolCalls?: ToolCallPart[];
    toolResults?: ToolResultPart[];
  };
  [InteractionEvent.STATUS_CHANGED]: { status: InteractionState["status"] };
  // Prompt
  [PromptEvent.SUBMITTED]: { turnData: PromptTurnObject };
  [PromptEvent.INPUT_CHANGED]: { value: string };
  [PromptEvent.PARAMS_CHANGED]: { params: Partial<PromptState> };
  // Settings (Specific)
  [SettingsEvent.THEME_CHANGED]: {
    theme: SettingsState["theme"];
  };
  [SettingsEvent.GLOBAL_SYSTEM_PROMPT_CHANGED]: {
    prompt: SettingsState["globalSystemPrompt"];
  };
  [SettingsEvent.TEMPERATURE_CHANGED]: {
    value: SettingsState["temperature"];
  };
  [SettingsEvent.MAX_TOKENS_CHANGED]: {
    value: SettingsState["maxTokens"];
  };
  [SettingsEvent.TOP_P_CHANGED]: {
    value: SettingsState["topP"];
  };
  [SettingsEvent.TOP_K_CHANGED]: {
    value: SettingsState["topK"];
  };
  [SettingsEvent.PRESENCE_PENALTY_CHANGED]: {
    value: SettingsState["presencePenalty"];
  };
  [SettingsEvent.FREQUENCY_PENALTY_CHANGED]: {
    value: SettingsState["frequencyPenalty"];
  };
  [SettingsEvent.ENABLE_ADVANCED_SETTINGS_CHANGED]: {
    enabled: SettingsState["enableAdvancedSettings"];
  };
  [SettingsEvent.ENABLE_STREAMING_MARKDOWN_CHANGED]: {
    enabled: SettingsState["enableStreamingMarkdown"];
  };
  [SettingsEvent.ENABLE_STREAMING_CODE_BLOCK_PARSING_CHANGED]: {
    enabled: SettingsState["enableStreamingCodeBlockParsing"];
  };
  [SettingsEvent.FOLD_STREAMING_CODE_BLOCKS_CHANGED]: {
    fold: SettingsState["foldStreamingCodeBlocks"];
  };
  [SettingsEvent.FOLD_USER_MESSAGES_ON_COMPLETION_CHANGED]: {
    fold: SettingsState["foldUserMessagesOnCompletion"];
  };
  [SettingsEvent.STREAMING_RENDER_FPS_CHANGED]: {
    fps: SettingsState["streamingRenderFPS"];
  };
  [SettingsEvent.GIT_USER_NAME_CHANGED]: {
    name: SettingsState["gitUserName"];
  };
  [SettingsEvent.GIT_USER_EMAIL_CHANGED]: {
    email: SettingsState["gitUserEmail"];
  };
  [SettingsEvent.TOOL_MAX_STEPS_CHANGED]: {
    steps: SettingsState["toolMaxSteps"];
  };
  [SettingsEvent.PRISM_THEME_URL_CHANGED]: {
    url: SettingsState["prismThemeUrl"];
  };
  [SettingsEvent.AUTO_TITLE_ENABLED_CHANGED]: {
    enabled: SettingsState["autoTitleEnabled"];
  };
  [SettingsEvent.AUTO_TITLE_MODEL_ID_CHANGED]: {
    modelId: SettingsState["autoTitleModelId"];
  };
  [SettingsEvent.AUTO_TITLE_PROMPT_MAX_LENGTH_CHANGED]: {
    length: SettingsState["autoTitlePromptMaxLength"];
  };
  [SettingsEvent.AUTO_TITLE_INCLUDE_FILES_CHANGED]: {
    include: SettingsState["autoTitleIncludeFiles"];
  };
  [SettingsEvent.AUTO_TITLE_INCLUDE_RULES_CHANGED]: {
    include: SettingsState["autoTitleIncludeRules"];
  };
  [SettingsEvent.CUSTOM_FONT_FAMILY_CHANGED]: {
    fontFamily: SettingsState["customFontFamily"];
  };
  [SettingsEvent.CUSTOM_FONT_SIZE_CHANGED]: {
    fontSize: SettingsState["customFontSize"];
  };
  [SettingsEvent.CHAT_MAX_WIDTH_CHANGED]: {
    maxWidth: SettingsState["chatMaxWidth"];
  };
  [SettingsEvent.CUSTOM_THEME_COLORS_CHANGED]: {
    colors: SettingsState["customThemeColors"];
  };
  [SettingsEvent.AUTO_SCROLL_INTERVAL_CHANGED]: {
    interval: SettingsState["autoScrollInterval"];
  };
  [SettingsEvent.ENABLE_AUTO_SCROLL_ON_STREAM_CHANGED]: {
    enabled: SettingsState["enableAutoScrollOnStream"];
  };
  [SettingsEvent.ENABLE_API_KEY_MANAGEMENT_CHANGED]: {
    enabled: boolean;
  };
  // Provider
  [ProviderEvent.CONFIG_CHANGED]: {
    providerId: string;
    config: DbProviderConfig;
  };
  [ProviderEvent.API_KEY_CHANGED]: {
    keyId: string;
    action: "added" | "deleted";
  };
  [ProviderEvent.MODEL_SELECTION_CHANGED]: { modelId: string | null };
  // VFS
  [VfsEvent.FILE_WRITTEN]: { path: string };
  [VfsEvent.FILE_READ]: { path: string };
  [VfsEvent.FILE_DELETED]: { path: string };
  [VfsEvent.CONTEXT_CHANGED]: { vfsKey: string | null };
  // Sync
  [SyncEvent.REPO_CHANGED]: {
    repoId: string;
    action: "added" | "updated" | "deleted";
  };
  [SyncEvent.REPO_INIT_STATUS_CHANGED]: { repoId: string; status: SyncStatus };
  // Input
  [InputEvent.ATTACHED_FILES_CHANGED]: { files: AttachedFileMetadata[] };
  // UI
  [UiEvent.CONTEXT_CHANGED]: {
    selectedItemId: string | null;
    selectedItemType: SidebarItemType | null;
  };
  // Rules & Tags
  [RulesEvent.RULES_LOADED]: { rules: DbRule[] };
  [RulesEvent.TAGS_LOADED]: { tags: DbTag[] };
  [RulesEvent.LINKS_LOADED]: { links: any[] }; // Replace any with DbTagRuleLink if available
  [RulesEvent.RULE_SAVED]: { rule: DbRule };
  [RulesEvent.RULE_DELETED]: { ruleId: string };
  [RulesEvent.TAG_SAVED]: { tag: DbTag };
  [RulesEvent.TAG_DELETED]: { tagId: string };
  [RulesEvent.LINK_SAVED]: { link: any }; // Replace any with DbTagRuleLink
  [RulesEvent.LINK_DELETED]: { linkId: string };
};

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
  // Corrected: Renderer types to match CoreChatControl
  renderer?: () => React.ReactElement | null;
  iconRenderer?: () => React.ReactElement | null;
  settingsRenderer?: () => React.ReactElement | null;
}
