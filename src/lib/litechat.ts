import { DbProviderType } from "./types";

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
  { value: "openai", label: "OpenAI" },
  { value: "google", label: "Google Gemini" },
  { value: "openrouter", label: "OpenRouter" },
  { value: "ollama", label: "Ollama" },
  { value: "openai-compatible", label: "OpenAI-Compatible (LMStudio, etc.)" },
];

export const REQUIRES_API_KEY_TYPES: DbProviderType[] = [
  "openai",
  "openrouter",
  "google",
];
