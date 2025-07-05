// src/store/settings.store.ts
// FULL FILE
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { PersistenceService } from "@/services/persistence.service";
import { toast } from "sonner";
import { emitter } from "@/lib/litechat/event-emitter";
import {
  settingsEvent,
  SettingsEventPayloads,
} from "@/types/litechat/events/settings.events";
import { controlRegistryEvent } from "@/types/litechat/events/control.registry.events";
import type { RegisteredActionHandler } from "@/types/litechat/control";
import { BUNDLED_SYSTEM_PROMPT } from "virtual:system-prompt";
import { useControlRegistryStore } from "./control.store";
import type { Theme } from "@/types/litechat/common";

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
  theme: Theme;
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
  gitGlobalPat: string | null;
  toolMaxSteps: number;
  prismThemeUrl: string | null;
  autoTitleEnabled: boolean;
  autoTitleAlwaysOn: boolean;
  autoTitleModelId: string | null;
  autoTitlePromptMaxLength: number;
  autoTitleIncludeFiles: boolean;
  autoTitleIncludeRules: boolean;
  forkCompactPrompt: string | null;
  forkCompactModelId: string | null;
  customFontFamily: string | null;
  customFontSize: number | null;
  chatMaxWidth: string | null;
  customThemeColors: CustomThemeColors | null;
  autoScrollInterval: number;
  enableAutoScrollOnStream: boolean;
  autoSyncOnStreamComplete: boolean;
  autoInitializeReposOnStartup: boolean;
  controlRuleAlwaysOn: Record<string, boolean>;
  autoRuleSelectionEnabled: boolean;
  autoRuleSelectionModelId: string | null;
  autoRuleSelectionPrompt: string | null;
  runnableBlocksEnabled: boolean;
  runnableBlocksSecurityCheckEnabled: boolean;
  runnableBlocksSecurityModelId: string | null;
  runnableBlocksSecurityPrompt: string | null;
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
  setGitGlobalPat: (pat: string | null) => void;
  setToolMaxSteps: (steps: number) => void;
  setPrismThemeUrl: (url: string | null) => void;
  setAutoTitleEnabled: (enabled: boolean) => void;
  setAutoTitleAlwaysOn: (enabled: boolean) => void;
  setAutoTitleModelId: (modelId: string | null) => void;
  setAutoTitlePromptMaxLength: (length: number) => void;
  setAutoTitleIncludeFiles: (include: boolean) => void;
  setAutoTitleIncludeRules: (include: boolean) => void;
  setForkCompactPrompt: (prompt: string | null) => void;
  setForkCompactModelId: (modelId: string | null) => void;
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
  setAutoSyncOnStreamComplete: (enabled: boolean) => void;
  setAutoInitializeReposOnStartup: (enabled: boolean) => void;
  setControlRuleAlwaysOn: (ruleId: string, alwaysOn: boolean) => void;
  setAutoRuleSelectionEnabled: (enabled: boolean) => void;
  setAutoRuleSelectionModelId: (modelId: string | null) => void;
  setAutoRuleSelectionPrompt: (prompt: string | null) => void;
  setRunnableBlocksEnabled: (enabled: boolean) => void;
  setRunnableBlocksSecurityCheckEnabled: (enabled: boolean) => void;
  setRunnableBlocksSecurityModelId: (modelId: string | null) => void;
  setRunnableBlocksSecurityPrompt: (prompt: string | null) => void;
  loadSettings: () => Promise<void>;
  resetGeneralSettings: () => Promise<void>;
  resetAssistantSettings: () => Promise<void>;
  resetThemeSettings: () => Promise<void>;
  getRegisteredActionHandlers: () => RegisteredActionHandler[];
}

