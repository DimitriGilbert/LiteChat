// src/services/event-action-coordinator.service.ts
// FULL FILE
import { emitter } from "@/lib/litechat/event-emitter";

// Import ALL store actions and event type constants
import { useSettingsStore } from "@/store/settings.store";
import { settingsEvent } from "@/types/litechat/events/settings.events";
import { useProviderStore } from "@/store/provider.store";
import { providerEvent } from "@/types/litechat/events/provider.events";
import { rulesEvent } from "@/types/litechat/events/rules.events"; // Correct: Only import event constants
import { useConversationStore } from "@/store/conversation.store";
import { conversationEvent } from "@/types/litechat/events/conversation.events";
import { useProjectStore } from "@/store/project.store";
import { projectEvent } from "@/types/litechat/events/project.events";
import { useInteractionStore } from "@/store/interaction.store";
import { interactionEvent } from "@/types/litechat/events/interaction.events";
import { useInputStore } from "@/store/input.store";
import { inputEvent } from "@/types/litechat/events/input.events";
import { usePromptStateStore } from "@/store/prompt.store";
import { promptEvent } from "@/types/litechat/events/prompt.events";
import { useModStore } from "@/store/mod.store";
import { modEvent } from "@/types/litechat/events/mod.events";
import { useUIStateStore } from "@/store/ui.store";
import { uiEvent } from "@/types/litechat/events/ui.events";
import { useVfsStore } from "@/store/vfs.store";
import { vfsEvent } from "@/types/litechat/events/vfs.events";
import { useControlRegistryStore } from "@/store/control.store";
import { controlRegistryEvent } from "@/types/litechat/events/control.registry.events";
import { useRulesStore } from "@/store/rules.store"; // This import is for accessing getState() for actions

export class EventActionCoordinatorService {
  private static isInitialized = false;

