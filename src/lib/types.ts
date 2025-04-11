// src/lib/types.ts
// import type { CoreMessage } from "ai";
import React from "react"; // Import React for ReactNode

// --- Basic Types ---
export type Role = "user" | "assistant" | "system";
export type SidebarItemType = "conversation" | "project";

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
}

export interface DbConversation extends DbBase {
  title: string;
  systemPrompt: string | null;
  parentId: string | null;
  vfsEnabled: boolean;
}

export interface DbMessage extends Pick<DbBase, "id" | "createdAt"> {
  conversationId: string;
  role: Role;
  content: string;
  vfsContextPaths?: string[];
}

export interface DbApiKey extends Pick<DbBase, "id" | "createdAt"> {
  name: string;
  providerId: string;
  value: string;
}

// --- UI & State Types ---
// Define Message properties directly instead of extending CoreMessage
export interface Message {
  // Core properties matching CoreMessage
  role: Role;
  content: string;
  // Additional properties
  id?: string;
  conversationId?: string;
  createdAt?: Date;
  isStreaming?: boolean;
  streamedContent?: string;
  error?: string | null;
  vfsContextPaths?: string[];
  providerId?: string;
  modelId?: string;
  tokensInput?: number;
  tokensOutput?: number;
  tokensPerSecond?: number;
  // Add other properties from CoreMessage if needed, e.g., tool_calls, tool_call_id
  // tool_calls?: ToolCall[];
  // tool_call_id?: string;
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
  instance: any; // Consider a more specific type if possible
  contextWindow?: number;
}

export interface AiProviderConfig {
  id: string;
  name: string;
  models: AiModelConfig[];
  requiresApiKey?: boolean;
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
  id: string; // Unique identifier for the action
  icon: React.ReactNode; // The icon component to display
  tooltip: string; // Tooltip text for the button
  className?: string; // Optional class names for the button
}

// Forward declare ChatContextProps for use in action handlers
// interface ChatContextPropsForwardDeclare extends CoreChatContextProps {
//   // Add other essential props needed by actions if CoreChatContextProps is not enough
//   // This avoids circular dependency issues if actions need the full context type.
//   // For now, let's assume CoreChatContextProps + specific needed items are sufficient
//   // or pass the full context object carefully.
//   // We will define the full ChatContextProps later.
//   providers: AiProviderConfig[];
//   selectedProviderId: string | null;
//   selectedModelId: string | null;
//   // ... add other specific props actions might need from the full context
//   customPromptActions?: CustomPromptAction[];
//   customMessageActions?: CustomMessageAction[];
//   customSettingsTabs?: CustomSettingTab[];
// }

export interface CustomPromptAction extends CustomActionBase {
  // onClick receives the full chat context for flexibility
  onClick: (context: ChatContextProps) => void; // Use full type here
}

export interface CustomMessageAction extends CustomActionBase {
  // onClick receives the specific message and the full chat context
  onClick: (message: Message, context: ChatContextProps) => void; // Use full type here
  // Optional: Condition to determine if the action should be shown for a specific message
  isVisible?: (message: Message, context: ChatContextProps) => boolean; // Use full type here
}

// --- Custom Settings Definitions ---
export interface CustomSettingTabProps {
  // Define props passed to custom setting components
  // Pass the full context for maximum flexibility, or specific parts if preferred
  context: ChatContextProps;
}

export interface CustomSettingTab {
  id: string;
  title: string;
  component: React.ComponentType<CustomSettingTabProps>;
}

// --- Chat Configuration ---
export interface LiteChatConfig {
  // Feature Flags (defaults to true if undefined)
  enableSidebar?: boolean;
  enableVfs?: boolean;
  enableApiKeyManagement?: boolean;
  enableAdvancedSettings?: boolean;

  // Initial State (defaults to null/undefined if undefined)
  initialProviderId?: string | null;
  initialModelId?: string | null;
  initialSelectedItemId?: string | null;
  initialSelectedItemType?: SidebarItemType | null;

