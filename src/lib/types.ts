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
  // apiKey?: string; // REMOVED - We now select a stored key
}

// Database Schemas
export interface DbConversation {
  id: string;
  title: string;
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

  // Conversations
  conversations: DbConversation[];
  selectedConversationId: string | null;
  selectConversation: (id: string | null) => void;
  createConversation: (title?: string) => Promise<string>;
  deleteConversation: (id: string) => Promise<void>;
  renameConversation: (id: string, newTitle: string) => Promise<void>;

  // Messages
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

  // Advanced Settings (Placeholders)
  temperature: number;
  setTemperature: (value: number) => void;
  maxTokens: number | null;
  setMaxTokens: (value: number | null) => void;
  systemPrompt: string;
  setSystemPrompt: (value: string) => void;
  theme: "light" | "dark" | "system";
  setTheme: (value: "light" | "dark" | "system") => void;

  // UI Config
  streamingThrottleRate: number;
}
