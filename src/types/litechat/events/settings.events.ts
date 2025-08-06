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
  gitGlobalPatChanged: "settings.git.global.pat.changed",
  toolMaxStepsChanged: "settings.tool.max.steps.changed",
  prismThemeUrlChanged: "settings.prism.theme.url.changed",
  autoTitleEnabledChanged: "settings.auto.title.enabled.changed",
  autoTitleAlwaysOnChanged: "settings.auto.title.always.on.changed",
  autoTitleModelIdChanged: "settings.auto.title.model.id.changed",
  autoTitlePromptMaxLengthChanged:
    "settings.auto.title.prompt.max.length.changed",
  autoTitleIncludeFilesChanged: "settings.auto.title.include.files.changed",
  autoTitleIncludeRulesChanged: "settings.auto.title.include.rules.changed",
  forkCompactPromptChanged: "settings.fork.compact.prompt.changed",
  forkCompactModelIdChanged: "settings.fork.compact.model.id.changed",
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
  autoRuleSelectionEnabledChanged: "settings.auto.rule.selection.enabled.changed",
  autoRuleSelectionModelIdChanged: "settings.auto.rule.selection.model.id.changed",
  autoRuleSelectionPromptChanged: "settings.auto.rule.selection.prompt.changed",
  runnableBlocksEnabledChanged: "settings.runnable.blocks.enabled.changed",
  runnableBlocksSecurityCheckEnabledChanged: "settings.runnable.blocks.security.check.enabled.changed",
  runnableBlocksSecurityModelIdChanged: "settings.runnable.blocks.security.model.id.changed",
  runnableBlocksSecurityPromptChanged: "settings.runnable.blocks.security.prompt.changed",
  controlRuleAlwaysOnChanged: "settings.control.rule.always.on.changed",
  
  // Auto Tool Selection Events
  autoToolSelectionEnabledChanged: "settings.auto.tool.selection.enabled.changed",
  autoToolSelectionModelIdChanged: "settings.auto.tool.selection.model.id.changed",
  autoToolSelectionPromptChanged: "settings.auto.tool.selection.prompt.changed",
  
  // Text Trigger Events
  textTriggersEnabledChanged: "settings.text.triggers.enabled.changed",
  textTriggerDelimitersChanged: "settings.text.trigger.delimiters.changed",

  // Config Sync Events
  configSyncEnabledChanged: "settings.config.sync.enabled.changed",
  configSyncRepoIdChanged: "settings.config.sync.repo.id.changed",
  configSyncAutoSyncChanged: "settings.config.sync.auto.sync.changed",
  configSyncIncludeSettingsChanged: "settings.config.sync.include.settings.changed",
  configSyncIncludeRulesChanged: "settings.config.sync.include.rules.changed",
  configSyncIncludePromptTemplatesChanged: "settings.config.sync.include.prompt.templates.changed",
  configSyncIncludeAgentsChanged: "settings.config.sync.include.agents.changed",
  configSyncIncludeWorkflowsChanged: "settings.config.sync.include.workflows.changed",
  configSyncIncludeMcpServersChanged: "settings.config.sync.include.mcp.servers.changed",
  configSyncLastSyncedAtChanged: "settings.config.sync.last.synced.at.changed",
  configSyncIntervalChanged: "settings.config.sync.interval.changed",

  // Service URL Events
  corsProxyUrlChanged: "settings.cors.proxy.url.changed",
  markdownServiceUrlChanged: "settings.markdown.service.url.changed",

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
  setGitGlobalPatRequest: "settings.set.git.global.pat.request",
  setToolMaxStepsRequest: "settings.set.tool.max.steps.request",
  setPrismThemeUrlRequest: "settings.set.prism.theme.url.request",
  setAutoTitleEnabledRequest: "settings.set.auto.title.enabled.request",
  setAutoTitleAlwaysOnRequest: "settings.set.auto.title.always.on.request",
  setAutoTitleModelIdRequest: "settings.set.auto.title.model.id.request",
  setAutoTitlePromptMaxLengthRequest:
    "settings.set.auto.title.prompt.max.length.request",
  setAutoTitleIncludeFilesRequest:
    "settings.set.auto.title.include.files.request",
  setAutoTitleIncludeRulesRequest:
    "settings.set.auto.title.include.rules.request",
  setForkCompactPromptRequest: "settings.set.fork.compact.prompt.request",
  setForkCompactModelIdRequest: "settings.set.fork.compact.model.id.request",
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
  setAutoRuleSelectionEnabledRequest: "settings.set.auto.rule.selection.enabled.request",
  setAutoRuleSelectionModelIdRequest: "settings.set.auto.rule.selection.model.id.request",
  setAutoRuleSelectionPromptRequest: "settings.set.auto.rule.selection.prompt.request",
  setRunnableBlocksEnabledRequest: "settings.set.runnable.blocks.enabled.request",
  setRunnableBlocksSecurityCheckEnabledRequest: "settings.set.runnable.blocks.security.check.enabled.request",
  setRunnableBlocksSecurityModelIdRequest: "settings.set.runnable.blocks.security.model.id.request",
  setRunnableBlocksSecurityPromptRequest: "settings.set.runnable.blocks.security.prompt.request",
  setControlRuleAlwaysOnRequest: "settings.set.control.rule.always.on.request",
  
  // Auto Tool Selection Request Events
  setAutoToolSelectionEnabledRequest: "settings.set.auto.tool.selection.enabled.request",
  setAutoToolSelectionModelIdRequest: "settings.set.auto.tool.selection.model.id.request",
  setAutoToolSelectionPromptRequest: "settings.set.auto.tool.selection.prompt.request",
  
  // Text Trigger Request Events
  setTextTriggersEnabledRequest: "settings.set.text.triggers.enabled.request",
  setTextTriggerDelimitersRequest: "settings.set.text.trigger.delimiters.request",

  // Config Sync Request Events
  setConfigSyncEnabledRequest: "settings.set.config.sync.enabled.request",
  setConfigSyncRepoIdRequest: "settings.set.config.sync.repo.id.request",
  setConfigSyncAutoSyncRequest: "settings.set.config.sync.auto.sync.request",
  setConfigSyncIntervalRequest: "settings.set.config.sync.interval.request",
  setConfigSyncIncludeSettingsRequest: "settings.set.config.sync.include.settings.request",
  setConfigSyncIncludeRulesRequest: "settings.set.config.sync.include.rules.request",
  setConfigSyncIncludePromptTemplatesRequest: "settings.set.config.sync.include.prompt.templates.request",
  setConfigSyncIncludeAgentsRequest: "settings.set.config.sync.include.agents.request",
  setConfigSyncIncludeWorkflowsRequest: "settings.set.config.sync.include.workflows.request",
  setConfigSyncIncludeMcpServersRequest: "settings.set.config.sync.include.mcp.servers.request",
  setConfigSyncLastSyncedAtRequest: "settings.set.config.sync.last.synced.at.request",

  // Service URL Request Events
  setCorsProxyUrlRequest: "settings.set.cors.proxy.url.request",
  setMarkdownServiceUrlRequest: "settings.set.markdown.service.url.request",

  loadSettingsRequest: "settings.load.settings.request",
  resetGeneralSettingsRequest: "settings.reset.general.settings.request",
  resetAssistantSettingsRequest: "settings.reset.assistant.settings.request",
  resetThemeSettingsRequest: "settings.reset.theme.settings.request",
  settingsChanged: "settings.changed",
} as const;

