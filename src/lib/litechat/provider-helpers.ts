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
import { createMistral } from "@ai-sdk/mistral";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createXai } from "@ai-sdk/xai";
import { createFal } from "@ai-sdk/fal";
import { createReplicate } from "@ai-sdk/replicate";
import { createLuma } from "@ai-sdk/luma";
import { createDeepInfra } from "@ai-sdk/deepinfra";
import { createFireworks } from "@ai-sdk/fireworks";
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
  return type === "openai" || type === "openrouter" || type === "google" || type === "mistral" || type === "anthropic" || type === "xai" || type === "fal" || type === "replicate" || type === "luma" || type === "deepinfra" || type === "fireworks";
};

export const optionalApiKey = (type: DbProviderType | null): boolean => {
  return type === "openai-compatible";
};

export const requiresBaseURL = (type: DbProviderType | null): boolean => {
  return type === "ollama" || type === "openai-compatible";
};

export const supportsModelFetching = (type: DbProviderType | null): boolean => {
  return (
    type === "openai" ||
    type === "openrouter" ||
    type === "ollama" ||
    type === "openai-compatible" ||
    type === "mistral" ||
    type === "anthropic" ||
    type === "xai" ||
    type === "google" ||
    type === "fal" ||
    type === "replicate" ||
    type === "deepinfra" ||
    type === "fireworks"
  );
};

export const PROVIDER_TYPES: { value: DbProviderType; label: string }[] = [
  { value: "openrouter", label: "OpenRouter" },
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic Claude" },
  { value: "google", label: "Google Gemini" },
  { value: "mistral", label: "Mistral AI" },
  { value: "xai", label: "xAI Grok" },
  { value: "fal", label: "fal.ai (Image Generation)" },
  { value: "replicate", label: "Replicate (Image Generation)" },
  { value: "luma", label: "Luma AI (Video Generation)" },
  { value: "deepinfra", label: "DeepInfra" },
  { value: "fireworks", label: "Fireworks AI" },
  { value: "ollama", label: "Ollama" },
  { value: "openai-compatible", label: "OpenAI-Compatible (LMStudio, etc.)" },
];

// Default provider type for new provider forms
export const DEFAULT_PROVIDER_TYPE: DbProviderType = "openrouter";

export const REQUIRES_API_KEY_TYPES: DbProviderType[] = [
  "openai",
  "openrouter",
  "google",
  "mistral",
  "anthropic",
  "xai",
  "fal",
  "replicate",
  "luma",
  "deepinfra",
  "fireworks",
];

