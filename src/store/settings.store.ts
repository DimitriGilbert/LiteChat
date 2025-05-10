// src/store/settings.store.ts
// FULL FILE
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { PersistenceService } from "@/services/persistence.service";
import { toast } from "sonner";
import { emitter } from "@/lib/litechat/event-emitter";
import { settingsEvent } from "@/types/litechat/modding"; // Updated import

export interface CustomThemeColors {
  background?: string;
  foreground?: string;
  card?: string;
  cardForeground?: string;
  popover?: string;
  popoverForeground?: string;
  primary?: string;
  primaryForeground?: string;
  secondary?: string;
  secondaryForeground?: string;
  muted?: string;
  mutedForeground?: string;
  accent?: string;
  accentForeground?: string;
  destructive?: string;
  destructiveForeground?: string;
  border?: string;
  input?: string;
  ring?: string;
  sidebar?: string;
  sidebarForeground?: string;
  sidebarPrimary?: string;
  sidebarPrimaryForeground?: string;
  sidebarAccent?: string;
  sidebarAccentForeground?: string;
  sidebarBorder?: string;
  sidebarRing?: string;
  chart1?: string;
  chart2?: string;
  chart3?: string;
  chart4?: string;
  chart5?: string;
}

export interface SettingsState {
  theme: "light" | "dark" | "system" | "TijuLight" | "TijuDark" | "custom";
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
  autoTitleEnabled: boolean;
  autoTitleModelId: string | null;
  autoTitlePromptMaxLength: number;
  autoTitleIncludeFiles: boolean;
  autoTitleIncludeRules: boolean;
  customFontFamily: string | null;
  customFontSize: number | null;
  chatMaxWidth: string | null;
  customThemeColors: CustomThemeColors | null;
  autoScrollInterval: number;
  enableAutoScrollOnStream: boolean;
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
  setAutoTitleEnabled: (enabled: boolean) => void;
  setAutoTitleModelId: (modelId: string | null) => void;
  setAutoTitlePromptMaxLength: (length: number) => void;
  setAutoTitleIncludeFiles: (include: boolean) => void;
  setAutoTitleIncludeRules: (include: boolean) => void;
  setCustomFontFamily: (fontFamily: string | null) => void;
  setCustomFontSize: (fontSize: number | null) => void;
  setChatMaxWidth: (maxWidthClass: string | null) => void;
  setCustomThemeColors: (colors: CustomThemeColors | null) => void;
  setCustomThemeColor: (
    colorName: keyof CustomThemeColors,
    value: string | null
  ) => void;
  setAutoScrollInterval: (interval: number) => void;
  setEnableAutoScrollOnStream: (enabled: boolean) => void;
  loadSettings: () => Promise<void>;
  resetGeneralSettings: () => Promise<void>;
  resetAssistantSettings: () => Promise<void>;
  resetThemeSettings: () => Promise<void>;
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
const DEFAULT_AUTO_TITLE_ENABLED = true;
const DEFAULT_AUTO_TITLE_MODEL_ID = null;
const DEFAULT_AUTO_TITLE_PROMPT_MAX_LENGTH = 768;
const DEFAULT_AUTO_TITLE_INCLUDE_FILES = false;
const DEFAULT_AUTO_TITLE_INCLUDE_RULES = false;
const DEFAULT_CUSTOM_FONT_FAMILY = null;
const DEFAULT_CUSTOM_FONT_SIZE = 16;
const DEFAULT_CHAT_MAX_WIDTH = "max-w-7xl";
const DEFAULT_CUSTOM_THEME_COLORS = null;
const DEFAULT_AUTO_SCROLL_INTERVAL = 1000;
const DEFAULT_ENABLE_AUTO_SCROLL_ON_STREAM = true;

export const useSettingsStore = create(
  immer<SettingsState & SettingsActions>((set, get) => ({
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
    autoTitleEnabled: DEFAULT_AUTO_TITLE_ENABLED,
    autoTitleModelId: DEFAULT_AUTO_TITLE_MODEL_ID,
    autoTitlePromptMaxLength: DEFAULT_AUTO_TITLE_PROMPT_MAX_LENGTH,
    autoTitleIncludeFiles: DEFAULT_AUTO_TITLE_INCLUDE_FILES,
    autoTitleIncludeRules: DEFAULT_AUTO_TITLE_INCLUDE_RULES,
    customFontFamily: DEFAULT_CUSTOM_FONT_FAMILY,
    customFontSize: DEFAULT_CUSTOM_FONT_SIZE,
    chatMaxWidth: DEFAULT_CHAT_MAX_WIDTH,
    customThemeColors: DEFAULT_CUSTOM_THEME_COLORS,
    autoScrollInterval: DEFAULT_AUTO_SCROLL_INTERVAL,
    enableAutoScrollOnStream: DEFAULT_ENABLE_AUTO_SCROLL_ON_STREAM,

    setTheme: (theme) => {
      set({ theme: theme });
      PersistenceService.saveSetting("theme", theme);
      emitter.emit(settingsEvent.themeChanged, { theme });
    },
    setGlobalSystemPrompt: (prompt) => {
      set({ globalSystemPrompt: prompt });
      PersistenceService.saveSetting("globalSystemPrompt", prompt);
      emitter.emit(settingsEvent.globalSystemPromptChanged, { prompt });
    },
    setTemperature: (temp) => {
      set({ temperature: temp });
      PersistenceService.saveSetting("temperature", temp);
      emitter.emit(settingsEvent.temperatureChanged, { value: temp });
    },
    setMaxTokens: (tokens) => {
      set({ maxTokens: tokens });
      PersistenceService.saveSetting("maxTokens", tokens);
      emitter.emit(settingsEvent.maxTokensChanged, { value: tokens });
    },
    setTopP: (topP) => {
      set({ topP: topP });
      PersistenceService.saveSetting("topP", topP);
      emitter.emit(settingsEvent.topPChanged, { value: topP });
    },
    setTopK: (topK) => {
      set({ topK: topK });
      PersistenceService.saveSetting("topK", topK);
      emitter.emit(settingsEvent.topKChanged, { value: topK });
    },
    setPresencePenalty: (penalty) => {
      set({ presencePenalty: penalty });
      PersistenceService.saveSetting("presencePenalty", penalty);
      emitter.emit(settingsEvent.presencePenaltyChanged, { value: penalty });
    },
    setFrequencyPenalty: (penalty) => {
      set({ frequencyPenalty: penalty });
      PersistenceService.saveSetting("frequencyPenalty", penalty);
      emitter.emit(settingsEvent.frequencyPenaltyChanged, { value: penalty });
    },
    setEnableAdvancedSettings: (enabled) => {
      set({ enableAdvancedSettings: enabled });
      PersistenceService.saveSetting("enableAdvancedSettings", enabled);
      emitter.emit(settingsEvent.enableAdvancedSettingsChanged, {
        enabled,
      });
    },
    setEnableStreamingMarkdown: (enabled) => {
      set({ enableStreamingMarkdown: enabled });
      PersistenceService.saveSetting("enableStreamingMarkdown", enabled);
      emitter.emit(settingsEvent.enableStreamingMarkdownChanged, {
        enabled,
      });
    },
    setEnableStreamingCodeBlockParsing: (enabled) => {
      set({ enableStreamingCodeBlockParsing: enabled });
      PersistenceService.saveSetting(
        "enableStreamingCodeBlockParsing",
        enabled
      );
      emitter.emit(settingsEvent.enableStreamingCodeBlockParsingChanged, {
        enabled,
      });
    },
    setFoldStreamingCodeBlocks: (fold) => {
      set({ foldStreamingCodeBlocks: fold });
      PersistenceService.saveSetting("foldStreamingCodeBlocks", fold);
      emitter.emit(settingsEvent.foldStreamingCodeBlocksChanged, { fold });
    },
    setFoldUserMessagesOnCompletion: (fold) => {
      set({ foldUserMessagesOnCompletion: fold });
      PersistenceService.saveSetting("foldUserMessagesOnCompletion", fold);
      emitter.emit(settingsEvent.foldUserMessagesOnCompletionChanged, {
        fold,
      });
    },
    setStreamingRenderFPS: (fps) => {
      const clampedFps = Math.max(3, Math.min(60, fps));
      set({ streamingRenderFPS: clampedFps });
      PersistenceService.saveSetting("streamingRenderFPS", clampedFps);
      emitter.emit(settingsEvent.streamingRenderFpsChanged, {
        fps: clampedFps,
      });
    },
    setGitUserName: (name) => {
      const trimmedName = name?.trim() || null;
      set({ gitUserName: trimmedName });
      PersistenceService.saveSetting("gitUserName", trimmedName);
      emitter.emit(settingsEvent.gitUserNameChanged, { name: trimmedName });
    },
    setGitUserEmail: (email) => {
      const trimmedEmail = email?.trim() || null;
      set({ gitUserEmail: trimmedEmail });
      PersistenceService.saveSetting("gitUserEmail", trimmedEmail);
      emitter.emit(settingsEvent.gitUserEmailChanged, {
        email: trimmedEmail,
      });
    },
    setToolMaxSteps: (steps) => {
      const clampedSteps = Math.max(1, Math.min(20, steps));
      set({ toolMaxSteps: clampedSteps });
      PersistenceService.saveSetting("toolMaxSteps", clampedSteps);
      emitter.emit(settingsEvent.toolMaxStepsChanged, {
        steps: clampedSteps,
      });
    },
    setPrismThemeUrl: (url) => {
      const trimmedUrl = url?.trim() || null;
      set({ prismThemeUrl: trimmedUrl });
      PersistenceService.saveSetting("prismThemeUrl", trimmedUrl);
      emitter.emit(settingsEvent.prismThemeUrlChanged, { url: trimmedUrl });
    },
    setAutoTitleEnabled: (enabled) => {
      set({ autoTitleEnabled: enabled });
      PersistenceService.saveSetting("autoTitleEnabled", enabled);
      emitter.emit(settingsEvent.autoTitleEnabledChanged, { enabled });
    },
    setAutoTitleModelId: (modelId) => {
      set({ autoTitleModelId: modelId });
      PersistenceService.saveSetting("autoTitleModelId", modelId);
      emitter.emit(settingsEvent.autoTitleModelIdChanged, { modelId });
    },
    setAutoTitlePromptMaxLength: (length) => {
      const clampedLength = Math.max(100, Math.min(4000, length));
      set({ autoTitlePromptMaxLength: clampedLength });
      PersistenceService.saveSetting("autoTitlePromptMaxLength", clampedLength);
      emitter.emit(settingsEvent.autoTitlePromptMaxLengthChanged, {
        length: clampedLength,
      });
    },
    setAutoTitleIncludeFiles: (include) => {
      set({ autoTitleIncludeFiles: include });
      PersistenceService.saveSetting("autoTitleIncludeFiles", include);
      emitter.emit(settingsEvent.autoTitleIncludeFilesChanged, {
        include,
      });
    },
    setAutoTitleIncludeRules: (include) => {
      set({ autoTitleIncludeRules: include });
      PersistenceService.saveSetting("autoTitleIncludeRules", include);
      emitter.emit(settingsEvent.autoTitleIncludeRulesChanged, {
        include,
      });
    },
    setCustomFontFamily: (fontFamily) => {
      const trimmedFont = fontFamily?.trim() || null;
      set({ customFontFamily: trimmedFont });
      PersistenceService.saveSetting("customFontFamily", trimmedFont);
      emitter.emit(settingsEvent.customFontFamilyChanged, {
        fontFamily: trimmedFont,
      });
    },
    setCustomFontSize: (fontSize) => {
      const clampedSize =
        fontSize === null ? null : Math.max(10, Math.min(24, fontSize));
      set({ customFontSize: clampedSize });
      PersistenceService.saveSetting("customFontSize", clampedSize);
      emitter.emit(settingsEvent.customFontSizeChanged, {
        fontSize: clampedSize,
      });
    },
    setChatMaxWidth: (maxWidthClass) => {
      set({ chatMaxWidth: maxWidthClass });
      PersistenceService.saveSetting("chatMaxWidth", maxWidthClass);
      emitter.emit(settingsEvent.chatMaxWidthChanged, {
        maxWidth: maxWidthClass,
      });
    },
    setCustomThemeColors: (colors) => {
      set({ customThemeColors: colors });
      PersistenceService.saveSetting("customThemeColors", colors);
      emitter.emit(settingsEvent.customThemeColorsChanged, { colors });
    },
    setCustomThemeColor: (colorName, value) => {
      set((state) => {
        const currentColors = state.customThemeColors ?? {};
        const newColors = { ...currentColors };
        if (value === null || value.trim() === "") {
          delete newColors[colorName];
        } else {
          newColors[colorName] = value.trim();
        }
        state.customThemeColors =
          Object.keys(newColors).length > 0 ? newColors : null;
      });
      const newColors = get().customThemeColors;
      PersistenceService.saveSetting("customThemeColors", newColors);
      emitter.emit(settingsEvent.customThemeColorsChanged, {
        colors: newColors,
      });
    },
    setAutoScrollInterval: (interval) => {
      const clampedInterval = Math.max(50, interval);
      set({ autoScrollInterval: clampedInterval });
      PersistenceService.saveSetting("autoScrollInterval", clampedInterval);
      emitter.emit(settingsEvent.autoScrollIntervalChanged, {
        interval: clampedInterval,
      });
    },
    setEnableAutoScrollOnStream: (enabled) => {
      set({ enableAutoScrollOnStream: enabled });
      PersistenceService.saveSetting("enableAutoScrollOnStream", enabled);
      emitter.emit(settingsEvent.enableAutoScrollOnStreamChanged, {
        enabled,
      });
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
          enableStreamingCodeBlock,
          foldStreamingCodeBlocks,
          foldUserMessages,
          streamingFps,
          gitUserName,
          gitUserEmail,
          toolMaxSteps,
          prismThemeUrl,
          autoTitleEnabled,
          autoTitleModelId,
          autoTitlePromptMaxLength,
          autoTitleIncludeFiles,
          autoTitleIncludeRules,
          customFontFamily,
          customFontSize,
          chatMaxWidth,
          customThemeColors,
          autoScrollInterval,
          enableAutoScrollOnStream,
        ] = await Promise.all([
          PersistenceService.loadSetting<SettingsState["theme"]>(
            "theme",
            DEFAULT_THEME
          ),
          PersistenceService.loadSetting<number>(
            "temperature",
            DEFAULT_TEMPERATURE
          ),
          PersistenceService.loadSetting<number | null>(
            "maxTokens",
            DEFAULT_MAX_TOKENS
          ),
          PersistenceService.loadSetting<number | null>("topP", DEFAULT_TOP_P),
          PersistenceService.loadSetting<number | null>("topK", DEFAULT_TOP_K),
          PersistenceService.loadSetting<number | null>(
            "presencePenalty",
            DEFAULT_PRESENCE_PENALTY
          ),
          PersistenceService.loadSetting<number | null>(
            "frequencyPenalty",
            DEFAULT_FREQUENCY_PENALTY
          ),
          PersistenceService.loadSetting<string | null>(
            "globalSystemPrompt",
            DEFAULT_SYSTEM_PROMPT
          ),
          PersistenceService.loadSetting<boolean>(
            "enableAdvancedSettings",
            DEFAULT_ENABLE_ADVANCED_SETTINGS
          ),
          PersistenceService.loadSetting<boolean>(
            "enableStreamingMarkdown",
            DEFAULT_ENABLE_STREAMING_MARKDOWN
          ),
          PersistenceService.loadSetting<boolean>(
            "enableStreamingCodeBlockParsing",
            DEFAULT_ENABLE_STREAMING_CODE_BLOCK_PARSING
          ),
          PersistenceService.loadSetting<boolean>(
            "foldStreamingCodeBlocks",
            DEFAULT_FOLD_STREAMING_CODE_BLOCKS
          ),
          PersistenceService.loadSetting<boolean>(
            "foldUserMessagesOnCompletion",
            DEFAULT_FOLD_USER_MESSAGES_ON_COMPLETION
          ),
          PersistenceService.loadSetting<number>(
            "streamingRenderFPS",
            DEFAULT_STREAMING_FPS
          ),
          PersistenceService.loadSetting<string | null>(
            "gitUserName",
            DEFAULT_GIT_USER_NAME
          ),
          PersistenceService.loadSetting<string | null>(
            "gitUserEmail",
            DEFAULT_GIT_USER_EMAIL
          ),
          PersistenceService.loadSetting<number>(
            "toolMaxSteps",
            DEFAULT_TOOL_MAX_STEPS
          ),
          PersistenceService.loadSetting<string | null>(
            "prismThemeUrl",
            DEFAULT_PRISM_THEME_URL
          ),
          PersistenceService.loadSetting<boolean>(
            "autoTitleEnabled",
            DEFAULT_AUTO_TITLE_ENABLED
          ),
          PersistenceService.loadSetting<string | null>(
            "autoTitleModelId",
            DEFAULT_AUTO_TITLE_MODEL_ID
          ),
          PersistenceService.loadSetting<number>(
            "autoTitlePromptMaxLength",
            DEFAULT_AUTO_TITLE_PROMPT_MAX_LENGTH
          ),
          PersistenceService.loadSetting<boolean>(
            "autoTitleIncludeFiles",
            DEFAULT_AUTO_TITLE_INCLUDE_FILES
          ),
          PersistenceService.loadSetting<boolean>(
            "autoTitleIncludeRules",
            DEFAULT_AUTO_TITLE_INCLUDE_RULES
          ),
          PersistenceService.loadSetting<string | null>(
            "customFontFamily",
            DEFAULT_CUSTOM_FONT_FAMILY
          ),
          PersistenceService.loadSetting<number | null>(
            "customFontSize",
            DEFAULT_CUSTOM_FONT_SIZE
          ),
          PersistenceService.loadSetting<string | null>(
            "chatMaxWidth",
            DEFAULT_CHAT_MAX_WIDTH
          ),
          PersistenceService.loadSetting<CustomThemeColors | null>(
            "customThemeColors",
            DEFAULT_CUSTOM_THEME_COLORS
          ),
          PersistenceService.loadSetting<number>(
            "autoScrollInterval",
            DEFAULT_AUTO_SCROLL_INTERVAL
          ),
          PersistenceService.loadSetting<boolean>(
            "enableAutoScrollOnStream",
            DEFAULT_ENABLE_AUTO_SCROLL_ON_STREAM
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
          autoTitleEnabled,
          autoTitleModelId,
          autoTitlePromptMaxLength,
          autoTitleIncludeFiles,
          autoTitleIncludeRules,
          customFontFamily,
          customFontSize,
          chatMaxWidth,
          customThemeColors,
          autoScrollInterval,
          enableAutoScrollOnStream,
        });
      } catch (error) {
        console.error("SettingsStore: Error loading settings", error);
      }
    },

    resetGeneralSettings: async () => {
      try {
        get().setEnableStreamingMarkdown(DEFAULT_ENABLE_STREAMING_MARKDOWN);
        get().setEnableStreamingCodeBlockParsing(
          DEFAULT_ENABLE_STREAMING_CODE_BLOCK_PARSING
        );
        get().setFoldStreamingCodeBlocks(DEFAULT_FOLD_STREAMING_CODE_BLOCKS);
        get().setFoldUserMessagesOnCompletion(
          DEFAULT_FOLD_USER_MESSAGES_ON_COMPLETION
        );
        get().setStreamingRenderFPS(DEFAULT_STREAMING_FPS);
        get().setAutoScrollInterval(DEFAULT_AUTO_SCROLL_INTERVAL);
        get().setEnableAutoScrollOnStream(DEFAULT_ENABLE_AUTO_SCROLL_ON_STREAM);
        toast.success("Streaming & Display settings reset to defaults.");
      } catch (error) {
        console.error("SettingsStore: Error resetting general settings", error);
        toast.error("Failed to reset general settings.");
      }
    },
    resetAssistantSettings: async () => {
      try {
        get().setGlobalSystemPrompt(DEFAULT_SYSTEM_PROMPT);
        get().setTemperature(DEFAULT_TEMPERATURE);
        get().setMaxTokens(DEFAULT_MAX_TOKENS);
        get().setTopP(DEFAULT_TOP_P);
        get().setTopK(DEFAULT_TOP_K);
        get().setPresencePenalty(DEFAULT_PRESENCE_PENALTY);
        get().setFrequencyPenalty(DEFAULT_FREQUENCY_PENALTY);
        get().setToolMaxSteps(DEFAULT_TOOL_MAX_STEPS);
        get().setAutoTitleEnabled(DEFAULT_AUTO_TITLE_ENABLED);
        get().setAutoTitleModelId(DEFAULT_AUTO_TITLE_MODEL_ID);
        get().setAutoTitlePromptMaxLength(DEFAULT_AUTO_TITLE_PROMPT_MAX_LENGTH);
        get().setAutoTitleIncludeFiles(DEFAULT_AUTO_TITLE_INCLUDE_FILES);
        get().setAutoTitleIncludeRules(DEFAULT_AUTO_TITLE_INCLUDE_RULES);
        toast.success("Assistant settings reset to defaults.");
      } catch (error) {
        console.error(
          "SettingsStore: Error resetting assistant settings",
          error
        );
        toast.error("Failed to reset assistant settings.");
      }
    },
    resetThemeSettings: async () => {
      try {
        get().setTheme(DEFAULT_THEME);
        get().setPrismThemeUrl(DEFAULT_PRISM_THEME_URL);
        get().setCustomFontFamily(DEFAULT_CUSTOM_FONT_FAMILY);
        get().setCustomFontSize(DEFAULT_CUSTOM_FONT_SIZE);
        get().setChatMaxWidth(DEFAULT_CHAT_MAX_WIDTH);
        get().setCustomThemeColors(DEFAULT_CUSTOM_THEME_COLORS);
        toast.success("Theme settings reset to defaults.");
      } catch (error) {
        console.error("SettingsStore: Error resetting theme settings", error);
        toast.error("Failed to reset theme settings.");
      }
    },
  }))
);