export type SettingsEvent = (typeof settingsEvent)[keyof typeof settingsEvent];

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
  [settingsEvent.gitGlobalPatChanged]: { pat: SettingsState["gitGlobalPat"] };
  [settingsEvent.toolMaxStepsChanged]: { steps: SettingsState["toolMaxSteps"] };
  [settingsEvent.prismThemeUrlChanged]: { url: SettingsState["prismThemeUrl"] };
  [settingsEvent.autoTitleEnabledChanged]: {
    enabled: SettingsState["autoTitleEnabled"];
  };
  [settingsEvent.autoTitleAlwaysOnChanged]: {
    enabled: SettingsState["autoTitleAlwaysOn"];
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
  [settingsEvent.forkCompactPromptChanged]: {
    prompt: SettingsState["forkCompactPrompt"];
  };
  [settingsEvent.forkCompactModelIdChanged]: {
    modelId: SettingsState["forkCompactModelId"];
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
  [settingsEvent.autoRuleSelectionEnabledChanged]: { enabled: SettingsState["autoRuleSelectionEnabled"] };
  [settingsEvent.autoRuleSelectionModelIdChanged]: { modelId: SettingsState["autoRuleSelectionModelId"] };
  [settingsEvent.autoRuleSelectionPromptChanged]: { prompt: SettingsState["autoRuleSelectionPrompt"] };
  [settingsEvent.runnableBlocksEnabledChanged]: { enabled: SettingsState["runnableBlocksEnabled"] };
  [settingsEvent.runnableBlocksSecurityCheckEnabledChanged]: { enabled: SettingsState["runnableBlocksSecurityCheckEnabled"] };
  [settingsEvent.runnableBlocksSecurityModelIdChanged]: { modelId: SettingsState["runnableBlocksSecurityModelId"] };
  [settingsEvent.runnableBlocksSecurityPromptChanged]: { prompt: SettingsState["runnableBlocksSecurityPrompt"] };
  [settingsEvent.controlRuleAlwaysOnChanged]: { ruleId: string, alwaysOn: boolean };
  
  // Auto Tool Selection Event Payloads
  [settingsEvent.autoToolSelectionEnabledChanged]: { enabled: SettingsState["autoToolSelectionEnabled"] };
  [settingsEvent.autoToolSelectionModelIdChanged]: { modelId: SettingsState["autoToolSelectionModelId"] };
  [settingsEvent.autoToolSelectionPromptChanged]: { prompt: SettingsState["autoToolSelectionPrompt"] };
  
  // Text Trigger Event Payloads
  [settingsEvent.textTriggersEnabledChanged]: { enabled: SettingsState["textTriggersEnabled"] };
  [settingsEvent.textTriggerDelimitersChanged]: { start: SettingsState["textTriggerStartDelimiter"], end: SettingsState["textTriggerEndDelimiter"] };

  // Config Sync Event Payloads
  [settingsEvent.configSyncEnabledChanged]: { enabled: SettingsState["configSyncEnabled"] };
  [settingsEvent.configSyncRepoIdChanged]: { repoId: SettingsState["configSyncRepoId"] };
  [settingsEvent.configSyncAutoSyncChanged]: { enabled: SettingsState["configSyncAutoSync"] };
  [settingsEvent.configSyncIncludeSettingsChanged]: { include: SettingsState["configSyncIncludeSettings"] };
  [settingsEvent.configSyncIncludeRulesChanged]: { include: SettingsState["configSyncIncludeRules"] };
  [settingsEvent.configSyncIncludePromptTemplatesChanged]: { include: SettingsState["configSyncIncludePromptTemplates"] };
  [settingsEvent.configSyncIncludeAgentsChanged]: { include: SettingsState["configSyncIncludeAgents"] };
  [settingsEvent.configSyncIncludeWorkflowsChanged]: { include: SettingsState["configSyncIncludeWorkflows"] };
  [settingsEvent.configSyncIncludeMcpServersChanged]: { include: SettingsState["configSyncIncludeMcpServers"] };
  [settingsEvent.configSyncLastSyncedAtChanged]: { timestamp: SettingsState["configSyncLastSyncedAt"] };
  [settingsEvent.configSyncIntervalChanged]: { interval: SettingsState["configSyncInterval"] };

  // Service URL Event Payloads
  [settingsEvent.corsProxyUrlChanged]: { url: SettingsState["corsProxyUrl"] };
  [settingsEvent.markdownServiceUrlChanged]: { url: SettingsState["markdownServiceUrl"] };

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
  [settingsEvent.setGitGlobalPatRequest]: { pat: SettingsState["gitGlobalPat"] };
  [settingsEvent.setToolMaxStepsRequest]: {
    steps: SettingsState["toolMaxSteps"];
  };
  [settingsEvent.setPrismThemeUrlRequest]: {
    url: SettingsState["prismThemeUrl"];
  };
  [settingsEvent.setAutoTitleEnabledRequest]: {
    enabled: SettingsState["autoTitleEnabled"];
  };
  [settingsEvent.setAutoTitleAlwaysOnRequest]: {
    enabled: SettingsState["autoTitleAlwaysOn"];
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
  [settingsEvent.setForkCompactPromptRequest]: {
    prompt: SettingsState["forkCompactPrompt"];
  };
  [settingsEvent.setForkCompactModelIdRequest]: {
    modelId: SettingsState["forkCompactModelId"];
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
  [settingsEvent.setAutoRuleSelectionEnabledRequest]: { enabled: SettingsState["autoRuleSelectionEnabled"] };
  [settingsEvent.setAutoRuleSelectionModelIdRequest]: { modelId: SettingsState["autoRuleSelectionModelId"] };
  [settingsEvent.setAutoRuleSelectionPromptRequest]: { prompt: SettingsState["autoRuleSelectionPrompt"] };
  [settingsEvent.setRunnableBlocksEnabledRequest]: { enabled: SettingsState["runnableBlocksEnabled"] };
  [settingsEvent.setRunnableBlocksSecurityCheckEnabledRequest]: { enabled: SettingsState["runnableBlocksSecurityCheckEnabled"] };
  [settingsEvent.setRunnableBlocksSecurityModelIdRequest]: { modelId: SettingsState["runnableBlocksSecurityModelId"] };
  [settingsEvent.setRunnableBlocksSecurityPromptRequest]: { prompt: SettingsState["runnableBlocksSecurityPrompt"] };
  [settingsEvent.setControlRuleAlwaysOnRequest]: { ruleId: string, alwaysOn: boolean };
  
  // Auto Tool Selection Request Payloads
  [settingsEvent.setAutoToolSelectionEnabledRequest]: { enabled: SettingsState["autoToolSelectionEnabled"] };
  [settingsEvent.setAutoToolSelectionModelIdRequest]: { modelId: SettingsState["autoToolSelectionModelId"] };
  [settingsEvent.setAutoToolSelectionPromptRequest]: { prompt: SettingsState["autoToolSelectionPrompt"] };
  
  // Text Trigger Request Payloads
  [settingsEvent.setTextTriggersEnabledRequest]: { enabled: SettingsState["textTriggersEnabled"] };
  [settingsEvent.setTextTriggerDelimitersRequest]: { start: SettingsState["textTriggerStartDelimiter"], end: SettingsState["textTriggerEndDelimiter"] };

  // Config Sync Request Payloads
  [settingsEvent.setConfigSyncEnabledRequest]: { enabled: SettingsState["configSyncEnabled"] };
  [settingsEvent.setConfigSyncRepoIdRequest]: { repoId: SettingsState["configSyncRepoId"] };
  [settingsEvent.setConfigSyncAutoSyncRequest]: { enabled: SettingsState["configSyncAutoSync"] };
  [settingsEvent.setConfigSyncIntervalRequest]: { interval: SettingsState["configSyncInterval"] };
  [settingsEvent.setConfigSyncIncludeSettingsRequest]: { include: SettingsState["configSyncIncludeSettings"] };
  [settingsEvent.setConfigSyncIncludeRulesRequest]: { include: SettingsState["configSyncIncludeRules"] };
  [settingsEvent.setConfigSyncIncludePromptTemplatesRequest]: { include: SettingsState["configSyncIncludePromptTemplates"] };
  [settingsEvent.setConfigSyncIncludeAgentsRequest]: { include: SettingsState["configSyncIncludeAgents"] };
  [settingsEvent.setConfigSyncIncludeWorkflowsRequest]: { include: SettingsState["configSyncIncludeWorkflows"] };
  [settingsEvent.setConfigSyncIncludeMcpServersRequest]: { include: SettingsState["configSyncIncludeMcpServers"] };
  [settingsEvent.setConfigSyncLastSyncedAtRequest]: { timestamp: SettingsState["configSyncLastSyncedAt"] };

  // Service URL Request Payloads
  [settingsEvent.setCorsProxyUrlRequest]: { url: SettingsState["corsProxyUrl"] };
  [settingsEvent.setMarkdownServiceUrlRequest]: { url: SettingsState["markdownServiceUrl"] };

  [settingsEvent.loadSettingsRequest]: undefined;
  [settingsEvent.resetGeneralSettingsRequest]: undefined;
  [settingsEvent.resetAssistantSettingsRequest]: undefined;
  [settingsEvent.resetThemeSettingsRequest]: undefined;
  [settingsEvent.settingsChanged]: Partial<SettingsState>;
}
