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
  value: string; // Encrypt this!
  providerId: string; // Intended provider type/ID for context
}

// Stored in DB for Provider Configurations
export interface DbProviderConfig extends DbBase {
  name: string;
  type: DbProviderType;
  isEnabled: boolean;
  apiKeyId: string | null;
  baseURL: string | null;
  enabledModels: string[] | null; // Models enabled FOR THIS PROVIDER
  autoFetchModels: boolean;
  // Update fetchedModels to include optional metadata
  fetchedModels:
    | {
        id: string;
        name: string;
        metadata?: Record<string, any>; // Add optional metadata field
      }[]
    | null;
  modelsLastFetchedAt: Date | null;
}

// Runtime representation of a Model
export interface AiModelConfig {
  id: string; // Combined ID: "providerId:modelId"
  name: string; // Display name, e.g., "GPT-4o"
  providerId: string; // ID of the provider config
  providerName: string; // Name of the provider config
  instance: any; // The actual AI SDK instance
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
