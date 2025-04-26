// src/store/settings.store.ts
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { PersistenceService } from "@/services/persistence.service";

interface SettingsState {
  theme: "light" | "dark" | "system";
  // Renamed defaultSystemPrompt to globalSystemPrompt
  globalSystemPrompt: string | null;
  // Added parameter states
  temperature: number;
  maxTokens: number | null;
  topP: number | null;
  topK: number | null;
  presencePenalty: number | null;
  frequencyPenalty: number | null;
  // Added general setting state
  enableAdvancedSettings: boolean;
}

interface SettingsActions {
  setTheme: (theme: SettingsState["theme"]) => void;
  // Renamed action
  setGlobalSystemPrompt: (prompt: string | null) => void;
  // Added parameter actions
  setTemperature: (temp: number) => void;
  setMaxTokens: (tokens: number | null) => void;
  setTopP: (topP: number | null) => void;
  setTopK: (topK: number | null) => void;
  setPresencePenalty: (penalty: number | null) => void;
  setFrequencyPenalty: (penalty: number | null) => void;
  // Added general setting action
  setEnableAdvancedSettings: (enabled: boolean) => void;
  loadSettings: () => Promise<void>;
}

const DEFAULT_SYSTEM_PROMPT = `You are a helpful AI assistant.`;

export const useSettingsStore = create(
  immer<SettingsState & SettingsActions>((set) => ({
    // Initial default values
    theme: "system",
    globalSystemPrompt: DEFAULT_SYSTEM_PROMPT,
    temperature: 0.7,
    maxTokens: null,
    topP: null,
    topK: null,
    presencePenalty: 0.0,
    frequencyPenalty: 0.0,
    enableAdvancedSettings: true, // Default to true or false as needed

    setTheme: (theme) => {
      set({ theme: theme });
      PersistenceService.saveSetting("theme", theme);
    },

    // Renamed action implementation
    setGlobalSystemPrompt: (prompt) => {
      set({ globalSystemPrompt: prompt });
      PersistenceService.saveSetting("globalSystemPrompt", prompt);
    },

    // Added parameter action implementations
    setTemperature: (temp) => {
      set({ temperature: temp });
      PersistenceService.saveSetting("temperature", temp);
    },
    setMaxTokens: (tokens) => {
      set({ maxTokens: tokens });
      PersistenceService.saveSetting("maxTokens", tokens);
    },
    setTopP: (topP) => {
      set({ topP: topP });
      PersistenceService.saveSetting("topP", topP);
    },
    setTopK: (topK) => {
      set({ topK: topK });
      PersistenceService.saveSetting("topK", topK);
    },
    setPresencePenalty: (penalty) => {
      set({ presencePenalty: penalty });
      PersistenceService.saveSetting("presencePenalty", penalty);
    },
    setFrequencyPenalty: (penalty) => {
      set({ frequencyPenalty: penalty });
      PersistenceService.saveSetting("frequencyPenalty", penalty);
    },

    // Added general setting action implementation
    setEnableAdvancedSettings: (enabled) => {
      set({ enableAdvancedSettings: enabled });
      PersistenceService.saveSetting("enableAdvancedSettings", enabled);
    },

    loadSettings: async () => {
      try {
        const [
          theme,
          temp,
          tokens,
          topP,
          topK,
          presencePenalty,
          frequencyPenalty,
          systemPrompt,
          enableAdvanced,
        ] = await Promise.all([
          PersistenceService.loadSetting<SettingsState["theme"]>(
            "theme",
            "system",
          ),
          PersistenceService.loadSetting<number>("temperature", 0.7),
          PersistenceService.loadSetting<number | null>("maxTokens", null),
          PersistenceService.loadSetting<number | null>("topP", null),
          PersistenceService.loadSetting<number | null>("topK", null),
          PersistenceService.loadSetting<number | null>("presencePenalty", 0.0),
          PersistenceService.loadSetting<number | null>(
            "frequencyPenalty",
            0.0,
          ),
          PersistenceService.loadSetting<string | null>(
            "globalSystemPrompt",
            DEFAULT_SYSTEM_PROMPT,
          ),
          PersistenceService.loadSetting<boolean>(
            "enableAdvancedSettings",
            true,
          ),
        ]);

        set({
          theme,
          temperature: temp,
          maxTokens: tokens,
          topP,
          topK,
          presencePenalty,
          frequencyPenalty,
          globalSystemPrompt: systemPrompt,
          enableAdvancedSettings: enableAdvanced,
        });
      } catch (error) {
        console.error("SettingsStore: Error loading settings", error);
        // Keep default values if loading fails
      }
    },
  })),
);
