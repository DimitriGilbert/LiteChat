// src/lib/types.ts
import React from "react";
import type { DbMod, ModInstance } from "@/mods/types";
// Import the global fs object to use its type
// Removed unused FileSystem import
import { fs } from "@zenfs/core";
import type { CoreMessage as AiCoreMessage } from "ai"; // Use alias to avoid naming conflict

// --- Basic Types ---
export type Role = "user" | "assistant" | "system" | "tool"; // Added 'tool' role
export type SidebarItemType = "conversation" | "project";
export type DbProviderType =
  | "openai"
  | "google"
  | "openrouter"
  | "ollama"
  | "openai-compatible";

// --- AI SDK Core Message Parts (Aligned with reference) ---
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

// --- AI SDK Tool Call/Result Parts ---
// Structure matching the 'tool_calls' property in assistant messages
export interface ToolCallPart {
  type: "tool-call";
  toolCallId: string;
  toolName: string;
  args: any; // Arguments provided by the model for the tool call
}

// Structure matching the content of 'tool' role messages
export interface ToolResultPart {
  type: "tool-result";
  toolCallId: string;
  toolName: string;
  result: any; // The result returned by the tool execution
  /** Optional: Set to true if the tool execution resulted in an error */
  isError?: boolean;
}

// Define the multi-modal content type based on AI SDK structure
// Can be simple text, or an array containing text, image, tool-call, or tool-result parts.
export type MessageContent =
  | string
  | Array<TextPart | ImagePart | ToolCallPart | ToolResultPart>;

// --- Database Schemas ---
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

export interface DbMessage extends Pick<DbBase, "id" | "createdAt"> {
  conversationId: string;
  role: Role; // Updated Role type
  /** Updated content type - can be string or array of parts */
  content: MessageContent;
  vfsContextPaths?: string[];
  // Optional fields matching AI SDK structure for tool interactions
  /** Present on assistant messages that contain tool calls */
  tool_calls?: Array<{
    id: string; // Matches toolCallId in ToolCallPart
    type: "function"; // AI SDK uses 'function' here
    function: { name: string; arguments: string }; // Raw arguments string from AI
  }>;
  /** Present on tool messages to link them to the corresponding tool call */
  tool_call_id?: string; // Matches toolCallId in ToolResultPart
}

export interface DbApiKey extends Pick<DbBase, "id" | "createdAt"> {
  name: string;
  providerId: string;
  value: string;
}

export interface DbProviderConfig extends DbBase {
  name: string; // User-defined name (e.g., "My LMStudio", "Work OpenAI")
  type: DbProviderType;
  isEnabled: boolean;
  apiKeyId: string | null; // Link to DbApiKey.id if required
  baseURL: string | null; // For openai-compatible, ollama
  /**
   * IDs of models to show in the primary dropdown list.
   * If null/empty, show all fetched/default models.
   * Search accesses all available models regardless of this setting.
   */
  enabledModels: string[] | null;
  autoFetchModels: boolean; // Default to true for supported types
  /** Stores the list of models fetched from the /models endpoint. */
  fetchedModels: { id: string; name: string }[] | null;
  /** Timestamp of the last successful model fetch. */
  modelsLastFetchedAt: Date | null;
  modelSortOrder: string[] | null;
}