  // Other Settings
  streamingThrottleRate?: number; // Default handled in provider
  defaultSidebarOpen?: boolean; // Default handled in LiteChat component

  // Extensibility
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
  isStreaming: boolean;
  setIsStreaming: React.Dispatch<React.SetStateAction<boolean>>;
  error: string | null;
  setError: (error: string | null) => void;
  handleSubmitCore: (
    originalUserPrompt: string,
    currentConversationId: string,
    promptToSendToAI: string,
    vfsContextPaths?: string[],
  ) => Promise<void>;
  stopStreamingCore: () => void;
  regenerateMessageCore: (messageId: string) => Promise<void>;
  abortControllerRef: React.MutableRefObject<AbortController | null>;
}

// VFS object within the context
export interface VfsContextObject {
  isReady: boolean;
  configuredVfsKey: string | null;
  isLoading: boolean;
  isOperationLoading: boolean;
  error: string | null;
  listFiles: (path: string) => Promise<FileSystemEntry[]>;
  readFile: (path: string) => Promise<Uint8Array>;
  writeFile: (path: string, data: Uint8Array | string) => Promise<void>;
  deleteItem: (path: string, recursive?: boolean) => Promise<void>;
  createDirectory: (path: string) => Promise<void>;
  downloadFile: (path: string, filename?: string) => Promise<void>;
  uploadFiles: (files: FileList | File[], targetPath: string) => Promise<void>;
  uploadAndExtractZip: (file: File, targetPath: string) => Promise<void>;
  downloadAllAsZip: (filename?: string) => Promise<void>;
  rename: (oldPath: string, newPath: string) => Promise<void>;
  vfsKey?: string | null;
}

// Full Context (Superset including Core + Optional Modules)
export interface ChatContextProps {
  // --- Feature Flags ---
  enableApiKeyManagement: boolean;
  enableAdvancedSettings: boolean;

  // Provider/Model Selection
  providers: AiProviderConfig[];
  selectedProviderId: string | null;
  setSelectedProviderId: React.Dispatch<React.SetStateAction<string | null>>;
  selectedModelId: string | null;
  setSelectedModelId: React.Dispatch<React.SetStateAction<string | null>>;

  // API Key Management (Functions might be dummies if disabled)
  apiKeys: DbApiKey[];
  selectedApiKeyId: Record<string, string | null>;
  setSelectedApiKeyId: (providerId: string, keyId: string | null) => void;
  addApiKey: (
    name: string,
    providerId: string,
    value: string,
  ) => Promise<string>;
  deleteApiKey: (id: string) => Promise<void>;
  getApiKeyForProvider: (providerId: string) => string | undefined;

  // Sidebar / Item Management (Functions might be dummies if disabled)
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

  // Messages & Streaming (Core)
  messages: Message[];
  isLoading: boolean; // Alias for isLoadingMessages
  isStreaming: boolean;
  error: string | null;
  setError: (error: string | null) => void;

  // Input Handling (Only expose stable handlers)
  handleSubmit: (
    // Modified signature
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

  // Settings (Functions might be dummies if disabled)
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

  // Import/Export & Data Management
  exportConversation: (conversationId: string | null) => Promise<void>;
  importConversation: (file: File) => Promise<void>;
  exportAllConversations: () => Promise<void>;
  clearAllData: () => Promise<void>;

  // Virtual File System (Object might be dummy if disabled)
  isVfsEnabledForItem: boolean;
  toggleVfsEnabled: () => Promise<void>;
  vfs: VfsContextObject;

  // Pass required DB functions
  getConversation: (id: string) => Promise<DbConversation | undefined>;
  getProject: (id: string) => Promise<DbProject | undefined>;

  // Extensibility
  customPromptActions?: CustomPromptAction[];
  customMessageActions?: CustomMessageAction[];
  customSettingsTabs?: CustomSettingTab[];
}