  public static initialize(): void {
    if (this.isInitialized) {
      console.warn(
        "[Coordinator] Already initialized. Skipping re-initialization."
      );
      return;
    }
    console.log(
      "[Coordinator] Initializing event listeners for action requests..."
    );

    // --- SettingsStore Listeners ---
    const settingsActions = useSettingsStore.getState();
    emitter.on(settingsEvent.setThemeRequest, (p) =>
      settingsActions.setTheme(p.theme)
    );
    emitter.on(settingsEvent.setGlobalSystemPromptRequest, (p) =>
      settingsActions.setGlobalSystemPrompt(p.prompt)
    );
    emitter.on(settingsEvent.setTemperatureRequest, (p) =>
      settingsActions.setTemperature(p.value)
    );
    emitter.on(settingsEvent.setMaxTokensRequest, (p) =>
      settingsActions.setMaxTokens(p.value)
    );
    emitter.on(settingsEvent.setTopPRequest, (p) =>
      settingsActions.setTopP(p.value)
    );
    emitter.on(settingsEvent.setTopKRequest, (p) =>
      settingsActions.setTopK(p.value)
    );
    emitter.on(settingsEvent.setPresencePenaltyRequest, (p) =>
      settingsActions.setPresencePenalty(p.value)
    );
    emitter.on(settingsEvent.setFrequencyPenaltyRequest, (p) =>
      settingsActions.setFrequencyPenalty(p.value)
    );
    emitter.on(settingsEvent.setEnableAdvancedSettingsRequest, (p) =>
      settingsActions.setEnableAdvancedSettings(p.enabled)
    );
    emitter.on(settingsEvent.setEnableStreamingMarkdownRequest, (p) =>
      settingsActions.setEnableStreamingMarkdown(p.enabled)
    );
    emitter.on(settingsEvent.setEnableStreamingCodeBlockParsingRequest, (p) =>
      settingsActions.setEnableStreamingCodeBlockParsing(p.enabled)
    );
    emitter.on(settingsEvent.setFoldStreamingCodeBlocksRequest, (p) =>
      settingsActions.setFoldStreamingCodeBlocks(p.fold)
    );
    emitter.on(settingsEvent.setFoldUserMessagesOnCompletionRequest, (p) =>
      settingsActions.setFoldUserMessagesOnCompletion(p.fold)
    );
    emitter.on(settingsEvent.setStreamingRenderFpsRequest, (p) =>
      settingsActions.setStreamingRenderFPS(p.fps)
    );
    emitter.on(settingsEvent.setGitUserNameRequest, (p) =>
      settingsActions.setGitUserName(p.name)
    );
    emitter.on(settingsEvent.setGitUserEmailRequest, (p) =>
      settingsActions.setGitUserEmail(p.email)
    );
    emitter.on(settingsEvent.setToolMaxStepsRequest, (p) =>
      settingsActions.setToolMaxSteps(p.steps)
    );
    emitter.on(settingsEvent.setPrismThemeUrlRequest, (p) =>
      settingsActions.setPrismThemeUrl(p.url)
    );
    emitter.on(settingsEvent.setAutoTitleEnabledRequest, (p) =>
      settingsActions.setAutoTitleEnabled(p.enabled)
    );
    emitter.on(settingsEvent.setAutoTitleModelIdRequest, (p) =>
      settingsActions.setAutoTitleModelId(p.modelId)
    );
    emitter.on(settingsEvent.setAutoTitlePromptMaxLengthRequest, (p) =>
      settingsActions.setAutoTitlePromptMaxLength(p.length)
    );
    emitter.on(settingsEvent.setAutoTitleIncludeFilesRequest, (p) =>
      settingsActions.setAutoTitleIncludeFiles(p.include)
    );
    emitter.on(settingsEvent.setAutoTitleIncludeRulesRequest, (p) =>
      settingsActions.setAutoTitleIncludeRules(p.include)
    );
    emitter.on(settingsEvent.setCustomFontFamilyRequest, (p) =>
      settingsActions.setCustomFontFamily(p.fontFamily)
    );
    emitter.on(settingsEvent.setCustomFontSizeRequest, (p) =>
      settingsActions.setCustomFontSize(p.fontSize)
    );
    emitter.on(settingsEvent.setChatMaxWidthRequest, (p) =>
      settingsActions.setChatMaxWidth(p.maxWidth)
    );
    emitter.on(settingsEvent.setCustomThemeColorsRequest, (p) =>
      settingsActions.setCustomThemeColors(p.colors)
    );
    emitter.on(settingsEvent.setCustomThemeColorRequest, (p) =>
      settingsActions.setCustomThemeColor(p.colorKey, p.value)
    );
    emitter.on(settingsEvent.setAutoScrollIntervalRequest, (p) =>
      settingsActions.setAutoScrollInterval(p.interval)
    );
    emitter.on(settingsEvent.setEnableAutoScrollOnStreamRequest, (p) =>
      settingsActions.setEnableAutoScrollOnStream(p.enabled)
    );
    emitter.on(settingsEvent.loadSettingsRequest, () =>
      settingsActions.loadSettings()
    );
    emitter.on(settingsEvent.resetGeneralSettingsRequest, () =>
      settingsActions.resetGeneralSettings()
    );
    emitter.on(settingsEvent.resetAssistantSettingsRequest, () =>
      settingsActions.resetAssistantSettings()
    );
    emitter.on(settingsEvent.resetThemeSettingsRequest, () =>
      settingsActions.resetThemeSettings()
    );

    // --- ProviderStore Listeners ---
    const providerActions = useProviderStore.getState();
    emitter.on(providerEvent.loadInitialDataRequest, () =>
      providerActions.loadInitialData()
    );
    emitter.on(providerEvent.selectModelRequest, (p) =>
      providerActions.selectModel(p.modelId)
    );
    emitter.on(providerEvent.addApiKeyRequest, (p) =>
      providerActions.addApiKey(p.name, p.providerId, p.value)
    );
    emitter.on(providerEvent.deleteApiKeyRequest, (p) =>
      providerActions.deleteApiKey(p.id)
    );
    emitter.on(providerEvent.addProviderConfigRequest, (p) =>
      providerActions.addProviderConfig(p)
    );
    emitter.on(providerEvent.updateProviderConfigRequest, (p) =>
      providerActions.updateProviderConfig(p.id, p.changes)
    );
    emitter.on(providerEvent.deleteProviderConfigRequest, (p) =>
      providerActions.deleteProviderConfig(p.id)
    );
    emitter.on(providerEvent.fetchModelsRequest, (p) =>
      providerActions.fetchModels(p.providerConfigId)
    );
    emitter.on(providerEvent.setGlobalModelSortOrderRequest, (p) =>
      providerActions.setGlobalModelSortOrder(p.ids)
    );
    emitter.on(providerEvent.setEnableApiKeyManagementRequest, (p) =>
      providerActions.setEnableApiKeyManagement(p.enabled)
    );
    emitter.on(providerEvent.setSelectedModelForDetailsRequest, (p) =>
      providerActions.setSelectedModelForDetails(p.modelId)
    );

    // --- RulesStore Listeners ---
    const rulesActions = useRulesStore.getState();
    emitter.on(rulesEvent.loadRulesAndTagsRequest, () =>
      rulesActions.loadRulesAndTags()
    );
    emitter.on(rulesEvent.addRuleRequest, (p) => rulesActions.addRule(p));
    emitter.on(rulesEvent.updateRuleRequest, (p) =>
      rulesActions.updateRule(p.id, p.updates)
    );
    emitter.on(rulesEvent.deleteRuleRequest, (p) =>
      rulesActions.deleteRule(p.id)
    );
    emitter.on(rulesEvent.addTagRequest, (p) => rulesActions.addTag(p));
    emitter.on(rulesEvent.updateTagRequest, (p) =>
      rulesActions.updateTag(p.id, p.updates)
    );
    emitter.on(rulesEvent.deleteTagRequest, (p) =>
      rulesActions.deleteTag(p.id)
    );
    emitter.on(rulesEvent.linkTagToRuleRequest, (p) =>
      rulesActions.linkTagToRule(p.tagId, p.ruleId)
    );
    emitter.on(rulesEvent.unlinkTagFromRuleRequest, (p) =>
      rulesActions.unlinkTagFromRule(p.tagId, p.ruleId)
    );

    // --- ConversationStore Listeners ---
    const conversationActions = useConversationStore.getState();
    emitter.on(conversationEvent.loadSidebarItemsRequest, () =>
      conversationActions.loadSidebarItems()
    );
    emitter.on(conversationEvent.addConversationRequest, (p) =>
      conversationActions.addConversation(p)
    );
    emitter.on(conversationEvent.updateConversationRequest, (p) =>
      conversationActions.updateConversation(p.id, p.updates)
    );
    emitter.on(conversationEvent.deleteConversationRequest, (p) =>
      conversationActions.deleteConversation(p.id)
    );
    emitter.on(conversationEvent.selectItemRequest, (p) =>
      conversationActions.selectItem(p.id, p.type)
    );
    emitter.on(conversationEvent.importConversationRequest, (p) =>
      conversationActions.importConversation(p.file)
    );
    emitter.on(conversationEvent.exportConversationRequest, (p) =>
      conversationActions.exportConversation(p.conversationId, p.format)
    );
    emitter.on(conversationEvent.exportProjectRequest, (p) =>
      conversationActions.exportProject(p.projectId)
    );
    emitter.on(conversationEvent.exportAllConversationsRequest, () =>
      conversationActions.exportAllConversations()
    );
    emitter.on(conversationEvent.loadSyncReposRequest, () =>
      conversationActions.loadSyncRepos()
    );
    emitter.on(conversationEvent.addSyncRepoRequest, (p) =>
      conversationActions.addSyncRepo(p)
    );
    emitter.on(conversationEvent.updateSyncRepoRequest, (p) =>
      conversationActions.updateSyncRepo(p.id, p.updates)
    );
    emitter.on(conversationEvent.deleteSyncRepoRequest, (p) =>
      conversationActions.deleteSyncRepo(p.id)
    );
    emitter.on(conversationEvent.linkConversationToRepoRequest, (p) =>
      conversationActions.linkConversationToRepo(p.conversationId, p.repoId)
    );
    emitter.on(conversationEvent.syncConversationRequest, (p) =>
      conversationActions.syncConversation(p.conversationId)
    );
    emitter.on(conversationEvent.initializeOrSyncRepoRequest, (p) =>
      conversationActions.initializeOrSyncRepo(p.repoId)
    );
    emitter.on(
      conversationEvent.updateCurrentConversationToolSettingsRequest,
      (p) => conversationActions.updateCurrentConversationToolSettings(p)
    );

    // --- ProjectStore Listeners ---
    const projectActions = useProjectStore.getState();
    emitter.on(projectEvent.loadProjectsRequest, () =>
      projectActions.loadProjects()
    );
    emitter.on(projectEvent.addProjectRequest, (p) =>
      projectActions.addProject(p)
    );
    emitter.on(projectEvent.updateProjectRequest, (p) =>
      projectActions.updateProject(p.id, p.updates)
    );
    emitter.on(projectEvent.deleteProjectRequest, (p) =>
      projectActions.deleteProject(p.id)
    );

    // --- InteractionStore Listeners ---
    const interactionActions = useInteractionStore.getState();
    emitter.on(interactionEvent.loadInteractionsRequest, (p) =>
      interactionActions.loadInteractions(p.conversationId)
    );
    emitter.on(interactionEvent.rateInteractionRequest, (p) =>
      interactionActions.rateInteraction(p.interactionId, p.rating)
    );
    emitter.on(interactionEvent.setCurrentConversationIdRequest, (p) =>
      interactionActions.setCurrentConversationId(p.id)
    );
    emitter.on(interactionEvent.clearInteractionsRequest, () =>
      interactionActions.clearInteractions()
    );
    emitter.on(interactionEvent.setErrorRequest, (p) =>
      interactionActions.setError(p.error)
    );
    emitter.on(interactionEvent.setStatusRequest, (p) =>
      interactionActions.setStatus(p.status)
    );

    // --- InputStore Listeners ---
    const inputActions = useInputStore.getState();
    emitter.on(inputEvent.addAttachedFileRequest, (p) =>
      inputActions.addAttachedFile(p)
    );
    emitter.on(inputEvent.removeAttachedFileRequest, (p) =>
      inputActions.removeAttachedFile(p.attachmentId)
    );
    emitter.on(inputEvent.clearAttachedFilesRequest, () =>
      inputActions.clearAttachedFiles()
    );

    // --- PromptStateStore Listeners ---
    const promptStateActions = usePromptStateStore.getState();
    emitter.on(promptEvent.setModelIdRequest, (p) =>
      promptStateActions.setModelId(p.id)
    );
    emitter.on(promptEvent.setTemperatureRequest, (p) =>
      promptStateActions.setTemperature(p.value)
    );
    emitter.on(promptEvent.setMaxTokensRequest, (p) =>
      promptStateActions.setMaxTokens(p.value)
    );
    emitter.on(promptEvent.setTopPRequest, (p) =>
      promptStateActions.setTopP(p.value)
    );
    emitter.on(promptEvent.setTopKRequest, (p) =>
      promptStateActions.setTopK(p.value)
    );
    emitter.on(promptEvent.setPresencePenaltyRequest, (p) =>
      promptStateActions.setPresencePenalty(p.value)
    );
    emitter.on(promptEvent.setFrequencyPenaltyRequest, (p) =>
      promptStateActions.setFrequencyPenalty(p.value)
    );
    emitter.on(promptEvent.setReasoningEnabledRequest, (p) =>
      promptStateActions.setReasoningEnabled(p.enabled)
    );
    emitter.on(promptEvent.setWebSearchEnabledRequest, (p) =>
      promptStateActions.setWebSearchEnabled(p.enabled)
    );
    emitter.on(promptEvent.setStructuredOutputJsonRequest, (p) =>
      promptStateActions.setStructuredOutputJson(p.json)
    );
    emitter.on(promptEvent.initializePromptStateRequest, (p) =>
      promptStateActions.initializePromptState(p.effectiveSettings)
    );
    emitter.on(promptEvent.resetTransientParametersRequest, () =>
      promptStateActions.resetTransientParameters()
    );

    // --- ModStore Listeners ---
    const modActions = useModStore.getState();
    emitter.on(modEvent.loadDbModsRequest, () => modActions.loadDbMods());
    emitter.on(modEvent.addDbModRequest, (p) => modActions.addDbMod(p));
    emitter.on(modEvent.updateDbModRequest, (p) =>
      modActions.updateDbMod(p.id, p.changes)
    );
    emitter.on(modEvent.deleteDbModRequest, (p) =>
      modActions.deleteDbMod(p.id)
    );

    // --- UIStateStore Listeners ---
    const uiActions = useUIStateStore.getState();
    emitter.on(uiEvent.toggleSidebarRequest, (p) =>
      uiActions.toggleSidebar(p?.isCollapsed)
    );
    emitter.on(uiEvent.toggleChatControlPanelRequest, (p) =>
      uiActions.toggleChatControlPanel(p.panelId, p.isOpen)
    );
    emitter.on(uiEvent.togglePromptControlPanelRequest, (p) =>
      uiActions.togglePromptControlPanel(p.controlId, p.isOpen)
    );
    emitter.on(uiEvent.setGlobalLoadingRequest, (p) =>
      uiActions.setGlobalLoading(p.loading)
    );
    emitter.on(uiEvent.setGlobalErrorRequest, (p) =>
      uiActions.setGlobalError(p.error)
    );
    emitter.on(uiEvent.setFocusInputFlagRequest, (p) =>
      uiActions.setFocusInputFlag(p.focus)
    );
    emitter.on(uiEvent.openModalRequest, (_p) => {
      // This is now handled by ModalManager directly, which listens to this event.
    });
    emitter.on(uiEvent.closeModalRequest, (_p) => {
      // Similar to open, ModalManager handles this.
    });

    // --- VfsStore Listeners ---
    const vfsActions = useVfsStore.getState();
    emitter.on(vfsEvent.setVfsKeyRequest, (p) => vfsActions.setVfsKey(p.key));
    emitter.on(vfsEvent.initializeVFSRequest, (p) =>
      vfsActions.initializeVFS(p.vfsKey, p.options)
    );
    emitter.on(vfsEvent.fetchNodesRequest, (p) =>
      vfsActions.fetchNodes(p.parentId)
    );
    emitter.on(vfsEvent.setCurrentPathRequest, (p) =>
      vfsActions.setCurrentPath(p.path)
    );
    emitter.on(vfsEvent.createDirectoryRequest, (p) =>
      vfsActions.createDirectory(p.parentId, p.name)
    );
    emitter.on(vfsEvent.uploadFilesRequest, (p) =>
      vfsActions.uploadFiles(p.parentId, p.files)
    );
    emitter.on(vfsEvent.deleteNodesRequest, (p) =>
      vfsActions.deleteNodes(p.ids)
    );
    emitter.on(vfsEvent.renameNodeRequest, (p) =>
      vfsActions.renameNode(p.id, p.newName)
    );
    emitter.on(vfsEvent.downloadFileRequest, (p) =>
      vfsActions.downloadFile(p.fileId)
    );
    emitter.on(vfsEvent.selectFileRequest, (p) =>
      vfsActions.selectFile(p.fileId)
    );
    emitter.on(vfsEvent.deselectFileRequest, (p) =>
      vfsActions.deselectFile(p.fileId)
    );
    emitter.on(vfsEvent.clearSelectionRequest, () =>
      vfsActions.clearSelection()
    );
    emitter.on(vfsEvent.setEnableVfsRequest, (p) =>
      vfsActions._setEnableVfs(p.enabled)
    );

    // --- ControlRegistryStore Listeners ---
    const controlRegistryActions = useControlRegistryStore.getState();
    emitter.on(controlRegistryEvent.registerPromptControlRequest, (p) =>
      controlRegistryActions.registerPromptControl(p.control)
    );
    emitter.on(controlRegistryEvent.unregisterPromptControlRequest, (p) =>
      controlRegistryActions.unregisterPromptControl(p.id)
    );
    emitter.on(controlRegistryEvent.registerChatControlRequest, (p) =>
      controlRegistryActions.registerChatControl(p.control)
    );
    emitter.on(controlRegistryEvent.unregisterChatControlRequest, (p) =>
      controlRegistryActions.unregisterChatControl(p.id)
    );
    emitter.on(controlRegistryEvent.registerMiddlewareRequest, (p) =>
      controlRegistryActions.registerMiddleware(
        p.hookName,
        p.modId,
        p.callback,
        p.order
      )
    );
    emitter.on(controlRegistryEvent.unregisterMiddlewareRequest, (p) =>
      controlRegistryActions.unregisterMiddleware(
        p.hookName,
        p.modId,
        p.callback
      )
    );
    emitter.on(controlRegistryEvent.registerToolRequest, (p) =>
      controlRegistryActions.registerTool(
        p.modId,
        p.toolName,
        p.definition,
        p.implementation
      )
    );
    emitter.on(controlRegistryEvent.unregisterToolRequest, (p) =>
      controlRegistryActions.unregisterTool(p.toolName)
    );
    emitter.on(controlRegistryEvent.registerModalProviderRequest, (p) =>
      controlRegistryActions.registerModalProvider(p.modalId, p.provider)
    );
    emitter.on(controlRegistryEvent.unregisterModalProviderRequest, (p) =>
      controlRegistryActions.unregisterModalProvider(p.modalId)
    );

    this.isInitialized = true;
    console.log(
      "[Coordinator] Event listeners for action requests initialized."
    );
  }
}
