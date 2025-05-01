// src/services/model-fetcher.ts
import type { DbProviderConfig } from "@/types/litechat/provider";
import { toast } from "sonner";
import { ensureV1Path } from "@/lib/litechat/provider-helpers";

// Define the structure for fetched model information including metadata
interface FetchedModel {
  id: string;
  name: string;
  metadata?: Record<string, any>;
}

// Simple in-memory cache for fetched models
const fetchCache = new Map<string, Promise<FetchedModel[]>>();
const CACHE_DURATION_MS = 5 * 60 * 1000;

/**
 * Fetches the list of available models for a given provider configuration.
 * Uses a simple time-based cache to avoid redundant requests.
 * @param config The database configuration for the provider.
 * @param apiKey The API key value, if required and available.
 * @returns A promise resolving to an array of FetchedModel objects.
 */
export async function fetchModelsForProvider(
  config: DbProviderConfig,
  apiKey: string | undefined,
): Promise<FetchedModel[]> {
  // Generate a cache key based on provider ID and base URL (if applicable)
  const cacheKey = `${config.id}-${config.baseURL || ""}`;
  const cachedPromise = fetchCache.get(cacheKey);

  // Return cached promise if available
  if (cachedPromise) {
    console.log(
      `[ModelFetcher] Using cache for provider ${config.name} (ID: ${config.id})`,
    );
    return cachedPromise;
  }

  // Create the actual fetch promise
  const fetchPromise = (async (): Promise<FetchedModel[]> => {
    let url: string;
    const headers: Record<string, string> = {
      Accept: "application/json",
    };

    // Add Authorization header if API key is provided and required/useful
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    // Determine the correct API endpoint URL based on provider type
    try {
      switch (config.type) {
        case "openai": {
          if (!apiKey) throw new Error("API Key required for OpenAI");
          url = "https://api.openai.com/v1/models";
          break;
        }
        case "openrouter": {
          if (!apiKey) throw new Error("API Key required for OpenRouter");
          url = "https://openrouter.ai/api/v1/models";
          // Add OpenRouter specific headers
          headers["HTTP-Referer"] =
            globalThis.location?.origin || "http://localhost:3000";
          headers["X-Title"] = "LiteChat";
          break;
        }
        case "ollama": {
          // Use default localhost if baseURL is not provided or empty
          const ollamaBase =
            config.baseURL?.replace(/\/$/, "") || "http://localhost:11434";
          url = new URL("/api/tags", ollamaBase).toString();
          // No Authorization header typically needed for local Ollama
          delete headers["Authorization"];
          break;
        }
        case "openai-compatible": {
          if (!config.baseURL)
            throw new Error("Base URL required for OpenAI-Compatible");
          // Ensure the base URL includes the /v1 path expected by many compatible APIs
          const baseUrlWithV1 = ensureV1Path(config.baseURL);
          // Ensure the base path has a trailing slash for correct relative resolution.
          url = new URL(
            "models",
            baseUrlWithV1.endsWith("/") ? baseUrlWithV1 : baseUrlWithV1 + "/",
          ).toString();
          // Keep Authorization header if apiKey was provided, as many compatible APIs use it
          break;
        }
        case "google": // Google Gemini models are often hardcoded or managed differently
        default: {
          console.log(
            `[ModelFetcher] Model fetching not supported via API for type: ${config.type}. Returning empty list.`,
          );
          return [];
        }
      }
    } catch (urlError) {
      // Handle errors during URL construction (e.g., invalid baseURL)
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
      // Perform the fetch request
      const response = await fetch(url, { headers });

      // Handle non-OK responses
      if (!response.ok) {
        let errorBody = `(${response.status} ${response.statusText})`;
        try {
          const textBody = await response.text();
          try {
            const jsonBody = JSON.parse(textBody);
            errorBody =
              jsonBody?.error?.message || // OpenAI style
              jsonBody?.message || // General style
              textBody ||
              errorBody;
          } catch {
            errorBody = textBody || errorBody;
          }
        } catch (e) {
          console.warn("[ModelFetcher] Failed to read error response body:", e);
        }
        // Throw an error with the detailed message
        throw new Error(`API Error: ${errorBody}`);
      }

      // Parse the successful JSON response
      const data = await response.json();

      // Extract model data based on expected response structure for each provider type
      let models: FetchedModel[] = [];
      if (config.type === "ollama") {
        // Ollama returns { models: [{ name: ..., details: {...} }, ...] }
        if (data.models && Array.isArray(data.models)) {
          models = data.models.map((m: any) => ({
            id: m.name,
            name: m.name,
            metadata: m.details ?? {},
          }));
        } else {
          console.warn(
            `[ModelFetcher] Unexpected response structure from Ollama for ${config.name}:`,
            data,
          );
        }
      } else if (config.type === "openrouter") {
        // OpenRouter returns { data: [{ id: ..., name: ..., ... }, ...] }
        const modelList = data.data || data;
        if (Array.isArray(modelList)) {
          models = modelList.map((m: any) => {
            // Extract known metadata fields, put others in metadata object
            const { id, name, ...rest } = m;
            return {
              id: id,
              name: name || id,
              metadata: rest,
            };
          });
        } else {
          console.warn(
            `[ModelFetcher] Unexpected response structure for ${config.name} (Type: ${config.type}):`,
            data,
          );
        }
      } else {
        // OpenAI, OpenAI-Compatible often return { data: [{ id: ..., ... }, ...] }
        // Or sometimes just the array [{ id: ..., ... }]
        const modelList = data.data || data;
        if (Array.isArray(modelList)) {
          models = modelList.map((m: any) => {
            // Extract known metadata fields, put others in metadata object
            const { id, name, ...rest } = m;
            return {
              id: id,
              name: name || id,
              metadata: rest,
            };
          });
        } else {
          console.warn(
            `[ModelFetcher] Unexpected response structure for ${config.name} (Type: ${config.type}):`,
            data,
          );
        }
      }

      // Sort models alphabetically by name (or ID if name is missing)
      models.sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));

      console.log(
        `[ModelFetcher] Fetched ${models.length} models for ${config.name}`,
      );
      return models;
    } catch (error) {
      // Handle fetch errors (network issues, parsing errors, API errors thrown above)
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(
        `[ModelFetcher] Error fetching models for ${config.name}:`,
        errorMessage,
      );
      toast.error(`Failed to fetch models for ${config.name}: ${errorMessage}`);
      // Remove the failed promise from the cache so retry is possible
      fetchCache.delete(cacheKey);
      // Return empty list on failure to allow the application to continue
      return [];
      // Optionally re-throw if the caller needs to handle the error specifically
      // throw error;
    }
  })();

  // Store the promise in the cache
  fetchCache.set(cacheKey, fetchPromise);

  // Set a timer to clear the cache entry after the duration
  setTimeout(() => {
    if (fetchCache.get(cacheKey) === fetchPromise) {
      fetchCache.delete(cacheKey);
      console.log(
        `[ModelFetcher] Cache expired for provider ${config.name} (ID: ${config.id})`,
      );
    }
  }, CACHE_DURATION_MS);

  // Return the promise (either new or cached)
  return fetchPromise;
}
