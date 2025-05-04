// src/store/settings.store.ts
// FULL FILE
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
  enableStreamingCodeBlockParsing: boolean;
  foldStreamingCodeBlocks: boolean;
  foldUserMessagesOnCompletion: boolean;
  streamingRenderFPS: number;
  gitUserName: string | null;
  gitUserEmail: string | null;
  toolMaxSteps: number;
  prismThemeUrl: string | null;
  // New Auto-Title Settings
  autoTitleEnabled: boolean;
  autoTitleModelId: string | null;
  autoTitlePromptMaxLength: number;
  autoTitleIncludeFiles: boolean;
  autoTitleIncludeRules: boolean;
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
  setEnableStreamingCodeBlockParsing: (enabled: boolean) => void;
  setFoldStreamingCodeBlocks: (fold: boolean) => void;
  setFoldUserMessagesOnCompletion: (fold: boolean) => void;
  setStreamingRenderFPS: (fps: number) => void;
  setGitUserName: (name: string | null) => void;
  setGitUserEmail: (email: string | null) => void;
  setToolMaxSteps: (steps: number) => void;
  setPrismThemeUrl: (url: string | null) => void;
  // New Auto-Title Actions
  setAutoTitleEnabled: (enabled: boolean) => void;
  setAutoTitleModelId: (modelId: string | null) => void;
  setAutoTitlePromptMaxLength: (length: number) => void;
  setAutoTitleIncludeFiles: (include: boolean) => void;
  setAutoTitleIncludeRules: (include: boolean) => void;
  loadSettings: () => Promise<void>;
  resetGeneralSettings: () => Promise<void>;
  resetAssistantSettings: () => Promise<void>; // Add reset for assistant
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
const DEFAULT_ENABLE_STREAMING_CODE_BLOCK_PARSING = false;
const DEFAULT_FOLD_STREAMING_CODE_BLOCKS = false;
const DEFAULT_FOLD_USER_MESSAGES_ON_COMPLETION = false;
const DEFAULT_STREAMING_FPS = 15;
const DEFAULT_GIT_USER_NAME = null;
const DEFAULT_GIT_USER_EMAIL = null;
const DEFAULT_TOOL_MAX_STEPS = 5;
const DEFAULT_PRISM_THEME_URL = null;
// New Auto-Title Defaults
const DEFAULT_AUTO_TITLE_ENABLED = true;
const DEFAULT_AUTO_TITLE_MODEL_ID = null; // User must select
const DEFAULT_AUTO_TITLE_PROMPT_MAX_LENGTH = 768;
const DEFAULT_AUTO_TITLE_INCLUDE_FILES = false;
const DEFAULT_AUTO_TITLE_INCLUDE_RULES = false;

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
    enableStreamingCodeBlockParsing:
      DEFAULT_ENABLE_STREAMING_CODE_BLOCK_PARSING,
    foldStreamingCodeBlocks: DEFAULT_FOLD_STREAMING_CODE_BLOCKS,
    foldUserMessagesOnCompletion: DEFAULT_FOLD_USER_MESSAGES_ON_COMPLETION,
    streamingRenderFPS: DEFAULT_STREAMING_FPS,
    gitUserName: DEFAULT_GIT_USER_NAME,
    gitUserEmail: DEFAULT_GIT_USER_EMAIL,
    toolMaxSteps: DEFAULT_TOOL_MAX_STEPS,
    prismThemeUrl: DEFAULT_PRISM_THEME_URL,
    // Initialize new settings
    autoTitleEnabled: DEFAULT_AUTO_TITLE_ENABLED,
    autoTitleModelId: DEFAULT_AUTO_TITLE_MODEL_ID,
    autoTitlePromptMaxLength: DEFAULT_AUTO_TITLE_PROMPT_MAX_LENGTH,
    autoTitleIncludeFiles: DEFAULT_AUTO_TITLE_INCLUDE_FILES,
    autoTitleIncludeRules: DEFAULT_AUTO_TITLE_INCLUDE_RULES,

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

    setEnableStreamingCodeBlockParsing: (enabled) => {
      set({ enableStreamingCodeBlockParsing: enabled });
      PersistenceService.saveSetting(
        "enableStreamingCodeBlockParsing",
        enabled,
      );
    },

    setFoldStreamingCodeBlocks: (fold) => {
      set({ foldStreamingCodeBlocks: fold });
      PersistenceService.saveSetting("foldStreamingCodeBlocks", fold);
    },

    setFoldUserMessagesOnCompletion: (fold) => {
      set({ foldUserMessagesOnCompletion: fold });
      PersistenceService.saveSetting("foldUserMessagesOnCompletion", fold);
    },

    setStreamingRenderFPS: (fps) => {
      const clampedFps = Math.max(3, Math.min(60, fps));
      set({ streamingRenderFPS: clampedFps });
      PersistenceService.saveSetting("streamingRenderFPS", clampedFps);
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

    // --- Auto-Title Setters ---
    setAutoTitleEnabled: (enabled) => {
      set({ autoTitleEnabled: enabled });
      PersistenceService.saveSetting("autoTitleEnabled", enabled);
    },
    setAutoTitleModelId: (modelId) => {
      set({ autoTitleModelId: modelId });
      PersistenceService.saveSetting("autoTitleModelId", modelId);
    },
    setAutoTitlePromptMaxLength: (length) => {
      const clampedLength = Math.max(100, Math.min(4000, length)); // Example clamp
      set({ autoTitlePromptMaxLength: clampedLength });
      PersistenceService.saveSetting("autoTitlePromptMaxLength", clampedLength);
    },
    setAutoTitleIncludeFiles: (include) => {
      set({ autoTitleIncludeFiles: include });
      PersistenceService.saveSetting("autoTitleIncludeFiles", include);
    },
    setAutoTitleIncludeRules: (include) => {
      set({ autoTitleIncludeRules: include });
      PersistenceService.saveSetting("autoTitleIncludeRules", include);
    },
    // --- End Auto-Title Setters ---

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
          enableStreamingCodeBlock,
          foldStreamingCodeBlocks,
          foldUserMessages,
          streamingFps,
          gitUserName,
          gitUserEmail,
          toolMaxSteps,
          prismThemeUrl,
          // Load new settings
          autoTitleEnabled,
          autoTitleModelId,
          autoTitlePromptMaxLength,
          autoTitleIncludeFiles,
          autoTitleIncludeRules,
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
          PersistenceService.loadSetting<boolean>(
            "enableStreamingCodeBlockParsing",
            DEFAULT_ENABLE_STREAMING_CODE_BLOCK_PARSING,
          ),
          PersistenceService.loadSetting<boolean>(
            "foldStreamingCodeBlocks",
            DEFAULT_FOLD_STREAMING_CODE_BLOCKS,
          ),
          PersistenceService.loadSetting<boolean>(
            "foldUserMessagesOnCompletion",
            DEFAULT_FOLD_USER_MESSAGES_ON_COMPLETION,
          ),
          PersistenceService.loadSetting<number>(
            "streamingRenderFPS",
            DEFAULT_STREAMING_FPS,
          ),
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
          // Load new settings with defaults
          PersistenceService.loadSetting<boolean>(
            "autoTitleEnabled",
            DEFAULT_AUTO_TITLE_ENABLED,
          ),
          PersistenceService.loadSetting<string | null>(
            "autoTitleModelId",
            DEFAULT_AUTO_TITLE_MODEL_ID,
          ),
          PersistenceService.loadSetting<number>(
            "autoTitlePromptMaxLength",
            DEFAULT_AUTO_TITLE_PROMPT_MAX_LENGTH,
          ),
          PersistenceService.loadSetting<boolean>(
            "autoTitleIncludeFiles",
            DEFAULT_AUTO_TITLE_INCLUDE_FILES,
          ),
          PersistenceService.loadSetting<boolean>(
            "autoTitleIncludeRules",
            DEFAULT_AUTO_TITLE_INCLUDE_RULES,
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
          enableStreamingCodeBlockParsing: enableStreamingCodeBlock,
          foldStreamingCodeBlocks: foldStreamingCodeBlocks,
          foldUserMessagesOnCompletion: foldUserMessages,
          streamingRenderFPS: streamingFps,
          gitUserName,
          gitUserEmail,
          toolMaxSteps,
          prismThemeUrl,
          // Set loaded values for new settings
          autoTitleEnabled,
          autoTitleModelId,
          autoTitlePromptMaxLength,
          autoTitleIncludeFiles,
          autoTitleIncludeRules,
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
          enableStreamingCodeBlockParsing:
            DEFAULT_ENABLE_STREAMING_CODE_BLOCK_PARSING,
          foldStreamingCodeBlocks: DEFAULT_FOLD_STREAMING_CODE_BLOCKS,
          foldUserMessagesOnCompletion:
            DEFAULT_FOLD_USER_MESSAGES_ON_COMPLETION,
          streamingRenderFPS: DEFAULT_STREAMING_FPS,
          prismThemeUrl: DEFAULT_PRISM_THEME_URL,
        });
        await Promise.all([
          PersistenceService.saveSetting("theme", DEFAULT_THEME),
          PersistenceService.saveSetting(
            "enableStreamingMarkdown",
            DEFAULT_ENABLE_STREAMING_MARKDOWN,
          ),
          PersistenceService.saveSetting(
            "enableStreamingCodeBlockParsing",
            DEFAULT_ENABLE_STREAMING_CODE_BLOCK_PARSING,
          ),
          PersistenceService.saveSetting(
            "foldStreamingCodeBlocks",
            DEFAULT_FOLD_STREAMING_CODE_BLOCKS,
          ),
          PersistenceService.saveSetting(
            "foldUserMessagesOnCompletion",
            DEFAULT_FOLD_USER_MESSAGES_ON_COMPLETION,
          ),
          PersistenceService.saveSetting(
            "streamingRenderFPS",
            DEFAULT_STREAMING_FPS,
          ),
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

    resetAssistantSettings: async () => {
      try {
        set({
          globalSystemPrompt: DEFAULT_SYSTEM_PROMPT,
          temperature: DEFAULT_TEMPERATURE,
          maxTokens: DEFAULT_MAX_TOKENS,
          topP: DEFAULT_TOP_P,
          topK: DEFAULT_TOP_K,
          presencePenalty: DEFAULT_PRESENCE_PENALTY,
          frequencyPenalty: DEFAULT_FREQUENCY_PENALTY,
          toolMaxSteps: DEFAULT_TOOL_MAX_STEPS,
          // Reset auto-title settings
          autoTitleEnabled: DEFAULT_AUTO_TITLE_ENABLED,
          autoTitleModelId: DEFAULT_AUTO_TITLE_MODEL_ID,
          autoTitlePromptMaxLength: DEFAULT_AUTO_TITLE_PROMPT_MAX_LENGTH,
          autoTitleIncludeFiles: DEFAULT_AUTO_TITLE_INCLUDE_FILES,
          autoTitleIncludeRules: DEFAULT_AUTO_TITLE_INCLUDE_RULES,
        });
        await Promise.all([
          PersistenceService.saveSetting(
            "globalSystemPrompt",
            DEFAULT_SYSTEM_PROMPT,
          ),
          PersistenceService.saveSetting("temperature", DEFAULT_TEMPERATURE),
          PersistenceService.saveSetting("maxTokens", DEFAULT_MAX_TOKENS),
          PersistenceService.saveSetting("topP", DEFAULT_TOP_P),
          PersistenceService.saveSetting("topK", DEFAULT_TOP_K),
          PersistenceService.saveSetting(
            "presencePenalty",
            DEFAULT_PRESENCE_PENALTY,
          ),
          PersistenceService.saveSetting(
            "frequencyPenalty",
            DEFAULT_FREQUENCY_PENALTY,
          ),
          PersistenceService.saveSetting(
            "toolMaxSteps",
            DEFAULT_TOOL_MAX_STEPS,
          ),
          // Persist reset for auto-title settings
          PersistenceService.saveSetting(
            "autoTitleEnabled",
            DEFAULT_AUTO_TITLE_ENABLED,
          ),
          PersistenceService.saveSetting(
            "autoTitleModelId",
            DEFAULT_AUTO_TITLE_MODEL_ID,
          ),
          PersistenceService.saveSetting(
            "autoTitlePromptMaxLength",
            DEFAULT_AUTO_TITLE_PROMPT_MAX_LENGTH,
          ),
          PersistenceService.saveSetting(
            "autoTitleIncludeFiles",
            DEFAULT_AUTO_TITLE_INCLUDE_FILES,
          ),
          PersistenceService.saveSetting(
            "autoTitleIncludeRules",
            DEFAULT_AUTO_TITLE_INCLUDE_RULES,
          ),
        ]);
        toast.success("Assistant settings reset to defaults.");
      } catch (error) {
        console.error(
          "SettingsStore: Error resetting assistant settings",
          error,
        );
        toast.error("Failed to reset assistant settings.");
      }
    },
  })),
);
