// src/services/model-fetcher.ts

import type {
  DbProviderConfig,
  OpenRouterModel,
} from "@/types/litechat/provider";
import { toast } from "sonner";
import {
  ensureV1Path,
  DEFAULT_SUPPORTED_PARAMS,
} from "@/lib/litechat/provider-helpers";

// Use OpenRouterModel as the return type
type FetchedModel = OpenRouterModel;

// Simple in-memory cache for fetched models
const fetchCache = new Map<string, Promise<FetchedModel[]>>();
const CACHE_DURATION_MS = 5 * 60 * 1000;

// --- Helper to Map Fetched Data to OpenRouterModel ---
const mapToOpenRouterModel = (
  fetchedData: any,
  providerType: DbProviderConfig["type"],
): OpenRouterModel => {
  const modelId = fetchedData.id || fetchedData.name;
  const modelName = fetchedData.name || modelId;

  // Extract homepage URL from various possible fields
  let homepageUrl: string | null = null;
  if (fetchedData.homepage) {
    homepageUrl = fetchedData.homepage;
  } else if (fetchedData.id && fetchedData.id.includes("huggingface:")) {
    // Extract HuggingFace model URL from ID like "huggingface:user/repo"
    const hfMatch = fetchedData.id.match(/huggingface:(.+)/);
    if (hfMatch) {
      homepageUrl = `https://huggingface.co/${hfMatch[1]}`;
    }
  } else if (fetchedData.source && typeof fetchedData.source === "string") {
    // Some APIs might provide source URL
    homepageUrl = fetchedData.source;
  }

  // Basic structure
  const model: OpenRouterModel = {
    id: modelId,
    name: modelName,
    created: fetchedData.created ?? null,
    description: fetchedData.description ?? null,
    context_length: fetchedData.context_length ?? null,
    architecture: {
      modality: fetchedData.architecture?.modality ?? "text->text",
      input_modalities: fetchedData.architecture?.input_modalities ?? ["text"],
      output_modalities: fetchedData.architecture?.output_modalities ?? [
        "text",
      ],
      tokenizer: fetchedData.architecture?.tokenizer ?? "Unknown",
      instruct_type: fetchedData.architecture?.instruct_type ?? null,
    },
    pricing: {
      prompt: fetchedData.pricing?.prompt ?? "0",
      completion: fetchedData.pricing?.completion ?? "0",
      request: fetchedData.pricing?.request ?? "0",
      image: fetchedData.pricing?.image ?? "0",
      web_search: fetchedData.pricing?.web_search ?? "0",
      internal_reasoning: fetchedData.pricing?.internal_reasoning ?? "0",
    },
    top_provider: {
      context_length:
        fetchedData.top_provider?.context_length ??
        fetchedData.context_length ??
        null,
      max_completion_tokens:
        fetchedData.top_provider?.max_completion_tokens ?? null,
      is_moderated: fetchedData.top_provider?.is_moderated ?? false,
    },
    per_request_limits: fetchedData.per_request_limits ?? null,
    supported_parameters:
      fetchedData.supported_parameters ??
      DEFAULT_SUPPORTED_PARAMS[providerType] ??
      [],
    homepageUrl: homepageUrl,
  };

  // Specific overrides or defaults based on provider type if needed
  if (providerType === "ollama") {
    // Ollama doesn't provide context length via /api/tags easily, might need /api/show
    // For now, leave it null or set a common default if known (e.g., 4096 for older models)
    model.context_length = model.context_length ?? 4096;
    // Fix: Add null check before accessing properties
    if (model.top_provider) {
      model.top_provider.context_length = model.context_length;
    }
    if (model.architecture) {
      model.architecture.tokenizer = "Ollama";
    }
  } else if (providerType === "openai") {
    // OpenAI context lengths (approximate, may change)
    if (modelId.includes("gpt-4")) model.context_length = 8192;
    if (modelId.includes("gpt-4-32k")) model.context_length = 32768;
    if (modelId.includes("gpt-4-turbo")) model.context_length = 128000;
    if (modelId.includes("gpt-4o")) model.context_length = 128000;
    if (modelId.includes("gpt-3.5-turbo")) model.context_length = 16385;
    // Fix: Add null check before accessing properties
    if (model.top_provider) {
      model.top_provider.context_length = model.context_length;
    }
    if (model.architecture) {
      model.architecture.tokenizer = "OpenAI";
    }
  } else if (providerType === "google") {
    // Google context lengths (approximate)
    if (modelId.includes("gemini-1.5")) model.context_length = 1048576;
    else if (modelId.includes("gemini")) model.context_length = 32768;
    // Fix: Add null check before accessing properties
    if (model.top_provider) {
      model.top_provider.context_length = model.context_length;
    }
    if (model.architecture) {
      model.architecture.tokenizer = "Google";
    }
  } else if (providerType === "openai-compatible") {
    model.context_length = model.context_length ?? 4096;
    // Fix: Add null check before accessing properties
    if (model.top_provider) {
      model.top_provider.context_length = model.context_length;
    }
    if (model.architecture) {
      model.architecture.tokenizer = "Compatible";
    }
  } else if (providerType === "mistral") {
    // Mistral context lengths (approximate)
    if (modelId.includes("ministral-3b")) model.context_length = 32768;
    else if (modelId.includes("ministral-8b")) model.context_length = 32768;
    else if (modelId.includes("mistral-small")) model.context_length = 32768;
    else if (modelId.includes("mistral-medium-3")) model.context_length = 128000;
    else if (modelId.includes("mistral-large")) model.context_length = 128000;
    else if (modelId.includes("pixtral")) model.context_length = 128000;
    else if (modelId.includes("codestral")) model.context_length = 32768;
    else if (modelId.includes("magistral")) model.context_length = 128000;
    else model.context_length = model.context_length ?? 32768;
    // Fix: Add null check before accessing properties
    if (model.top_provider) {
      model.top_provider.context_length = model.context_length;
    }
    if (model.architecture) {
      model.architecture.tokenizer = "Mistral";
    }
  } else if (providerType === "anthropic") {
    // Anthropic context lengths (approximate)
    if (modelId.includes("claude-opus-4")) model.context_length = 200000;
    else if (modelId.includes("claude-sonnet-4")) model.context_length = 200000;
    else if (modelId.includes("claude-3-7-sonnet")) model.context_length = 200000;
    else if (modelId.includes("claude-3-5-sonnet")) model.context_length = 200000;
    else if (modelId.includes("claude-3-5-haiku")) model.context_length = 200000;
    else if (modelId.includes("claude-3-opus")) model.context_length = 200000;
    else if (modelId.includes("claude-3-sonnet")) model.context_length = 200000;
    else if (modelId.includes("claude-3-haiku")) model.context_length = 200000;
    else model.context_length = model.context_length ?? 200000;
    // Fix: Add null check before accessing properties
    if (model.top_provider) {
      model.top_provider.context_length = model.context_length;
    }
    if (model.architecture) {
      model.architecture.tokenizer = "Anthropic";
    }
  } else if (providerType === "xai") {
    // xAI context lengths (approximate)
    if (modelId.includes("grok-4")) model.context_length = 128000;
    else if (modelId.includes("grok-3")) model.context_length = 128000;
    else if (modelId.includes("grok-2")) model.context_length = 131072;
    else if (modelId.includes("grok-beta")) model.context_length = 131072;
    else model.context_length = model.context_length ?? 128000;
    // Fix: Add null check before accessing properties
    if (model.top_provider) {
      model.top_provider.context_length = model.context_length;
    }
    if (model.architecture) {
      model.architecture.tokenizer = "xAI";
    }
  } else if (providerType === "fal" || providerType === "replicate" || providerType === "luma" || providerType === "deepinfra" || providerType === "fireworks") {
    // Image/Video generation providers - no text context length needed
    model.context_length = null;
    if (model.top_provider) {
      model.top_provider.context_length = null;
    }
    if (model.architecture) {
      model.architecture.tokenizer = providerType;
      model.architecture.modality = "text->image";
      model.architecture.input_modalities = ["text"];
      model.architecture.output_modalities = providerType === "luma" ? ["video"] : ["image"];
    }
  }

  return model;
};

