// src/lib/litechat/provider-helpers.ts
// FULL FILE

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
  { value: "openrouter", label: "OpenRouter" },
  { value: "openai", label: "OpenAI" },
  { value: "ollama", label: "Ollama" },
  { value: "openai-compatible", label: "OpenAI-Compatible (LMStudio, etc.)" },
  { value: "google", label: "Google Gemini" },
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
  openai: [
    { id: "gpt-4o", name: "GPT-4o" },
    { id: "dall-e-3", name: "DALL-E 3" },
    { id: "dall-e-2", name: "DALL-E 2" },
    { id: "o3-mini", name: "o3-mini" },
    { id: "o4-mini", name: "o4-mini" },
    { id: "o4-mini-high", name: "o4-mini-high" },
    { id: "o3-mini-high", name: "o3-mini-high" },
    { id: "o3", name: "o3" },
    { id: "4.1", name: "4.1" },
    { id: "4.1-mini", name: "4.1-mini" },
    { id: "4.1-nano", name: "4.1-nano" },
    { id: "o3-pro", name: "o3-pro" },
    { id: "codex-mini", name: "codex-mini" },
  ],
  google: [
    { id: "gemini-2.5-pro-preview", name: "Gemini 2.5 Pro Preview" },
    { id: "gemini-2.5-flash-preview-05-20:thinking", name: "Gemini 2.5 Flash Preview (Thinking)" },
    { id: "gemini-2.5-flash-preview", name: "Gemini 2.5 Flash Preview" },
    { id: "gemini-2.0-flash-001", name: "Gemini 2.0 Flash" },
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

// --- NEW: Ensure Ollama base URL always includes /api ---
export function ensureOllamaApiBase(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, "");
  if (trimmed.endsWith("/api")) return trimmed;
  return trimmed + "/api";
}

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
        // Create the OpenRouter model instance
        const openRouterInstance = createOpenRouter({
          apiKey,
          extraBody: { include_reasoning: true },
        });
        
        // Get the model but intercept doStream to fix the toolCall.sent bug
        const model = openRouterInstance(modelId);
        const originalDoStream = model.doStream.bind(model);
        
        model.doStream = async function(options: any) {
          const result = await originalDoStream(options);
          
          // Override the stream to fix the OpenRouter provider bug
          const reader = result.stream.getReader();
          const stream = new ReadableStream({
            async start(controller) {
              try {
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;
                  
                  // Pass through all chunks normally - the bug is in the provider's internal state
                  // We can't easily fix it without rewriting the entire provider
                  controller.enqueue(value);
                }
              } catch (error) {
                // If we get the "Cannot read properties of undefined (reading 'sent')" error
                // Try to recover by closing the stream gracefully
                if (error && typeof error === 'object' && 'message' in error && 
                    typeof error.message === 'string' && error.message.includes("reading 'sent'")) {
                  console.warn('[OpenRouter Provider Bug] Caught toolCall.sent error, attempting graceful recovery');
                  // Don't re-throw, just end the stream
                } else {
                  controller.error(error);
                }
              } finally {
                controller.close();
              }
            }
          });
          
          return { ...result, stream };
        };
        
        return model;
      case "ollama":
        // Always ensure /api is present in the base URL
        return createOllama({ baseURL: config.baseURL ? ensureOllamaApiBase(config.baseURL) : undefined })(modelId);
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
