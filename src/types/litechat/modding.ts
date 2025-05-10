// src/types/litechat/modding.ts
// FULL FILE
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

// Import decentralized event constants
import { appEvent } from "./events/app.events";
import { modEvent } from "./events/mod.events";
import { conversationEvent } from "./events/conversation.events";
import { projectEvent } from "./events/project.events";
import { interactionEvent } from "./events/interaction.events";
import { promptEvent } from "./events/prompt.events";
import { settingsEvent } from "./events/settings.events";
import { providerEvent } from "./events/provider.events";
import { vfsEvent } from "./events/vfs.events";
import { syncEvent } from "./events/sync.events";
import { inputEvent } from "./events/input.events";
import { uiEvent } from "./events/ui.events";
import { rulesEvent } from "./events/rules.events";
import { PromptTurnObject } from "./prompt";

// Import middleware types
import {
  type ModMiddlewareHookName,
  type ModMiddlewarePayloadMap,
  type ModMiddlewareReturnMap,
} from "./middleware.types";

// Re-export middleware types for convenience if needed by mods
export type {
  ModMiddlewareHookName,
  ModMiddlewarePayloadMap,
  ModMiddlewareReturnMap,
};
export { ModMiddlewareHook } from "./middleware.types";

// --- Mod Definition & Instance ---
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

export interface LiteChatModApi {
  readonly modId: string;
  readonly modName: string;
  registerPromptControl: (control: ModPromptControl) => () => void;
  registerChatControl: (control: ModChatControl) => () => void;
  registerTool: <P extends z.ZodSchema<any>>(
    toolName: string,
    definition: Tool<P>,
    implementation?: ToolImplementation<P>
  ) => () => void;
  on: <K extends keyof ModEventPayloadMap>(
    eventName: K,
    callback: (payload: ModEventPayloadMap[K]) => void
  ) => () => void;
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
}

// --- Tool Implementation ---
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

// --- Event Emitter Payload Map ---
export type ModEventPayloadMap = {
  [appEvent.loaded]: undefined;
  [modEvent.loaded]: { id: string; name: string };
  [modEvent.error]: { id: string; name: string; error: Error | string };
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
  [projectEvent.selected]: { projectId: string | null };
  [projectEvent.added]: { project: Project };
  [projectEvent.updated]: { projectId: string; updates: Partial<Project> };
  [projectEvent.deleted]: { projectId: string };
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
  [promptEvent.submitted]: { turnData: PromptTurnObject };
  [promptEvent.inputChanged]: { value: string };
  [promptEvent.paramsChanged]: { params: Partial<PromptState> };
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
  [providerEvent.configChanged]: {
    providerId: string;
    config: DbProviderConfig;
  };
  [providerEvent.apiKeyChanged]: {
    keyId: string;
    action: "added" | "deleted";
  };
  [providerEvent.modelSelectionChanged]: { modelId: string | null };
  [vfsEvent.fileWritten]: { path: string };
  [vfsEvent.fileRead]: { path: string };
  [vfsEvent.fileDeleted]: { path: string };
  [vfsEvent.contextChanged]: { vfsKey: string | null };
  [syncEvent.repoChanged]: {
    repoId: string;
    action: "added" | "updated" | "deleted";
  };
  [syncEvent.repoInitStatusChanged]: { repoId: string; status: SyncStatus };
  [inputEvent.attachedFilesChanged]: { files: AttachedFileMetadata[] };
  [uiEvent.contextChanged]: {
    selectedItemId: string | null;
    selectedItemType: SidebarItemType | null;
  };
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

// --- Controls ---
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