// --- UI & State Types ---
export interface Message {
  id: string; // Make ID mandatory for UI state consistency
  role: Role; // Updated Role type
  /** Updated content type - can be string or array of parts */
  content: MessageContent;
  conversationId?: string;
  createdAt?: Date;
  isStreaming?: boolean;
  /** Stores partial streamed text content */
  streamedContent?: string;
  error?: string | null;
  vfsContextPaths?: string[];
  providerId?: string;
  modelId?: string;
  tokensInput?: number;
  tokensOutput?: number;
  tokensPerSecond?: number;
  // Optional fields matching AI SDK structure for tool interactions
  /** Present on assistant messages that contain tool calls */
  tool_calls?: Array<{
    id: string; // Matches toolCallId in ToolCallPart
    type: "function"; // AI SDK uses 'function' here
    function: { name: string; arguments: string }; // Raw arguments string from AI
  }>;
  /** Present on tool messages to link them to the corresponding tool call */
  tool_call_id?: string; // Matches toolCallId in ToolResultPart
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

// --- AI Configuration ---
export interface AiModelConfig {
  id: string;
  name: string;
  instance: any; // Holds the AI SDK model instance (e.g., from openai('gpt-4'))
  contextWindow?: number;
  // Add flag to indicate image generation capability
  supportsImageGeneration?: boolean;
  // Flag to indicate tool calling capability (can be refined later)
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

// --- Virtual File System ---
export interface FileSystemEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  lastModified: Date;
}

// --- Custom Action Definitions ---
export interface CustomActionBase {
  id: string;
  icon: React.ReactNode;
  tooltip: string;
  className?: string;
}

export interface CustomPromptAction extends CustomActionBase {
  onClick: (context: ChatContextProps) => void;
}

export interface CustomMessageAction extends CustomActionBase {
  onClick: (message: Message, context: ChatContextProps) => void;
  isVisible?: (message: Message, context: ChatContextProps) => boolean;
}

// --- Custom Settings Definitions ---
export interface CustomSettingTabProps {
  context: ChatContextProps;
}

export interface CustomSettingTab {
  id: string;
  title: string;
  component: React.ComponentType<CustomSettingTabProps>;
}

// --- Chat Configuration ---
export interface LiteChatConfig {
  enableSidebar?: boolean;
  enableVfs?: boolean;
  enableApiKeyManagement?: boolean;
  enableAdvancedSettings?: boolean;
  initialProviderId?: string | null;
  initialModelId?: string | null;
  initialSelectedItemId?: string | null;
  initialSelectedItemType?: SidebarItemType | null;
  streamingThrottleRate?: number;
  defaultSidebarOpen?: boolean;
  customPromptActions?: CustomPromptAction[];
  customMessageActions?: CustomMessageAction[];
  customSettingsTabs?: CustomSettingTab[];
}

// --- Chat Context ---

// Core Context Definition
export interface CoreChatContextProps {
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  isLoadingMessages: boolean;
  setIsLoadingMessages: React.Dispatch<React.SetStateAction<boolean>>;
  isStreaming: boolean; // Covers both text and image generation
  setIsStreaming: React.Dispatch<React.SetStateAction<boolean>>;
  error: string | null;
  setError: (error: string | null) => void;
  handleSubmitCore: (
    currentConversationId: string,
    contentToSendToAI: MessageContent, // Use the multi-modal type
    vfsContextPaths?: string[],
  ) => Promise<void>;
  // Add image generation core function
  handleImageGenerationCore: (
    currentConversationId: string,
    prompt: string,
  ) => Promise<void>;
  stopStreamingCore: () => void;
  regenerateMessageCore: (messageId: string) => Promise<void>;
  abortControllerRef: React.MutableRefObject<AbortController | null>;
}

// VFS object within the context
export interface VfsContextObject {
  isReady: boolean;
  isLoading: boolean;
  isOperationLoading: boolean;
  error: string | null;
  configuredVfsKey: string | null;
  // Use the type of the imported global fs object
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

// Full Context (Aggregated - Consumers should ideally use specific context hooks)
// This acts as the central hub providing access to everything if needed,
// but its direct use should be minimized in favor of specific contexts.
export interface ChatContextProps {
  // --- Feature Flags (from Settings/ProviderMgmt) ---
  enableApiKeyManagement: boolean;
  enableAdvancedSettings: boolean;
  enableSidebar: boolean; // from SidebarContext
  enableVfs: boolean; // from VfsContext

  // --- Provider/Model Selection (from ProviderManagementContext) ---
  activeProviders: AiProviderConfig[];
  selectedProviderId: string | null;
  setSelectedProviderId: React.Dispatch<React.SetStateAction<string | null>>;
  selectedModelId: string | null;
  setSelectedModelId: React.Dispatch<React.SetStateAction<string | null>>;
  getApiKeyForProvider: (providerConfigId: string) => string | undefined;
  // Add selected model details for checking capabilities
  selectedModel: AiModelConfig | undefined;

