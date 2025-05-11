// src/types/litechat/modding.ts
// FULL FILE
import type { Interaction } from "./interaction";
import type { Tool, ToolCallPart, ToolResultPart } from "ai";
import type { z } from "zod";
import type { Conversation, SidebarItemType } from "./chat";
import type { Project } from "./project";
import type { DbProviderConfig, DbApiKey, ModelListItem } from "./provider";
import type { SyncRepo, SyncStatus } from "./sync";
import type { AttachedFileMetadata } from "@/store/input.store";
import type { PromptState } from "@/store/prompt.store";
import type { InteractionState } from "@/store/interaction.store";
import type { SettingsState, CustomThemeColors } from "@/store/settings.store";
import type { DbRule, DbTag, DbTagRuleLink } from "@/types/litechat/rules";
import type { PromptTurnObject } from "./prompt";
import type { VfsNode } from "./vfs";
import type { fs } from "@zenfs/core";
import type {
  ControlState,
  PromptControl as CorePromptControlAliased,
  ChatControl as CoreChatControlAliased,
} from "./control";

// Import ALL new event constants
import { appEvent } from "./events/app.events";
import { settingsStoreEvent } from "./events/settings.events";
import { providerStoreEvent } from "./events/provider.events";
import { rulesStoreEvent } from "./events/rules.events";
import { conversationStoreEvent } from "./events/conversation.events";
import { projectStoreEvent } from "./events/project.events";
import { interactionStoreEvent } from "./events/interaction.events";
import { inputStoreEvent } from "./events/input.events";
import { promptStoreEvent } from "./events/prompt.events";
import { modStoreEvent } from "./events/mod.events";
import { uiEvent } from "./events/ui.events";
import { vfsStoreEvent } from "./events/vfs.events";
import { syncStoreEvent } from "./events/sync.events";
import { controlRegistryStoreEvent } from "./events/control.registry.events";

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
  error?: Error | string | null;
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
  readonly theme: SettingsState["theme"];
  readonly gitUserName: string | null;
  readonly gitUserEmail: string | null;
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

// --- Tool Implementation ---
export type ToolImplementation<P extends z.ZodSchema<any>> = (
  params: z.infer<P>,
  context: ReadonlyChatContextSnapshot & { fsInstance?: typeof fs }
) => Promise<any>;

// --- Custom Settings Tab ---
export interface CustomSettingTab {
  id: string;
  title: string;
  component: React.ComponentType<any>;
  order?: number;
}

// --- Modal Provider (For Phase 4) ---
export interface ModalProviderProps<P = any> {
  isOpen: boolean;
  onClose: () => void;
  modalProps?: P;
  targetId?: string | null;
  initialTab?: string | null;
  initialSubTab?: string | null;
}
export type ModalProvider<P = any> = React.ComponentType<ModalProviderProps<P>>;

