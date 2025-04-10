// src/hooks/use-chat-settings.ts
import { useState, useMemo, useEffect } from "react";
import type { DbConversation, DbProject } from "@/lib/types";

interface UseChatSettingsProps {
  activeConversationData: DbConversation | null;
  activeProjectData: DbProject | null; // Accept active project data
}

interface UseChatSettingsReturn {
  temperature: number;
  setTemperature: React.Dispatch<React.SetStateAction<number>>;
  maxTokens: number | null;
  setMaxTokens: React.Dispatch<React.SetStateAction<number | null>>;
  globalSystemPrompt: string;
  setGlobalSystemPrompt: React.Dispatch<React.SetStateAction<string>>;
  activeSystemPrompt: string | null; // Derived: convo-specific or global
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

// Custom hook to apply theme changes to the DOM
function useThemeEffect(theme: "light" | "dark" | "system") {
  useEffect(() => {
    // Skip DOM manipulation during server-side rendering or tests
    if (typeof window === "undefined" || !window.document?.documentElement) {
      return;
    }
    // Skip during Vitest runs if needed
    if (import.meta.env.VITEST) {
      return;
    }

    const root = window.document.documentElement;
    root.classList.remove("light", "dark"); // Remove previous theme classes

    let effectiveTheme = theme;
    // Determine effective theme if 'system' is selected
    if (theme === "system") {
      effectiveTheme =
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
    }

    // Add the calculated theme class to the root element
    root.classList.add(effectiveTheme);
  }, [theme]); // Re-run effect only when the theme state changes
}

export function useChatSettings({
  activeConversationData,
  // activeProjectData, // Currently unused, but available if needed for project-specific settings
}: UseChatSettingsProps): UseChatSettingsReturn {
  // State for various chat settings
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState<number | null>(null); // Default to null (provider default)
  const [globalSystemPrompt, setGlobalSystemPrompt] = useState(
    "You are a helpful AI assistant.", // Default global prompt
  );
  const [topP, setTopP] = useState<number | null>(null); // Default to null (provider default)
  const [topK, setTopK] = useState<number | null>(null); // Default to null (provider default)
  const [presencePenalty, setPresencePenalty] = useState<number | null>(null); // Default to null (provider default)
  const [frequencyPenalty, setFrequencyPenalty] = useState<number | null>(null); // Default to null (provider default)
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system"); // Default theme
  const [searchTerm, setSearchTerm] = useState(""); // State for message search term

  // Determine the active system prompt: use conversation-specific if available, else global
  const activeSystemPrompt = useMemo(() => {
    // Projects don't have system prompts, only conversations do
    if (activeConversationData?.systemPrompt) {
      return activeConversationData.systemPrompt;
    }
    // Fallback to the global system prompt
    return globalSystemPrompt;
  }, [activeConversationData, globalSystemPrompt]); // Recalculate when conversation data or global prompt changes

  // Apply the theme effect using the custom hook
  useThemeEffect(theme);

  // Return all settings states and setters
  return useMemo(
    () => ({
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
    }),
    [
      temperature,
      maxTokens,
      globalSystemPrompt,
      activeSystemPrompt,
      topP,
      topK,
      presencePenalty,
      frequencyPenalty,
      theme,
      searchTerm,
      // Include setters if they might change, though unlikely for useState setters
      setTemperature,
      setMaxTokens,
      setGlobalSystemPrompt,
      setTopP,
      setTopK,
      setPresencePenalty,
      setFrequencyPenalty,
      setTheme,
      setSearchTerm,
    ],
  );
}
