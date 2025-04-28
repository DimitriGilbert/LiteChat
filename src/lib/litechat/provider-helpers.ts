// src/lib/litechat/provider-helpers.ts
import type {
  DbProviderConfig,
  DbProviderType,
  AiModelConfig,
} from "@/types/litechat/provider";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createOllama } from "ollama-ai-provider";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

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

// --- Default Models ---

export const DEFAULT_MODELS: Record<
  DbProviderType,
  { id: string; name: string; metadata?: Record<string, any> }[] // Add metadata
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
    if (/\/(v\d+)$/.test(trimmed)) {
      return trimmed;
    }
    return trimmed + "/v1";
  } catch (e) {
    console.error("Error processing base URL:", baseUrl, e);
    return baseUrl.replace(/\/+$/, "");
  }
};

// Instantiates the AI SDK model instance
export function instantiateModelInstance(
  config: DbProviderConfig,
  modelId: string, // Simple model ID (e.g., "gpt-4o")
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

// Creates the runtime AiModelConfig object
export function createAiModelConfig(
  config: DbProviderConfig,
  modelId: string, // Simple model ID (e.g., "gpt-4o")
  apiKey?: string,
): AiModelConfig | undefined {
  const providerTypeKey = config.type as keyof typeof DEFAULT_MODELS;
  const allAvailable =
    config.fetchedModels && config.fetchedModels.length > 0
      ? config.fetchedModels
      : DEFAULT_MODELS[providerTypeKey] || [];
  const modelInfo = allAvailable.find((m) => m.id === modelId);
  if (!modelInfo) return undefined;

  const instance = instantiateModelInstance(config, modelId, apiKey);
  if (!instance) return undefined;

  const supportsImageGen = config.type === "openai";
  const supportsTools = ["openai", "google", "openrouter"].includes(
    config.type,
  );

  return {
    id: `${config.id}:${modelId}`, // Combined ID
    name: modelInfo.name,
    providerId: config.id,
    providerName: config.name,
    instance,
    supportsImageGeneration: supportsImageGen,
    supportsToolCalling: supportsTools,
    metadata: modelInfo.metadata, // Include metadata
  };
}

// getDefaultModelIdForProvider REMOVED - Default selection is now handled globally in the store
