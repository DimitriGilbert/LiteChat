// src/services/model-fetcher.ts
import type { DbProviderConfig } from "@/lib/types";
import { toast } from "sonner";

interface FetchedModel {
  id: string;
  name: string; // Optional: Some APIs might only return ID
}

// Simple cache to avoid fetching too often during a session
const fetchCache = new Map<string, Promise<FetchedModel[]>>();
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

export async function fetchModelsForProvider(
  config: DbProviderConfig,
  apiKey: string | undefined,
): Promise<FetchedModel[]> {
  const cacheKey = `${config.id}-${config.baseURL || ""}`;
  const cached = fetchCache.get(cacheKey);
  if (cached) {
    console.log(`[ModelFetcher] Using cache for ${config.name}`);
    return cached;
  }

  const fetchPromise = (async (): Promise<FetchedModel[]> => {
    let url: string;
    const headers: Record<string, string> = {
      Accept: "application/json",
    };

    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    // Determine URL and potentially add specific headers
    switch (config.type) {
      case "openai":
        url = "https://api.openai.com/v1/models";
        break;
      case "openrouter":
        url = "https://openrouter.ai/api/v1/models";
        // OpenRouter requires these headers even without API key for listing
        headers["HTTP-Referer"] =
          globalThis.location?.origin || "http://localhost"; // Use actual origin
        headers["X-Title"] = "LiteChat"; // Your app name
        break;
      case "ollama":
        if (!config.baseURL) throw new Error("Base URL required for Ollama");
        // Ollama uses /api/tags
        url = new URL("/api/tags", config.baseURL).toString();
        break;
      case "openai-compatible":
        if (!config.baseURL)
          throw new Error("Base URL required for OpenAI-Compatible");
        // Standard path is /v1/models
        url = new URL("/v1/models", config.baseURL).toString();
        break;
      case "google": // Google GenAI SDK doesn't have a standard /models endpoint
      default:
        console.warn(
          `[ModelFetcher] Model fetching not supported for type: ${config.type}`,
        );
        return []; // Return empty, rely on defaults/enabledModels
    }

    console.log(
      `[ModelFetcher] Fetching models for ${config.name} from ${url}`,
    );
    try {
      const response = await fetch(url, { headers });

      if (!response.ok) {
        let errorBody = "Unknown error";
        try {
          errorBody = await response.text();
        } catch (e) {
          console.error(`Failed to parse error body: ${e}`);
        }
        throw new Error(
          `Failed to fetch models (${response.status}): ${errorBody}`,
        );
      }

      const data = await response.json();

      // Parse response based on provider type
      let models: FetchedModel[] = [];
      if (config.type === "ollama") {
        // Ollama /api/tags response: { models: [{ name: "model:tag", ... }] }
        if (data.models && Array.isArray(data.models)) {
          models = data.models.map((m: any) => ({
            id: m.name, // Ollama uses the full tag as ID
            name: m.name, // Use the tag as name too
          }));
        }
      } else {
        // OpenAI / OpenRouter / Compatible /v1/models response: { data: [{ id: "...", ... }] }
        if (data.data && Array.isArray(data.data)) {
          models = data.data.map((m: any) => ({
            id: m.id,
            // Attempt to find a user-friendly name, fallback to ID
            name: m.name || m.id,
          }));
        } else if (Array.isArray(data)) {
          // Some compatible servers might return just an array
          models = data.map((m: any) => ({
            id: m.id,
            name: m.name || m.id,
          }));
        }
      }

      // Sort models alphabetically by name/ID for consistency
      models.sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));

      console.log(
        `[ModelFetcher] Fetched ${models.length} models for ${config.name}`,
      );
      return models;
    } catch (error) {
      console.error(
        `[ModelFetcher] Error fetching models for ${config.name}:`,
        error,
      );
      toast.error(
        `Failed to fetch models for ${config.name}: ${error instanceof Error ? error.message : String(error)}`,
      );
      fetchCache.delete(cacheKey); // Remove failed attempt from cache
      throw error; // Re-throw to handle upstream
    }
  })();

  fetchCache.set(cacheKey, fetchPromise);
  // Set timeout to clear cache entry
  setTimeout(() => {
    fetchCache.delete(cacheKey);
  }, CACHE_DURATION_MS);

  return fetchPromise;
}
