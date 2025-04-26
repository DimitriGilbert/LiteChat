// src/store/settings.store.ts
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { PersistenceService } from "@/services/persistence.service";

interface SettingsState {
  theme: "light" | "dark" | "system";
  globalSystemPrompt: string | null;
  temperature: number;
  maxTokens: number | null;
  topP: number | null;
  topK: number | null;
  presencePenalty: number | null;
  frequencyPenalty: number | null;
  enableAdvancedSettings: boolean;
  enableStreamingMarkdown: boolean;
  streamingRenderFPS: number; // General FPS
  streamingCodeRenderFPS: number; // FPS specifically for code blocks
}

interface SettingsActions {
  setTheme: (theme: SettingsState["theme"]) => void;
  setGlobalSystemPrompt: (prompt: string | null) => void;
  setTemperature: (temp: number) => void;
  setMaxTokens: (tokens: number | null) => void;
  setTopP: (topP: number | null) => void;
  setTopK: (topK: number | null) => void;
  setPresencePenalty: (penalty: number | null) => void;
  setFrequencyPenalty: (penalty: number | null) => void;
  setEnableAdvancedSettings: (enabled: boolean) => void;
  setEnableStreamingMarkdown: (enabled: boolean) => void;
  setStreamingRenderFPS: (fps: number) => void;
  setStreamingCodeRenderFPS: (fps: number) => void; // Action for code FPS
  loadSettings: () => Promise<void>;
}

const DEFAULT_SYSTEM_PROMPT = `You are a helpful AI assistant.`;
const DEFAULT_STREAMING_FPS = 30;
const DEFAULT_STREAMING_CODE_FPS = 10; // Slower default for code blocks

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
    enableAdvancedSettings: true,
    enableStreamingMarkdown: true,
    streamingRenderFPS: DEFAULT_STREAMING_FPS,
    streamingCodeRenderFPS: DEFAULT_STREAMING_CODE_FPS, // Initialize code FPS

    setTheme: (theme) => {
      set({ theme: theme });
      PersistenceService.saveSetting("theme", theme);
    },

    setGlobalSystemPrompt: (prompt) => {
      set({ globalSystemPrompt: prompt });
      PersistenceService.saveSetting("globalSystemPrompt", prompt);
    },

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

    setEnableAdvancedSettings: (enabled) => {
      set({ enableAdvancedSettings: enabled });
      PersistenceService.saveSetting("enableAdvancedSettings", enabled);
    },

    setEnableStreamingMarkdown: (enabled) => {
      set({ enableStreamingMarkdown: enabled });
      PersistenceService.saveSetting("enableStreamingMarkdown", enabled);
    },

    setStreamingRenderFPS: (fps) => {
      const clampedFps = Math.max(1, Math.min(60, fps));
      set({ streamingRenderFPS: clampedFps });
      PersistenceService.saveSetting("streamingRenderFPS", clampedFps);
    },

    // Action for Code FPS setting
    setStreamingCodeRenderFPS: (fps) => {
      const clampedFps = Math.max(1, Math.min(60, fps)); // Clamp between 1 and 60 FPS
      set({ streamingCodeRenderFPS: clampedFps });
      PersistenceService.saveSetting("streamingCodeRenderFPS", clampedFps); // Use new key
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
          enableStreamingMd,
          streamingFps,
          streamingCodeFps, // Load code FPS setting
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
          PersistenceService.loadSetting<boolean>(
            "enableStreamingMarkdown",
            true,
          ),
          PersistenceService.loadSetting<number>(
            "streamingRenderFPS",
            DEFAULT_STREAMING_FPS,
          ),
          PersistenceService.loadSetting<number>( // Load code FPS setting
            "streamingCodeRenderFPS", // Use new key
            DEFAULT_STREAMING_CODE_FPS, // Default code FPS value
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
          enableStreamingMarkdown: enableStreamingMd,
          streamingRenderFPS: streamingFps,
          streamingCodeRenderFPS: streamingCodeFps, // Set loaded code FPS value
        });
      } catch (error) {
        console.error("SettingsStore: Error loading settings", error);
      }
    },
  })),
);
