// src/services/event-action-coordinator.service.ts
// FULL FILE
import { emitter } from "@/lib/litechat/event-emitter";

// Import ALL store actions and event type constants
import { useSettingsStore } from "@/store/settings.store";
import { settingsStoreEvent } from "@/types/litechat/events/settings.events";
import { useProviderStore } from "@/store/provider.store";
import { providerStoreEvent } from "@/types/litechat/events/provider.events";
import { useRulesStore } from "@/store/rules.store";
import { rulesStoreEvent } from "@/types/litechat/events/rules.events";
import { useConversationStore } from "@/store/conversation.store";
import { conversationStoreEvent } from "@/types/litechat/events/conversation.events";
import { useProjectStore } from "@/store/project.store";
import { projectStoreEvent } from "@/types/litechat/events/project.events";
import { useInteractionStore } from "@/store/interaction.store";
import { interactionStoreEvent } from "@/types/litechat/events/interaction.events";
import { useInputStore } from "@/store/input.store";
import { inputStoreEvent } from "@/types/litechat/events/input.events";
import { usePromptStateStore } from "@/store/prompt.store";
import { promptStoreEvent } from "@/types/litechat/events/prompt.events";
import { useModStore } from "@/store/mod.store";
import { modStoreEvent } from "@/types/litechat/events/mod.events";
import { useUIStateStore } from "@/store/ui.store";
import { uiEvent } from "@/types/litechat/events/ui.events"; // UI events are not store-specific in naming yet
import { useVfsStore } from "@/store/vfs.store";
import { vfsStoreEvent } from "@/types/litechat/events/vfs.events";
import { useControlRegistryStore } from "@/store/control.store";
import { controlRegistryStoreEvent } from "@/types/litechat/events/control.registry.events";

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
    emitter.on(settingsStoreEvent.setThemeRequest, (p) =>
      settingsActions.setTheme(p.theme)
    );
    emitter.on(settingsStoreEvent.setGlobalSystemPromptRequest, (p) =>
      settingsActions.setGlobalSystemPrompt(p.prompt)
    );
    emitter.on(settingsStoreEvent.setTemperatureRequest, (p) =>
      settingsActions.setTemperature(p.value)
    );
    emitter.on(settingsStoreEvent.setMaxTokensRequest, (p) =>
      settingsActions.setMaxTokens(p.value)
    );
    emitter.on(settingsStoreEvent.setTopPRequest, (p) =>
      settingsActions.setTopP(p.value)
    );
    emitter.on(settingsStoreEvent.setTopKRequest, (p) =>
      settingsActions.setTopK(p.value)
    );
    emitter.on(settingsStoreEvent.setPresencePenaltyRequest, (p) =>
      settingsActions.setPresencePenalty(p.value)
    );
    emitter.on(settingsStoreEvent.setFrequencyPenaltyRequest, (p) =>
      settingsActions.setFrequencyPenalty(p.value)
    );
    emitter.on(settingsStoreEvent.setEnableAdvancedSettingsRequest, (p) =>
      settingsActions.setEnableAdvancedSettings(p.enabled)
    );
    emitter.on(settingsStoreEvent.setEnableStreamingMarkdownRequest, (p) =>
      settingsActions.setEnableStreamingMarkdown(p.enabled)
    );
    emitter.on(
      settingsStoreEvent.setEnableStreamingCodeBlockParsingRequest,
      (p) => settingsActions.setEnableStreamingCodeBlockParsing(p.enabled)
    );
    emitter.on(settingsStoreEvent.setFoldStreamingCodeBlocksRequest, (p) =>
      settingsActions.setFoldStreamingCodeBlocks(p.fold)
    );
    emitter.on(settingsStoreEvent.setFoldUserMessagesOnCompletionRequest, (p) =>
      settingsActions.setFoldUserMessagesOnCompletion(p.fold)
    );
    emitter.on(settingsStoreEvent.setStreamingRenderFpsRequest, (p) =>
      settingsActions.setStreamingRenderFPS(p.fps)
    );
    emitter.on(settingsStoreEvent.setGitUserNameRequest, (p) =>
      settingsActions.setGitUserName(p.name)
    );
    emitter.on(settingsStoreEvent.setGitUserEmailRequest, (p) =>
      settingsActions.setGitUserEmail(p.email)
    );
    emitter.on(settingsStoreEvent.setToolMaxStepsRequest, (p) =>
      settingsActions.setToolMaxSteps(p.steps)
    );
    emitter.on(settingsStoreEvent.setPrismThemeUrlRequest, (p) =>
      settingsActions.setPrismThemeUrl(p.url)
    );
    emitter.on(settingsStoreEvent.setAutoTitleEnabledRequest, (p) =>
      settingsActions.setAutoTitleEnabled(p.enabled)
    );
    emitter.on(settingsStoreEvent.setAutoTitleModelIdRequest, (p) =>
      settingsActions.setAutoTitleModelId(p.modelId)
    );
    emitter.on(settingsStoreEvent.setAutoTitlePromptMaxLengthRequest, (p) =>
      settingsActions.setAutoTitlePromptMaxLength(p.length)
    );
    emitter.on(settingsStoreEvent.setAutoTitleIncludeFilesRequest, (p) =>
      settingsActions.setAutoTitleIncludeFiles(p.include)
    );
    emitter.on(settingsStoreEvent.setAutoTitleIncludeRulesRequest, (p) =>
      settingsActions.setAutoTitleIncludeRules(p.include)
    );
    emitter.on(settingsStoreEvent.setCustomFontFamilyRequest, (p) =>
      settingsActions.setCustomFontFamily(p.fontFamily)
    );
    emitter.on(settingsStoreEvent.setCustomFontSizeRequest, (p) =>
      settingsActions.setCustomFontSize(p.fontSize)
    );
    emitter.on(settingsStoreEvent.setChatMaxWidthRequest, (p) =>
      settingsActions.setChatMaxWidth(p.maxWidth)
    );
    emitter.on(settingsStoreEvent.setCustomThemeColorsRequest, (p) =>
      settingsActions.setCustomThemeColors(p.colors)
    );
    emitter.on(settingsStoreEvent.setCustomThemeColorRequest, (p) =>
      settingsActions.setCustomThemeColor(p.colorKey, p.value)
    );
    emitter.on(settingsStoreEvent.setAutoScrollIntervalRequest, (p) =>
      settingsActions.setAutoScrollInterval(p.interval)
    );
    emitter.on(settingsStoreEvent.setEnableAutoScrollOnStreamRequest, (p) =>
      settingsActions.setEnableAutoScrollOnStream(p.enabled)
    );
    emitter.on(settingsStoreEvent.setEnableApiKeyManagementRequest, (p) =>
      useProviderStore.getState().setEnableApiKeyManagement(p.enabled)
    ); // This action moved to ProviderStore
    emitter.on(settingsStoreEvent.loadSettingsRequest, () =>
      settingsActions.loadSettings()
    );
    emitter.on(settingsStoreEvent.resetGeneralSettingsRequest, () =>
      settingsActions.resetGeneralSettings()
    );
    emitter.on(settingsStoreEvent.resetAssistantSettingsRequest, () =>
      settingsActions.resetAssistantSettings()
    );
    emitter.on(settingsStoreEvent.resetThemeSettingsRequest, () =>
      settingsActions.resetThemeSettings()
    );

    // --- ProviderStore Listeners ---
    const providerActions = useProviderStore.getState();
    emitter.on(providerStoreEvent.loadInitialDataRequest, () =>
      providerActions.loadInitialData()
    );
    emitter.on(providerStoreEvent.selectModelRequest, (p) =>
      providerActions.selectModel(p.modelId)
    );
    emitter.on(providerStoreEvent.addApiKeyRequest, (p) =>
      providerActions.addApiKey(p.name, p.providerId, p.value)
    );
    emitter.on(providerStoreEvent.deleteApiKeyRequest, (p) =>
      providerActions.deleteApiKey(p.id)
    );
    emitter.on(providerStoreEvent.addProviderConfigRequest, (p) =>
      providerActions.addProviderConfig(p)
    );
    emitter.on(providerStoreEvent.updateProviderConfigRequest, (p) =>
      providerActions.updateProviderConfig(p.id, p.changes)
    );
    emitter.on(providerStoreEvent.deleteProviderConfigRequest, (p) =>
      providerActions.deleteProviderConfig(p.id)
    );
    emitter.on(providerStoreEvent.fetchModelsRequest, (p) =>
      providerActions.fetchModels(p.providerConfigId)
    );
    emitter.on(providerStoreEvent.setGlobalModelSortOrderRequest, (p) =>
      providerActions.setGlobalModelSortOrder(p.ids)
    );
    emitter.on(providerStoreEvent.setSelectedModelForDetailsRequest, (p) =>
      providerActions.setSelectedModelForDetails(p.modelId)
    );

    // --- RulesStore Listeners ---
    const rulesActions = useRulesStore.getState();
    emitter.on(rulesStoreEvent.loadRulesAndTagsRequest, () =>
      rulesActions.loadRulesAndTags()
    );
    emitter.on(rulesStoreEvent.addRuleRequest, (p) => rulesActions.addRule(p));
    emitter.on(rulesStoreEvent.updateRuleRequest, (p) =>
      rulesActions.updateRule(p.id, p.updates)
    );
    emitter.on(rulesStoreEvent.deleteRuleRequest, (p) =>
      rulesActions.deleteRule(p.id)
    );
    emitter.on(rulesStoreEvent.addTagRequest, (p) => rulesActions.addTag(p));
    emitter.on(rulesStoreEvent.updateTagRequest, (p) =>
      rulesActions.updateTag(p.id, p.updates)
    );
    emitter.on(rulesStoreEvent.deleteTagRequest, (p) =>
      rulesActions.deleteTag(p.id)
    );
    emitter.on(rulesStoreEvent.linkTagToRuleRequest, (p) =>
      rulesActions.linkTagToRule(p.tagId, p.ruleId)
    );
    emitter.on(rulesStoreEvent.unlinkTagFromRuleRequest, (p) =>
      rulesActions.unlinkTagFromRule(p.tagId, p.ruleId)
    );

    // --- ConversationStore Listeners ---
    const conversationActions = useConversationStore.getState();
    emitter.on(conversationStoreEvent.loadSidebarItemsRequest, () =>
      conversationActions.loadSidebarItems()
    );
    emitter.on(conversationStoreEvent.addConversationRequest, (p) =>
      conversationActions.addConversation(p)
    );
    emitter.on(conversationStoreEvent.updateConversationRequest, (p) =>
      conversationActions.updateConversation(p.id, p.updates)
    );
    emitter.on(conversationStoreEvent.deleteConversationRequest, (p) =>
      conversationActions.deleteConversation(p.id)
    );
    emitter.on(conversationStoreEvent.selectItemRequest, (p) =>
      conversationActions.selectItem(p.id, p.type)
    );
    emitter.on(conversationStoreEvent.importConversationRequest, (p) =>
      conversationActions.importConversation(p.file)
    );
    emitter.on(conversationStoreEvent.exportConversationRequest, (p) =>
      conversationActions.exportConversation(p.conversationId, p.format)
    );
    emitter.on(conversationStoreEvent.exportProjectRequest, (p) =>
      conversationActions.exportProject(p.projectId)
    );
    emitter.on(conversationStoreEvent.exportAllConversationsRequest, () =>
      conversationActions.exportAllConversations()
    );
    emitter.on(conversationStoreEvent.loadSyncReposRequest, () =>
      conversationActions.loadSyncRepos()
    );
    emitter.on(conversationStoreEvent.addSyncRepoRequest, (p) =>
      conversationActions.addSyncRepo(p)
    );
    emitter.on(conversationStoreEvent.updateSyncRepoRequest, (p) =>
      conversationActions.updateSyncRepo(p.id, p.updates)
    );
    emitter.on(conversationStoreEvent.deleteSyncRepoRequest, (p) =>
      conversationActions.deleteSyncRepo(p.id)
    );
    emitter.on(conversationStoreEvent.linkConversationToRepoRequest, (p) =>
      conversationActions.linkConversationToRepo(p.conversationId, p.repoId)
    );
    emitter.on(conversationStoreEvent.syncConversationRequest, (p) =>
      conversationActions.syncConversation(p.conversationId)
    );
    emitter.on(conversationStoreEvent.initializeOrSyncRepoRequest, (p) =>
      conversationActions.initializeOrSyncRepo(p.repoId)
    );
    emitter.on(
      conversationStoreEvent.updateCurrentConversationToolSettingsRequest,
      (p) => conversationActions.updateCurrentConversationToolSettings(p)
    );

    // --- ProjectStore Listeners ---
    const projectActions = useProjectStore.getState();
    emitter.on(projectStoreEvent.loadProjectsRequest, () =>
      projectActions.loadProjects()
    );
    emitter.on(projectStoreEvent.addProjectRequest, (p) =>
      projectActions.addProject(p)
    );
    emitter.on(projectStoreEvent.updateProjectRequest, (p) =>
      projectActions.updateProject(p.id, p.updates)
    );
    emitter.on(projectStoreEvent.deleteProjectRequest, (p) =>
      projectActions.deleteProject(p.id)
    );

    // --- InteractionStore Listeners ---
    const interactionActions = useInteractionStore.getState();
    emitter.on(interactionStoreEvent.loadInteractionsRequest, (p) =>
      interactionActions.loadInteractions(p.conversationId)
    );
    emitter.on(interactionStoreEvent.rateInteractionRequest, (p) =>
      interactionActions.rateInteraction(p.interactionId, p.rating)
    );
    emitter.on(interactionStoreEvent.setCurrentConversationIdRequest, (p) =>
      interactionActions.setCurrentConversationId(p.id)
    );
    emitter.on(interactionStoreEvent.clearInteractionsRequest, () =>
      interactionActions.clearInteractions()
    );
    emitter.on(interactionStoreEvent.setErrorRequest, (p) =>
      interactionActions.setError(p.error)
    );
    emitter.on(interactionStoreEvent.setStatusRequest, (p) =>
      interactionActions.setStatus(p.status)
    );

    // --- InputStore Listeners ---
    const inputActions = useInputStore.getState();
    emitter.on(inputStoreEvent.addAttachedFileRequest, (p) =>
      inputActions.addAttachedFile(p)
    );
    emitter.on(inputStoreEvent.removeAttachedFileRequest, (p) =>
      inputActions.removeAttachedFile(p.attachmentId)
    );
    emitter.on(inputStoreEvent.clearAttachedFilesRequest, () =>
      inputActions.clearAttachedFiles()
    );

    // --- PromptStateStore Listeners ---
    const promptStateActions = usePromptStateStore.getState();
    emitter.on(promptStoreEvent.setModelIdRequest, (p) =>
      promptStateActions.setModelId(p.id)
    );
    emitter.on(promptStoreEvent.setTemperatureRequest, (p) =>
      promptStateActions.setTemperature(p.value)
    );
    emitter.on(promptStoreEvent.setMaxTokensRequest, (p) =>
      promptStateActions.setMaxTokens(p.value)
    );
    emitter.on(promptStoreEvent.setTopPRequest, (p) =>
      promptStateActions.setTopP(p.value)
    );
    emitter.on(promptStoreEvent.setTopKRequest, (p) =>
      promptStateActions.setTopK(p.value)
    );
    emitter.on(promptStoreEvent.setPresencePenaltyRequest, (p) =>
      promptStateActions.setPresencePenalty(p.value)
    );
    emitter.on(promptStoreEvent.setFrequencyPenaltyRequest, (p) =>
      promptStateActions.setFrequencyPenalty(p.value)
    );
    emitter.on(promptStoreEvent.setReasoningEnabledRequest, (p) =>
      promptStateActions.setReasoningEnabled(p.enabled)
    );
    emitter.on(promptStoreEvent.setWebSearchEnabledRequest, (p) =>
      promptStateActions.setWebSearchEnabled(p.enabled)
    );
    emitter.on(promptStoreEvent.setStructuredOutputJsonRequest, (p) =>
      promptStateActions.setStructuredOutputJson(p.json)
    );
    emitter.on(promptStoreEvent.initializePromptStateRequest, (p) =>
      promptStateActions.initializePromptState(p.effectiveSettings)
    );
    emitter.on(promptStoreEvent.resetTransientParametersRequest, () =>
      promptStateActions.resetTransientParameters()
    );

    // --- ModStore Listeners ---
    const modActions = useModStore.getState();
    emitter.on(modStoreEvent.loadDbModsRequest, () => modActions.loadDbMods());
    emitter.on(modStoreEvent.addDbModRequest, (p) => modActions.addDbMod(p));
    emitter.on(modStoreEvent.updateDbModRequest, (p) =>
      modActions.updateDbMod(p.id, p.changes)
    );
    emitter.on(modStoreEvent.deleteDbModRequest, (p) =>
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
    // Modal open/close requests will be handled by ModalManager in Phase 4

    // --- VfsStore Listeners ---
    const vfsActions = useVfsStore.getState();
    emitter.on(vfsStoreEvent.setVfsKeyRequest, (p) =>
      vfsActions.setVfsKey(p.key)
    );
    emitter.on(vfsStoreEvent.initializeVFSRequest, (p) =>
      vfsActions.initializeVFS(p.vfsKey, p.options)
    );
    emitter.on(vfsStoreEvent.fetchNodesRequest, (p) =>
      vfsActions.fetchNodes(p.parentId)
    );
    emitter.on(vfsStoreEvent.setCurrentPathRequest, (p) =>
      vfsActions.setCurrentPath(p.path)
    );
    emitter.on(vfsStoreEvent.createDirectoryRequest, (p) =>
      vfsActions.createDirectory(p.parentId, p.name)
    );
    emitter.on(vfsStoreEvent.uploadFilesRequest, (p) =>
      vfsActions.uploadFiles(p.parentId, p.files)
    );
    emitter.on(vfsStoreEvent.deleteNodesRequest, (p) =>
      vfsActions.deleteNodes(p.ids)
    );
    emitter.on(vfsStoreEvent.renameNodeRequest, (p) =>
      vfsActions.renameNode(p.id, p.newName)
    );
    emitter.on(vfsStoreEvent.downloadFileRequest, (p) =>
      vfsActions.downloadFile(p.fileId)
    );
    emitter.on(vfsStoreEvent.selectFileRequest, (p) =>
      vfsActions.selectFile(p.fileId)
    );
    emitter.on(vfsStoreEvent.deselectFileRequest, (p) =>
      vfsActions.deselectFile(p.fileId)
    );
    emitter.on(vfsStoreEvent.clearSelectionRequest, () =>
      vfsActions.clearSelection()
    );
    emitter.on(vfsStoreEvent.setEnableVfsRequest, (p) =>
      vfsActions._setEnableVfs(p.enabled)
    ); // Use internal setter

    // --- ControlRegistryStore Listeners ---
    const controlRegistryActions = useControlRegistryStore.getState();
    emitter.on(controlRegistryStoreEvent.registerPromptControlRequest, (p) =>
      controlRegistryActions.registerPromptControl(p.control)
    );
    emitter.on(controlRegistryStoreEvent.unregisterPromptControlRequest, (p) =>
      controlRegistryActions.unregisterPromptControl(p.id)
    );
    emitter.on(controlRegistryStoreEvent.registerChatControlRequest, (p) =>
      controlRegistryActions.registerChatControl(p.control)
    );
    emitter.on(controlRegistryStoreEvent.unregisterChatControlRequest, (p) =>
      controlRegistryActions.unregisterChatControl(p.id)
    );
    emitter.on(controlRegistryStoreEvent.registerMiddlewareRequest, (p) =>
      controlRegistryActions.registerMiddleware(
        p.hookName,
        p.modId,
        p.callback,
        p.order
      )
    );
    emitter.on(controlRegistryStoreEvent.unregisterMiddlewareRequest, (p) =>
      controlRegistryActions.unregisterMiddleware(
        p.hookName,
        p.modId,
        p.callback
      )
    );
    emitter.on(controlRegistryStoreEvent.registerToolRequest, (p) =>
      controlRegistryActions.registerTool(
        p.modId,
        p.toolName,
        p.definition,
        p.implementation
      )
    );
    emitter.on(controlRegistryStoreEvent.unregisterToolRequest, (p) =>
      controlRegistryActions.unregisterTool(p.toolName)
    );
    // Modal provider registration will be added in Phase 4

    this.isInitialized = true;
    console.log(
      "[Coordinator] Event listeners for action requests initialized."
    );
  }
}
