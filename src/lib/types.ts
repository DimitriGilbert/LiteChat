// src/lib/types.ts
import React from "react";

import type {
  DbMod as ModDbType,
  ModInstance as ModInstanceType,
} from "@/mods/types";

import { fs } from "@zenfs/core";
import type { CoreMessage as AiCoreMessage } from "ai";

import type { ReadonlyChatContextSnapshot as ModApiSnapshot } from "@/mods/api";

export type Role = "user" | "assistant" | "system" | "tool";
export type SidebarItemType = "conversation" | "project";
export type DbProviderType =
  | "openai"
  | "google"
  | "openrouter"
  | "ollama"
  | "openai-compatible";

export interface TextPart {
  type: "text";
  text: string;
}

export interface ImagePart {
  type: "image";
  /** Base64 encoded data URL or raw base64 string */
  image: string;
  /** Optional mime type */
  mediaType?: string;
}

export interface ToolCallPart {
  type: "tool-call";
  toolCallId: string;
  toolName: string;
  args: any;
}

export interface ToolResultPart {
  type: "tool-result";
  toolCallId: string;
  toolName: string;
  result: any;
  /** Optional: Set to true if the tool execution resulted in an error */
  isError?: boolean;
}

export type MessageContent =
  | string
  | Array<TextPart | ImagePart | ToolCallPart | ToolResultPart>;

export interface DbBase {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DbProject extends DbBase {
  name: string;
  parentId: string | null;
  vfsEnabled: boolean;
  gitRepoUrl?: string | null;
  gitRepoBranch?: string | null;
  gitRepoEnabled?: boolean;
}

export interface DbConversation extends DbBase {
  title: string;
  systemPrompt: string | null;
  parentId: string | null;
  vfsEnabled: boolean;
  gitRepoUrl?: string | null;
  gitRepoBranch?: string | null;
  gitRepoEnabled?: boolean;
}

export interface Workflow {
  type: "race" | "sequence" | "parallel";
  status: "pending" | "running" | "completed" | "error";
  childIds: string[];
}

export interface DbMessage extends Pick<DbBase, "id" | "createdAt"> {
  conversationId: string;
  role: Role;
  /** Updated content type - can be string or array of parts */
  content: MessageContent;
  vfsContextPaths?: string[];
  /** Present on assistant messages that contain tool calls */
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  /** Present on tool messages to link them to the corresponding tool call */
  tool_call_id?: string;
  tokensInput?: number;
  tokensOutput?: number;
  /** Optional array to store child messages for workflows/alternatives */
  children?: Message[];
  /** Optional field to describe and track a workflow */
  workflow?: Workflow;
  /** Optional: ID of the provider used for this message */
  providerId?: string | null;
  /** Optional: ID of the model used for this message */
  modelId?: string | null;
}

export interface DbApiKey extends Pick<DbBase, "id" | "createdAt"> {
  name: string;
  providerId: string;
  value: string;
}

export interface DbProviderConfig extends DbBase {
  name: string;
  type: DbProviderType;
  isEnabled: boolean;
  apiKeyId: string | null;
  baseURL: string | null;
  /**
   * IDs of models to show in the primary dropdown list.
   * If null/empty, show all fetched/default models.
   * Search accesses all available models regardless of this setting.
   */
  enabledModels: string[] | null;
  autoFetchModels: boolean;
  /** Stores the list of models fetched from the /models endpoint. */
  fetchedModels: { id: string; name: string }[] | null;
  /** Timestamp of the last successful model fetch. */
  modelsLastFetchedAt: Date | null;
  modelSortOrder: string[] | null;
}

export type DbMod = ModDbType;
export type ModInstance = ModInstanceType;

export interface Message {
  id: string;
  role: Role;
  content: MessageContent;
  conversationId?: string;
  createdAt?: Date;
  isStreaming?: boolean;
  /** Stores partial streamed text content */
  // streamedContent?: string;
  error?: string | null;
  vfsContextPaths?: string[];
  providerId?: string | null;
  modelId?: string | null;
  tokensInput?: number;
  tokensOutput?: number;
  tokensPerSecond?: number;
  /** Present on assistant messages that contain tool calls */
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  /** Present on tool messages to link them to the corresponding tool call */
  tool_call_id?: string;
  /** Optional array to store child messages for workflows/alternatives */
  children?: Message[];
  /** Optional field to describe and track a workflow */
  workflow?: Workflow;
}

export interface SidebarItemBase extends DbBase {
  type: SidebarItemType;
}
export interface ProjectSidebarItem extends DbProject, SidebarItemBase {
  type: "project";
}
export interface ConversationSidebarItem
  extends DbConversation,
    SidebarItemBase {
  type: "conversation";
}
export type SidebarItem = ProjectSidebarItem | ConversationSidebarItem;

export interface AiModelConfig {
  id: string;
  name: string;
  instance: any;
  contextWindow?: number;
  supportsImageGeneration?: boolean;
  supportsToolCalling?: boolean;
}

export interface AiProviderConfig {
  id: string;
  name: string;
  type: DbProviderType;
  /** Models actively configured/enabled for this provider (subset of allAvailableModels). */
  models: AiModelConfig[];
  /** All models potentially available from this provider (fetched or default). */
  allAvailableModels: { id: string; name: string }[];
}

export interface FileSystemEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  lastModified: Date;
}