/**
 * Fetches the list of available models for a given provider configuration.
 * Uses a simple time-based cache to avoid redundant requests.
 * Maps fetched data to the OpenRouterModel structure.
 * @param config The database configuration for the provider.
 * @param apiKey The API key value, if required and available.
 * @returns A promise resolving to an array of OpenRouterModel objects.
 */
export async function fetchModelsForProvider(
  config: DbProviderConfig,
  apiKey: string | undefined,
): Promise<FetchedModel[]> {
  const cacheKey = `${config.id}-${config.baseURL || ""}`;
  const cachedPromise = fetchCache.get(cacheKey);

  if (cachedPromise) {
    console.log(
      `[ModelFetcher] Using cache for provider ${config.name} (ID: ${config.id})`,
    );
    return cachedPromise;
  }

  const fetchPromise = (async (): Promise<FetchedModel[]> => {
    let url: string;
    const headers: Record<string, string> = {
      Accept: "application/json",
    };

    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    try {
      switch (config.type) {
        case "openai":
          if (!apiKey) throw new Error("API Key required for OpenAI");
          url = "https://api.openai.com/v1/models";
          break;
        case "openrouter":
          if (!apiKey) throw new Error("API Key required for OpenRouter");
          url = "https://openrouter.ai/api/v1/models";
          headers["HTTP-Referer"] =
            globalThis.location?.origin || "http://localhost:3000";
          headers["X-Title"] = "LiteChat";
          break;
        case "ollama":
          const ollamaBase =
            config.baseURL?.replace(/\/$/, "") || "http://localhost:11434";
          url = new URL("/api/tags", ollamaBase).toString();
          delete headers["Authorization"];
          break;
        case "openai-compatible":
          if (!config.baseURL)
            throw new Error("Base URL required for OpenAI-Compatible");
          const baseUrlWithV1 = ensureV1Path(config.baseURL);
          url = new URL(
            "models",
            baseUrlWithV1.endsWith("/") ? baseUrlWithV1 : baseUrlWithV1 + "/",
          ).toString();
          break;
        case "mistral":
          if (!apiKey) throw new Error("API Key required for Mistral AI");
          url = "https://api.mistral.ai/v1/models";
          break;
        case "anthropic":
          if (!apiKey) throw new Error("API Key required for Anthropic");
          url = "https://api.anthropic.com/v1/models";
          headers["anthropic-version"] = "2023-06-01";
          break;
        case "xai":
          if (!apiKey) throw new Error("API Key required for xAI");
          url = "https://api.x.ai/v1/models";
          break;
        case "google":
          if (!apiKey) throw new Error("API Key required for Google");
          url = "https://generativelanguage.googleapis.com/v1beta/models";
          headers["Authorization"] = `Bearer ${apiKey}`;
          break;
        case "fal":
          if (!apiKey) throw new Error("API Key required for fal.ai");
          url = "https://fal.run/fal-ai/models";
          break;
        case "replicate":
          if (!apiKey) throw new Error("API Key required for Replicate");
          url = "https://api.replicate.com/v1/models";
          break;
        case "deepinfra":
          if (!apiKey) throw new Error("API Key required for DeepInfra");
          url = "https://api.deepinfra.com/v1/models";
          break;
        case "fireworks":
          if (!apiKey) throw new Error("API Key required for Fireworks AI");
          url = "https://api.fireworks.ai/inference/v1/models";
          break;
        case "luma":
          // Luma doesn't have a public models API, return default models
          console.log(
            `[ModelFetcher] Using default models for Luma AI - no public API available.`,
          );
          return [];
        default:
          console.log(
            `[ModelFetcher] Model fetching not supported via API for type: ${config.type}. Returning empty list.`,
          );
          return [];
      }
    } catch (urlError) {
      console.error(
        `[ModelFetcher] Error constructing URL for ${config.name}:`,
        urlError,
      );
      toast.error(
        `Invalid Base URL for ${config.name}: ${urlError instanceof Error ? urlError.message : String(urlError)}`,
      );
      return [];
    }

    console.log(
      `[ModelFetcher] Fetching models for ${config.name} (Type: ${config.type}) from ${url}`,
    );

    try {
      const response = await fetch(url, { headers });

      if (!response.ok) {
        let errorBody = `(${response.status} ${response.statusText})`;
        try {
          const textBody = await response.text();
          errorBody = textBody || errorBody;
          try {
            const jsonBody = JSON.parse(textBody);
            errorBody =
              jsonBody?.error?.message || jsonBody?.message || errorBody;
          } catch {
            /* ignore json parse error, use textBody */
          }
        } catch (e) {
          console.warn("[ModelFetcher] Failed to read error response body:", e);
        }
        throw new Error(`API Error: ${errorBody}`);
      }

      const data = await response.json();
      let rawModels: any[] = [];

      if (config.type === "ollama") {
        rawModels = data.models || [];
      } else {
        rawModels = data.data || data || [];
      }

      if (!Array.isArray(rawModels)) {
        console.warn(
          `[ModelFetcher] Unexpected non-array response for ${config.name}:`,
          data,
        );
        return [];
      }

      // Map raw data to OpenRouterModel structure
      const models: FetchedModel[] = rawModels.map((m) =>
        mapToOpenRouterModel(m, config.type),
      );

      models.sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));

      console.log(
        `[ModelFetcher] Fetched and mapped ${models.length} models for ${config.name}`,
      );
      return models;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(
        `[ModelFetcher] Error fetching models for ${config.name}:`,
        errorMessage,
      );
      toast.error(`Failed to fetch models for ${config.name}: ${errorMessage}`);
      fetchCache.delete(cacheKey);
      return [];
    }
  })();

  fetchCache.set(cacheKey, fetchPromise);

  setTimeout(() => {
    if (fetchCache.get(cacheKey) === fetchPromise) {
      fetchCache.delete(cacheKey);
      console.log(
        `[ModelFetcher] Cache expired for provider ${config.name} (ID: ${config.id})`,
      );
    }
  }, CACHE_DURATION_MS);

  return fetchPromise;
}
