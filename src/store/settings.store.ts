// src/store/settings.store.ts
import { create } from "zustand";

export interface SettingsState {
  // Feature Flags (can be set during init)
  enableAdvancedSettings: boolean;
  // UI Settings
  theme: "light" | "dark" | "system";
  searchTerm: string; // For sidebar/item search
  isSettingsModalOpen: boolean;
  // AI Parameters (Global/Defaults)
  temperature: number;
  maxTokens: number | null;
  globalSystemPrompt: string | null;
  topP: number | null;
  topK: number | null;
  presencePenalty: number | null;
  frequencyPenalty: number | null;
  // Other Config
  /** Refresh rate for UI updates during AI response streaming (in milliseconds). */
  streamingRefreshRateMs: number;
  /** Enable markdown parsing during streaming */
  enableStreamingMarkdown: boolean; // Added
}

export interface SettingsActions {
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
  setEnableStreamingMarkdown: (enabled: boolean) => void; // Added
  // Derived data (activeSystemPrompt) should be handled by selectors outside the store
}

// Default global system prompt (can be moved to constants later)
const defaultGlobalPrompt = `You are a helpful, concise AI assistant designed to provide accurate, relevant answers.
Follow all instructions exactly, prioritizing clarity, specificity, and relevance.
Define your role and limitations in context, and adhere strictly to them.
Format responses according to specified output format (e.g., JSON, code block, bullet list).
If unsure, admit uncertainty rather than guessing, and ask a single clarifying question if required.
When reasoning is needed, provide brief chain‑of‑thought steps to improve transparency.
Keep responses concise; avoid unnecessary preamble or filler words.
`;

export const useSettingsStore = create<SettingsState & SettingsActions>()(
  (set) => ({
    // Initial State
    enableAdvancedSettings: true,
    theme: "system",
    searchTerm: "",
    isSettingsModalOpen: false,
    temperature: 0.7,
    maxTokens: null,
    globalSystemPrompt: defaultGlobalPrompt, // Initialize with default
    topP: null,
    topK: null,
    presencePenalty: null,
    frequencyPenalty: null,
    streamingRefreshRateMs: 33, // Default ~30 FPS (1000ms / 30)
    enableStreamingMarkdown: true, // Added default

    // Actions
    setEnableAdvancedSettings: (enableAdvancedSettings) =>
      set({ enableAdvancedSettings }),
    setTheme: (theme) => {
      set({ theme });
      // IMPORTANT: The side effect of applying the theme to the DOM
      // should be handled by a component subscribing to this state,
      // not directly within the store action.
    },
    setSearchTerm: (searchTerm) => set({ searchTerm }),
    setIsSettingsModalOpen: (isOpen) => {
      set({ isSettingsModalOpen: isOpen });
    },
    setTemperature: (temperature) => set({ temperature }),
    setMaxTokens: (maxTokens) => set({ maxTokens }),
    setGlobalSystemPrompt: (globalSystemPrompt) => set({ globalSystemPrompt }),
    setTopP: (topP) => set({ topP }),
    setTopK: (topK) => set({ topK }),
    setPresencePenalty: (presencePenalty) => set({ presencePenalty }),
    setFrequencyPenalty: (frequencyPenalty) => set({ frequencyPenalty }),
    setStreamingRefreshRateMs: (streamingRefreshRateMs) =>
      set({ streamingRefreshRateMs }),
    setEnableStreamingMarkdown: (enableStreamingMarkdown) =>
      set({ enableStreamingMarkdown }), // Added action
  }),
);
