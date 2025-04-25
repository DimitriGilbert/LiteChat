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

export const DEFAULT_MODELS: Record<
  DbProviderType,
  { id: string; name: string }[]
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
          // Add the name property
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

export function createAiModelConfig(
  config: DbProviderConfig,
  modelId: string,
  apiKey?: string,
): AiModelConfig | undefined {
  const providerTypeKey = config.type as keyof typeof DEFAULT_MODELS;
  const allAvailable = config.fetchedModels?.length
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
  const availableModels = providerConfig.fetchedModels?.length
    ? providerConfig.fetchedModels
    : DEFAULT_MODELS[providerTypeKey] || [];
  if (availableModels.length === 0) return null;
  const enabledModelIds = providerConfig.enabledModels ?? [];
  let potentialModels = availableModels;
  if (enabledModelIds.length > 0) {
    const filtered = availableModels.filter((m) =>
      enabledModelIds.includes(m.id),
    );
    if (filtered.length > 0) potentialModels = filtered;
    else
      console.warn(
        `Provider ${providerConfig.id}: enabledModels filter empty.`,
      );
  }
  const sortOrder = providerConfig.modelSortOrder ?? [];
  if (sortOrder.length > 0 && potentialModels.length > 0) {
    const orderedList: { id: string; name: string }[] = [];
    const addedIds = new Set<string>();
    const potentialMap = new Map(potentialModels.map((m) => [m.id, m]));
    for (const mId of sortOrder) {
      const m = potentialMap.get(mId);
      if (m && !addedIds.has(mId)) {
        orderedList.push(m);
        addedIds.add(mId);
      }
    }
    const remaining = potentialModels
      .filter((m) => !addedIds.has(m.id))
      .sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));
    potentialModels = [...orderedList, ...remaining];
  } else {
    potentialModels.sort((a, b) =>
      (a.name || a.id).localeCompare(b.name || b.id),
    );
  }
  return potentialModels[0]?.id ?? null;
};
