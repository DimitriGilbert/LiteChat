// src/store/settings.store.ts
// Entire file content provided
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { PersistenceService } from "@/services/persistence.service";
import { toast } from "sonner";

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
  // Add setting for code block parsing during streaming
  enableStreamingCodeBlockParsing: boolean;
  streamingRenderFPS: number;
  // streamingCodeRenderFPS removed
  gitUserName: string | null;
  gitUserEmail: string | null;
  toolMaxSteps: number;
  prismThemeUrl: string | null;
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
  // Add setter for code block parsing
  setEnableStreamingCodeBlockParsing: (enabled: boolean) => void;
  setStreamingRenderFPS: (fps: number) => void;
  // setStreamingCodeRenderFPS removed
  setGitUserName: (name: string | null) => void;
  setGitUserEmail: (email: string | null) => void;
  setToolMaxSteps: (steps: number) => void;
  setPrismThemeUrl: (url: string | null) => void;
  loadSettings: () => Promise<void>;
  resetGeneralSettings: () => Promise<void>;
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
// Add default for code block parsing
const DEFAULT_ENABLE_STREAMING_CODE_BLOCK_PARSING = false; // Default to off
const DEFAULT_STREAMING_FPS = 15; // Adjusted default FPS
// DEFAULT_STREAMING_CODE_FPS removed
const DEFAULT_GIT_USER_NAME = null;
const DEFAULT_GIT_USER_EMAIL = null;
const DEFAULT_TOOL_MAX_STEPS = 5;
const DEFAULT_PRISM_THEME_URL = null;

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
    // Initialize new setting
    enableStreamingCodeBlockParsing:
      DEFAULT_ENABLE_STREAMING_CODE_BLOCK_PARSING,
    streamingRenderFPS: DEFAULT_STREAMING_FPS,
    // streamingCodeRenderFPS removed
    gitUserName: DEFAULT_GIT_USER_NAME,
    gitUserEmail: DEFAULT_GIT_USER_EMAIL,
    toolMaxSteps: DEFAULT_TOOL_MAX_STEPS,
    prismThemeUrl: DEFAULT_PRISM_THEME_URL,

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

    // Implement setter for code block parsing
    setEnableStreamingCodeBlockParsing: (enabled) => {
      set({ enableStreamingCodeBlockParsing: enabled });
      PersistenceService.saveSetting(
        "enableStreamingCodeBlockParsing",
        enabled,
      );
    },

    setStreamingRenderFPS: (fps) => {
      const clampedFps = Math.max(3, Math.min(60, fps)); // Adjusted min FPS
      set({ streamingRenderFPS: clampedFps });
      PersistenceService.saveSetting("streamingRenderFPS", clampedFps);
    },

    // setStreamingCodeRenderFPS removed

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

    setToolMaxSteps: (steps) => {
      const clampedSteps = Math.max(1, Math.min(20, steps));
      set({ toolMaxSteps: clampedSteps });
      PersistenceService.saveSetting("toolMaxSteps", clampedSteps);
    },

    setPrismThemeUrl: (url) => {
      const trimmedUrl = url?.trim() || null;
      set({ prismThemeUrl: trimmedUrl });
      PersistenceService.saveSetting("prismThemeUrl", trimmedUrl);
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
          // Load new setting
          enableStreamingCodeBlock,
          streamingFps,
          // streamingCodeFps removed
          gitUserName,
          gitUserEmail,
          toolMaxSteps,
          prismThemeUrl,
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
          // Load new setting from persistence
          PersistenceService.loadSetting<boolean>(
            "enableStreamingCodeBlockParsing",
            DEFAULT_ENABLE_STREAMING_CODE_BLOCK_PARSING,
          ),
          PersistenceService.loadSetting<number>(
            "streamingRenderFPS",
            DEFAULT_STREAMING_FPS,
          ),
          // streamingCodeRenderFPS removed
          PersistenceService.loadSetting<string | null>(
            "gitUserName",
            DEFAULT_GIT_USER_NAME,
          ),
          PersistenceService.loadSetting<string | null>(
            "gitUserEmail",
            DEFAULT_GIT_USER_EMAIL,
          ),
          PersistenceService.loadSetting<number>(
            "toolMaxSteps",
            DEFAULT_TOOL_MAX_STEPS,
          ),
          PersistenceService.loadSetting<string | null>(
            "prismThemeUrl",
            DEFAULT_PRISM_THEME_URL,
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
          // Set loaded value for new setting
          enableStreamingCodeBlockParsing: enableStreamingCodeBlock,
          streamingRenderFPS: streamingFps,
          // streamingCodeRenderFPS removed
          gitUserName,
          gitUserEmail,
          toolMaxSteps,
          prismThemeUrl,
        });
      } catch (error) {
        console.error("SettingsStore: Error loading settings", error);
      }
    },

    resetGeneralSettings: async () => {
      try {
        set({
          theme: DEFAULT_THEME,
          enableStreamingMarkdown: DEFAULT_ENABLE_STREAMING_MARKDOWN,
          // Reset new setting
          enableStreamingCodeBlockParsing:
            DEFAULT_ENABLE_STREAMING_CODE_BLOCK_PARSING,
          streamingRenderFPS: DEFAULT_STREAMING_FPS,
          // streamingCodeRenderFPS removed
          prismThemeUrl: DEFAULT_PRISM_THEME_URL,
        });
        await Promise.all([
          PersistenceService.saveSetting("theme", DEFAULT_THEME),
          PersistenceService.saveSetting(
            "enableStreamingMarkdown",
            DEFAULT_ENABLE_STREAMING_MARKDOWN,
          ),
          // Persist reset for new setting
          PersistenceService.saveSetting(
            "enableStreamingCodeBlockParsing",
            DEFAULT_ENABLE_STREAMING_CODE_BLOCK_PARSING,
          ),
          PersistenceService.saveSetting(
            "streamingRenderFPS",
            DEFAULT_STREAMING_FPS,
          ),
          // streamingCodeRenderFPS removed
          PersistenceService.saveSetting(
            "prismThemeUrl",
            DEFAULT_PRISM_THEME_URL,
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
