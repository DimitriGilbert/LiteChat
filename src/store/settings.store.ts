// src/store/settings.store.ts
import { create } from "zustand";
import { db } from "@/lib/db"; // Import db
import { toast } from "sonner"; // Import toast for potential errors

export interface SettingsState {
  // Feature Flags (can be set during init)
  enableAdvancedSettings: boolean;
  theme: "light" | "dark" | "system";
  searchTerm: string;
  isSettingsModalOpen: boolean;
  temperature: number;
  maxTokens: number | null;
  globalSystemPrompt: string | null;
  topP: number | null;
  topK: number | null;
  presencePenalty: number | null;
  frequencyPenalty: number | null;
  /** Refresh rate for UI updates during AI response streaming (in milliseconds). */
  streamingRefreshRateMs: number;
  /** Enable markdown parsing during streaming */
  enableStreamingMarkdown: boolean;
}

export interface SettingsActions {
  // Add an initialization action
  loadInitialSettings: () => Promise<void>;
  setEnableAdvancedSettings: (enabled: boolean) => void;
  setTheme: (theme: "light" | "dark" | "system") => void;
  setSearchTerm: (term: string) => void;
  setIsSettingsModalOpen: (isOpen: boolean) => void;
  setTemperature: (temp: number) => void;
  setMaxTokens: (tokens: number | null) => void;
  setGlobalSystemPrompt: (prompt: string | null) => void;
  setTopP: (topP: number | null) => void;
  setTopK: (topK: number | null) => void;
  setPresencePenalty: (penalty: number | null) => void;
  setFrequencyPenalty: (penalty: number | null) => void;
  /** Sets the UI refresh rate during streaming (in milliseconds). */
  setStreamingRefreshRateMs: (rate: number) => void;
  /** Sets whether markdown should be parsed during streaming */
  setEnableStreamingMarkdown: (enabled: boolean) => void;
  // Derived data (activeSystemPrompt) should be handled by selectors outside the store
}

const defaultGlobalPrompt = `You are a helpful, concise AI assistant designed to provide accurate, relevant answers.
Follow all instructions exactly, prioritizing clarity, specificity, and relevance.
Define your role and limitations in context, and adhere strictly to them.
Format responses according to specified output format (e.g., JSON, code block, bullet list).
If unsure, admit uncertainty rather than guessing, and ask a single clarifying question if required.
When reasoning is needed, provide brief chain‑of‑thought steps to improve transparency.
Keep responses concise; avoid unnecessary preamble or filler words.
`;

// Helper to save a setting to DB
const saveSetting = async (key: string, value: any) => {
  try {
    await db.appState.put({ key: `settings:${key}`, value });
  } catch (error) {
    console.error(`Failed to save setting ${key}:`, error);
    toast.error(`Failed to save setting: ${key}`);
  }
};

// Helper to load a setting from DB
const loadSetting = async <T>(key: string, defaultValue: T): Promise<T> => {
  try {
    const setting = await db.appState.get(`settings:${key}`);
    return setting?.value !== undefined ? (setting.value as T) : defaultValue;
  } catch (error) {
    console.error(`Failed to load setting ${key}:`, error);
    toast.error(`Failed to load setting: ${key}`);
    return defaultValue;
  }
};

export const useSettingsStore = create<SettingsState & SettingsActions>()(
  (set) => ({
    // Initial State (will be overwritten by loadInitialSettings)
    enableAdvancedSettings: true,
    theme: "system",
    searchTerm: "",
    isSettingsModalOpen: false,
    temperature: 0.7,
    maxTokens: null,
    globalSystemPrompt: defaultGlobalPrompt,
    topP: null,
    topK: null,
    presencePenalty: null,
    frequencyPenalty: null,
    streamingRefreshRateMs: 33,
    enableStreamingMarkdown: true,

    // Initialization Action
    loadInitialSettings: async () => {
      console.log("[SettingsStore] Loading initial settings from DB...");
      const loadedSettings = {
        enableAdvancedSettings: await loadSetting(
          "enableAdvancedSettings",
          true,
        ),
        theme: await loadSetting<"light" | "dark" | "system">(
          "theme",
          "system",
        ),
        temperature: await loadSetting("temperature", 0.7),
        maxTokens: await loadSetting<number | null>("maxTokens", null),
        globalSystemPrompt: await loadSetting<string | null>(
          "globalSystemPrompt",
          defaultGlobalPrompt,
        ),
        topP: await loadSetting<number | null>("topP", null),
        topK: await loadSetting<number | null>("topK", null),
        presencePenalty: await loadSetting<number | null>(
          "presencePenalty",
          null,
        ),
        frequencyPenalty: await loadSetting<number | null>(
          "frequencyPenalty",
          null,
        ),
        streamingRefreshRateMs: await loadSetting("streamingRefreshRateMs", 33),
        enableStreamingMarkdown: await loadSetting(
          "enableStreamingMarkdown",
          true,
        ),
      };
      console.log("[SettingsStore] Loaded settings:", loadedSettings);
      set(loadedSettings);
    },

    // Actions (now include saving)
    setEnableAdvancedSettings: (enableAdvancedSettings) => {
      set({ enableAdvancedSettings });
      saveSetting("enableAdvancedSettings", enableAdvancedSettings);
    },
    setTheme: (theme) => {
      set({ theme });
      saveSetting("theme", theme);
    },
    setSearchTerm: (searchTerm) => set({ searchTerm }), // Search term is likely transient, no need to save
    setIsSettingsModalOpen: (isOpen) => {
      set({ isSettingsModalOpen: isOpen });
    },
    setTemperature: (temperature) => {
      set({ temperature });
      saveSetting("temperature", temperature);
    },
    setMaxTokens: (maxTokens) => {
      set({ maxTokens });
      saveSetting("maxTokens", maxTokens);
    },
    setGlobalSystemPrompt: (globalSystemPrompt) => {
      set({ globalSystemPrompt });
      saveSetting("globalSystemPrompt", globalSystemPrompt);
    },
    setTopP: (topP) => {
      set({ topP });
      saveSetting("topP", topP);
    },
    setTopK: (topK) => {
      set({ topK });
      saveSetting("topK", topK);
    },
    setPresencePenalty: (presencePenalty) => {
      set({ presencePenalty });
      saveSetting("presencePenalty", presencePenalty);
    },
    setFrequencyPenalty: (frequencyPenalty) => {
      set({ frequencyPenalty });
      saveSetting("frequencyPenalty", frequencyPenalty);
    },
    setStreamingRefreshRateMs: (streamingRefreshRateMs) => {
      set({ streamingRefreshRateMs });
      saveSetting("streamingRefreshRateMs", streamingRefreshRateMs);
    },
    setEnableStreamingMarkdown: (enableStreamingMarkdown) => {
      set({ enableStreamingMarkdown });
      saveSetting("enableStreamingMarkdown", enableStreamingMarkdown);
    },
  }),
);
