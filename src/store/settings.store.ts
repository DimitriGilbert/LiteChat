// src/store/settings.store.ts
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { PersistenceService } from "@/services/persistence.service";

interface SettingsState {
  theme: "light" | "dark" | "system";
  defaultTemperature: number;
  defaultMaxTokens: number | null;
  defaultSystemPrompt: string | null;
}

interface SettingsActions {
  setTheme: (theme: SettingsState["theme"]) => void;
  setDefaultTemperature: (temp: number) => void;
  setDefaultMaxTokens: (tokens: number | null) => void;
  setDefaultSystemPrompt: (prompt: string | null) => void;
  loadSettings: () => Promise<void>;
}

const DEFAULT_SYSTEM_PROMPT = `You are a helpful AI assistant.`;

export const useSettingsStore = create(
  immer<SettingsState & SettingsActions>((set) => ({
    // Initial default values
    theme: "system",
    defaultTemperature: 0.7,
    defaultMaxTokens: null,
    defaultSystemPrompt: DEFAULT_SYSTEM_PROMPT,

    setTheme: (theme) => {
      set({ theme: theme });
      PersistenceService.saveSetting("theme", theme);
    },

    setDefaultTemperature: (temp) => {
      set({ defaultTemperature: temp });
      PersistenceService.saveSetting("defaultTemperature", temp);
    },

    setDefaultMaxTokens: (tokens) => {
      set({ defaultMaxTokens: tokens });
      PersistenceService.saveSetting("defaultMaxTokens", tokens);
    },

    setDefaultSystemPrompt: (prompt) => {
      set({ defaultSystemPrompt: prompt });
      PersistenceService.saveSetting("defaultSystemPrompt", prompt);
    },

    loadSettings: async () => {
      try {
        const theme = await PersistenceService.loadSetting<
          SettingsState["theme"]
        >("theme", "system");
        const temp = await PersistenceService.loadSetting<number>(
          "defaultTemperature",
          0.7,
        );
        const tokens = await PersistenceService.loadSetting<number | null>(
          "defaultMaxTokens",
          null,
        );
        const systemPrompt = await PersistenceService.loadSetting<
          string | null
        >("defaultSystemPrompt", DEFAULT_SYSTEM_PROMPT);
        set({
          theme,
          defaultTemperature: temp,
          defaultMaxTokens: tokens,
          defaultSystemPrompt: systemPrompt,
        });
      } catch (error) {
        console.error("SettingsStore: Error loading settings", error);
        // Keep default values if loading fails
      }
    },
  })),
);
