// src/types/litechat/events/settings.events.ts
// FULL FILE
import type { SettingsState, CustomThemeColors } from "@/store/settings.store";

export const settingsEvent = {
  // State Change Events
  loaded: "settings.loaded",
  themeChanged: "settings.theme.changed",
  globalSystemPromptChanged: "settings.global.system.prompt.changed",
  temperatureChanged: "settings.temperature.changed",
  maxTokensChanged: "settings.max.tokens.changed",
  topPChanged: "settings.top.p.changed",
  topKChanged: "settings.top.k.changed",
  presencePenaltyChanged: "settings.presence.penalty.changed",
  frequencyPenaltyChanged: "settings.frequency.penalty.changed",
  enableAdvancedSettingsChanged: "settings.enable.advanced.settings.changed",
  enableStreamingMarkdownChanged: "settings.enable.streaming.markdown.changed",
  enableStreamingCodeBlockParsingChanged:
    "settings.enable.streaming.code.block.parsing.changed",
  foldStreamingCodeBlocksChanged: "settings.fold.streaming.code.blocks.changed",
  foldUserMessagesOnCompletionChanged:
    "settings.fold.user.messages.on.completion.changed",
  streamingRenderFpsChanged: "settings.streaming.render.fps.changed",
  gitUserNameChanged: "settings.git.user.name.changed",
  gitUserEmailChanged: "settings.git.user.email.changed",
  toolMaxStepsChanged: "settings.tool.max.steps.changed",
  prismThemeUrlChanged: "settings.prism.theme.url.changed",
  autoTitleEnabledChanged: "settings.auto.title.enabled.changed",
  autoTitleModelIdChanged: "settings.auto.title.model.id.changed",
  autoTitlePromptMaxLengthChanged:
    "settings.auto.title.prompt.max.length.changed",
  autoTitleIncludeFilesChanged: "settings.auto.title.include.files.changed",
  autoTitleIncludeRulesChanged: "settings.auto.title.include.rules.changed",
  customFontFamilyChanged: "settings.custom.font.family.changed",
  customFontSizeChanged: "settings.custom.font.size.changed",
  chatMaxWidthChanged: "settings.chat.max.width.changed",
  customThemeColorsChanged: "settings.custom.theme.colors.changed",
  autoScrollIntervalChanged: "settings.auto.scroll.interval.changed",
  enableAutoScrollOnStreamChanged:
    "settings.enable.auto.scroll.on.stream.changed",
  autoSyncOnStreamCompleteChanged:
    "settings.auto.sync.on.stream.complete.changed",
  autoInitializeReposOnStartupChanged:
    "settings.auto.initialize.repos.on.startup.changed",

  // Action Request Events
  setThemeRequest: "settings.set.theme.request",
  setGlobalSystemPromptRequest: "settings.set.global.system.prompt.request",
  setTemperatureRequest: "settings.set.temperature.request",
  setMaxTokensRequest: "settings.set.max.tokens.request",
  setTopPRequest: "settings.set.top.p.request",
  setTopKRequest: "settings.set.top.k.request",
  setPresencePenaltyRequest: "settings.set.presence.penalty.request",
  setFrequencyPenaltyRequest: "settings.set.frequency.penalty.request",
  setEnableAdvancedSettingsRequest:
    "settings.set.enable.advanced.settings.request",
  setEnableStreamingMarkdownRequest:
    "settings.set.enable.streaming.markdown.request",
  setEnableStreamingCodeBlockParsingRequest:
    "settings.set.enable.streaming.code.block.parsing.request",
  setFoldStreamingCodeBlocksRequest:
    "settings.set.fold.streaming.code.blocks.request",
  setFoldUserMessagesOnCompletionRequest:
    "settings.set.fold.user.messages.on.completion.request",
  setStreamingRenderFpsRequest: "settings.set.streaming.render.fps.request",
  setGitUserNameRequest: "settings.set.git.user.name.request",
  setGitUserEmailRequest: "settings.set.git.user.email.request",
  setToolMaxStepsRequest: "settings.set.tool.max.steps.request",
  setPrismThemeUrlRequest: "settings.set.prism.theme.url.request",
  setAutoTitleEnabledRequest: "settings.set.auto.title.enabled.request",
  setAutoTitleModelIdRequest: "settings.set.auto.title.model.id.request",
  setAutoTitlePromptMaxLengthRequest:
    "settings.set.auto.title.prompt.max.length.request",
  setAutoTitleIncludeFilesRequest:
    "settings.set.auto.title.include.files.request",
  setAutoTitleIncludeRulesRequest:
    "settings.set.auto.title.include.rules.request",
  setCustomFontFamilyRequest: "settings.set.custom.font.family.request",
  setCustomFontSizeRequest: "settings.set.custom.font.size.request",
  setChatMaxWidthRequest: "settings.set.chat.max.width.request",
  setCustomThemeColorsRequest: "settings.set.custom.theme.colors.request",
  setCustomThemeColorRequest: "settings.set.custom.theme.color.request",
  setAutoScrollIntervalRequest: "settings.set.auto.scroll.interval.request",
  setEnableAutoScrollOnStreamRequest:
    "settings.set.enable.auto.scroll.on.stream.request",
  setAutoSyncOnStreamCompleteRequest:
    "settings.set.auto.sync.on.stream.complete.request",
  setAutoInitializeReposOnStartupRequest:
    "settings.set.auto.initialize.repos.on.startup.request",
  loadSettingsRequest: "settings.load.settings.request",
  resetGeneralSettingsRequest: "settings.reset.general.settings.request",
  resetAssistantSettingsRequest: "settings.reset.assistant.settings.request",
  resetThemeSettingsRequest: "settings.reset.theme.settings.request",
} as const;

