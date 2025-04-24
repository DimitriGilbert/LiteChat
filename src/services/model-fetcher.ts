// src/services/model-fetcher.ts
import type { DbProviderConfig } from "@/lib/types";
import { toast } from "sonner";
import { ensureV1Path } from "@/utils/chat-utils";

// Define the structure for fetched model information
interface FetchedModel {
  id: string;
  name: string;
}

// Simple in-memory cache for fetched models
const fetchCache = new Map<string, Promise<FetchedModel[]>>();
const CACHE_DURATION_MS = 5 * 60 * 1000; // Cache for 5 minutes

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

  // Return cached promise if available and not expired (handled by setTimeout below)
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
      Accept: "application/json", // Standard header
    };

    // Add Authorization header if API key is provided
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    // Determine the correct API endpoint URL based on provider type
    try {
      switch (config.type) {
        case "openai":
          url = "https://api.openai.com/v1/models";
          break;
        case "openrouter":
          url = "https://openrouter.ai/api/v1/models";
          // Add OpenRouter specific headers
          headers["HTTP-Referer"] =
            globalThis.location?.origin || "http://localhost"; // Recommended by OpenRouter
          headers["X-Title"] = "LiteChat"; // Optional: Identify your app
          break;
        case "ollama":
          if (!config.baseURL) throw new Error("Base URL required for Ollama");
          // Use URL constructor for safety and correctness
          url = new URL("/api/tags", config.baseURL).toString();
          break;
        case "openai-compatible":
          if (!config.baseURL)
            throw new Error("Base URL required for OpenAI-Compatible");
          // Ensure the base URL includes the /v1 path expected by many compatible APIs
          const baseUrlWithV1 = ensureV1Path(config.baseURL);
          // Ensure the base path has a trailing slash for correct relative resolution.
          url = new URL("models", baseUrlWithV1 + "/").toString();
          break;
        case "google": // Google Gemini models are often hardcoded or managed differently
        default:
          console.warn(
            `[ModelFetcher] Model fetching not actively supported or needed for type: ${config.type}. Returning empty list.`,
          );
          return []; // Return empty array for unsupported types
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
      return []; // Return empty array on URL error
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
          // Attempt to parse error details from the response body
          const textBody = await response.text();
          try {
            const jsonBody = JSON.parse(textBody);
            // Look for common error message structures
            errorBody =
              jsonBody?.error?.message || // OpenAI style
              jsonBody?.message || // General style
              textBody || // Fallback to text body
              errorBody; // Fallback to status text
          } catch {
            // If JSON parsing fails, use the text body
            errorBody = textBody || errorBody;
          }
        } catch (e) {
          // Ignore errors reading the error body itself
          console.error(
            "[ModelFetcher] Failed to read error response body:",
            e,
          );
        }
        // Throw an error with the detailed message
        throw new Error(`Failed to fetch models: ${errorBody}`);
      }

      // Parse the successful JSON response
      const data = await response.json();

      // Extract model data based on expected response structure for each provider type
      let models: FetchedModel[] = [];
      if (config.type === "ollama") {
        // Ollama returns { models: [...] }
        if (data.models && Array.isArray(data.models)) {
          models = data.models.map((m: any) => ({
            id: m.name, // Ollama uses 'name' as the ID
            name: m.name, // Use 'name' for display as well
          }));
        }
      } else {
        // OpenAI, OpenRouter, OpenAI-Compatible often return { data: [...] } or just [...]
        if (data.data && Array.isArray(data.data)) {
          models = data.data.map((m: any) => ({
            id: m.id,
            name: m.name || m.id, // Use 'name' if available, otherwise 'id'
          }));
        } else if (Array.isArray(data)) {
          // Handle cases where the response is directly an array of models
          models = data.map((m: any) => ({
            id: m.id,
            name: m.name || m.id,
          }));
        }
      }

      // Sort models alphabetically by name (or ID if name is missing)
      models.sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));

      console.log(
        `[ModelFetcher] Fetched ${models.length} models for ${config.name}`,
      );
      return models;
    } catch (error) {
      // Handle fetch errors (network issues, parsing errors, etc.)
      console.error(
        `[ModelFetcher] Error fetching models for ${config.name}:`,
        error,
      );
      toast.error(
        `Failed to fetch models for ${config.name}: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Remove the failed promise from the cache
      fetchCache.delete(cacheKey);
      throw error; // Re-throw the error to be caught by the caller
    }
  })();

  // Store the promise in the cache
  fetchCache.set(cacheKey, fetchPromise);

  // Set a timer to clear the cache entry after the duration
  setTimeout(() => {
    fetchCache.delete(cacheKey);
    console.log(
      `[ModelFetcher] Cache expired for provider ${config.name} (ID: ${config.id})`,
    );
  }, CACHE_DURATION_MS);

  // Return the promise (either new or cached)
  return fetchPromise;
}
