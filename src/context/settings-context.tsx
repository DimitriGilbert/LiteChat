import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  useEffect,
} from "react";
import type { DbConversation } from "@/lib/types";

interface SettingsContextProps {
  enableAdvancedSettings: boolean;
  theme: "light" | "dark" | "system";
  setTheme: React.Dispatch<React.SetStateAction<"light" | "dark" | "system">>;
  searchTerm: string;
  setSearchTerm: React.Dispatch<React.SetStateAction<string>>;
  temperature: number;
  setTemperature: React.Dispatch<React.SetStateAction<number>>;
  maxTokens: number | null;
  setMaxTokens: React.Dispatch<React.SetStateAction<number | null>>;
  globalSystemPrompt: string | null;
  setGlobalSystemPrompt: React.Dispatch<React.SetStateAction<string | null>>;
  activeSystemPrompt: string | null;
  topP: number | null;
  setTopP: React.Dispatch<React.SetStateAction<number | null>>;
  topK: number | null;
  setTopK: React.Dispatch<React.SetStateAction<number | null>>;
  presencePenalty: number | null;
  setPresencePenalty: React.Dispatch<React.SetStateAction<number | null>>;
  frequencyPenalty: number | null;
  setFrequencyPenalty: React.Dispatch<React.SetStateAction<number | null>>;
  isSettingsModalOpen: boolean;
  onSettingsModalOpenChange: (open: boolean) => void;
}

const SettingsContext = createContext<SettingsContextProps | undefined>(
  undefined,
);

interface SettingsProviderProps {
  children: React.ReactNode;
  enableAdvancedSettings?: boolean;
  activeConversationData: DbConversation | null;
  // Pass modal state control
  isSettingsModalOpen: boolean;
  onSettingsModalOpenChange: (open: boolean) => void;
}

const defaultGlobalPrompt = `You are a helpful, concise AI assistant designed to provide accurate, relevant answers.
Follow all instructions exactly, prioritizing clarity, specificity, and relevance.
Define your role and limitations in context, and adhere strictly to them.
Format responses according to specified output format (e.g., JSON, code block, bullet list).
If unsure, admit uncertainty rather than guessing, and ask a single clarifying question if required.
When reasoning is needed, provide brief chain‑of‑thought steps to improve transparency.
Keep responses concise; avoid unnecessary preamble or filler words.
`;

function useThemeEffect(theme: "light" | "dark" | "system") {
  useEffect(() => {
    // Skip DOM manipulation during server-side rendering or tests
    if (typeof window === "undefined" || !window.document?.documentElement) {
      return;
    }
    // Skip during Vitest runs if needed
    // if (import.meta.env.VITEST) {
    //   return;

    const root = window.document.documentElement;
    root.classList.remove("light", "dark");

    let effectiveTheme = theme;
    if (theme === "system") {
      effectiveTheme =
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
    }

    // Add the calculated theme class to the root element
    root.classList.add(effectiveTheme);
  }, [theme]);
}

export const SettingsProvider: React.FC<SettingsProviderProps> = ({
  children,
  enableAdvancedSettings = true,
  activeConversationData,
  isSettingsModalOpen,
  onSettingsModalOpenChange,
}) => {
  // --- Manage Settings State Directly ---
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");
  const [searchTerm, setSearchTerm] = useState("");
  const defaultTemp = 0.7;
  const [temperature, setTemperature] = useState(defaultTemp);
  const [maxTokens, setMaxTokens] = useState<number | null>(null);
  const [globalSystemPrompt, setGlobalSystemPrompt] = useState<string | null>(
    enableAdvancedSettings ? defaultGlobalPrompt : null,
  );
  const [topP, setTopP] = useState<number | null>(null);
  const [topK, setTopK] = useState<number | null>(null);
  const [presencePenalty, setPresencePenalty] = useState<number | null>(null);
  const [frequencyPenalty, setFrequencyPenalty] = useState<number | null>(null);
  useEffect(() => {
    if (!enableAdvancedSettings) {
      setTemperature(defaultTemp);
      setMaxTokens(null);
      setGlobalSystemPrompt(null);
      setTopP(null);
      setTopK(null);
      setPresencePenalty(null);
      setFrequencyPenalty(null);
    } else {
      // Re-initialize global prompt if it became null when disabled
      if (globalSystemPrompt === null) {
        setGlobalSystemPrompt(defaultGlobalPrompt);
      }
    }
    // Only run when enableAdvancedSettings changes
  }, [enableAdvancedSettings, globalSystemPrompt]);

  // Determine the active system prompt
  const activeSystemPrompt = useMemo(() => {
    if (!enableAdvancedSettings) {
      return null;
    }
    if (
      activeConversationData?.systemPrompt &&
      activeConversationData.systemPrompt.trim() !== ""
    ) {
      return activeConversationData.systemPrompt;
    }
    if (globalSystemPrompt && globalSystemPrompt.trim() !== "") {
      return globalSystemPrompt;
    }
    return null;
  }, [enableAdvancedSettings, activeConversationData, globalSystemPrompt]);
  useThemeEffect(theme);
  const noOpSetter = () => {};
  const setTemperatureFinal = enableAdvancedSettings
    ? setTemperature
    : noOpSetter;
  const setMaxTokensFinal = enableAdvancedSettings ? setMaxTokens : noOpSetter;
  const setGlobalSystemPromptFinal = enableAdvancedSettings
    ? setGlobalSystemPrompt
    : noOpSetter;
  const setTopPFinal = enableAdvancedSettings ? setTopP : noOpSetter;
  const setTopKFinal = enableAdvancedSettings ? setTopK : noOpSetter;
  const setPresencePenaltyFinal = enableAdvancedSettings
    ? setPresencePenalty
    : noOpSetter;
  const setFrequencyPenaltyFinal = enableAdvancedSettings
    ? setFrequencyPenalty
    : noOpSetter;

  const value = useMemo(
    () => ({
      enableAdvancedSettings: enableAdvancedSettings ?? true,
      theme,
      setTheme,
      searchTerm,
      setSearchTerm,
      temperature,
      setTemperature: setTemperatureFinal,
      maxTokens,
      setMaxTokens: setMaxTokensFinal,
      globalSystemPrompt,
      setGlobalSystemPrompt: setGlobalSystemPromptFinal,
      activeSystemPrompt,
      topP,
      setTopP: setTopPFinal,
      topK,
      setTopK: setTopKFinal,
      presencePenalty,
      setPresencePenalty: setPresencePenaltyFinal,
      frequencyPenalty,
      setFrequencyPenalty: setFrequencyPenaltyFinal,
      isSettingsModalOpen,
      onSettingsModalOpenChange,
    }),
    [
      enableAdvancedSettings,
      theme,
      setTheme,
      searchTerm,
      setSearchTerm,
      temperature,
      setTemperatureFinal,
      maxTokens,
      setMaxTokensFinal,
      globalSystemPrompt,
      setGlobalSystemPromptFinal,
      activeSystemPrompt,
      topP,
      setTopPFinal,
      topK,
      setTopKFinal,
      presencePenalty,
      setPresencePenaltyFinal,
      frequencyPenalty,
      setFrequencyPenaltyFinal,
      isSettingsModalOpen,
      onSettingsModalOpenChange,
    ],
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettingsContext = (): SettingsContextProps => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error(
      "useSettingsContext must be used within a SettingsProvider",
    );
  }
  return context;
};
