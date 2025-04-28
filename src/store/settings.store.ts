// src/store/settings.store.ts
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { PersistenceService } from "@/services/persistence.service";
import { toast } from "sonner"; // Import toast for feedback

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
  gitUserName: string | null; // Added
  gitUserEmail: string | null; // Added
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
  setGitUserName: (name: string | null) => void; // Added
  setGitUserEmail: (email: string | null) => void; // Added
  loadSettings: () => Promise<void>;
  resetGeneralSettings: () => Promise<void>; // Added reset action
}

// Define default constants
const DEFAULT_THEME = "system";
const DEFAULT_SYSTEM_PROMPT = `You are a helpful AI assistant.`;
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_TOKENS = null;
const DEFAULT_TOP_P = null;
const DEFAULT_TOP_K = null;
const DEFAULT_PRESENCE_PENALTY = 0.0;
const DEFAULT_FREQUENCY_PENALTY = 0.0;
const DEFAULT_ENABLE_ADVANCED_SETTINGS = true;
const DEFAULT_ENABLE_STREAMING_MARKDOWN = true;
const DEFAULT_STREAMING_FPS = 30;
const DEFAULT_STREAMING_CODE_FPS = 10;
const DEFAULT_GIT_USER_NAME = null;
const DEFAULT_GIT_USER_EMAIL = null;

export const useSettingsStore = create(
  immer<SettingsState & SettingsActions>((set) => ({
    // Initial default values using constants
    theme: DEFAULT_THEME,
    globalSystemPrompt: DEFAULT_SYSTEM_PROMPT,
    temperature: DEFAULT_TEMPERATURE,
    maxTokens: DEFAULT_MAX_TOKENS,
    topP: DEFAULT_TOP_P,
    topK: DEFAULT_TOP_K,
    presencePenalty: DEFAULT_PRESENCE_PENALTY,
    frequencyPenalty: DEFAULT_FREQUENCY_PENALTY,
    enableAdvancedSettings: DEFAULT_ENABLE_ADVANCED_SETTINGS,
    enableStreamingMarkdown: DEFAULT_ENABLE_STREAMING_MARKDOWN,
    streamingRenderFPS: DEFAULT_STREAMING_FPS,
    streamingCodeRenderFPS: DEFAULT_STREAMING_CODE_FPS,
    gitUserName: DEFAULT_GIT_USER_NAME,
    gitUserEmail: DEFAULT_GIT_USER_EMAIL,

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

    setStreamingCodeRenderFPS: (fps) => {
      const clampedFps = Math.max(1, Math.min(60, fps));
      set({ streamingCodeRenderFPS: clampedFps });
      PersistenceService.saveSetting("streamingCodeRenderFPS", clampedFps);
    },

    setGitUserName: (name) => {
      const trimmedName = name?.trim() || null;
      set({ gitUserName: trimmedName });
      PersistenceService.saveSetting("gitUserName", trimmedName);
    },
    setGitUserEmail: (email) => {
      const trimmedEmail = email?.trim() || null;
      set({ gitUserEmail: trimmedEmail });
      PersistenceService.saveSetting("gitUserEmail", trimmedEmail);
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
          streamingCodeFps,
          gitUserName,
          gitUserEmail,
        ] = await Promise.all([
          PersistenceService.loadSetting<SettingsState["theme"]>(
            "theme",
            DEFAULT_THEME,
          ),
          PersistenceService.loadSetting<number>(
            "temperature",
            DEFAULT_TEMPERATURE,
          ),
          PersistenceService.loadSetting<number | null>(
            "maxTokens",
            DEFAULT_MAX_TOKENS,
          ),
          PersistenceService.loadSetting<number | null>("topP", DEFAULT_TOP_P),
          PersistenceService.loadSetting<number | null>("topK", DEFAULT_TOP_K),
          PersistenceService.loadSetting<number | null>(
            "presencePenalty",
            DEFAULT_PRESENCE_PENALTY,
          ),
          PersistenceService.loadSetting<number | null>(
            "frequencyPenalty",
            DEFAULT_FREQUENCY_PENALTY,
          ),
          PersistenceService.loadSetting<string | null>(
            "globalSystemPrompt",
            DEFAULT_SYSTEM_PROMPT,
          ),
          PersistenceService.loadSetting<boolean>(
            "enableAdvancedSettings",
            DEFAULT_ENABLE_ADVANCED_SETTINGS,
          ),
          PersistenceService.loadSetting<boolean>(
            "enableStreamingMarkdown",
            DEFAULT_ENABLE_STREAMING_MARKDOWN,
          ),
          PersistenceService.loadSetting<number>(
            "streamingRenderFPS",
            DEFAULT_STREAMING_FPS,
          ),
          PersistenceService.loadSetting<number>(
            "streamingCodeRenderFPS",
            DEFAULT_STREAMING_CODE_FPS,
          ),
          PersistenceService.loadSetting<string | null>(
            "gitUserName",
            DEFAULT_GIT_USER_NAME,
          ),
          PersistenceService.loadSetting<string | null>(
            "gitUserEmail",
            DEFAULT_GIT_USER_EMAIL,
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
          streamingCodeRenderFPS: streamingCodeFps,
          gitUserName,
          gitUserEmail,
        });
      } catch (error) {
        console.error("SettingsStore: Error loading settings", error);
      }
    },

    // Added reset action
    resetGeneralSettings: async () => {
      try {
        set({
          theme: DEFAULT_THEME,
          enableStreamingMarkdown: DEFAULT_ENABLE_STREAMING_MARKDOWN,
          streamingRenderFPS: DEFAULT_STREAMING_FPS,
          streamingCodeRenderFPS: DEFAULT_STREAMING_CODE_FPS,
        });
        await Promise.all([
          PersistenceService.saveSetting("theme", DEFAULT_THEME),
          PersistenceService.saveSetting(
            "enableStreamingMarkdown",
            DEFAULT_ENABLE_STREAMING_MARKDOWN,
          ),
          PersistenceService.saveSetting(
            "streamingRenderFPS",
            DEFAULT_STREAMING_FPS,
          ),
          PersistenceService.saveSetting(
            "streamingCodeRenderFPS",
            DEFAULT_STREAMING_CODE_FPS,
          ),
        ]);
        toast.success("General settings reset to defaults.");
      } catch (error) {
        console.error("SettingsStore: Error resetting general settings", error);
        toast.error("Failed to reset general settings.");
      }
    },
  })),
);
