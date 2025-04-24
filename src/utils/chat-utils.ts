// src/utils/chat-utils.ts
import type {
  CustomSettingTab,
  CustomPromptAction,
  CustomMessageAction,
  DbProviderConfig,
  DbProviderType,
  DbMessage,
  Message,
  CoreMessage,
  MessageContent,
  Role,
  AiModelConfig,
} from "@/lib/types";
import { createOpenAI } from "@ai-sdk/openai"; // Added
import { createGoogleGenerativeAI } from "@ai-sdk/google"; // Added
import { createOpenRouter } from "@openrouter/ai-sdk-provider"; // Added
import { createOllama } from "ollama-ai-provider"; // Added
import { createOpenAICompatible } from "@ai-sdk/openai-compatible"; // Added
import { DEFAULT_MODELS } from "@/lib/litechat"; // Added

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

/**
 * Converts an array of DbMessage or Message objects to the CoreMessage format
 * expected by the AI SDK (filtering out non-user/assistant/system roles).
 */
export function convertDbMessagesToCoreMessages(
  messages: Array<DbMessage | Message>,
): CoreMessage[] {
  const validRoles: Role[] = ["user", "assistant", "system"];
  return messages
    .filter(
      (m) => validRoles.includes(m.role), // Filter only by valid roles for AI interaction
    )
    .map((m) => ({
      role: m.role,
      content: m.content as MessageContent, // Cast content, assuming it's already correct
      // Add tool_calls and tool_call_id if they exist and are needed by the SDK format
      // tool_calls: m.toolCalls, // Example if tool calls were stored
      // tool_call_id: m.toolCallId, // Example if tool call ID was stored
    })) as CoreMessage[]; // Cast the final array to CoreMessage[]
}

export const EMPTY_CUSTOM_SETTINGS_TABS: CustomSettingTab[] = [];
export const EMPTY_CUSTOM_PROMPT_ACTIONS: CustomPromptAction[] = [];
export const EMPTY_CUSTOM_MESSAGE_ACTIONS: CustomMessageAction[] = [];
export const EMPTY_DB_PROVIDER_CONFIGS: DbProviderConfig[] = [];

export const ensureV1Path = (baseUrl: string): string => {
  try {
    // Trim trailing slashes ONLY for the final return value if needed,
    // but perform checks on the original or slightly modified string.
    const trimmedForV1Check = baseUrl.replace(/\/+$/, ""); // Trim only for the /v1 check

    if (trimmedForV1Check.endsWith("/v1")) {
      return trimmedForV1Check; // Return the version ending in /v1 (already trimmed)
    } else if (baseUrl.endsWith("/")) {
      // Ends with '/', append 'v1'
      return baseUrl + "v1";
    } else {
      // Doesn't end with '/' or '/v1', append '/v1'
      return baseUrl + "/v1";
    }
  } catch (e) {
    console.error("Error processing base URL for /v1 path:", baseUrl, e);
    // Fallback: return original URL trimmed of trailing slashes
    return baseUrl.replace(/\/+$/, "");
  }
};

/**
 * Instantiates an AI model instance based on provider configuration.
 * @param config The provider configuration from the database.
 * @param modelId The specific model ID to instantiate.
 * @param apiKey Optional API key value.
 * @returns The instantiated model object or null if instantiation fails.
 */
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

/**
 * Creates an AiModelConfig object including the instantiated model.
 * @param config The provider configuration.
 * @param modelId The model ID.
 * @param apiKey Optional API key.
 * @returns AiModelConfig object or null if instantiation fails.
 */
export function createAiModelConfig(
  config: DbProviderConfig,
  modelId: string,
  apiKey?: string,
): AiModelConfig | undefined {
  const allAvailable =
    config.fetchedModels && config.fetchedModels.length > 0
      ? config.fetchedModels
      : DEFAULT_MODELS[config.type] || [];
  const modelInfo = allAvailable.find((m) => m.id === modelId);
  if (!modelInfo) return undefined;

  const instance = instantiateModelInstance(config, modelId, apiKey);
  if (!instance) return undefined;

  const supportsImageGen = config.type === "openai"; // Example, adjust as needed
  const supportsTools = ["openai", "google", "openrouter"].includes(
    config.type,
  ); // Example

  return {
    id: modelInfo.id,
    name: modelInfo.name,
    instance: instance,
    supportsImageGeneration: supportsImageGen,
    supportsToolCalling: supportsTools,
  };
}
