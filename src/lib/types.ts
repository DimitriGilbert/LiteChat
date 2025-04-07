// src/lib/types.ts
import type { LanguageModel, Tool } from "ai";

// --- API Key Storage ---
export interface DbApiKey {
  id: string; // Unique ID for the key entry
  name: string; // User-defined name for the key (e.g., "My Personal OpenAI Key")
  providerId: string; // Links to AiProviderConfig.id (e.g., 'openai')
  value: string; // The actual API key (store securely)
  createdAt: Date;
}

// --- Project Structure ---
export interface DbProject {
  id: string;
  name: string;
  parentId: string | null; // ID of the parent project, or null for root
  createdAt: Date;
  updatedAt: Date;
  // Add other project-specific fields if needed, e.g., description
  // description?: string;
}

// Define the structure for AI providers and their models
export interface AiModelConfig {
  id: string; // e.g., 'gpt-4o', 'claude-3-opus'
  name: string; // User-friendly name
  instance: LanguageModel; // The actual instantiated model from Vercel AI SDK
  tools?: Record<string, Tool>;
}

export interface AiProviderConfig {
  id: string; // e.g., 'openai', 'anthropic'
  name: string; // User-friendly name
  models: AiModelConfig[];
  requiresApiKey?: boolean;
}

// Database Schemas
export interface DbConversation {
  id: string;
  parentId: string | null; // ID of the parent project, or null for root
  title: string;
  systemPrompt?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DbMessage {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
}

// Runtime Message Type (includes potential streaming state)
export interface Message extends DbMessage {
  isStreaming?: boolean;
  streamedContent?: string; // Content being actively streamed
  error?: string | null; // Add error field to message type
}

// Type for items displayed in the sidebar (Projects or Conversations)
export type SidebarItemType = "project" | "conversation";
export interface SidebarItemBase {
  id: string;
  parentId: string | null;
  createdAt: Date;
  updatedAt: Date;
}
export interface ProjectSidebarItem extends SidebarItemBase {
  type: "project";
  name: string;
  children?: SidebarItem[]; // For hierarchical display
}
export interface ConversationSidebarItem extends SidebarItemBase {
  type: "conversation";
  title: string;
}
export type SidebarItem = ProjectSidebarItem | ConversationSidebarItem;

// Context Type
export interface ChatContextProps {
  // Config
  providers: AiProviderConfig[];
  selectedProviderId: string | null;
  setSelectedProviderId: (id: string | null) => void;
  selectedModelId: string | null;
  setSelectedModelId: (id: string | null) => void;

  // API Keys
  apiKeys: DbApiKey[]; // List of all stored keys
  selectedApiKeyId: Record<string, string | null>; // { [providerId]: selectedKeyId | null }
  setSelectedApiKeyId: (providerId: string, keyId: string | null) => void;
  addApiKey: (
    name: string,
    providerId: string,
    value: string,
  ) => Promise<string>;
  deleteApiKey: (id: string) => Promise<void>;
  getApiKeyForProvider: (providerId: string) => string | undefined; // Gets the *value* of the selected key

  // Projects & Conversations (Sidebar Tree)
  sidebarItems: SidebarItem[]; // Combined list for the tree view
  selectedItemId: string | null; // ID of the selected project or conversation
  selectedItemType: SidebarItemType | null; // Type of the selected item
  selectItem: (id: string | null, type: SidebarItemType | null) => void; // Unified selection
  createConversation: (
    parentId: string | null,
    title?: string,
  ) => Promise<string>;
  createProject: (
    parentId: string | null,
    name?: string,
  ) => Promise<{ id: string; name: string }>; // Returns ID and initial name
  deleteItem: (id: string, type: SidebarItemType) => Promise<void>; // Unified delete
  renameItem: (
    id: string,
    newName: string,
    type: SidebarItemType,
  ) => Promise<void>; // Unified rename
  updateConversationSystemPrompt: (
    id: string,
    systemPrompt: string | null,
  ) => Promise<void>;
  activeConversationData: DbConversation | null; // Data for the *selected* conversation (if any)

  // Messages (for the selected conversation)
  messages: Message[];
  isLoading: boolean; // Loading messages or initial state
  isStreaming: boolean; // Is AI currently responding?
  error: string | null; // Global error state
  setError: (error: string | null) => void; // Setter for global error

  // Input & Submission
  prompt: string;
  setPrompt: (prompt: string) => void;
  handleSubmit: (e?: React.FormEvent<HTMLFormElement>) => Promise<void>;
  stopStreaming: () => void;
  regenerateMessage: (messageId: string) => Promise<void>; // Regeneration function

  // File Handling (Placeholders)
  attachedFiles: File[];
  addAttachedFile: (file: File) => void;
  removeAttachedFile: (fileName: string) => void;
  clearAttachedFiles: () => void;

  // Advanced Settings
  temperature: number;
  setTemperature: (value: number) => void;
  maxTokens: number | null;
  setMaxTokens: (value: number | null) => void;
  globalSystemPrompt: string; // Global default system prompt
  setGlobalSystemPrompt: (value: string) => void; // Setter for global prompt
  activeSystemPrompt: string | null;
  topP: number | null;
  setTopP: (value: number | null) => void;
  topK: number | null;
  setTopK: (value: number | null) => void;
  presencePenalty: number | null;
  setPresencePenalty: (value: number | null) => void;
  frequencyPenalty: number | null;
  setFrequencyPenalty: (value: number | null) => void;

  theme: "light" | "dark" | "system";
  setTheme: (value: "light" | "dark" | "system") => void;

  // UI Config
  streamingThrottleRate: number;

  // Search
  searchTerm: string;
  setSearchTerm: (term: string) => void;

  // Import/Export
  exportConversation: (conversationId: string | null) => Promise<void>;
  importConversation: (file: File, parentId: string | null) => Promise<void>; // Add parentId
  exportAllConversations: () => Promise<void>; // Might need rework for projects
  // TODO: Add project export/import later if needed
}
