// src/types/litechat/provider.ts
// FULL FILE
import type { DbBase } from "./common";

// --- OpenRouter Model Structure (Subset for Typing) ---
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
  id: string; // Simple model ID (e.g., "gpt-4o", "llama3")
  name: string;
  created?: number | null;
  description?: string | null;
  context_length?: number | null;
  architecture?: OpenRouterModelArchitecture | null;
  pricing?: OpenRouterModelPricing | null;
  top_provider?: OpenRouterTopProvider | null;
  per_request_limits?: Record<string, any> | null;
  supported_parameters?: string[] | null;
  homepageUrl?: string | null;
}
// --- End OpenRouter Model Structure ---

// --- Lighter Model Type for Global Lists ---
export interface ModelListItem {
  id: string; // Combined ID: providerId:modelId
  name: string;
  providerId: string;
  providerName: string;
  metadataSummary: {
    // Contains only essential fields for list display and filtering
    context_length?: number | null;
    supported_parameters?: string[] | null;
    input_modalities?: string[] | null;
    output_modalities?: string[] | null;
    pricing?: OpenRouterModelPricing | null;
    description?: string | null;
    created?: number | null;
    homepageUrl?: string | null;
  };
}
// --- End Lighter Model Type ---

export type DbProviderType =
  | "openai"
  | "google"
  | "openrouter"
  | "ollama"
  | "openai-compatible"
  | "mistral"
  | "anthropic"
  | "xai";

// Stored in DB for API Keys
export interface DbApiKey extends DbBase {
  name: string;
  value: string;
  providerId: string; // This should ideally be DbProviderType for clarity if keys are type-specific
}

// Stored in DB for Provider Configurations
export interface DbProviderConfig extends DbBase {
  name: string;
  type: DbProviderType;
  isEnabled: boolean;
  apiKeyId: string | null;
  baseURL: string | null;
  enabledModels: string[] | null; // Stores simple model IDs, not combined
  autoFetchModels: boolean;
  fetchedModels: OpenRouterModel[] | null; // Stores full OpenRouterModel definitions
  modelsLastFetchedAt: Date | null;
}

// Runtime representation of a Model (used when a model is actively selected/used)
export interface AiModelConfig {
  id: string; // Combined ID
  name: string;
  providerId: string;
  providerName: string;
  instance: any; // The actual AI SDK model instance
  metadata: OpenRouterModel | null; // Full metadata for the selected model
}

// Runtime representation of a Provider (less critical for selection, more for info)
export interface AiProviderConfig {
  id: string;
  name: string;
  type: DbProviderType;
  allAvailableModels: OpenRouterModel[]; // Full definitions for a specific provider
}
