// src/lib/litechat/provider-helpers.ts
import type {
  DbProviderConfig,
  DbProviderType,
  AiModelConfig,
} from "@/types/litechat/provider.types"; // Use new type location
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createOllama } from "ollama-ai-provider";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

// --- Constants (Moved from old litechat.ts/chat-utils.ts) ---

// Define default models here as they are closely tied to provider logic
export const DEFAULT_MODELS: Record<
  DbProviderType,
  { id: string; name: string }[]
> = {
  openai: [{ id: "gpt-4o", name: "GPT-4o" }],
  google: [
    { id: "gemini-1.5-flash-latest", name: "Gemini 1.5 Flash" },
    { id: "gemini-1.5-pro-latest", name: "Gemini 1.5 Pro" },
  ],
  openrouter: [], // OpenRouter models should ideally be fetched
  ollama: [{ id: "llama3", name: "Llama 3 (Ollama)" }], // Example default
  "openai-compatible": [], // No sensible default
};

// --- Helper Functions (Moved/Adapted) ---

export const ensureV1Path = (baseUrl: string): string => {
  try {
    const trimmedForV1Check = baseUrl.replace(/\/+$/, "");
    if (trimmedForV1Check.endsWith("/v1")) {
      return trimmedForV1Check;
    } else if (baseUrl.endsWith("/")) {
      return baseUrl + "v1";
    } else {
      return baseUrl + "/v1";
    }
  } catch (e) {
    console.error("Error processing base URL for /v1 path:", baseUrl, e);
    return baseUrl.replace(/\/+$/, ""); // Return trimmed on error
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
        // Ensure API key is passed if required by the specific model/API version
        return createGoogleGenerativeAI({ apiKey })(modelId);
      case "openrouter":
        return createOpenRouter({ apiKey })(modelId);
      case "ollama":
        return createOllama({ baseURL: config.baseURL ?? undefined })(modelId);
      case "openai-compatible":
        if (!config.baseURL) {
          throw new Error("Base URL required for openai-compatible");
        }
        return createOpenAICompatible({
          baseURL: ensureV1Path(config.baseURL),
          apiKey: apiKey, // Pass API key if provided
          // name: config.name || 'Custom API', // Optional name
        })(modelId);
      default:
        console.warn(
          `Unsupported provider type for instantiation: ${config.type}`,
        );
        return null; // Return null for unsupported types
    }
  } catch (e) {
    console.error(
      `Failed to instantiate model ${modelId} for provider ${config.name}:`,
      e,
    );
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
      : DEFAULT_MODELS[providerTypeKey] || [];
  const modelInfo = allAvailable.find((m) => m.id === modelId);
  if (!modelInfo) return undefined;

  const instance = instantiateModelInstance(config, modelId, apiKey);
  // Return undefined if instantiation fails
  if (!instance) return undefined;

  // Determine capabilities based on provider type (adjust as needed)
  const supportsImageGen = config.type === "openai"; // Example
  const supportsTools = ["openai", "google", "openrouter"].includes(
    config.type,
  ); // Example

  return {
    id: modelInfo.id,
    name: modelInfo.name,
    instance: instance,
    supportsImageGeneration: supportsImageGen,
    supportsToolCalling: supportsTools,
    // contextWindow: ... // Add if available
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
      : DEFAULT_MODELS[providerTypeKey] || [];

  if (availableModels.length === 0) return null;

  const enabledModelIds = providerConfig.enabledModels ?? [];
  let potentialModels = availableModels;

  // Filter by enabled models if the list is not empty
  if (enabledModelIds.length > 0) {
    const filteredByEnabled = availableModels.filter((m) =>
      enabledModelIds.includes(m.id),
    );
    // Only use the filtered list if it's not empty, otherwise fallback to all available
    if (filteredByEnabled.length > 0) {
      potentialModels = filteredByEnabled;
    } else {
      console.warn(
        `Provider ${providerConfig.id}: enabledModels filter resulted in empty list. Considering all available models for default selection.`,
      );
    }
  }

  // Apply sort order if available
  const sortOrder = providerConfig.modelSortOrder ?? [];
  if (sortOrder.length > 0 && potentialModels.length > 0) {
    const orderedList: { id: string; name: string }[] = [];
    const addedIds = new Set<string>();
    const potentialModelMap = new Map(potentialModels.map((m) => [m.id, m]));
    for (const modelId of sortOrder) {
      const model = potentialModelMap.get(modelId);
      // Ensure the model from sort order is actually in the potential list
      if (model && !addedIds.has(modelId)) {
        orderedList.push(model);
        addedIds.add(modelId);
      }
    }
    // Add remaining potential models (those not in sort order) sorted alphabetically
    const remainingEnabled = potentialModels
      .filter((m) => !addedIds.has(m.id))
      .sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));
    potentialModels = [...orderedList, ...remainingEnabled];
  } else {
    // Default sort alphabetically if no sort order defined
    potentialModels.sort((a, b) =>
      (a.name || a.id).localeCompare(b.name || b.id),
    );
  }

  // Return the ID of the first model in the final sorted/filtered list
  return potentialModels[0]?.id ?? null;
};