export interface CustomActionBase {
  id: string;
  icon: React.ReactNode;
  tooltip: string;
  className?: string;
}

export interface CustomPromptAction extends CustomActionBase {
  // onClick should accept the Readonly Snapshot, not the full context
  onClick: (context: ReadonlyChatContextSnapshot) => void;
}

export interface CustomMessageAction extends CustomActionBase {
  // onClick should accept the Readonly Snapshot
  onClick: (message: Message, context: ReadonlyChatContextSnapshot) => void;
  isVisible?: (
    message: Message,
    context: ReadonlyChatContextSnapshot,
  ) => boolean;
}

// Remove the context prop from CustomSettingTabProps
export interface CustomSettingTabProps {
  // No context prop needed here anymore
}

export interface CustomSettingTab {
  id: string;
  title: string;
  component: React.ComponentType<CustomSettingTabProps>;
}

export interface LiteChatConfig {
  enableSidebar?: boolean;
  enableVfs?: boolean;
  enableApiKeyManagement?: boolean;
  enableAdvancedSettings?: boolean;
  initialProviderId?: string | null;
  initialModelId?: string | null;
  initialSelectedItemId?: string | null;
  initialSelectedItemType?: SidebarItemType | null;
  streamingRefreshRateMs?: number;
  defaultSidebarOpen?: boolean;
  customPromptActions?: CustomPromptAction[];
  customMessageActions?: CustomMessageAction[];
  customSettingsTabs?: CustomSettingTab[];
}

export interface CoreChatContextProps {
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  isLoadingMessages: boolean;
  setIsLoadingMessages: React.Dispatch<React.SetStateAction<boolean>>;
  isStreaming: boolean;
  setIsStreaming: React.Dispatch<React.SetStateAction<boolean>>;
  error: string | null;
  setError: (error: string | null) => void;
  handleSubmitCore: (
    currentConversationId: string,
    contentToSendToAI: MessageContent,
    vfsContextPaths?: string[],
  ) => Promise<void>;
  handleImageGenerationCore: (
    currentConversationId: string,
    prompt: string,
  ) => Promise<void>;
  stopStreamingCore: () => void;
  regenerateMessageCore: (messageId: string) => Promise<void>;
  abortControllerRef: React.MutableRefObject<AbortController | null>;
}

export interface VfsContextObject {
  isReady: boolean;
  isLoading: boolean;
  isOperationLoading: boolean;
  error: string | null;
  configuredVfsKey: string | null;
  fs: typeof fs | null;
  listFiles: (path: string) => Promise<FileSystemEntry[]>;
  readFile: (path: string) => Promise<Uint8Array>;
  writeFile: (path: string, data: Uint8Array | string) => Promise<void>;
  deleteItem: (path: string, recursive?: boolean) => Promise<void>;
  createDirectory: (path: string) => Promise<void>;
  downloadFile: (path: string, filename?: string) => Promise<void>;
  uploadFiles: (files: FileList | File[], targetPath: string) => Promise<void>;
  uploadAndExtractZip: (file: File, targetPath: string) => Promise<void>;
  downloadAllAsZip: (filename?: string, rootPath?: string) => Promise<void>;
  rename: (oldPath: string, newPath: string) => Promise<void>;
  vfsKey: string | null;
}

