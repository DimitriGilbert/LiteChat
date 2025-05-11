// src/types/litechat/events/stores/settings.events.ts
// NEW FILE
export const settingsStoreEvent = {
  // State Change Events
  loaded: "stores.settings.loaded",
  themeChanged: "stores.settings.theme.changed",
  globalSystemPromptChanged: "stores.settings.global.system.prompt.changed",
  temperatureChanged: "stores.settings.temperature.changed",
  maxTokensChanged: "stores.settings.max.tokens.changed",
  topPChanged: "stores.settings.top.p.changed",
  topKChanged: "stores.settings.top.k.changed",
  presencePenaltyChanged: "stores.settings.presence.penalty.changed",
  frequencyPenaltyChanged: "stores.settings.frequency.penalty.changed",
  enableAdvancedSettingsChanged:
    "stores.settings.enable.advanced.settings.changed",
  enableStreamingMarkdownChanged:
    "stores.settings.enable.streaming.markdown.changed",
  enableStreamingCodeBlockParsingChanged:
    "stores.settings.enable.streaming.code.block.parsing.changed",
  foldStreamingCodeBlocksChanged:
    "stores.settings.fold.streaming.code.blocks.changed",
  foldUserMessagesOnCompletionChanged:
    "stores.settings.fold.user.messages.on.completion.changed",
  streamingRenderFpsChanged: "stores.settings.streaming.render.fps.changed",
  gitUserNameChanged: "stores.settings.git.user.name.changed",
  gitUserEmailChanged: "stores.settings.git.user.email.changed",
  toolMaxStepsChanged: "stores.settings.tool.max.steps.changed",
  prismThemeUrlChanged: "stores.settings.prism.theme.url.changed",
  autoTitleEnabledChanged: "stores.settings.auto.title.enabled.changed",
  autoTitleModelIdChanged: "stores.settings.auto.title.model.id.changed",
  autoTitlePromptMaxLengthChanged:
    "stores.settings.auto.title.prompt.max.length.changed",
  autoTitleIncludeFilesChanged:
    "stores.settings.auto.title.include.files.changed",
  autoTitleIncludeRulesChanged:
    "stores.settings.auto.title.include.rules.changed",
  customFontFamilyChanged: "stores.settings.custom.font.family.changed",
  customFontSizeChanged: "stores.settings.custom.font.size.changed",
  chatMaxWidthChanged: "stores.settings.chat.max.width.changed",
  customThemeColorsChanged: "stores.settings.custom.theme.colors.changed",
  autoScrollIntervalChanged: "stores.settings.auto.scroll.interval.changed",
  enableAutoScrollOnStreamChanged:
    "stores.settings.enable.auto.scroll.on.stream.changed",
  enableApiKeyManagementChanged:
    "stores.settings.enable.api.key.management.changed", // Renamed from toggled

  // Action Request Events
  setThemeRequest: "stores.settings.set.theme.request",
  setGlobalSystemPromptRequest:
    "stores.settings.set.global.system.prompt.request",
  setTemperatureRequest: "stores.settings.set.temperature.request",
  setMaxTokensRequest: "stores.settings.set.max.tokens.request",
  setTopPRequest: "stores.settings.set.top.p.request",
  setTopKRequest: "stores.settings.set.top.k.request",
  setPresencePenaltyRequest: "stores.settings.set.presence.penalty.request",
  setFrequencyPenaltyRequest: "stores.settings.set.frequency.penalty.request",
  setEnableAdvancedSettingsRequest:
    "stores.settings.set.enable.advanced.settings.request",
  setEnableStreamingMarkdownRequest:
    "stores.settings.set.enable.streaming.markdown.request",
  setEnableStreamingCodeBlockParsingRequest:
    "stores.settings.set.enable.streaming.code.block.parsing.request",
  setFoldStreamingCodeBlocksRequest:
    "stores.settings.set.fold.streaming.code.blocks.request",
  setFoldUserMessagesOnCompletionRequest:
    "stores.settings.set.fold.user.messages.on.completion.request",
  setStreamingRenderFpsRequest:
    "stores.settings.set.streaming.render.fps.request",
  setGitUserNameRequest: "stores.settings.set.git.user.name.request",
  setGitUserEmailRequest: "stores.settings.set.git.user.email.request",
  setToolMaxStepsRequest: "stores.settings.set.tool.max.steps.request",
  setPrismThemeUrlRequest: "stores.settings.set.prism.theme.url.request",
  setAutoTitleEnabledRequest: "stores.settings.set.auto.title.enabled.request",
  setAutoTitleModelIdRequest: "stores.settings.set.auto.title.model.id.request",
  setAutoTitlePromptMaxLengthRequest:
    "stores.settings.set.auto.title.prompt.max.length.request",
  setAutoTitleIncludeFilesRequest:
    "stores.settings.set.auto.title.include.files.request",
  setAutoTitleIncludeRulesRequest:
    "stores.settings.set.auto.title.include.rules.request",
  setCustomFontFamilyRequest: "stores.settings.set.custom.font.family.request",
  setCustomFontSizeRequest: "stores.settings.set.custom.font.size.request",
  setChatMaxWidthRequest: "stores.settings.set.chat.max.width.request",
  setCustomThemeColorsRequest:
    "stores.settings.set.custom.theme.colors.request",
  setCustomThemeColorRequest: "stores.settings.set.custom.theme.color.request",
  setAutoScrollIntervalRequest:
    "stores.settings.set.auto.scroll.interval.request",
  setEnableAutoScrollOnStreamRequest:
    "stores.settings.set.enable.auto.scroll.on.stream.request",
  setEnableApiKeyManagementRequest:
    "stores.settings.set.enable.api.key.management.request",
  loadSettingsRequest: "stores.settings.load.settings.request",
  resetGeneralSettingsRequest: "stores.settings.reset.general.settings.request",
  resetAssistantSettingsRequest:
    "stores.settings.reset.assistant.settings.request",
  resetThemeSettingsRequest: "stores.settings.reset.theme.settings.request",
} as const;
