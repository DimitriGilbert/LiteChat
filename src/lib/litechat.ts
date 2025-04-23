// src/lib/litechat.ts
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

// Consolidated default models
export const DEFAULT_MODELS: Record<
  DbProviderType,
  { id: string; name: string }[]
> = {
  openai: [{ id: "gpt-4o", name: "GPT-4o" }],
  google: [
    { id: "gemini-2.5-pro-exp-03-25", name: "Gemini 2.5 Pro exp (Free)" },
    {
      id: "gemini-2.0-flash-thinking-exp-01-21",
      name: "Gemini 2.0 Flash exp (Free)",
    },
    { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash" },
    { id: "emini-2.5-pro-preview-03-25", name: "Gemini 2.5 Pro Preview" },
    {
      id: "gemini-2.5-flash-preview-04-17",
      name: "Gemini 2.5 Flash Preview",
    },
  ],
  openrouter: [],
  ollama: [{ id: "llama3", name: "Llama 3 (Ollama)" }],
  "openai-compatible": [],
};
