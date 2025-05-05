// src/lib/litechat/provider-helpers.ts
// Line 7: Remove unused import

import type {
  DbProviderConfig,
  DbProviderType,
  AiModelConfig,
  // OpenRouterModel,
} from "@/types/litechat/provider";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createOllama } from "ollama-ai-provider";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { useProviderStore } from "@/store/provider.store";

// --- Helper Functions (Moved and Exported) ---

/**
 * Combines provider and model IDs into a single string.
 * @param providerId The ID of the provider config.
 * @param modelId The specific model ID.
 * @returns A combined string ID.
 */
export const combineModelId = (providerId: string, modelId: string): string =>
  `${providerId}:${modelId}`;

/**
 * Splits a combined model ID string back into provider and model IDs.
 * @param combinedId The combined ID string (e.g., "providerId:modelId").
 * @returns An object containing providerId and modelId (or null if invalid).
 */
export const splitModelId = (
  combinedId: string | null,
): { providerId: string | null; modelId: string | null } => {
  if (!combinedId || !combinedId.includes(":")) {
    return { providerId: null, modelId: null };
  }
  const parts = combinedId.split(":");
  // Handle potential cases where modelId itself contains ':'
  const providerId = parts[0];
  const modelId = parts.slice(1).join(":");
  return { providerId, modelId };
};

// --- Provider Type Helpers ---

export const requiresApiKey = (type: DbProviderType | null): boolean => {
  return type === "openai" || type === "openrouter" || type === "google";
};

export const requiresBaseURL = (type: DbProviderType | null): boolean => {
  return type === "ollama" || type === "openai-compatible";
};

export const supportsModelFetching = (type: DbProviderType | null): boolean => {
  return (
    type === "openai" ||
    type === "openrouter" ||
    type === "ollama" ||
    type === "openai-compatible"
  );
};

export const PROVIDER_TYPES: { value: DbProviderType; label: string }[] = [
  { value: "openai", label: "OpenAI" },
  { value: "google", label: "Google Gemini" },
  { value: "openrouter", label: "OpenRouter" },
  { value: "ollama", label: "Ollama" },
  { value: "openai-compatible", label: "OpenAI-Compatible (LMStudio, etc.)" },
];

export const REQUIRES_API_KEY_TYPES: DbProviderType[] = [
  "openai",
  "openrouter",
  "google",
];

// --- Default Models (Simplified - Primary source should be fetched) ---
// Keep this minimal, as the fetcher now maps to OpenRouterModel
export const DEFAULT_MODELS: Record<
  DbProviderType,
  { id: string; name: string }[] // Store only basic info here
> = {
  openai: [{ id: "gpt-4o", name: "GPT-4o" }],
  google: [
    { id: "gemini-1.5-flash-latest", name: "Gemini 1.5 Flash" },
    { id: "gemini-1.5-pro-latest", name: "Gemini 1.5 Pro" },
  ],
  openrouter: [],
  ollama: [{ id: "llama3", name: "Llama 3 (Ollama)" }],
  "openai-compatible": [],
};

// --- Instantiation and Configuration Helpers ---

export const ensureV1Path = (baseUrl: string): string => {
  try {
    const trimmed = baseUrl.replace(/\/+$/, "");
    // More robust check for existing /vN path
    if (/\/(v\d+(\.\d+)*)$/.test(trimmed)) {
      return trimmed;
    }
    return trimmed + "/v1";
  } catch (e) {
    console.error("Error processing base URL:", baseUrl, e);
    return baseUrl.replace(/\/+$/, "");
  }
};

export function instantiateModelInstance(
  config: DbProviderConfig,
  modelId: string,
  apiKey?: string,
): any | null {
  try {
    switch (config.type) {
      case "openai":
        return createOpenAI({ apiKey })(modelId);
      case "google":
        return createGoogleGenerativeAI({ apiKey })(modelId);
      case "openrouter":
        return createOpenRouter({ apiKey })(modelId);
      case "ollama":
        return createOllama({ baseURL: config.baseURL ?? undefined })(modelId);
      case "openai-compatible":
        if (!config.baseURL) throw new Error("Base URL required");
        return createOpenAICompatible({
          baseURL: ensureV1Path(config.baseURL),
          apiKey,
          // Pass compatibility: 'strict' if needed, or leave default
          // compatibility: 'strict',
          // Provide a default name if config.name is missing
          name: config.name || "Custom API",
        })(modelId);
      default:
        console.warn(`Unsupported provider type: ${config.type}`);
        return null;
    }
  } catch (e) {
    console.error(`Failed instantiate model ${modelId} for ${config.name}:`, e);
    return null;
  }
}

// Updated to use the full OpenRouterModel metadata
export function createAiModelConfig(
  config: DbProviderConfig,
  modelId: string,
  apiKey?: string,
): AiModelConfig | undefined {
  // Get all available models (which are now OpenRouterModel type)
  const allAvailable = useProviderStore
    .getState()
    .getAllAvailableModelDefsForProvider(config.id);

  // Find the specific model definition using the modelId
  const modelInfo = allAvailable.find((m) => m.id === modelId);

  // If model definition not found, return undefined
  if (!modelInfo) {
    console.warn(
      `Model definition not found for ${modelId} in provider ${config.name}`,
    );
    return undefined;
  }

  // Instantiate the AI SDK model instance
  const instance = instantiateModelInstance(config, modelId, apiKey);
  if (!instance) {
    console.warn(
      `Failed to instantiate AI SDK instance for ${modelId} from provider ${config.name}`,
    );
    return undefined;
  }

  // Construct the AiModelConfig object
  return {
    id: combineModelId(config.id, modelId),
    name: modelInfo.name,
    providerId: config.id,
    providerName: config.name,
    instance,
    metadata: modelInfo,
  };
}
export const DEFAULT_SUPPORTED_PARAMS: Record<string, string[]> = {
  openai: [
    "max_tokens",
    "temperature",
    "top_p",
    "stop",
    "presence_penalty",
    "frequency_penalty",
    "seed",
    "logit_bias",
    "response_format",
    "tools",
    "tool_choice",
    "logprobs",
    "top_logprobs",
  ],
  google: [
    "max_tokens",
    "temperature",
    "top_p",
    "top_k",
    "stop",
    "tools",
    "tool_choice",
  ],
  ollama: [
    "max_tokens",
    "temperature",
    "top_p",
    "top_k",
    "stop",
    "presence_penalty",
    "frequency_penalty",
    "seed",
    "repetition_penalty",
    "response_format",
  ],
  "openai-compatible": [
    // Assume similar to OpenAI, but may vary widely
    "max_tokens",
    "temperature",
    "top_p",
    "stop",
    "presence_penalty",
    "frequency_penalty",
    "seed",
    "logit_bias",
    "response_format",
    "tools",
    "tool_choice",
    "logprobs",
    "top_logprobs",
    "repetition_penalty",
    "min_p",
    "top_k",
  ],
  openrouter: [],
};
