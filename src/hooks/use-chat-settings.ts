// src/hooks/use-chat-settings.ts
import { useState, useMemo, useEffect } from "react";
import type { DbConversation, DbProject } from "@/lib/types";

interface UseChatSettingsProps {
  activeConversationData: DbConversation | null;
  activeProjectData: DbProject | null; // Accept active project data
  enableAdvancedSettings: boolean; // Flag to control advanced features
}

interface UseChatSettingsReturn {
  // Always available
  theme: "light" | "dark" | "system";
  setTheme: React.Dispatch<React.SetStateAction<"light" | "dark" | "system">>;
  searchTerm: string;
  setSearchTerm: React.Dispatch<React.SetStateAction<string>>;
  // Conditionally available (defaults/null if disabled)
  temperature: number;
  setTemperature: React.Dispatch<React.SetStateAction<number>>;
  maxTokens: number | null;
  setMaxTokens: React.Dispatch<React.SetStateAction<number | null>>;
  globalSystemPrompt: string | null; // Nullable if disabled
  setGlobalSystemPrompt: React.Dispatch<React.SetStateAction<string | null>>;
  activeSystemPrompt: string | null; // Derived: convo-specific, global, or null
  topP: number | null;
  setTopP: React.Dispatch<React.SetStateAction<number | null>>;
  topK: number | null;
  setTopK: React.Dispatch<React.SetStateAction<number | null>>;
  presencePenalty: number | null;
  setPresencePenalty: React.Dispatch<React.SetStateAction<number | null>>;
  frequencyPenalty: number | null;
  setFrequencyPenalty: React.Dispatch<React.SetStateAction<number | null>>;
}

// Custom hook to apply theme changes to the DOM (remains the same)
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
  // activeProjectData, // Currently unused
  enableAdvancedSettings, // Use the flag
}: UseChatSettingsProps): UseChatSettingsReturn {
  // --- Basic Settings (Always Active) ---
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");
  const [searchTerm, setSearchTerm] = useState("");

  // --- Advanced Settings (Conditional State) ---
  // Use defaults if advanced settings are disabled
  const defaultTemp = 0.7;
  const defaultGlobalPrompt = `You are a helpful, concise AI assistant designed to provide accurate, relevant answers.
Follow all instructions exactly, prioritizing clarity, specificity, and relevance.
Define your role and limitations in context, and adhere strictly to them.
Format responses according to specified output format (e.g., JSON, code block, bullet list).
If unsure, admit uncertainty rather than guessing, and ask a single clarifying question if required.
When reasoning is needed, provide brief chain‑of‑thought steps to improve transparency.
Keep responses concise; avoid unnecessary preamble or filler words.
`;

  const [temperature, setTemperature] = useState(
    enableAdvancedSettings ? defaultTemp : defaultTemp, // Keep default even if disabled for consistency
  );
  const [maxTokens, setMaxTokens] = useState<number | null>(null);
  const [globalSystemPrompt, setGlobalSystemPrompt] = useState<string | null>(
    enableAdvancedSettings ? defaultGlobalPrompt : null, // Null if disabled
  );
  const [topP, setTopP] = useState<number | null>(null);
  const [topK, setTopK] = useState<number | null>(null);
  const [presencePenalty, setPresencePenalty] = useState<number | null>(null);
  const [frequencyPenalty, setFrequencyPenalty] = useState<number | null>(null);

  // Effect to reset advanced settings if the flag changes to disabled
  useEffect(() => {
    if (!enableAdvancedSettings) {
      setTemperature(defaultTemp); // Reset to default
      setMaxTokens(null);
      setGlobalSystemPrompt(null);
      setTopP(null);
      setTopK(null);
      setPresencePenalty(null);
      setFrequencyPenalty(null);
    } else {
      // Optionally re-initialize if needed when enabled, e.g., set global prompt
      if (globalSystemPrompt === null) {
        setGlobalSystemPrompt(defaultGlobalPrompt);
      }
    }
    // Only run when enableAdvancedSettings changes
  }, [enableAdvancedSettings, globalSystemPrompt, defaultGlobalPrompt]); // Added globalSystemPrompt to deps

  // Determine the active system prompt
  const activeSystemPrompt = useMemo(() => {
    // Only consider system prompts if advanced settings are enabled
    if (!enableAdvancedSettings) {
      return null;
    }
    // Use conversation-specific if available and not empty
    if (
      activeConversationData?.systemPrompt &&
      activeConversationData.systemPrompt.trim() !== ""
    ) {
      return activeConversationData.systemPrompt;
    }
    // Fallback to the global system prompt if it's set
    if (globalSystemPrompt && globalSystemPrompt.trim() !== "") {
      return globalSystemPrompt;
    }
    // Otherwise, no active system prompt
    return null;
  }, [
    enableAdvancedSettings,
    activeConversationData,
    globalSystemPrompt, // Recalculate when flag, conversation data, or global prompt changes
  ]);

  // Apply the theme effect using the custom hook
  useThemeEffect(theme);

  // Return all settings states and setters
  return useMemo(
    () => ({
      // Basic
      theme,
      setTheme,
      searchTerm,
      setSearchTerm,
      // Advanced (or defaults/null)
      temperature,
      setTemperature: enableAdvancedSettings ? setTemperature : () => {},
      maxTokens,
      setMaxTokens: enableAdvancedSettings ? setMaxTokens : () => {},
      globalSystemPrompt,
      setGlobalSystemPrompt: enableAdvancedSettings
        ? setGlobalSystemPrompt
        : () => {},
      activeSystemPrompt,
      topP,
      setTopP: enableAdvancedSettings ? setTopP : () => {},
      topK,
      setTopK: enableAdvancedSettings ? setTopK : () => {},
      presencePenalty,
      setPresencePenalty: enableAdvancedSettings
        ? setPresencePenalty
        : () => {},
      frequencyPenalty,
      setFrequencyPenalty: enableAdvancedSettings
        ? setFrequencyPenalty
        : () => {},
    }),
    [
      // Basic deps
      theme,
      searchTerm,
      // Advanced deps
      enableAdvancedSettings, // Include flag
      temperature,
      maxTokens,
      globalSystemPrompt,
      activeSystemPrompt,
      topP,
      topK,
      presencePenalty,
      frequencyPenalty,
      // Setters (usually stable, but include if needed)
      setTheme,
      setSearchTerm,
      setTemperature,
      setMaxTokens,
      setGlobalSystemPrompt,
      setTopP,
      setTopK,
      setPresencePenalty,
      setFrequencyPenalty,
    ],
  );
}
