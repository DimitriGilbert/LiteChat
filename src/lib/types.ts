// src/lib/types.ts

import type { CoreMessage } from "ai";
import type { FileSystem } from "@zenfs/core"; // Keep if needed elsewhere, but not directly in context type

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
  parentId: string | null; // ID of the parent project, null for root
  vfsEnabled: boolean; // Flag for Virtual File System
}

export interface DbConversation extends DbBase {
  title: string;
  systemPrompt: string | null;
  parentId: string | null; // ID of the parent project, null for root
  vfsEnabled: boolean; // Flag for Virtual File System
}

export interface DbMessage extends Pick<DbBase, "id" | "createdAt"> {
  conversationId: string;
  role: Role;
  content: string;
  vfsContextPaths?: string[]; // ADDED: Paths of VFS files included in context
}

export interface DbApiKey extends Pick<DbBase, "id" | "createdAt"> {
  name: string;
  providerId: string;
  value: string; // Store the actual key value (consider security implications)
}

// --- UI & State Types ---
export interface Message extends CoreMessage {
  id?: string; // Optional ID for UI state before DB save
  conversationId?: string; // Optional for UI state
  createdAt?: Date; // Optional for UI state
  isStreaming?: boolean; // Flag for streaming state
  streamedContent?: string; // Intermediate streamed content
  error?: string | null; // Error associated with the message
  vfsContextPaths?: string[]; // ADDED: Paths of VFS files included in context
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
  id: string; // e.g., 'gpt-4o', 'claude-3-opus'
  name: string; // User-friendly name, e.g., "GPT-4o"
  instance: any; // The actual AI SDK model instance
  contextWindow?: number; // Optional: Token limit
}

export interface AiProviderConfig {
  id: string; // e.g., 'openai', 'anthropic', 'google'
  name: string; // User-friendly name, e.g., "OpenAI"
  models: AiModelConfig[];
  requiresApiKey?: boolean; // Does this provider need an API key client-side? (default: true)
}

// --- Virtual File System ---
export interface FileSystemEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  lastModified: Date;
}

// --- Chat Context ---
// Define the shape of the VFS object within the context
interface VfsContextObject {
  isReady: boolean; // ADDED: Is the FS configured and ready?
  configuredItemId: string | null; // ADDED: Which item ID is it configured for?
  isLoading: boolean; // Is the VFS hook currently loading/configuring?
  isOperationLoading: boolean; // ADDED: Is a VFS operation (write, delete, etc.) in progress?
  error: string | null; // Any configuration error?
  // Include all the functions returned by the useVirtualFileSystem hook
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
}

export interface ChatContextProps {
  // Provider/Model Selection
  providers: AiProviderConfig[];
  selectedProviderId: string | null;
  setSelectedProviderId: React.Dispatch<React.SetStateAction<string | null>>;
  selectedModelId: string | null;
  setSelectedModelId: React.Dispatch<React.SetStateAction<string | null>>;

  // API Key Management
  apiKeys: DbApiKey[];
  selectedApiKeyId: Record<string, string | null>; // Map: providerId -> selectedKeyId
  setSelectedApiKeyId: (providerId: string, keyId: string | null) => void;
  addApiKey: (
    name: string,
    providerId: string,
    value: string,
  ) => Promise<string>;
  deleteApiKey: (id: string) => Promise<void>;
  getApiKeyForProvider: (providerId: string) => string | undefined;

  // Sidebar / Item Management
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
  activeConversationData: DbConversation | null;
  activeProjectData: DbProject | null;

  // Messages & Streaming
  messages: Message[];
  isLoading: boolean; // Loading messages state
  isStreaming: boolean; // AI response streaming state
  error: string | null; // General chat error
  setError: (error: string | null) => void;

  // Input Handling
  prompt: string;
  setPrompt: React.Dispatch<React.SetStateAction<string>>;
  handleSubmit: (e?: React.FormEvent<HTMLFormElement>) => Promise<void>;
  stopStreaming: () => void;
  regenerateMessage: (messageId: string) => Promise<void>;
  attachedFiles: File[];
  addAttachedFile: (file: File) => void;
  removeAttachedFile: (fileName: string) => void;
  clearAttachedFiles: () => void;
  selectedVfsPaths: string[]; // ADDED: Paths selected for context
  addSelectedVfsPath: (path: string) => void; // ADDED
  removeSelectedVfsPath: (path: string) => void; // ADDED
  clearSelectedVfsPaths: () => void; // ADDED

  // Settings
  temperature: number;
  setTemperature: React.Dispatch<React.SetStateAction<number>>;
  maxTokens: number | null;
  setMaxTokens: React.Dispatch<React.SetStateAction<number | null>>;
  globalSystemPrompt: string;
  setGlobalSystemPrompt: React.Dispatch<React.SetStateAction<string>>;
  activeSystemPrompt: string | null; // Derived system prompt
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

  // Import/Export
  exportConversation: (conversationId: string | null) => Promise<void>;
  importConversation: (file: File) => Promise<void>; // Simplified signature for context
  exportAllConversations: () => Promise<void>;

  // Virtual File System
  vfsEnabled: boolean; // Is VFS enabled for the *currently selected* item?
  toggleVfsEnabled: () => Promise<void>; // Function to toggle the DB flag and refresh state
  vfs: VfsContextObject; // Use the defined interface here
}
