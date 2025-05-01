// src/types/litechat/provider.ts
import type { DbBase } from "./common";

export type DbProviderType =
  | "openai"
  | "google"
  | "openrouter"
  | "ollama"
  | "openai-compatible";

// Stored in DB for API Keys
export interface DbApiKey extends DbBase {
  name: string;
  value: string
  providerId: string
}

// Stored in DB for Provider Configurations
export interface DbProviderConfig extends DbBase {
  name: string;
  type: DbProviderType;
  isEnabled: boolean;
  apiKeyId: string | null;
  baseURL: string | null;
  enabledModels: string[] | null
  autoFetchModels: boolean;
  // Update fetchedModels to include optional metadata
  fetchedModels:
    | {
        id: string;
        name: string;
        metadata?: Record<string, any>
      }[]
    | null;
  modelsLastFetchedAt: Date | null;
}

// Runtime representation of a Model
export interface AiModelConfig {
  id: string
  name: string
  providerId: string
  providerName: string
  instance: any
  contextWindow?: number;
  supportsImageGeneration?: boolean;
  supportsToolCalling?: boolean;
  // Add optional metadata field to runtime representation as well
  metadata?: Record<string, any>;
}

// Runtime representation of a Provider (Less critical for selection)
export interface AiProviderConfig {
  id: string;
  name: string;
  type: DbProviderType;
  // models removed - handled globally
  // Update allAvailableModels to include optional metadata
  allAvailableModels: {
    id: string;
    name: string;
    metadata?: Record<string, any>;
  }[];
}