// Define default constants
const DEFAULT_THEME: Theme = "system";
const DEFAULT_SYSTEM_PROMPT = BUNDLED_SYSTEM_PROMPT;
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_TOKENS = null;
const DEFAULT_TOP_P = null;
const DEFAULT_TOP_K = null;
const DEFAULT_PRESENCE_PENALTY = 0.0;
const DEFAULT_FREQUENCY_PENALTY = 0.0;
const DEFAULT_ENABLE_ADVANCED_SETTINGS = false;
const DEFAULT_ENABLE_STREAMING_MARKDOWN = true;
const DEFAULT_ENABLE_STREAMING_CODE_BLOCK_PARSING = true;
const DEFAULT_FOLD_STREAMING_CODE_BLOCKS = false;
const DEFAULT_FOLD_USER_MESSAGES_ON_COMPLETION = false;
const DEFAULT_STREAMING_FPS = 15;
const DEFAULT_GIT_USER_NAME = null;
const DEFAULT_GIT_USER_EMAIL = null;
const DEFAULT_GIT_GLOBAL_PAT = null;
const DEFAULT_TOOL_MAX_STEPS = 5;
const DEFAULT_PRISM_THEME_URL = null;
const DEFAULT_AUTO_TITLE_ENABLED = true;
const DEFAULT_AUTO_TITLE_ALWAYS_ON = false;
const DEFAULT_AUTO_TITLE_MODEL_ID = null;
const DEFAULT_AUTO_TITLE_PROMPT_MAX_LENGTH = 768;
const DEFAULT_AUTO_TITLE_INCLUDE_FILES = false;
const DEFAULT_AUTO_TITLE_INCLUDE_RULES = false;
const DEFAULT_FORK_COMPACT_PROMPT = null;
const DEFAULT_FORK_COMPACT_MODEL_ID = null;
const DEFAULT_CUSTOM_FONT_FAMILY = null;
const DEFAULT_CUSTOM_FONT_SIZE = 16;
const DEFAULT_CHAT_MAX_WIDTH = "max-w-7xl";
const DEFAULT_CUSTOM_THEME_COLORS = null;
const DEFAULT_AUTO_SCROLL_INTERVAL = 1000;
const DEFAULT_ENABLE_AUTO_SCROLL_ON_STREAM = true;
const DEFAULT_AUTO_SYNC_ON_STREAM_COMPLETE = false;
const DEFAULT_AUTO_INITIALIZE_REPOS_ON_STARTUP = false;
const DEFAULT_CONTROL_RULE_ALWAYS_ON = {};
const DEFAULT_AUTO_RULE_SELECTION_ENABLED = false;
const DEFAULT_AUTO_RULE_SELECTION_MODEL_ID = null;
const DEFAULT_AUTO_RULE_SELECTION_PROMPT =
  "Given the following user prompt and the list of available rules, select the most relevant rules for this conversation. Return a JSON array of rule IDs.\n\nUser Prompt: {{prompt}}\n\nAvailable Rules:\n{{rules}}\n\nReturn only a JSON array of rule IDs.";
const DEFAULT_RUNNABLE_BLOCKS_ENABLED = true;
const DEFAULT_RUNNABLE_BLOCKS_SECURITY_CHECK_ENABLED = true;
const DEFAULT_RUNNABLE_BLOCKS_SECURITY_MODEL_ID = null;
const DEFAULT_RUNNABLE_BLOCKS_SECURITY_PROMPT =
  "Analyze the following code for potential security risks or malicious behavior. Respond with ONLY a number from 0 to 100 where:\n- 0-30: Safe code (reading data, basic calculations, simple DOM manipulation)\n- 31-60: Moderate risk (file operations, network requests, eval usage)\n- 61-90: High risk (system commands, dangerous APIs, potential privacy violations)\n- 91-100: Extremely dangerous (malware, destructive operations, clear security threats)\n\nCode to analyze:\n{{code}}\n\nReturn only the numeric risk score (0-100).";

// Add a static array of all SettingsState keys for robust, type-safe enumeration
export const SETTINGS_KEYS: (keyof SettingsState)[] = [
  "theme",
  "globalSystemPrompt",
  "temperature",
  "maxTokens",
  "topP",
  "topK",
  "presencePenalty",
  "frequencyPenalty",
  "enableAdvancedSettings",
  "enableStreamingMarkdown",
  "enableStreamingCodeBlockParsing",
  "foldStreamingCodeBlocks",
  "foldUserMessagesOnCompletion",
  "streamingRenderFPS",
  "gitUserName",
  "gitUserEmail",
  "gitGlobalPat",
  "toolMaxSteps",
  "prismThemeUrl",
  "autoTitleEnabled",
  "autoTitleAlwaysOn",
  "autoTitleModelId",
  "autoTitlePromptMaxLength",
  "autoTitleIncludeFiles",
  "autoTitleIncludeRules",
  "forkCompactPrompt",
  "forkCompactModelId",
  "customFontFamily",
  "customFontSize",
  "chatMaxWidth",
  "customThemeColors",
  "autoScrollInterval",
  "enableAutoScrollOnStream",
  "autoSyncOnStreamComplete",
  "autoInitializeReposOnStartup",
  "controlRuleAlwaysOn",
  "autoRuleSelectionEnabled",
  "autoRuleSelectionModelId",
  "autoRuleSelectionPrompt",
  "runnableBlocksEnabled",
  "runnableBlocksSecurityCheckEnabled",
  "runnableBlocksSecurityModelId",
  "runnableBlocksSecurityPrompt",
];

