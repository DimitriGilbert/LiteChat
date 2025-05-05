// src/types/litechat/provider.ts

import type { DbBase } from "./common";

// --- OpenRouter Model Structure (Subset for Typing) ---
// Define interfaces based on the OpenRouter model structure
export interface OpenRouterModelArchitecture {
  modality?: string | null;
  input_modalities?: string[] | null;
  output_modalities?: string[] | null;
  tokenizer?: string | null;
  instruct_type?: string | null;
}

export interface OpenRouterModelPricing {
  prompt?: string | null;
  completion?: string | null;
  request?: string | null;
  image?: string | null;
  web_search?: string | null;
  internal_reasoning?: string | null;
}

export interface OpenRouterTopProvider {
  context_length?: number | null;
  max_completion_tokens?: number | null;
  is_moderated?: boolean | null;
}

export interface OpenRouterModel {
  id: string;
  name: string;
  created?: number | null;
  description?: string | null;
  context_length?: number | null;
  architecture?: OpenRouterModelArchitecture | null;
  pricing?: OpenRouterModelPricing | null;
  top_provider?: OpenRouterTopProvider | null;
  per_request_limits?: Record<string, any> | null;
  supported_parameters?: string[] | null;
  // Add any other fields you might want to store/use
}
// --- End OpenRouter Model Structure ---

export type DbProviderType =
  | "openai"
  | "google"
  | "openrouter"
  | "ollama"
  | "openai-compatible";

// Stored in DB for API Keys
export interface DbApiKey extends DbBase {
  name: string;
  value: string;
  providerId: string;
}

// Stored in DB for Provider Configurations
export interface DbProviderConfig extends DbBase {
  name: string;
  type: DbProviderType;
  isEnabled: boolean;
  apiKeyId: string | null;
  baseURL: string | null;
  enabledModels: string[] | null;
  autoFetchModels: boolean;
  // Update fetchedModels to store the full OpenRouterModel structure
  fetchedModels: OpenRouterModel[] | null;
  modelsLastFetchedAt: Date | null;
}

// Runtime representation of a Model
export interface AiModelConfig {
  id: string;
  name: string;
  providerId: string;
  providerName: string;
  instance: any;
  // Add the full metadata object
  metadata: OpenRouterModel | null;
  // Deprecate these individual fields in favor of metadata
  // contextWindow?: number;
  // supportsImageGeneration?: boolean;
  // supportsToolCalling?: boolean;
}

// Runtime representation of a Provider (Less critical for selection)
export interface AiProviderConfig {
  id: string;
  name: string;
  type: DbProviderType;
  // Update allAvailableModels to store the full OpenRouterModel structure
  allAvailableModels: OpenRouterModel[];
}