export const OPTIONAL_API_KEY_TYPES: DbProviderType[] = [
  "openai-compatible",
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
  mistral: [
    { id: "mistral-small-latest", name: "Mistral Small (Latest)" },
    { id: "mistral-medium-3", name: "Mistral Medium 3" },
    { id: "mistral-large-latest", name: "Mistral Large (Latest)" },
    { id: "ministral-3b-latest", name: "Ministral 3B (Latest)" },
    { id: "ministral-8b-latest", name: "Ministral 8B (Latest)" },
    { id: "pixtral-large-latest", name: "Pixtral Large (Latest)" },
    { id: "codestral-latest", name: "Codestral (Latest)" },
    { id: "codestral-2501", name: "Codestral 2501" },
    { id: "magistral-small", name: "Magistral Small (Reasoning)" },
    { id: "magistral-medium", name: "Magistral Medium (Reasoning)" },
  ],
  anthropic: [
    { id: "claude-opus-4-20250514", name: "Claude Opus 4 (Latest)" },
    { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4 (Latest)" },
    { id: "claude-3-7-sonnet-20250219", name: "Claude 3.7 Sonnet (Reasoning)" },
    { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet" },
    { id: "claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku" },
    { id: "claude-3-opus-20240229", name: "Claude 3 Opus" },
  ],
  xai: [
    { id: "grok-4", name: "Grok 4 (Latest)" },
    { id: "grok-4-heavy", name: "Grok 4 Heavy" },
    { id: "grok-3", name: "Grok 3" },
    { id: "grok-3-fast", name: "Grok 3 Fast" },
    { id: "grok-3-mini", name: "Grok 3 Mini" },
    { id: "grok-3-mini-fast", name: "Grok 3 Mini Fast" },
    { id: "grok-2-1212", name: "Grok 2" },
    { id: "grok-2-vision-1212", name: "Grok 2 Vision" },
  ],
  fal: [
    { id: "fal-ai/flux-pro", name: "FLUX Pro" },
    { id: "fal-ai/flux-dev", name: "FLUX Dev" },
    { id: "fal-ai/flux-schnell", name: "FLUX Schnell" },
    { id: "fal-ai/stable-diffusion-v3-medium", name: "Stable Diffusion v3 Medium" },
    { id: "fal-ai/recraft-v3", name: "Recraft v3" },
  ],
  replicate: [
    { id: "black-forest-labs/flux-schnell", name: "FLUX Schnell" },
    { id: "black-forest-labs/flux-dev", name: "FLUX Dev" },
    { id: "stability-ai/stable-diffusion-3", name: "Stable Diffusion 3" },
    { id: "stability-ai/sdxl", name: "SDXL" },
  ],
  luma: [
    { id: "dream-machine-v1", name: "Dream Machine v1" },
    { id: "photon-1", name: "Photon 1" },
  ],
  deepinfra: [
    { id: "black-forest-labs/FLUX.1-schnell", name: "FLUX.1 Schnell" },
    { id: "black-forest-labs/FLUX.1-dev", name: "FLUX.1 Dev" },
    { id: "stabilityai/stable-diffusion-3-medium", name: "Stable Diffusion 3 Medium" },
  ],
  fireworks: [
    { id: "stable-diffusion-xl-1024-v1-0", name: "Stable Diffusion XL" },
    { id: "playground-v2-1024", name: "Playground v2" },
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
        return createOpenRouter({
          apiKey,
          extraBody: { include_reasoning: true },
          headers: {
            'X-Title': 'LiteChat',
          },
        })(modelId);
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
      case "mistral":
        return createMistral({ apiKey })(modelId);
      case "anthropic":
        return createAnthropic({ apiKey })(modelId);
      case "xai":
        return createXai({ apiKey })(modelId);
      case "fal":
        return createFal({ apiKey }).image(modelId);
      case "replicate":
        return createReplicate({ apiToken: apiKey }).image(modelId);
      case "luma":
        return createLuma({ apiKey }).image(modelId);
      case "deepinfra":
        return createDeepInfra({ apiKey }).image(modelId);
      case "fireworks":
        return createFireworks({ apiKey }).image(modelId);
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
  mistral: [
    "max_tokens",
    "temperature",
    "top_p",
    "stop",
    "tools",
    "tool_choice",
    "seed",
    "response_format",
  ],
  anthropic: [
    "max_tokens",
    "temperature",
    "top_p",
    "top_k",
    "stop",
    "tools",
    "tool_choice",
  ],
  xai: [
    "max_tokens",
    "temperature",
    "top_p",
    "stop",
    "tools",
    "tool_choice",
    "seed",
    "response_format",
  ],
  fal: [
    "width",
    "height",
    "steps",
    "guidance_scale",
    "seed",
    "scheduler",
  ],
  replicate: [
    "width",
    "height",
    "steps",
    "guidance_scale",
    "seed",
    "scheduler",
  ],
  luma: [
    "width",
    "height",
    "duration",
    "aspect_ratio",
    "loop",
  ],
  deepinfra: [
    "width",
    "height",
    "steps",
    "guidance_scale",
    "seed",
  ],
  fireworks: [
    "width",
    "height",
    "steps",
    "guidance_scale",
    "seed",
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
