// src/utils/chat-utils.ts

// Add DbProviderConfig and DbProviderType to imports
import type {
  CustomSettingTab,
  CustomPromptAction,
  CustomMessageAction,
  DbProviderConfig, // Added
  DbProviderType, // Added
  DbMessage,
  Message,
  CoreMessage,
  MessageContent,
  Role,
  AiModelConfig,
} from "@/lib/types";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createOllama } from "ollama-ai-provider";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { DEFAULT_MODELS } from "@/lib/litechat";

// ... (decodeUint8Array, CODE_FILE_EXTENSIONS, isCodeFile, requiresApiKey remain the same) ...
export const decodeUint8Array = (arr: Uint8Array): string => {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(arr);
  } catch (e) {
    console.warn(
      "Failed to decode Uint8Array as strict UTF-8, trying lossy:",
      e,
    );
    return new TextDecoder("utf-8", { fatal: false }).decode(arr);
  }
};

export const CODE_FILE_EXTENSIONS = new Set([
  "js",
  "jsx",
  "ts",
  "tsx",
  "html",
  "css",
  "scss",
  "less",
  "php",
  "py",
  "rb",
  "java",
  "cpp",
  "c",
  "cs",
  "go",
  "rs",
  "json",
  "yaml",
  "yml",
  "xml",
  "csv",
  "sql",
  "md",
  "markdown",
  "txt",
  "rst",
  "sh",
  "bash",
  "zsh",
  "fish",
  "bat",
  "ps1",
  "env",
  "ini",
  "conf",
  "config",
  "toml",
  "gradle",
  "dockerfile",
  "gitignore",
]);

export const isCodeFile = (filename: string): boolean => {
  const extension = filename.split(".").pop()?.toLowerCase() || "";
  return CODE_FILE_EXTENSIONS.has(extension);
};

export const requiresApiKey = (type: DbProviderType | null): boolean => {
  return type === "openai" || type === "openrouter" || type === "google";
};

// ... (convertDbMessagesToCoreMessages, EMPTY_* constants, ensureV1Path remain the same) ...
export function convertDbMessagesToCoreMessages(
  messages: Array<DbMessage | Message>,
): CoreMessage[] {
  const validRoles: Role[] = ["user", "assistant", "system"];
  return messages
    .filter((m) => validRoles.includes(m.role))
    .map((m) => ({
      role: m.role,
      content: m.content as MessageContent,
    })) as CoreMessage[];
}

export const EMPTY_CUSTOM_SETTINGS_TABS: CustomSettingTab[] = [];
export const EMPTY_CUSTOM_PROMPT_ACTIONS: CustomPromptAction[] = [];
export const EMPTY_CUSTOM_MESSAGE_ACTIONS: CustomMessageAction[] = [];
export const EMPTY_DB_PROVIDER_CONFIGS: DbProviderConfig[] = [];

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
    return baseUrl.replace(/\/+$/, "");
  }
};

// --- Moved Helper Function ---
/**
 * Helper to determine the default model for a provider config.
 * Considers fetched models, enabled models, and sort order.
 */
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
// --- End Moved Helper Function ---

// ... (instantiateModelInstance, createAiModelConfig remain the same) ...
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
        if (!config.baseURL) {
          throw new Error("Base URL required for openai-compatible");
        }
        return createOpenAICompatible({
          baseURL: ensureV1Path(config.baseURL),
          apiKey: apiKey,
          name: config.name || "Custom API",
        })(modelId);
      default:
        throw new Error(`Unsupported provider type: ${config.type}`);
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
  if (!instance) return undefined;

  const supportsImageGen = config.type === "openai";
  const supportsTools = ["openai", "google", "openrouter"].includes(
    config.type,
  );

  return {
    id: modelInfo.id,
    name: modelInfo.name,
    instance: instance,
    supportsImageGeneration: supportsImageGen,
    supportsToolCalling: supportsTools,
  };
}