export type ReadonlyChatContextSnapshot = ModApiSnapshot;
// increasingly rely on specific hooks/stores, but keep it for now.
export interface ChatContextProps {
  // --- Feature Flags (from Settings/ProviderMgmt) ---
  enableApiKeyManagement: boolean;
  enableAdvancedSettings: boolean;
  enableSidebar: boolean;
  enableVfs: boolean;
  activeProviders: AiProviderConfig[];
  selectedProviderId: string | null;
  setSelectedProviderId: React.Dispatch<React.SetStateAction<string | null>>;
  selectedModelId: string | null;
  setSelectedModelId: React.Dispatch<React.SetStateAction<string | null>>;
  getApiKeyForProvider: (providerConfigId: string) => string | undefined;
  selectedModel: AiModelConfig | undefined;
  apiKeys: DbApiKey[];
  addApiKey: (
    name: string,
    providerId: string,
    value: string,
  ) => Promise<string>;
  deleteApiKey: (id: string) => Promise<void>;
  dbProviderConfigs: DbProviderConfig[];
  addDbProviderConfig: (
    config: Omit<DbProviderConfig, "id" | "createdAt" | "updatedAt">,
  ) => Promise<string>;
  updateDbProviderConfig: (
    id: string,
    changes: Partial<DbProviderConfig>,
  ) => Promise<void>;
  deleteDbProviderConfig: (id: string) => Promise<void>;
  sidebarItems: SidebarItem[];
  selectedItemId: string | null;
  selectedItemType: SidebarItemType | null;
  selectItem: (
    id: string | null,
    type: SidebarItemType | null,
  ) => Promise<void>;
  createConversation: (
    parentId: string | null,
    title?: string,
  ) => Promise<string>;
  createProject: (
    parentId: string | null,
    name?: string,
  ) => Promise<{ id: string; name: string }>;
  deleteItem: (id: string, type: SidebarItemType) => Promise<void>;
  renameItem: (
    id: string,
    newName: string,
    type: SidebarItemType,
  ) => Promise<void>;
  updateConversationSystemPrompt: (
    id: string,
    systemPrompt: string | null,
  ) => Promise<void>;
  messages: Message[];
  isLoading: boolean;
  isStreaming: boolean;
  error: string | null;
  setError: (error: string | null) => void;
  handleSubmit: (
    promptValue: string,
    attachedFilesValue: File[],
    selectedVfsPathsValue: string[],
  ) => Promise<void>;
  stopStreaming: () => void;
  regenerateMessage: (messageId: string) => Promise<void>;
  selectedVfsPaths: string[];
  addSelectedVfsPath: (path: string) => void;
  removeSelectedVfsPath: (path: string) => void;
  clearSelectedVfsPaths: () => void;
  temperature: number;
  setTemperature: React.Dispatch<React.SetStateAction<number>>;
  maxTokens: number | null;
  setMaxTokens: React.Dispatch<React.SetStateAction<number | null>>;
  globalSystemPrompt: string | null;
  setGlobalSystemPrompt: React.Dispatch<React.SetStateAction<string | null>>;
  activeSystemPrompt: string | null;
  topP: number | null;
  setTopP: React.Dispatch<React.SetStateAction<number | null>>;
  topK: number | null;
  setTopK: React.Dispatch<React.SetStateAction<number | null>>;
  presencePenalty: number | null;
  setPresencePenalty: React.Dispatch<React.SetStateAction<number | null>>;
  frequencyPenalty: number | null;
  setFrequencyPenalty: React.Dispatch<React.SetStateAction<number | null>>;
  theme: "light" | "dark" | "system";
  setTheme: React.Dispatch<React.SetStateAction<"light" | "dark" | "system">>;
  streamingThrottleRate: number;
  searchTerm: string;
  setSearchTerm: React.Dispatch<React.SetStateAction<string>>;
  enableStreamingMarkdown: boolean;
  setEnableStreamingMarkdown: (enabled: boolean) => void;

  // --- Import/Export & Data Management (from SidebarContext/Storage) ---
  exportConversation: (conversationId: string | null) => Promise<void>;
  importConversation: (file: File, parentId: string | null) => Promise<void>;
  exportAllConversations: () => Promise<void>;
  clearAllData: () => Promise<void>;
  isVfsEnabledForItem: boolean;
  toggleVfsEnabled: () => Promise<void>;
  vfs: VfsContextObject;
  getConversation: (id: string) => Promise<DbConversation | undefined>;
  getProject: (id: string) => Promise<DbProject | undefined>;
  customPromptActions: CustomPromptAction[];
  customMessageActions: CustomMessageAction[];
  customSettingsTabs: CustomSettingTab[];
  dbMods: DbMod[];
  loadedMods: ModInstance[];
  addDbMod: (modData: Omit<DbMod, "id" | "createdAt">) => Promise<string>;
  updateDbMod: (id: string, changes: Partial<DbMod>) => Promise<void>;
  deleteDbMod: (id: string) => Promise<void>;
  isSettingsModalOpen: boolean;
  onSettingsModalOpenChange: (open: boolean) => void;
}

export type CoreMessage = AiCoreMessage;
