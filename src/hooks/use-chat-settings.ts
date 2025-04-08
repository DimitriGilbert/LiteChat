// src/hooks/use-chat-settings.ts
import { useState, useMemo, useEffect } from "react";
import type { DbConversation } from "@/lib/types";

interface UseChatSettingsProps {
  activeConversationData: DbConversation | null;
}

interface UseChatSettingsReturn {
  temperature: number;
  setTemperature: React.Dispatch<React.SetStateAction<number>>;
  maxTokens: number | null;
  setMaxTokens: React.Dispatch<React.SetStateAction<number | null>>;
  globalSystemPrompt: string;
  setGlobalSystemPrompt: React.Dispatch<React.SetStateAction<string>>;
  activeSystemPrompt: string | null; // Derived
  topP: number | null;
  setTopP: React.Dispatch<React.SetStateAction<number | null>>;
  topK: number | null;
  setTopK: React.Dispatch<React.SetStateAction<number | null>>;
  presencePenalty: number | null;
  setPresencePenalty: React.Dispatch<React.SetStateAction<number | null>>;
  frequencyPenalty: number | null;
  setFrequencyPenalty: React.Dispatch<React.SetStateAction<number | null>>;
  theme: "light" | "dark" | "system";
  setTheme: React.Dispatch<React.SetStateAction<"light" | "dark" | "system">>;
  searchTerm: string;
  setSearchTerm: React.Dispatch<React.SetStateAction<string>>;
}

// Separate custom hook for the theme effect to satisfy Rules of Hooks
function useThemeEffect(theme: "light" | "dark" | "system") {
  useEffect(() => {
    // Skip DOM manipulation entirely during Vitest runs
    if (import.meta.env.VITEST) {
      return;
    }

    // Guard against SSR or environments where document might not be fully ready
    if (typeof window === "undefined" || !window.document?.documentElement) {
      return;
    }

    const root = window.document.documentElement;
    root.classList.remove("light", "dark");

    let effectiveTheme = theme;
    if (theme === "system") {
      // Ensure matchMedia is available before calling it
      effectiveTheme =
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
    }

    root.classList.add(effectiveTheme);
  }, [theme]); // Dependency remains the same
}

export function useChatSettings({
  activeConversationData,
}: UseChatSettingsProps): UseChatSettingsReturn {
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState<number | null>(null);
  const [globalSystemPrompt, setGlobalSystemPrompt] = useState(
    "You are a helpful AI assistant.",
  );
  const [topP, setTopP] = useState<number | null>(null);
  const [topK, setTopK] = useState<number | null>(null);
  const [presencePenalty, setPresencePenalty] = useState<number | null>(null);
  const [frequencyPenalty, setFrequencyPenalty] = useState<number | null>(null);
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");
  const [searchTerm, setSearchTerm] = useState("");

  const activeSystemPrompt = useMemo(() => {
    if (activeConversationData?.systemPrompt) {
      return activeConversationData.systemPrompt;
    }
    return globalSystemPrompt;
  }, [activeConversationData, globalSystemPrompt]);

  // Call the custom hook that contains the effect
  useThemeEffect(theme);

  return {
    temperature,
    setTemperature,
    maxTokens,
    setMaxTokens,
    globalSystemPrompt,
    setGlobalSystemPrompt,
    activeSystemPrompt,
    topP,
    setTopP,
    topK,
    setTopK,
    presencePenalty,
    setPresencePenalty,
    frequencyPenalty,
    setFrequencyPenalty,
    theme,
    setTheme,
    searchTerm,
    setSearchTerm,
  };
}