  // --- API Key Management (from ProviderManagementContext) ---
  apiKeys: DbApiKey[];
  addApiKey: (
    name: string,
    providerId: string,
    value: string,
  ) => Promise<string>;
  deleteApiKey: (id: string) => Promise<void>;

  // --- Provider Configuration Management (from ProviderManagementContext) ---
  dbProviderConfigs: DbProviderConfig[];
  addDbProviderConfig: (
    config: Omit<DbProviderConfig, "id" | "createdAt" | "updatedAt">,
  ) => Promise<string>;
  updateDbProviderConfig: (
    id: string,
    changes: Partial<DbProviderConfig>,
  ) => Promise<void>;
  deleteDbProviderConfig: (id: string) => Promise<void>;

  // --- Sidebar / Item Management (from SidebarContext) ---
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

  // --- Messages & Streaming (from CoreChatContext) ---
  messages: Message[];
  isLoading: boolean; // Alias for isLoadingMessages
  isStreaming: boolean; // Covers both text and image generation
  error: string | null;
  setError: (error: string | null) => void;

  // --- Interaction Handlers (defined in ChatProvider) ---
  handleSubmit: (
    promptValue: string,
    attachedFilesValue: File[],
    selectedVfsPathsValue: string[],
  ) => Promise<void>;
  stopStreaming: () => void;
  regenerateMessage: (messageId: string) => Promise<void>;

  // --- VFS Selection State (from VfsContext) ---
  selectedVfsPaths: string[];
  addSelectedVfsPath: (path: string) => void;
  removeSelectedVfsPath: (path: string) => void;
  clearSelectedVfsPaths: () => void;

  // --- Settings (from SettingsContext) ---
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
  streamingThrottleRate: number; // Passed down from config
  searchTerm: string;
  setSearchTerm: React.Dispatch<React.SetStateAction<string>>;

  // --- Import/Export & Data Management (from SidebarContext/Storage) ---
  exportConversation: (conversationId: string | null) => Promise<void>;
  importConversation: (file: File, parentId: string | null) => Promise<void>; // Adjusted signature
  exportAllConversations: () => Promise<void>;
  clearAllData: () => Promise<void>; // From storage hook

  // --- Virtual File System (from VfsContext) ---
  isVfsEnabledForItem: boolean;
  toggleVfsEnabled: () => Promise<void>; // Handler defined in ChatProvider
  vfs: VfsContextObject;

  // --- DB Accessors (from Storage hook) ---
  getConversation: (id: string) => Promise<DbConversation | undefined>;
  getProject: (id: string) => Promise<DbProject | undefined>;

  // --- Extensibility (Combined - User Config + Mods from ModContext) ---
  customPromptActions: CustomPromptAction[];
  customMessageActions: CustomMessageAction[];
  customSettingsTabs: CustomSettingTab[];

  // --- Mod System (from ModContext) ---
  dbMods: DbMod[];
  loadedMods: ModInstance[];
  addDbMod: (modData: Omit<DbMod, "id" | "createdAt">) => Promise<string>;
  updateDbMod: (id: string, changes: Partial<DbMod>) => Promise<void>;
  deleteDbMod: (id: string) => Promise<void>;
  // Add modTools access if needed directly in context, though usually accessed via ModContext
  // modTools: ReadonlyMap<string, import('../mods/types').RegisteredTool>;

  // --- Settings Modal Control (from SettingsContext) ---
  isSettingsModalOpen: boolean;
  onSettingsModalOpenChange: (open: boolean) => void;
}

// --- AI SDK CoreMessage Re-export/Alias ---
// Re-exporting or aliasing the CoreMessage type from 'ai' package
// This ensures we use the canonical type definition from the SDK
// Includes 'role', 'content', and optional 'tool_calls' / 'tool_call_id'
export type CoreMessage = AiCoreMessage;
