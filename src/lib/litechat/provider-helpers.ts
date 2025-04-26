// src/lib/litechat/provider-helpers.ts
import type {
  DbProviderConfig,
  DbProviderType,
  AiModelConfig,
} from "@/types/litechat/provider"; // Use correct type path
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

// *** ADDED PROVIDER_TYPES EXPORT HERE ***
export const PROVIDER_TYPES: { value: DbProviderType; label: string }[] = [
  { value: "openai", label: "OpenAI" },
  { value: "google", label: "Google Gemini" },
  { value: "openrouter", label: "OpenRouter" },
  { value: "ollama", label: "Ollama" },
  { value: "openai-compatible", label: "OpenAI-Compatible (LMStudio, etc.)" },
];

// This might be redundant if requiresApiKey covers it, but keep for clarity if needed elsewhere
export const REQUIRES_API_KEY_TYPES: DbProviderType[] = [
  "openai",
  "openrouter",
  "google",
];

// --- Default Models ---

// Consolidated default models - Keep this central source of truth
export const DEFAULT_MODELS: Record<
  DbProviderType,
  { id: string; name: string }[]
> = {
  openai: [{ id: "gpt-4o", name: "GPT-4o" }],
  google: [
    // Note: Specific Gemini model IDs can change. Use identifiers known to the SDK.
    { id: "gemini-1.5-flash-latest", name: "Gemini 1.5 Flash" },
    { id: "gemini-1.5-pro-latest", name: "Gemini 1.5 Pro" },
    // Add other relevant Gemini models if needed
  ],
  openrouter: [], // OpenRouter models are fetched dynamically
  ollama: [{ id: "llama3", name: "Llama 3 (Ollama)" }], // Example, user needs Ollama running
  "openai-compatible": [], // No defaults, requires fetching or manual entry
};

// --- Instantiation and Configuration Helpers ---

export const ensureV1Path = (baseUrl: string): string => {
  try {
    const trimmed = baseUrl.replace(/\/+$/, "");
    return trimmed.endsWith("/v1")
      ? trimmed
      : baseUrl.endsWith("/")
        ? baseUrl + "v1"
        : baseUrl + "/v1";
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
          name: config.name || "Custom API", // Add the name property
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

export function createAiModelConfig(
  config: DbProviderConfig,
  modelId: string,
  apiKey?: string,
): AiModelConfig | undefined {
  const providerTypeKey = config.type as keyof typeof DEFAULT_MODELS;
  const allAvailable =
    config.fetchedModels && config.fetchedModels.length > 0
      ? config.fetchedModels
      : DEFAULT_MODELS[providerTypeKey] || []; // Use imported DEFAULT_MODELS
  const modelInfo = allAvailable.find((m) => m.id === modelId);
  if (!modelInfo) return undefined;

  const instance = instantiateModelInstance(config, modelId, apiKey);
  if (!instance) return undefined;

  const supportsImageGen = config.type === "openai";
  const supportsTools = ["openai", "google", "openrouter"].includes(
    config.type,
  );

  return {
    id: modelInfo.id,
    name: modelInfo.name,
    instance,
    supportsImageGeneration: supportsImageGen,
    supportsToolCalling: supportsTools,
  };
}

export const getDefaultModelIdForProvider = (
  providerConfig: DbProviderConfig | undefined,
): string | null => {
  if (!providerConfig) return null;

  const providerTypeKey = providerConfig.type as keyof typeof DEFAULT_MODELS;
  const availableModels =
    providerConfig.fetchedModels && providerConfig.fetchedModels.length > 0
      ? providerConfig.fetchedModels
      : DEFAULT_MODELS[providerTypeKey] || []; // Use imported DEFAULT_MODELS

  if (availableModels.length === 0) return null;

  const enabledModelIds = providerConfig.enabledModels ?? [];
  let potentialModels = availableModels;

  if (enabledModelIds.length > 0) {
    const filteredByEnabled = availableModels.filter((m: { id: string }) =>
      enabledModelIds.includes(m.id),
    );
    if (filteredByEnabled.length > 0) {
      potentialModels = filteredByEnabled;
    } else {
      console.warn(
        `Provider ${providerConfig.id}: enabledModels filter resulted in empty list. Considering all available models.`,
      );
    }
  }

  const sortOrder = providerConfig.modelSortOrder ?? [];
  if (sortOrder.length > 0 && potentialModels.length > 0) {
    const orderedList: { id: string; name: string }[] = [];
    const addedIds = new Set<string>();
    const potentialModelMap = new Map(
      potentialModels.map((m: { id: string; name: string }) => [m.id, m]),
    );
    for (const modelId of sortOrder) {
      const model = potentialModelMap.get(modelId);
      if (model && !addedIds.has(modelId)) {
        orderedList.push(model);
        addedIds.add(modelId);
      }
    }
    const remaining = potentialModels
      .filter((m: { id: string }) => !addedIds.has(m.id))
      .sort((a: { name: string }, b: { name: string }) =>
        a.name.localeCompare(b.name),
      );
    potentialModels = [...orderedList, ...remaining];
  } else {
    potentialModels.sort((a: { name: string }, b: { name: string }) =>
      a.name.localeCompare(b.name),
    );
  }

  return potentialModels[0]?.id ?? null;
};
