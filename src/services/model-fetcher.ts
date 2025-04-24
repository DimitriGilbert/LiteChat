
import type { DbProviderConfig } from "@/lib/types";
import { toast } from "sonner";
import { ensureV1Path } from "@/utils/chat-utils";

interface FetchedModel {
  id: string;
  name: string;
}


const fetchCache = new Map<string, Promise<FetchedModel[]>>();
const CACHE_DURATION_MS = 5 * 60 * 1000;

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

    try {
      switch (config.type) {
        case "openai":
          url = "https://api.openai.com/v1/models";
          break;
        case "openrouter":
          url = "https://openrouter.ai/api/v1/models";
          headers["HTTP-Referer"] =
            globalThis.location?.origin || "http://localhost";
          headers["X-Title"] = "LiteChat";
          break;
        case "ollama":
          if (!config.baseURL) throw new Error("Base URL required for Ollama");
          url = new URL("/api/tags", config.baseURL).toString();
          break;
        case "openai-compatible":
          if (!config.baseURL)
            throw new Error("Base URL required for OpenAI-Compatible");
          const baseUrlWithV1 = ensureV1Path(config.baseURL);
          //    Ensure the base path has a trailing slash for correct relative resolution.
          url = new URL("models", baseUrlWithV1 + "/").toString();
          break;
        case "google":
        default:
          console.warn(
            `[ModelFetcher] Model fetching not supported for type: ${config.type}`,
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
      `[ModelFetcher] Fetching models for ${config.name} from ${url}`,
    );
    try {
      const response = await fetch(url, { headers });

      if (!response.ok) {
        let errorBody = `(${response.status} ${response.statusText})`;
        try {
          const textBody = await response.text();
          try {
            const jsonBody = JSON.parse(textBody);
            errorBody =
              jsonBody?.error?.message ||
              jsonBody?.message ||
              textBody ||
              errorBody;
          } catch {
            errorBody = textBody || errorBody;
          }
        } catch (e) {
          console.error("Failed to read error response body:", e);
        }
        throw new Error(`Failed to fetch models: ${errorBody}`);
      }

      const data = await response.json();

      let models: FetchedModel[] = [];
      if (config.type === "ollama") {
        if (data.models && Array.isArray(data.models)) {
          models = data.models.map((m: any) => ({
            id: m.name,
            name: m.name,
          }));
        }
      } else {
        if (data.data && Array.isArray(data.data)) {
          models = data.data.map((m: any) => ({
            id: m.id,
            name: m.name || m.id,
          }));
        } else if (Array.isArray(data)) {
          models = data.map((m: any) => ({
            id: m.id,
            name: m.name || m.id,
          }));
        }
      }

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
      fetchCache.delete(cacheKey);
      throw error;
    }
  })();

  fetchCache.set(cacheKey, fetchPromise);
  setTimeout(() => {
    fetchCache.delete(cacheKey);
  }, CACHE_DURATION_MS);

  return fetchPromise;
}