const persistSetting = async <K extends keyof SettingsState>(
  key: K,
  value: SettingsState[K]
) => {
  await PersistenceService.saveSetting(key, value);
  emitter.emit(settingsEvent.settingsChanged, { [key]: value });
};

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
    gitGlobalPat: DEFAULT_GIT_GLOBAL_PAT,
    toolMaxSteps: DEFAULT_TOOL_MAX_STEPS,
    prismThemeUrl: DEFAULT_PRISM_THEME_URL,
    autoTitleEnabled: DEFAULT_AUTO_TITLE_ENABLED,
    autoTitleAlwaysOn: DEFAULT_AUTO_TITLE_ALWAYS_ON,
    autoTitleModelId: DEFAULT_AUTO_TITLE_MODEL_ID,
    autoTitlePromptMaxLength: DEFAULT_AUTO_TITLE_PROMPT_MAX_LENGTH,
    autoTitleIncludeFiles: DEFAULT_AUTO_TITLE_INCLUDE_FILES,
    autoTitleIncludeRules: DEFAULT_AUTO_TITLE_INCLUDE_RULES,
    forkCompactPrompt: DEFAULT_FORK_COMPACT_PROMPT,
    forkCompactModelId: DEFAULT_FORK_COMPACT_MODEL_ID,
    customFontFamily: DEFAULT_CUSTOM_FONT_FAMILY,
    customFontSize: DEFAULT_CUSTOM_FONT_SIZE,
    chatMaxWidth: DEFAULT_CHAT_MAX_WIDTH,
    customThemeColors: DEFAULT_CUSTOM_THEME_COLORS,
    autoScrollInterval: DEFAULT_AUTO_SCROLL_INTERVAL,
    enableAutoScrollOnStream: DEFAULT_ENABLE_AUTO_SCROLL_ON_STREAM,
    autoSyncOnStreamComplete: DEFAULT_AUTO_SYNC_ON_STREAM_COMPLETE,
    autoInitializeReposOnStartup: DEFAULT_AUTO_INITIALIZE_REPOS_ON_STARTUP,
    controlRuleAlwaysOn: DEFAULT_CONTROL_RULE_ALWAYS_ON,
    autoRuleSelectionEnabled: DEFAULT_AUTO_RULE_SELECTION_ENABLED,
    autoRuleSelectionModelId: DEFAULT_AUTO_RULE_SELECTION_MODEL_ID,
    autoRuleSelectionPrompt: DEFAULT_AUTO_RULE_SELECTION_PROMPT,
    runnableBlocksEnabled: DEFAULT_RUNNABLE_BLOCKS_ENABLED,
    runnableBlocksSecurityCheckEnabled: DEFAULT_RUNNABLE_BLOCKS_SECURITY_CHECK_ENABLED,
    runnableBlocksSecurityModelId: DEFAULT_RUNNABLE_BLOCKS_SECURITY_MODEL_ID,
    runnableBlocksSecurityPrompt: DEFAULT_RUNNABLE_BLOCKS_SECURITY_PROMPT,

    setTheme: (theme) => {
      set({ theme: theme });
      persistSetting("theme", theme);
      emitter.emit(settingsEvent.themeChanged, { theme });
    },
    setGlobalSystemPrompt: (prompt) => {
      set({ globalSystemPrompt: prompt });
      persistSetting("globalSystemPrompt", prompt);
      emitter.emit(settingsEvent.globalSystemPromptChanged, { prompt });
    },
    setTemperature: (temp) => {
      set({ temperature: temp });
      persistSetting("temperature", temp);
      emitter.emit(settingsEvent.temperatureChanged, { value: temp });
    },
    setMaxTokens: (tokens) => {
      set({ maxTokens: tokens });
      persistSetting("maxTokens", tokens);
      emitter.emit(settingsEvent.maxTokensChanged, { value: tokens });
    },
    setTopP: (topP) => {
      set({ topP: topP });
      persistSetting("topP", topP);
      emitter.emit(settingsEvent.topPChanged, { value: topP });
    },
    setTopK: (topK) => {
      set({ topK: topK });
      persistSetting("topK", topK);
      emitter.emit(settingsEvent.topKChanged, { value: topK });
    },
    setPresencePenalty: (penalty) => {
      set({ presencePenalty: penalty });
      persistSetting("presencePenalty", penalty);
      emitter.emit(settingsEvent.presencePenaltyChanged, { value: penalty });
    },
    setFrequencyPenalty: (penalty) => {
      set({ frequencyPenalty: penalty });
      persistSetting("frequencyPenalty", penalty);
      emitter.emit(settingsEvent.frequencyPenaltyChanged, { value: penalty });
    },
    setEnableAdvancedSettings: (enabled) => {
      set({ enableAdvancedSettings: enabled });
      persistSetting("enableAdvancedSettings", enabled);
      emitter.emit(settingsEvent.enableAdvancedSettingsChanged, { enabled });
    },
    setEnableStreamingMarkdown: (enabled) => {
      set({ enableStreamingMarkdown: enabled });
      persistSetting("enableStreamingMarkdown", enabled);
      emitter.emit(settingsEvent.enableStreamingMarkdownChanged, { enabled });
    },
    setEnableStreamingCodeBlockParsing: (enabled) => {
      set({ enableStreamingCodeBlockParsing: enabled });
      persistSetting("enableStreamingCodeBlockParsing", enabled);
      emitter.emit(settingsEvent.enableStreamingCodeBlockParsingChanged, { enabled });
    },
    setFoldStreamingCodeBlocks: (fold) => {
      set({ foldStreamingCodeBlocks: fold });
      persistSetting("foldStreamingCodeBlocks", fold);
      emitter.emit(settingsEvent.foldStreamingCodeBlocksChanged, { fold });
    },
    setFoldUserMessagesOnCompletion: (fold) => {
      set({ foldUserMessagesOnCompletion: fold });
      persistSetting("foldUserMessagesOnCompletion", fold);
      emitter.emit(settingsEvent.foldUserMessagesOnCompletionChanged, { fold });
    },
    setStreamingRenderFPS: (fps) => {
      // Clamp FPS to 3-60
      const clamped = Math.max(3, Math.min(60, fps));
      set({ streamingRenderFPS: clamped });
      persistSetting("streamingRenderFPS", clamped);
      emitter.emit(settingsEvent.streamingRenderFpsChanged, { fps: clamped });
    },
    setGitUserName: (name) => {
      // Trim whitespace
      const trimmed = name ? name.trim() : name;
      set({ gitUserName: trimmed });
      persistSetting("gitUserName", trimmed);
      emitter.emit(settingsEvent.gitUserNameChanged, { name: trimmed });
    },
    setGitUserEmail: (email) => {
      // Trim whitespace
      const trimmed = email ? email.trim() : email;
      set({ gitUserEmail: trimmed });
      persistSetting("gitUserEmail", trimmed);
      emitter.emit(settingsEvent.gitUserEmailChanged, { email: trimmed });
    },
    setGitGlobalPat: (pat) => {
      set({ gitGlobalPat: pat });
      persistSetting("gitGlobalPat", pat);
      emitter.emit(settingsEvent.gitGlobalPatChanged, { pat });
    },
    setToolMaxSteps: (steps) => {
      // Clamp steps to 1-20
      const clamped = Math.max(1, Math.min(20, steps));
      set({ toolMaxSteps: clamped });
      persistSetting("toolMaxSteps", clamped);
      emitter.emit(settingsEvent.toolMaxStepsChanged, { steps: clamped });
    },
    setPrismThemeUrl: (url) => {
      set({ prismThemeUrl: url });
      persistSetting("prismThemeUrl", url);
      emitter.emit(settingsEvent.prismThemeUrlChanged, { url });
    },
    setAutoTitleEnabled: (enabled) => {
      set({ autoTitleEnabled: enabled });
      persistSetting("autoTitleEnabled", enabled);
      emitter.emit(settingsEvent.autoTitleEnabledChanged, { enabled });
    },
    setAutoTitleAlwaysOn: (enabled) => {
      set({ autoTitleAlwaysOn: enabled });
      persistSetting("autoTitleAlwaysOn", enabled);
      emitter.emit(settingsEvent.autoTitleAlwaysOnChanged, { enabled });
    },
    setAutoTitleModelId: (modelId) => {
      set({ autoTitleModelId: modelId });
      persistSetting("autoTitleModelId", modelId);
      emitter.emit(settingsEvent.autoTitleModelIdChanged, { modelId });
    },
    setAutoTitlePromptMaxLength: (length) => {
      // Clamp to 32-4096
      const clamped = Math.max(32, Math.min(4096, length));
      set({ autoTitlePromptMaxLength: clamped });
      persistSetting("autoTitlePromptMaxLength", clamped);
      emitter.emit(settingsEvent.autoTitlePromptMaxLengthChanged, { length: clamped });
    },
    setAutoTitleIncludeFiles: (include) => {
      set({ autoTitleIncludeFiles: include });
      persistSetting("autoTitleIncludeFiles", include);
      emitter.emit(settingsEvent.autoTitleIncludeFilesChanged, { include });
    },
    setAutoTitleIncludeRules: (include) => {
      set({ autoTitleIncludeRules: include });
      persistSetting("autoTitleIncludeRules", include);
      emitter.emit(settingsEvent.autoTitleIncludeRulesChanged, { include });
    },
    setForkCompactPrompt: (prompt) => {
      set({ forkCompactPrompt: prompt });
      persistSetting("forkCompactPrompt", prompt);
      emitter.emit(settingsEvent.forkCompactPromptChanged, { prompt });
    },
    setForkCompactModelId: (modelId) => {
      set({ forkCompactModelId: modelId });
      persistSetting("forkCompactModelId", modelId);
      emitter.emit(settingsEvent.forkCompactModelIdChanged, { modelId });
    },
    setCustomFontFamily: (fontFamily) => {
      set({ customFontFamily: fontFamily });
      persistSetting("customFontFamily", fontFamily);
      emitter.emit(settingsEvent.customFontFamilyChanged, { fontFamily });
    },
    setCustomFontSize: (fontSize) => {
      // Clamp font size to 10-24 if not null
      if (typeof fontSize === "number") {
        const clamped = Math.max(10, Math.min(24, fontSize));
        set({ customFontSize: clamped });
        persistSetting("customFontSize", clamped);
        emitter.emit(settingsEvent.customFontSizeChanged, { fontSize: clamped });
      } else {
        set({ customFontSize: fontSize });
        persistSetting("customFontSize", fontSize);
        emitter.emit(settingsEvent.customFontSizeChanged, { fontSize });
      }
    },
    setChatMaxWidth: (maxWidthClass) => {
      set({ chatMaxWidth: maxWidthClass });
      persistSetting("chatMaxWidth", maxWidthClass);
      emitter.emit(settingsEvent.chatMaxWidthChanged, { maxWidth: maxWidthClass });
    },
    setCustomThemeColors: (colors) => {
      set({ customThemeColors: colors });
      persistSetting("customThemeColors", colors);
      emitter.emit(settingsEvent.customThemeColorsChanged, { colors });
    },
    setCustomThemeColor: (colorName, value) => {
      set((state) => {
        if (!state.customThemeColors) {
          state.customThemeColors = {};
        }
        if (value) {
          state.customThemeColors[colorName] = value;
        } else {
          delete state.customThemeColors[colorName];
        }
      });
      persistSetting("customThemeColors", get().customThemeColors);
      emitter.emit(settingsEvent.customThemeColorsChanged, { colors: get().customThemeColors });
    },
    setAutoScrollInterval: (interval) => {
      set({ autoScrollInterval: interval });
      persistSetting("autoScrollInterval", interval);
      emitter.emit(settingsEvent.autoScrollIntervalChanged, { interval });
    },
    setEnableAutoScrollOnStream: (enabled) => {
      set({ enableAutoScrollOnStream: enabled });
      persistSetting("enableAutoScrollOnStream", enabled);
      emitter.emit(settingsEvent.enableAutoScrollOnStreamChanged, { enabled });
    },
    setAutoSyncOnStreamComplete: (enabled) => {
      set({ autoSyncOnStreamComplete: enabled });
      persistSetting("autoSyncOnStreamComplete", enabled);
      emitter.emit(settingsEvent.autoSyncOnStreamCompleteChanged, { enabled });
    },
    setAutoInitializeReposOnStartup: (enabled) => {
      set({ autoInitializeReposOnStartup: enabled });
      persistSetting("autoInitializeReposOnStartup", enabled);
      emitter.emit(settingsEvent.autoInitializeReposOnStartupChanged, { enabled });
    },
    setControlRuleAlwaysOn: (ruleId, alwaysOn) => {
      set((state) => {
        state.controlRuleAlwaysOn[ruleId] = alwaysOn;
      });
      persistSetting("controlRuleAlwaysOn", get().controlRuleAlwaysOn);
      emitter.emit(settingsEvent.controlRuleAlwaysOnChanged, { ruleId, alwaysOn });
      emitter.emit(controlRegistryEvent.controlRulesChanged, {
        controlRules: useControlRegistryStore.getState().getControlRules(),
      });
    },
    setAutoRuleSelectionEnabled: (enabled) => {
      set({ autoRuleSelectionEnabled: enabled });
      persistSetting("autoRuleSelectionEnabled", enabled);
      emitter.emit(settingsEvent.autoRuleSelectionEnabledChanged, { enabled });
    },
    setAutoRuleSelectionModelId: (modelId) => {
      set({ autoRuleSelectionModelId: modelId });
      persistSetting("autoRuleSelectionModelId", modelId);
      emitter.emit(settingsEvent.autoRuleSelectionModelIdChanged, { modelId });
    },
    setAutoRuleSelectionPrompt: (prompt) => {
      set({ autoRuleSelectionPrompt: prompt });
      persistSetting("autoRuleSelectionPrompt", prompt);
      emitter.emit(settingsEvent.autoRuleSelectionPromptChanged, { prompt });
    },
    setRunnableBlocksEnabled: (enabled) => {
      set({ runnableBlocksEnabled: enabled });
      persistSetting("runnableBlocksEnabled", enabled);
      emitter.emit(settingsEvent.runnableBlocksEnabledChanged, { enabled });
    },
    setRunnableBlocksSecurityCheckEnabled: (enabled) => {
      set({ runnableBlocksSecurityCheckEnabled: enabled });
      persistSetting("runnableBlocksSecurityCheckEnabled", enabled);
      emitter.emit(settingsEvent.runnableBlocksSecurityCheckEnabledChanged, { enabled });
    },
    setRunnableBlocksSecurityModelId: (modelId) => {
      set({ runnableBlocksSecurityModelId: modelId });
      persistSetting("runnableBlocksSecurityModelId", modelId);
      emitter.emit(settingsEvent.runnableBlocksSecurityModelIdChanged, { modelId });
    },
    setRunnableBlocksSecurityPrompt: (prompt) => {
      set({ runnableBlocksSecurityPrompt: prompt });
      persistSetting("runnableBlocksSecurityPrompt", prompt);
      emitter.emit(settingsEvent.runnableBlocksSecurityPromptChanged, { prompt });
    },

    loadSettings: async () => {
      try {
        const initialState = get();
        // Use the static SETTINGS_KEYS array for robust, type-safe key enumeration
        const settingKeys = SETTINGS_KEYS;

        const loadedSettings: Partial<SettingsState> = {};
        for (const key of settingKeys) {
          const loadedValue = await PersistenceService.loadSetting(key, initialState[key]);
          // Apply all loaded values, including nulls (do not filter out null)
          (loadedSettings as any)[key] = loadedValue;
        }
        set(loadedSettings);
        emitter.emit(settingsEvent.loaded, { settings: get() });
      } catch (error) {
        toast.error("Failed to load settings from the database.", {
          description:
            "Your settings could not be retrieved. Default settings will be used. Please check the console for more details.",
        });
        console.error("Error loading settings:", error);
      }
    },

    resetGeneralSettings: async () => {
      const newSettings = {
        enableAdvancedSettings: DEFAULT_ENABLE_ADVANCED_SETTINGS,
        enableStreamingMarkdown: DEFAULT_ENABLE_STREAMING_MARKDOWN,
        enableStreamingCodeBlockParsing: DEFAULT_ENABLE_STREAMING_CODE_BLOCK_PARSING,
        foldStreamingCodeBlocks: DEFAULT_FOLD_STREAMING_CODE_BLOCKS,
        foldUserMessagesOnCompletion: DEFAULT_FOLD_USER_MESSAGES_ON_COMPLETION,
        streamingRenderFPS: DEFAULT_STREAMING_FPS,
        autoScrollInterval: DEFAULT_AUTO_SCROLL_INTERVAL,
        enableAutoScrollOnStream: DEFAULT_ENABLE_AUTO_SCROLL_ON_STREAM,
      };
      set(newSettings);
      for (const key of Object.keys(newSettings) as (keyof typeof newSettings)[]) {
        await persistSetting(key, newSettings[key] as any);
      }
      toast.success("General settings have been reset to their defaults.");
    },

    resetAssistantSettings: async () => {
      const newSettings = {
        temperature: DEFAULT_TEMPERATURE,
        maxTokens: DEFAULT_MAX_TOKENS,
        topP: DEFAULT_TOP_P,
        topK: DEFAULT_TOP_K,
        presencePenalty: DEFAULT_PRESENCE_PENALTY,
        frequencyPenalty: DEFAULT_FREQUENCY_PENALTY,
        toolMaxSteps: DEFAULT_TOOL_MAX_STEPS,
        autoTitleEnabled: DEFAULT_AUTO_TITLE_ENABLED,
        autoTitleAlwaysOn: DEFAULT_AUTO_TITLE_ALWAYS_ON,
        autoTitleModelId: DEFAULT_AUTO_TITLE_MODEL_ID,
        autoTitlePromptMaxLength: DEFAULT_AUTO_TITLE_PROMPT_MAX_LENGTH,
        autoTitleIncludeFiles: DEFAULT_AUTO_TITLE_INCLUDE_FILES,
        autoTitleIncludeRules: DEFAULT_AUTO_TITLE_INCLUDE_RULES,
        forkCompactPrompt: DEFAULT_FORK_COMPACT_PROMPT,
        forkCompactModelId: DEFAULT_FORK_COMPACT_MODEL_ID,
        autoRuleSelectionEnabled: DEFAULT_AUTO_RULE_SELECTION_ENABLED,
        autoRuleSelectionModelId: DEFAULT_AUTO_RULE_SELECTION_MODEL_ID,
        autoRuleSelectionPrompt: DEFAULT_AUTO_RULE_SELECTION_PROMPT,
        runnableBlocksEnabled: DEFAULT_RUNNABLE_BLOCKS_ENABLED,
        runnableBlocksSecurityCheckEnabled: DEFAULT_RUNNABLE_BLOCKS_SECURITY_CHECK_ENABLED,
        runnableBlocksSecurityModelId: DEFAULT_RUNNABLE_BLOCKS_SECURITY_MODEL_ID,
        runnableBlocksSecurityPrompt: DEFAULT_RUNNABLE_BLOCKS_SECURITY_PROMPT,
      };
      set(newSettings);
      for (const key of Object.keys(newSettings) as (keyof typeof newSettings)[]) {
        await persistSetting(key, newSettings[key] as any);
      }
      toast.success("Assistant settings have been reset to their defaults.");
    },

    resetThemeSettings: async () => {
      const newSettings = {
        theme: DEFAULT_THEME,
        prismThemeUrl: DEFAULT_PRISM_THEME_URL,
        customFontFamily: DEFAULT_CUSTOM_FONT_FAMILY,
        customFontSize: DEFAULT_CUSTOM_FONT_SIZE,
        chatMaxWidth: DEFAULT_CHAT_MAX_WIDTH,
        customThemeColors: DEFAULT_CUSTOM_THEME_COLORS,
      };
      set(newSettings);
      for (const key of Object.keys(newSettings) as (keyof typeof newSettings)[]) {
        await persistSetting(key, newSettings[key] as any);
      }
      toast.success("Theme settings have been reset to their defaults.");
    },

    getRegisteredActionHandlers: (): RegisteredActionHandler[] => {
      const actions = get();

      const storeId = "settingsStore";
      return [
        {
          eventName: settingsEvent.setThemeRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setThemeRequest]) => actions.setTheme(p.theme),
          storeId,
        },
        {
          eventName: settingsEvent.setGlobalSystemPromptRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setGlobalSystemPromptRequest]) =>
            actions.setGlobalSystemPrompt(p.prompt),
          storeId,
        },
        {
          eventName: settingsEvent.setTemperatureRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setTemperatureRequest]) =>
            actions.setTemperature(p.value),
          storeId,
        },
        {
          eventName: settingsEvent.setMaxTokensRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setMaxTokensRequest]) =>
            actions.setMaxTokens(p.value),
          storeId,
        },
        {
          eventName: settingsEvent.setTopPRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setTopPRequest]) => actions.setTopP(p.value),
          storeId,
        },
        {
          eventName: settingsEvent.setTopKRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setTopKRequest]) => actions.setTopK(p.value),
          storeId,
        },
        {
          eventName: settingsEvent.setPresencePenaltyRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setPresencePenaltyRequest]) =>
            actions.setPresencePenalty(p.value),
          storeId,
        },
        {
          eventName: settingsEvent.setFrequencyPenaltyRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setFrequencyPenaltyRequest]) =>
            actions.setFrequencyPenalty(p.value),
          storeId,
        },
        {
          eventName: settingsEvent.setEnableAdvancedSettingsRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setEnableAdvancedSettingsRequest]) =>
            actions.setEnableAdvancedSettings(p.enabled),
          storeId,
        },
        {
          eventName: settingsEvent.setEnableStreamingMarkdownRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setEnableStreamingMarkdownRequest]) =>
            actions.setEnableStreamingMarkdown(p.enabled),
          storeId,
        },
        {
          eventName: settingsEvent.setEnableStreamingCodeBlockParsingRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setEnableStreamingCodeBlockParsingRequest]) =>
            actions.setEnableStreamingCodeBlockParsing(p.enabled),
          storeId,
        },
        {
          eventName: settingsEvent.setFoldStreamingCodeBlocksRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setFoldStreamingCodeBlocksRequest]) =>
            actions.setFoldStreamingCodeBlocks(p.fold),
          storeId,
        },
        {
          eventName: settingsEvent.setFoldUserMessagesOnCompletionRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setFoldUserMessagesOnCompletionRequest]) =>
            actions.setFoldUserMessagesOnCompletion(p.fold),
          storeId,
        },
        {
          eventName: settingsEvent.setStreamingRenderFpsRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setStreamingRenderFpsRequest]) =>
            actions.setStreamingRenderFPS(p.fps),
          storeId,
        },
        {
          eventName: settingsEvent.setGitUserNameRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setGitUserNameRequest]) =>
            actions.setGitUserName(p.name),
          storeId,
        },
        {
          eventName: settingsEvent.setGitUserEmailRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setGitUserEmailRequest]) =>
            actions.setGitUserEmail(p.email),
          storeId,
        },
        {
          eventName: settingsEvent.setGitGlobalPatRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setGitGlobalPatRequest]) =>
            actions.setGitGlobalPat(p.pat),
          storeId,
        },
        {
          eventName: settingsEvent.setToolMaxStepsRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setToolMaxStepsRequest]) =>
            actions.setToolMaxSteps(p.steps),
          storeId,
        },
        {
          eventName: settingsEvent.setPrismThemeUrlRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setPrismThemeUrlRequest]) =>
            actions.setPrismThemeUrl(p.url),
          storeId,
        },
        {
          eventName: settingsEvent.setAutoTitleEnabledRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setAutoTitleEnabledRequest]) =>
            actions.setAutoTitleEnabled(p.enabled),
          storeId,
        },
        {
          eventName: settingsEvent.setAutoTitleAlwaysOnRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setAutoTitleAlwaysOnRequest]) =>
            actions.setAutoTitleAlwaysOn(p.enabled),
          storeId,
        },
        {
          eventName: settingsEvent.setAutoTitleModelIdRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setAutoTitleModelIdRequest]) =>
            actions.setAutoTitleModelId(p.modelId),
          storeId,
        },
        {
          eventName: settingsEvent.setAutoTitlePromptMaxLengthRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setAutoTitlePromptMaxLengthRequest]) =>
            actions.setAutoTitlePromptMaxLength(p.length),
          storeId,
        },
        {
          eventName: settingsEvent.setAutoTitleIncludeFilesRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setAutoTitleIncludeFilesRequest]) =>
            actions.setAutoTitleIncludeFiles(p.include),
          storeId,
        },
        {
          eventName: settingsEvent.setAutoTitleIncludeRulesRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setAutoTitleIncludeRulesRequest]) =>
            actions.setAutoTitleIncludeRules(p.include),
          storeId,
        },
        {
          eventName: settingsEvent.setCustomFontFamilyRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setCustomFontFamilyRequest]) =>
            actions.setCustomFontFamily(p.fontFamily),
          storeId,
        },
        {
          eventName: settingsEvent.setCustomFontSizeRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setCustomFontSizeRequest]) =>
            actions.setCustomFontSize(p.fontSize),
          storeId,
        },
        {
          eventName: settingsEvent.setChatMaxWidthRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setChatMaxWidthRequest]) =>
            actions.setChatMaxWidth(p.maxWidth),
          storeId,
        },
        {
          eventName: settingsEvent.setCustomThemeColorsRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setCustomThemeColorsRequest]) =>
            actions.setCustomThemeColors(p.colors),
          storeId,
        },
        {
          eventName: settingsEvent.setCustomThemeColorRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setCustomThemeColorRequest]) =>
            actions.setCustomThemeColor(p.colorKey, p.value),
          storeId,
        },
        {
          eventName: settingsEvent.setAutoScrollIntervalRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setAutoScrollIntervalRequest]) =>
            actions.setAutoScrollInterval(p.interval),
          storeId,
        },
        {
          eventName: settingsEvent.setEnableAutoScrollOnStreamRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setEnableAutoScrollOnStreamRequest]) =>
            actions.setEnableAutoScrollOnStream(p.enabled),
          storeId,
        },
        {
          eventName: settingsEvent.setAutoSyncOnStreamCompleteRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setAutoSyncOnStreamCompleteRequest]) =>
            actions.setAutoSyncOnStreamComplete(p.enabled),
          storeId,
        },
        {
          eventName: settingsEvent.setAutoInitializeReposOnStartupRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setAutoInitializeReposOnStartupRequest]) =>
            actions.setAutoInitializeReposOnStartup(p.enabled),
          storeId,
        },
        {
          eventName: settingsEvent.setControlRuleAlwaysOnRequest,
          handler: (payload) => actions.setControlRuleAlwaysOn(payload.ruleId, payload.alwaysOn),
          storeId,
        },
        {
          eventName: settingsEvent.setAutoRuleSelectionEnabledRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setAutoRuleSelectionEnabledRequest]) =>
            actions.setAutoRuleSelectionEnabled(p.enabled),
          storeId,
        },
        {
          eventName: settingsEvent.setAutoRuleSelectionModelIdRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setAutoRuleSelectionModelIdRequest]) =>
            actions.setAutoRuleSelectionModelId(p.modelId),
          storeId,
        },
        {
          eventName: settingsEvent.setAutoRuleSelectionPromptRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setAutoRuleSelectionPromptRequest]) =>
            actions.setAutoRuleSelectionPrompt(p.prompt),
          storeId,
        },
        {
          eventName: settingsEvent.setRunnableBlocksEnabledRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setRunnableBlocksEnabledRequest]) =>
            actions.setRunnableBlocksEnabled(p.enabled),
          storeId,
        },
        {
          eventName: settingsEvent.setRunnableBlocksSecurityCheckEnabledRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setRunnableBlocksSecurityCheckEnabledRequest]) =>
            actions.setRunnableBlocksSecurityCheckEnabled(p.enabled),
          storeId,
        },
        {
          eventName: settingsEvent.setRunnableBlocksSecurityModelIdRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setRunnableBlocksSecurityModelIdRequest]) =>
            actions.setRunnableBlocksSecurityModelId(p.modelId),
          storeId,
        },
        {
          eventName: settingsEvent.setRunnableBlocksSecurityPromptRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setRunnableBlocksSecurityPromptRequest]) =>
            actions.setRunnableBlocksSecurityPrompt(p.prompt),
          storeId,
        },
        {
          eventName: settingsEvent.loadSettingsRequest,
          handler: () => actions.loadSettings(),
          storeId,
        },
        {
          eventName: settingsEvent.resetGeneralSettingsRequest,
          handler: () => actions.resetGeneralSettings(),
          storeId,
        },
        {
          eventName: settingsEvent.resetAssistantSettingsRequest,
          handler: () => actions.resetAssistantSettings(),
          storeId,
        },
        {
          eventName: settingsEvent.resetThemeSettingsRequest,
          handler: () => actions.resetThemeSettings(),
          storeId,
        },
      ];
    },
  }))
);