// --- Event Emitter Payload Map ---
// This map should now correctly reference the event constants.
export type ModEventPayloadMap = {
  // App Events
  [appEvent.loaded]: undefined;
  [appEvent.errorBoundaryTriggered]: {
    error: Error;
    errorInfo: React.ErrorInfo;
  };
  [appEvent.initializationPhaseCompleted]: {
    phase:
      | "coreData"
      | "controlModulesInit"
      | "controlModulesRegister"
      | "externalMods"
      | "uiStateSync"
      | "all";
  };

  // Settings Store Events
  [settingsStoreEvent.loaded]: { settings: SettingsState };
  [settingsStoreEvent.themeChanged]: { theme: SettingsState["theme"] };
  [settingsStoreEvent.globalSystemPromptChanged]: {
    prompt: SettingsState["globalSystemPrompt"];
  };
  [settingsStoreEvent.temperatureChanged]: {
    value: SettingsState["temperature"];
  };
  [settingsStoreEvent.maxTokensChanged]: { value: SettingsState["maxTokens"] };
  [settingsStoreEvent.topPChanged]: { value: SettingsState["topP"] };
  [settingsStoreEvent.topKChanged]: { value: SettingsState["topK"] };
  [settingsStoreEvent.presencePenaltyChanged]: {
    value: SettingsState["presencePenalty"];
  };
  [settingsStoreEvent.frequencyPenaltyChanged]: {
    value: SettingsState["frequencyPenalty"];
  };
  [settingsStoreEvent.enableAdvancedSettingsChanged]: {
    enabled: SettingsState["enableAdvancedSettings"];
  };
  [settingsStoreEvent.enableStreamingMarkdownChanged]: {
    enabled: SettingsState["enableStreamingMarkdown"];
  };
  [settingsStoreEvent.enableStreamingCodeBlockParsingChanged]: {
    enabled: SettingsState["enableStreamingCodeBlockParsing"];
  };
  [settingsStoreEvent.foldStreamingCodeBlocksChanged]: {
    fold: SettingsState["foldStreamingCodeBlocks"];
  };
  [settingsStoreEvent.foldUserMessagesOnCompletionChanged]: {
    fold: SettingsState["foldUserMessagesOnCompletion"];
  };
  [settingsStoreEvent.streamingRenderFpsChanged]: {
    fps: SettingsState["streamingRenderFPS"];
  };
  [settingsStoreEvent.gitUserNameChanged]: {
    name: SettingsState["gitUserName"];
  };
  [settingsStoreEvent.gitUserEmailChanged]: {
    email: SettingsState["gitUserEmail"];
  };
  [settingsStoreEvent.toolMaxStepsChanged]: {
    steps: SettingsState["toolMaxSteps"];
  };
  [settingsStoreEvent.prismThemeUrlChanged]: {
    url: SettingsState["prismThemeUrl"];
  };
  [settingsStoreEvent.autoTitleEnabledChanged]: {
    enabled: SettingsState["autoTitleEnabled"];
  };
  [settingsStoreEvent.autoTitleModelIdChanged]: {
    modelId: SettingsState["autoTitleModelId"];
  };
  [settingsStoreEvent.autoTitlePromptMaxLengthChanged]: {
    length: SettingsState["autoTitlePromptMaxLength"];
  };
  [settingsStoreEvent.autoTitleIncludeFilesChanged]: {
    include: SettingsState["autoTitleIncludeFiles"];
  };
  [settingsStoreEvent.autoTitleIncludeRulesChanged]: {
    include: SettingsState["autoTitleIncludeRules"];
  };
  [settingsStoreEvent.customFontFamilyChanged]: {
    fontFamily: SettingsState["customFontFamily"];
  };
  [settingsStoreEvent.customFontSizeChanged]: {
    fontSize: SettingsState["customFontSize"];
  };
  [settingsStoreEvent.chatMaxWidthChanged]: {
    maxWidth: SettingsState["chatMaxWidth"];
  };
  [settingsStoreEvent.customThemeColorsChanged]: {
    colors: SettingsState["customThemeColors"];
  };
  [settingsStoreEvent.autoScrollIntervalChanged]: {
    interval: SettingsState["autoScrollInterval"];
  };
  [settingsStoreEvent.enableAutoScrollOnStreamChanged]: {
    enabled: SettingsState["enableAutoScrollOnStream"];
  };
  [settingsStoreEvent.enableApiKeyManagementChanged]: { enabled: boolean };

  // Settings Store Action Requests
  [settingsStoreEvent.setThemeRequest]: { theme: SettingsState["theme"] };
  [settingsStoreEvent.setGlobalSystemPromptRequest]: {
    prompt: SettingsState["globalSystemPrompt"];
  };
  [settingsStoreEvent.setTemperatureRequest]: {
    value: SettingsState["temperature"];
  };
  [settingsStoreEvent.setMaxTokensRequest]: {
    value: SettingsState["maxTokens"];
  };
  [settingsStoreEvent.setTopPRequest]: { value: SettingsState["topP"] };
  [settingsStoreEvent.setTopKRequest]: { value: SettingsState["topK"] };
  [settingsStoreEvent.setPresencePenaltyRequest]: {
    value: SettingsState["presencePenalty"];
  };
  [settingsStoreEvent.setFrequencyPenaltyRequest]: {
    value: SettingsState["frequencyPenalty"];
  };
  [settingsStoreEvent.setEnableAdvancedSettingsRequest]: {
    enabled: SettingsState["enableAdvancedSettings"];
  };
  [settingsStoreEvent.setEnableStreamingMarkdownRequest]: {
    enabled: SettingsState["enableStreamingMarkdown"];
  };
  [settingsStoreEvent.setEnableStreamingCodeBlockParsingRequest]: {
    enabled: SettingsState["enableStreamingCodeBlockParsing"];
  };
  [settingsStoreEvent.setFoldStreamingCodeBlocksRequest]: {
    fold: SettingsState["foldStreamingCodeBlocks"];
  };
  [settingsStoreEvent.setFoldUserMessagesOnCompletionRequest]: {
    fold: SettingsState["foldUserMessagesOnCompletion"];
  };
  [settingsStoreEvent.setStreamingRenderFpsRequest]: {
    fps: SettingsState["streamingRenderFPS"];
  };
  [settingsStoreEvent.setGitUserNameRequest]: {
    name: SettingsState["gitUserName"];
  };
  [settingsStoreEvent.setGitUserEmailRequest]: {
    email: SettingsState["gitUserEmail"];
  };
  [settingsStoreEvent.setToolMaxStepsRequest]: {
    steps: SettingsState["toolMaxSteps"];
  };
  [settingsStoreEvent.setPrismThemeUrlRequest]: {
    url: SettingsState["prismThemeUrl"];
  };
  [settingsStoreEvent.setAutoTitleEnabledRequest]: {
    enabled: SettingsState["autoTitleEnabled"];
  };
  [settingsStoreEvent.setAutoTitleModelIdRequest]: {
    modelId: SettingsState["autoTitleModelId"];
  };
  [settingsStoreEvent.setAutoTitlePromptMaxLengthRequest]: {
    length: SettingsState["autoTitlePromptMaxLength"];
  };
  [settingsStoreEvent.setAutoTitleIncludeFilesRequest]: {
    include: SettingsState["autoTitleIncludeFiles"];
  };
  [settingsStoreEvent.setAutoTitleIncludeRulesRequest]: {
    include: SettingsState["autoTitleIncludeRules"];
  };
  [settingsStoreEvent.setCustomFontFamilyRequest]: {
    fontFamily: SettingsState["customFontFamily"];
  };
  [settingsStoreEvent.setCustomFontSizeRequest]: {
    fontSize: SettingsState["customFontSize"];
  };
  [settingsStoreEvent.setChatMaxWidthRequest]: {
    maxWidth: SettingsState["chatMaxWidth"];
  };
  [settingsStoreEvent.setCustomThemeColorsRequest]: {
    colors: SettingsState["customThemeColors"];
  };
  [settingsStoreEvent.setCustomThemeColorRequest]: {
    colorKey: keyof CustomThemeColors;
    value: string | null;
  };
  [settingsStoreEvent.setAutoScrollIntervalRequest]: {
    interval: SettingsState["autoScrollInterval"];
  };
  [settingsStoreEvent.setEnableAutoScrollOnStreamRequest]: {
    enabled: SettingsState["enableAutoScrollOnStream"];
  };
  [settingsStoreEvent.setEnableApiKeyManagementRequest]: { enabled: boolean };
  [settingsStoreEvent.loadSettingsRequest]: undefined;
  [settingsStoreEvent.resetGeneralSettingsRequest]: undefined;
  [settingsStoreEvent.resetAssistantSettingsRequest]: undefined;
  [settingsStoreEvent.resetThemeSettingsRequest]: undefined;

  // Provider Store Events
  [providerStoreEvent.initialDataLoaded]: {
    configs: DbProviderConfig[];
    apiKeys: DbApiKey[];
    selectedModelId: string | null;
    globalSortOrder: string[];
  };
  [providerStoreEvent.configsChanged]: { providerConfigs: DbProviderConfig[] };
  [providerStoreEvent.apiKeysChanged]: { apiKeys: DbApiKey[] };
  [providerStoreEvent.selectedModelChanged]: { modelId: string | null };
  [providerStoreEvent.globalModelSortOrderChanged]: { ids: string[] };
  [providerStoreEvent.fetchStatusChanged]: {
    providerId: string;
    status: "idle" | "fetching" | "error" | "success";
  };
  [providerStoreEvent.globallyEnabledModelsUpdated]: {
    models: ModelListItem[];
  };
  [providerStoreEvent.selectedModelForDetailsChanged]: {
    modelId: string | null;
  };
  [providerStoreEvent.enableApiKeyManagementChanged]: { enabled: boolean };

  // Provider Store Action Requests
  [providerStoreEvent.loadInitialDataRequest]: undefined;
  [providerStoreEvent.selectModelRequest]: { modelId: string | null };
  [providerStoreEvent.addApiKeyRequest]: {
    name: string;
    providerId: string;
    value: string;
  };
  [providerStoreEvent.deleteApiKeyRequest]: { id: string };
  [providerStoreEvent.addProviderConfigRequest]: Omit<
    DbProviderConfig,
    "id" | "createdAt" | "updatedAt"
  >;
  [providerStoreEvent.updateProviderConfigRequest]: {
    id: string;
    changes: Partial<DbProviderConfig>;
  };
  [providerStoreEvent.deleteProviderConfigRequest]: { id: string };
  [providerStoreEvent.fetchModelsRequest]: { providerConfigId: string };
  [providerStoreEvent.setGlobalModelSortOrderRequest]: { ids: string[] };
  [providerStoreEvent.setEnableApiKeyManagementRequest]: { enabled: boolean };
  [providerStoreEvent.setSelectedModelForDetailsRequest]: {
    modelId: string | null;
  };

  // Rules Store Events
  [rulesStoreEvent.dataLoaded]: {
    rules: DbRule[];
    tags: DbTag[];
    links: DbTagRuleLink[];
  };
  [rulesStoreEvent.ruleSaved]: { rule: DbRule };
  [rulesStoreEvent.ruleDeleted]: { ruleId: string };
  [rulesStoreEvent.tagSaved]: { tag: DbTag };
  [rulesStoreEvent.tagDeleted]: { tagId: string };
  [rulesStoreEvent.linkSaved]: { link: DbTagRuleLink };
  [rulesStoreEvent.linkDeleted]: { linkId: string };
  [rulesStoreEvent.loadingStateChanged]: {
    isLoading: boolean;
    error: string | null;
  };

  // Rules Store Action Requests
  [rulesStoreEvent.loadRulesAndTagsRequest]: undefined;
  [rulesStoreEvent.addRuleRequest]: Omit<
    DbRule,
    "id" | "createdAt" | "updatedAt"
  >;
  [rulesStoreEvent.updateRuleRequest]: {
    id: string;
    updates: Partial<Omit<DbRule, "id" | "createdAt">>;
  };
  [rulesStoreEvent.deleteRuleRequest]: { id: string };
  [rulesStoreEvent.addTagRequest]: Omit<
    DbTag,
    "id" | "createdAt" | "updatedAt"
  >;
  [rulesStoreEvent.updateTagRequest]: {
    id: string;
    updates: Partial<Omit<DbTag, "id" | "createdAt">>;
  };
  [rulesStoreEvent.deleteTagRequest]: { id: string };
  [rulesStoreEvent.linkTagToRuleRequest]: { tagId: string; ruleId: string };
  [rulesStoreEvent.unlinkTagFromRuleRequest]: { tagId: string; ruleId: string };

  // Conversation Store Events
  [conversationStoreEvent.sidebarItemsLoaded]: {
    conversations: Conversation[];
    projects: Project[];
  };
  [conversationStoreEvent.selectedItemChanged]: {
    itemId: string | null;
    itemType: SidebarItemType | null;
  };
  [conversationStoreEvent.conversationAdded]: { conversation: Conversation };
  [conversationStoreEvent.conversationUpdated]: {
    conversationId: string;
    updates: Partial<Conversation>;
  };
  [conversationStoreEvent.conversationDeleted]: { conversationId: string };
  [conversationStoreEvent.conversationSyncStatusChanged]: {
    conversationId: string;
    status: SyncStatus;
  };
  [conversationStoreEvent.syncReposLoaded]: { repos: SyncRepo[] };
  [conversationStoreEvent.syncRepoChanged]: {
    repoId: string;
    action: "added" | "updated" | "deleted";
  };
  [conversationStoreEvent.syncRepoInitStatusChanged]: {
    repoId: string;
    status: SyncStatus;
  };
  [conversationStoreEvent.loadingStateChanged]: {
    isLoading: boolean;
    error: string | null;
  };

  // Conversation Store Action Requests
  [conversationStoreEvent.loadSidebarItemsRequest]: undefined;
  [conversationStoreEvent.addConversationRequest]: Partial<
    Omit<Conversation, "id" | "createdAt">
  > & { title: string; projectId?: string | null };
  [conversationStoreEvent.updateConversationRequest]: {
    id: string;
    updates: Partial<Omit<Conversation, "id" | "createdAt">>;
  };
  [conversationStoreEvent.deleteConversationRequest]: { id: string };
  [conversationStoreEvent.selectItemRequest]: {
    id: string | null;
    type: SidebarItemType | null;
  };
  [conversationStoreEvent.importConversationRequest]: { file: File };
  [conversationStoreEvent.exportConversationRequest]: {
    conversationId: string;
    format: "json" | "md";
  };
  [conversationStoreEvent.exportProjectRequest]: { projectId: string };
  [conversationStoreEvent.exportAllConversationsRequest]: undefined;
  [conversationStoreEvent.loadSyncReposRequest]: undefined;
  [conversationStoreEvent.addSyncRepoRequest]: Omit<
    SyncRepo,
    "id" | "createdAt" | "updatedAt"
  >;
  [conversationStoreEvent.updateSyncRepoRequest]: {
    id: string;
    updates: Partial<Omit<SyncRepo, "id" | "createdAt">>;
  };
  [conversationStoreEvent.deleteSyncRepoRequest]: { id: string };
  [conversationStoreEvent.linkConversationToRepoRequest]: {
    conversationId: string;
    repoId: string | null;
  };
  [conversationStoreEvent.syncConversationRequest]: { conversationId: string };
  [conversationStoreEvent.initializeOrSyncRepoRequest]: { repoId: string };
  [conversationStoreEvent.updateCurrentConversationToolSettingsRequest]: {
    enabledTools?: string[];
    toolMaxStepsOverride?: number | null;
  };

  // Project Store Events
  [projectStoreEvent.loaded]: { projects: Project[] };
  [projectStoreEvent.added]: { project: Project };
  [projectStoreEvent.updated]: { projectId: string; updates: Partial<Project> };
  [projectStoreEvent.deleted]: { projectId: string };
  [projectStoreEvent.loadingStateChanged]: {
    isLoading: boolean;
    error: string | null;
  };

  // Project Store Action Requests
  [projectStoreEvent.loadProjectsRequest]: undefined;
  [projectStoreEvent.addProjectRequest]: Partial<
    Omit<Project, "id" | "createdAt" | "path">
  > & { name: string; parentId?: string | null };
  [projectStoreEvent.updateProjectRequest]: {
    id: string;
    updates: Partial<Omit<Project, "id" | "createdAt" | "path">>;
  };
  [projectStoreEvent.deleteProjectRequest]: { id: string };

  // Interaction Store Events
  [interactionStoreEvent.loaded]: {
    conversationId: string;
    interactions: Interaction[];
  };
  [interactionStoreEvent.currentConversationIdChanged]: {
    conversationId: string | null;
  };
  [interactionStoreEvent.added]: { interaction: Interaction };
  [interactionStoreEvent.updated]: {
    interactionId: string;
    updates: Partial<Interaction>;
  };
  [interactionStoreEvent.streamingIdsChanged]: { streamingIds: string[] };
  [interactionStoreEvent.activeStreamBuffersChanged]: {
    buffers: Record<string, string>;
  };
  [interactionStoreEvent.activeReasoningBuffersChanged]: {
    buffers: Record<string, string>;
  };
  [interactionStoreEvent.statusChanged]: { status: InteractionState["status"] };
  [interactionStoreEvent.errorChanged]: { error: string | null };
  [interactionStoreEvent.interactionRated]: {
    interactionId: string;
    rating: number | null;
  };
  [interactionStoreEvent.started]: {
    interactionId: string;
    conversationId: string;
    type: string;
  };
  [interactionStoreEvent.streamChunk]: { interactionId: string; chunk: string };
  [interactionStoreEvent.completed]: {
    interactionId: string;
    status: Interaction["status"];
    error?: string;
    toolCalls?: ToolCallPart[];
    toolResults?: ToolResultPart[];
  };

  // Interaction Store Action Requests
  [interactionStoreEvent.loadInteractionsRequest]: { conversationId: string };
  [interactionStoreEvent.rateInteractionRequest]: {
    interactionId: string;
    rating: number | null;
  };
  [interactionStoreEvent.setCurrentConversationIdRequest]: {
    id: string | null;
  };
  [interactionStoreEvent.clearInteractionsRequest]: undefined;
  [interactionStoreEvent.setErrorRequest]: { error: string | null };
  [interactionStoreEvent.setStatusRequest]: {
    status: InteractionState["status"];
  };

  // Input Store Events
  [inputStoreEvent.attachedFilesChanged]: { files: AttachedFileMetadata[] };

  // Input Store Action Requests
  [inputStoreEvent.addAttachedFileRequest]: Omit<AttachedFileMetadata, "id">;
  [inputStoreEvent.removeAttachedFileRequest]: { attachmentId: string };
  [inputStoreEvent.clearAttachedFilesRequest]: undefined;

  // Prompt Store Events
  [promptStoreEvent.initialized]: { state: PromptState };
  [promptStoreEvent.parameterChanged]: { params: Partial<PromptState> };
  [promptStoreEvent.transientParametersReset]: undefined;
  [promptStoreEvent.inputTextStateChanged]: { value: string };
  [promptStoreEvent.submitted]: { turnData: PromptTurnObject };
  [promptStoreEvent.inputChanged]: { value: string };

  // Prompt Store Action Requests
  [promptStoreEvent.setModelIdRequest]: { id: string | null };
  [promptStoreEvent.setTemperatureRequest]: { value: number | null };
  [promptStoreEvent.setMaxTokensRequest]: { value: number | null };
  [promptStoreEvent.setTopPRequest]: { value: number | null };
  [promptStoreEvent.setTopKRequest]: { value: number | null };
  [promptStoreEvent.setPresencePenaltyRequest]: { value: number | null };
  [promptStoreEvent.setFrequencyPenaltyRequest]: { value: number | null };
  [promptStoreEvent.setReasoningEnabledRequest]: { enabled: boolean | null };
  [promptStoreEvent.setWebSearchEnabledRequest]: { enabled: boolean | null };
  [promptStoreEvent.setStructuredOutputJsonRequest]: { json: string | null };
  [promptStoreEvent.initializePromptStateRequest]: {
    effectiveSettings: {
      modelId: string | null;
      temperature: number | null;
      maxTokens: number | null;
      topP: number | null;
      topK: number | null;
      presencePenalty: number | null;
      frequencyPenalty: number | null;
    };
  };
  [promptStoreEvent.resetTransientParametersRequest]: undefined;

  // Mod Store Events
  [modStoreEvent.dbModsLoaded]: { dbMods: DbMod[] };
  [modStoreEvent.loadedInstancesChanged]: { loadedMods: ModInstance[] };
  [modStoreEvent.settingsTabsChanged]: { tabs: CustomSettingTab[] };
  [modStoreEvent.loadingStateChanged]: {
    isLoading: boolean;
    error: string | null;
  };
  [modStoreEvent.modLoaded]: { id: string; name: string };
  [modStoreEvent.modError]: { id: string; name: string; error: Error | string };

  // Mod Store Action Requests
  [modStoreEvent.loadDbModsRequest]: undefined;
  [modStoreEvent.addDbModRequest]: Omit<DbMod, "id" | "createdAt">;
  [modStoreEvent.updateDbModRequest]: { id: string; changes: Partial<DbMod> };
  [modStoreEvent.deleteDbModRequest]: { id: string };

  // UI Store Events
  [uiEvent.sidebarVisibilityChanged]: { isCollapsed: boolean };
  [uiEvent.chatControlPanelVisibilityChanged]: {
    panelId: string;
    isOpen: boolean;
  };
  [uiEvent.promptControlPanelVisibilityChanged]: {
    controlId: string;
    isOpen: boolean;
  };
  [uiEvent.globalLoadingChanged]: { loading: boolean };
  [uiEvent.globalErrorChanged]: { error: string | null };
  [uiEvent.focusInputFlagChanged]: { focus: boolean };
  [uiEvent.modalStateChanged]: {
    modalId: string;
    isOpen: boolean;
    targetId?: string | null;
    initialTab?: string | null;
    initialSubTab?: string | null;
    modalProps?: any;
  };
  [uiEvent.contextChanged]: {
    selectedItemId: string | null;
    selectedItemType: SidebarItemType | null;
  };
  [uiEvent.openSettingsModalRequest]: {
    tabId: string;
    subTabId?: string;
  };

  // UI Store Action Requests
  [uiEvent.toggleSidebarRequest]: { isCollapsed?: boolean } | undefined;
  [uiEvent.toggleChatControlPanelRequest]: {
    panelId: string;
    isOpen?: boolean;
  };
  [uiEvent.togglePromptControlPanelRequest]: {
    controlId: string;
    isOpen?: boolean;
  };
  [uiEvent.setGlobalLoadingRequest]: { loading: boolean };
  [uiEvent.setGlobalErrorRequest]: { error: string | null };
  [uiEvent.setFocusInputFlagRequest]: { focus: boolean };
  [uiEvent.openModalRequest]: {
    modalId: string;
    targetId?: string | null;
    initialTab?: string | null;
    initialSubTab?: string | null;
    modalProps?: any;
  };
  [uiEvent.closeModalRequest]: { modalId: string };

  // VFS Store Events
  [vfsStoreEvent.vfsKeyChanged]: {
    vfsKey: string | null;
    configuredVfsKey: string | null;
  };
  [vfsStoreEvent.nodesUpdated]: {
    vfsKey: string | null;
    nodes: Record<string, VfsNode>;
    childrenMap: Record<string, string[]>;
  };
  [vfsStoreEvent.selectionChanged]: { selectedFileIds: string[] };
  [vfsStoreEvent.loadingStateChanged]: {
    isLoading: boolean;
    operationLoading: boolean;
    error: string | null;
  };
  [vfsStoreEvent.fsInstanceChanged]: { fsInstance: typeof fs | null };
  [vfsStoreEvent.vfsEnabledChanged]: { enabled: boolean };
  [vfsStoreEvent.fileWritten]: { path: string };
  [vfsStoreEvent.fileRead]: { path: string };
  [vfsStoreEvent.fileDeleted]: { path: string };

  // VFS Store Action Requests
  [vfsStoreEvent.setVfsKeyRequest]: { key: string | null };
  [vfsStoreEvent.initializeVFSRequest]: {
    vfsKey: string;
    options?: { force?: boolean };
  };
  [vfsStoreEvent.fetchNodesRequest]: { parentId?: string | null };
  [vfsStoreEvent.setCurrentPathRequest]: { path: string };
  [vfsStoreEvent.createDirectoryRequest]: {
    parentId: string | null;
    name: string;
  };
  [vfsStoreEvent.uploadFilesRequest]: {
    parentId: string | null;
    files: FileList;
  };
  [vfsStoreEvent.deleteNodesRequest]: { ids: string[] };
  [vfsStoreEvent.renameNodeRequest]: { id: string; newName: string };
  [vfsStoreEvent.downloadFileRequest]: { fileId: string };
  [vfsStoreEvent.selectFileRequest]: { fileId: string };
  [vfsStoreEvent.deselectFileRequest]: { fileId: string };
  [vfsStoreEvent.clearSelectionRequest]: undefined;
  [vfsStoreEvent.setEnableVfsRequest]: { enabled: boolean };

  // Sync Store Events
  [syncStoreEvent.repoChanged]: {
    repoId: string;
    action: "added" | "updated" | "deleted";
  };
  [syncStoreEvent.repoInitStatusChanged]: {
    repoId: string;
    status: SyncStatus;
  };

  // Control Registry Store Events
  [controlRegistryStoreEvent.promptControlsChanged]: {
    controls: Record<string, CorePromptControlAliased>;
  };
  [controlRegistryStoreEvent.chatControlsChanged]: {
    controls: Record<string, CoreChatControlAliased>;
  };
  [controlRegistryStoreEvent.middlewareChanged]: {
    middleware: ControlState["middlewareRegistry"];
  };
  [controlRegistryStoreEvent.toolsChanged]: { tools: ControlState["tools"] };
  [controlRegistryStoreEvent.modalProvidersChanged]: {
    providers: Record<string, ModalProvider>;
  };

  // Control Registry Store Action Requests
  [controlRegistryStoreEvent.registerPromptControlRequest]: {
    control: CorePromptControlAliased;
  };
  [controlRegistryStoreEvent.unregisterPromptControlRequest]: { id: string };
  [controlRegistryStoreEvent.registerChatControlRequest]: {
    control: CoreChatControlAliased;
  };
  [controlRegistryStoreEvent.unregisterChatControlRequest]: { id: string };
  [controlRegistryStoreEvent.registerMiddlewareRequest]: {
    hookName: ModMiddlewareHookName;
    modId: string;
    callback: (payload: any) => any | Promise<any>;
    order?: number;
  };
  [controlRegistryStoreEvent.unregisterMiddlewareRequest]: {
    hookName: ModMiddlewareHookName;
    modId: string;
    callback: (payload: any) => any | Promise<any>;
  };
  [controlRegistryStoreEvent.registerToolRequest]: {
    modId: string;
    toolName: string;
    definition: Tool<any>;
    implementation?: ToolImplementation<any>;
  };
  [controlRegistryStoreEvent.unregisterToolRequest]: { toolName: string };
  [controlRegistryStoreEvent.registerModalProviderRequest]: {
    modalId: string;
    provider: ModalProvider;
  };
  [controlRegistryStoreEvent.unregisterModalProviderRequest]: {
    modalId: string;
  };
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
