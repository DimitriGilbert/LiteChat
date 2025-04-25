import type { DbBase } from './common';

export type DbProviderType =
  | 'openai' | 'google' | 'openrouter' | 'ollama' | 'openai-compatible';

// Stored in DB for API Keys
export interface DbApiKey extends DbBase {
  name: string;
  value: string; // Encrypt this!
}

// Stored in DB for Provider Configurations
export interface DbProviderConfig extends DbBase {
  name: string; type: DbProviderType; isEnabled: boolean;
  apiKeyId: string | null; baseURL: string | null;
  enabledModels: string[] | null; autoFetchModels: boolean;
  fetchedModels: { id: string; name: string }[] | null;
  modelsLastFetchedAt: Date | null; modelSortOrder: string[] | null;
}

// Runtime representation of a Model
export interface AiModelConfig {
  id: string; name: string; instance: any; contextWindow?: number;
  supportsImageGeneration?: boolean; supportsToolCalling?: boolean;
}

// Runtime representation of a Provider
export interface AiProviderConfig {
  id: string; name: string; type: DbProviderType;
  models: AiModelConfig[]; // Currently usable models
  allAvailableModels: { id: string; name: string }[]; // All known models
}