export interface SettingsEventPayloads {
  [settingsEvent.loaded]: { settings: SettingsState };
  [settingsEvent.themeChanged]: { theme: SettingsState["theme"] };
  [settingsEvent.globalSystemPromptChanged]: {
    prompt: SettingsState["globalSystemPrompt"];
  };
  [settingsEvent.temperatureChanged]: { value: SettingsState["temperature"] };
  [settingsEvent.maxTokensChanged]: { value: SettingsState["maxTokens"] };
  [settingsEvent.topPChanged]: { value: SettingsState["topP"] };
  [settingsEvent.topKChanged]: { value: SettingsState["topK"] };
  [settingsEvent.presencePenaltyChanged]: {
    value: SettingsState["presencePenalty"];
  };
  [settingsEvent.frequencyPenaltyChanged]: {
    value: SettingsState["frequencyPenalty"];
  };
  [settingsEvent.enableAdvancedSettingsChanged]: {
    enabled: SettingsState["enableAdvancedSettings"];
  };
  [settingsEvent.enableStreamingMarkdownChanged]: {
    enabled: SettingsState["enableStreamingMarkdown"];
  };
  [settingsEvent.enableStreamingCodeBlockParsingChanged]: {
    enabled: SettingsState["enableStreamingCodeBlockParsing"];
  };
  [settingsEvent.foldStreamingCodeBlocksChanged]: {
    fold: SettingsState["foldStreamingCodeBlocks"];
  };
  [settingsEvent.foldUserMessagesOnCompletionChanged]: {
    fold: SettingsState["foldUserMessagesOnCompletion"];
  };
  [settingsEvent.streamingRenderFpsChanged]: {
    fps: SettingsState["streamingRenderFPS"];
  };
  [settingsEvent.gitUserNameChanged]: { name: SettingsState["gitUserName"] };
  [settingsEvent.gitUserEmailChanged]: { email: SettingsState["gitUserEmail"] };
  [settingsEvent.toolMaxStepsChanged]: { steps: SettingsState["toolMaxSteps"] };
  [settingsEvent.prismThemeUrlChanged]: { url: SettingsState["prismThemeUrl"] };
  [settingsEvent.autoTitleEnabledChanged]: {
    enabled: SettingsState["autoTitleEnabled"];
  };
  [settingsEvent.autoTitleModelIdChanged]: {
    modelId: SettingsState["autoTitleModelId"];
  };
  [settingsEvent.autoTitlePromptMaxLengthChanged]: {
    length: SettingsState["autoTitlePromptMaxLength"];
  };
  [settingsEvent.autoTitleIncludeFilesChanged]: {
    include: SettingsState["autoTitleIncludeFiles"];
  };
  [settingsEvent.autoTitleIncludeRulesChanged]: {
    include: SettingsState["autoTitleIncludeRules"];
  };
  [settingsEvent.customFontFamilyChanged]: {
    fontFamily: SettingsState["customFontFamily"];
  };
  [settingsEvent.customFontSizeChanged]: {
    fontSize: SettingsState["customFontSize"];
  };
  [settingsEvent.chatMaxWidthChanged]: {
    maxWidth: SettingsState["chatMaxWidth"];
  };
  [settingsEvent.customThemeColorsChanged]: {
    colors: SettingsState["customThemeColors"];
  };
  [settingsEvent.autoScrollIntervalChanged]: {
    interval: SettingsState["autoScrollInterval"];
  };
  [settingsEvent.enableAutoScrollOnStreamChanged]: {
    enabled: SettingsState["enableAutoScrollOnStream"];
  };
  [settingsEvent.autoSyncOnStreamCompleteChanged]: {
    enabled: SettingsState["autoSyncOnStreamComplete"];
  };
  [settingsEvent.autoInitializeReposOnStartupChanged]: {
    enabled: SettingsState["autoInitializeReposOnStartup"];
  };

  [settingsEvent.setThemeRequest]: { theme: SettingsState["theme"] };
  [settingsEvent.setGlobalSystemPromptRequest]: {
    prompt: SettingsState["globalSystemPrompt"];
  };
  [settingsEvent.setTemperatureRequest]: {
    value: SettingsState["temperature"];
  };
  [settingsEvent.setMaxTokensRequest]: { value: SettingsState["maxTokens"] };
  [settingsEvent.setTopPRequest]: { value: SettingsState["topP"] };
  [settingsEvent.setTopKRequest]: { value: SettingsState["topK"] };
  [settingsEvent.setPresencePenaltyRequest]: {
    value: SettingsState["presencePenalty"];
  };
  [settingsEvent.setFrequencyPenaltyRequest]: {
    value: SettingsState["frequencyPenalty"];
  };
  [settingsEvent.setEnableAdvancedSettingsRequest]: {
    enabled: SettingsState["enableAdvancedSettings"];
  };
  [settingsEvent.setEnableStreamingMarkdownRequest]: {
    enabled: SettingsState["enableStreamingMarkdown"];
  };
  [settingsEvent.setEnableStreamingCodeBlockParsingRequest]: {
    enabled: SettingsState["enableStreamingCodeBlockParsing"];
  };
  [settingsEvent.setFoldStreamingCodeBlocksRequest]: {
    fold: SettingsState["foldStreamingCodeBlocks"];
  };
  [settingsEvent.setFoldUserMessagesOnCompletionRequest]: {
    fold: SettingsState["foldUserMessagesOnCompletion"];
  };
  [settingsEvent.setStreamingRenderFpsRequest]: {
    fps: SettingsState["streamingRenderFPS"];
  };
  [settingsEvent.setGitUserNameRequest]: { name: SettingsState["gitUserName"] };
  [settingsEvent.setGitUserEmailRequest]: {
    email: SettingsState["gitUserEmail"];
  };
  [settingsEvent.setToolMaxStepsRequest]: {
    steps: SettingsState["toolMaxSteps"];
  };
  [settingsEvent.setPrismThemeUrlRequest]: {
    url: SettingsState["prismThemeUrl"];
  };
  [settingsEvent.setAutoTitleEnabledRequest]: {
    enabled: SettingsState["autoTitleEnabled"];
  };
  [settingsEvent.setAutoTitleModelIdRequest]: {
    modelId: SettingsState["autoTitleModelId"];
  };
  [settingsEvent.setAutoTitlePromptMaxLengthRequest]: {
    length: SettingsState["autoTitlePromptMaxLength"];
  };
  [settingsEvent.setAutoTitleIncludeFilesRequest]: {
    include: SettingsState["autoTitleIncludeFiles"];
  };
  [settingsEvent.setAutoTitleIncludeRulesRequest]: {
    include: SettingsState["autoTitleIncludeRules"];
  };
  [settingsEvent.setCustomFontFamilyRequest]: {
    fontFamily: SettingsState["customFontFamily"];
  };
  [settingsEvent.setCustomFontSizeRequest]: {
    fontSize: SettingsState["customFontSize"];
  };
  [settingsEvent.setChatMaxWidthRequest]: {
    maxWidth: SettingsState["chatMaxWidth"];
  };
  [settingsEvent.setCustomThemeColorsRequest]: {
    colors: SettingsState["customThemeColors"];
  };
  [settingsEvent.setCustomThemeColorRequest]: {
    colorKey: keyof CustomThemeColors;
    value: string | null;
  };
  [settingsEvent.setAutoScrollIntervalRequest]: {
    interval: SettingsState["autoScrollInterval"];
  };
  [settingsEvent.setEnableAutoScrollOnStreamRequest]: {
    enabled: SettingsState["enableAutoScrollOnStream"];
  };
  [settingsEvent.setAutoSyncOnStreamCompleteRequest]: {
    enabled: SettingsState["autoSyncOnStreamComplete"];
  };
  [settingsEvent.setAutoInitializeReposOnStartupRequest]: {
    enabled: SettingsState["autoInitializeReposOnStartup"];
  };
  [settingsEvent.loadSettingsRequest]: undefined;
  [settingsEvent.resetGeneralSettingsRequest]: undefined;
  [settingsEvent.resetAssistantSettingsRequest]: undefined;
  [settingsEvent.resetThemeSettingsRequest]: undefined;
}
