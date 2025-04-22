// src/hooks/use-lite-chat-logic.ts
import { useMemo, useCallback, useRef, useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import { toast } from "sonner";

// Store Imports and Types
import { useSidebarStore, type SidebarActions } from "@/store/sidebar.store";
import {
  useCoreChatStore,
  type CoreChatActions,
} from "@/store/core-chat.store";
import {
  useProviderStore,
  type ProviderState,
  type ProviderActions,
} from "@/store/provider.store";
import {
  useSettingsStore,
  type SettingsState,
  type SettingsActions,
} from "@/store/settings.store";
import { useVfsStore, type VfsState, type VfsActions } from "@/store/vfs.store";
import { useModStore, type ModState, type ModActions } from "@/store/mod.store";
// Import useInputStore
import {
  useInputStore,
  type InputState,
  type InputActions,
} from "@/store/input.store";
import type {
  SidebarItemType,
  DbConversation,
  AiProviderConfig,
  AiModelConfig,
  // DbProviderConfig, // Removed unused import
  Message,
  // MessageContent, // Removed unused import
} from "@/lib/types";
import type { ReadonlyChatContextSnapshot } from "@/mods/api";
import { db } from "@/lib/db";
import { useAiInteraction } from "@/hooks/ai-interaction";
import { convertDbMessagesToCoreMessages } from "@/utils/chat-utils";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createOllama } from "ollama-ai-provider";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
// Removed unused import
// import { WorkflowExecutionService } from "@/services/workflow-execution-service";

interface UseLiteChatLogicProps {
  editingItemId: string | null;
  setEditingItemId: (id: string | null) => void;
  onEditComplete: (id: string) => void;
  dbConversations: DbConversation[];
}

// Define the return type, including input actions
interface UseLiteChatLogicReturn {
  // Input State & Actions (from InputStore)
  promptInputValue: InputState["promptInputValue"];
  setPromptInputValue: InputActions["setPromptInputValue"];
  attachedFiles: InputState["attachedFiles"];
  addAttachedFile: InputActions["addAttachedFile"];
  removeAttachedFile: InputActions["removeAttachedFile"];
  clearAttachedFiles: InputActions["clearAttachedFiles"];
  selectedVfsPaths: InputState["selectedVfsPaths"];
  addSelectedVfsPath: InputActions["addSelectedVfsPath"];
  removeSelectedVfsPath: InputActions["removeSelectedVfsPath"];
  clearSelectedVfsPaths: InputActions["clearSelectedVfsPaths"];
  clearAllInput: InputActions["clearAllInput"];

  // State and Actions from Stores
  sidebarActions: Pick<
    SidebarActions,
    | "selectItem"
    | "createConversation"
    | "createProject"
    | "deleteItem"
    | "renameItem"
    | "exportConversation"
    | "importConversation"
    | "exportAllConversations"
    | "updateConversationSystemPrompt"
    | "toggleVfsEnabled"
  >;
  coreChatActions: Pick<
    CoreChatActions,
    | "setMessages"
    | "addMessage"
    | "updateMessage"
    | "setIsStreaming"
    | "setError"
    | "addDbMessage"
    | "bulkAddMessages"
    | "handleSubmitCore"
    | "handleImageGenerationCore"
    | "stopStreamingCore"
    | "regenerateMessageCore"
    | "startWorkflowCore"
    | "finalizeWorkflowTask"
  >;
  vfsActions: Pick<
    VfsActions,
    "clearSelectedVfsPaths" | "removeSelectedVfsPath"
  >;
  providerActions: Pick<
    ProviderActions,
    | "setSelectedProviderId"
    | "setSelectedModelId"
    | "addDbProviderConfig"
    | "updateDbProviderConfig"
    | "deleteDbProviderConfig"
    | "fetchModels"
    | "addApiKey"
    | "deleteApiKey"
  >;
  settingsActions: Pick<
    SettingsActions,
    | "setIsSettingsModalOpen"
    | "setSearchTerm"
    | "setTheme"
    | "setTemperature"
    | "setTopP"
    | "setMaxTokens"
    | "setTopK"
    | "setPresencePenalty"
    | "setFrequencyPenalty"
    | "setGlobalSystemPrompt"
    | "setStreamingRefreshRateMs"
  >;
  modActions: Pick<ModActions, "addDbMod" | "updateDbMod" | "deleteDbMod">;
  // Selection State (Stable)
  selectedItemId: string | null;
  selectedItemType: SidebarItemType | null;
  enableSidebar: boolean;
  // Other store states (non-volatile)
  vfsState: Pick<
    VfsState,
    | "isVfsEnabledForItem"
    | "isVfsReady"
    | "isVfsLoading"
    | "vfsError"
    | "vfsKey"
  >;
  providerState: Pick<
    ProviderState,
    | "selectedProviderId"
    | "selectedModelId"
    | "dbProviderConfigs"
    | "apiKeys"
    | "enableApiKeyManagement"
    | "providerFetchStatus"
  >;
  settingsState: Pick<
    SettingsState,
    | "searchTerm"
    | "theme"
    | "enableAdvancedSettings"
    | "temperature"
    | "topP"
    | "maxTokens"
    | "topK"
    | "presencePenalty"
    | "frequencyPenalty"
    | "globalSystemPrompt"
    | "streamingRefreshRateMs"
    | "isSettingsModalOpen"
  >;
  modState: Pick<
    ModState,
    | "dbMods"
    | "loadedMods"
    | "modSettingsTabs"
    | "modPromptActions"
    | "modMessageActions"
  >;
  // Memoized Callbacks
  clearAllData: () => Promise<void>;
  getAllAvailableModelDefs: (
    providerConfigId: string,
  ) => { id: string; name: string }[];
  handleFormSubmit: (
    prompt: string,
    files: File[],
    vfsPaths: string[],
    context: any,
  ) => Promise<void>;
  handleImageGenerationWrapper: (prompt: string) => Promise<void>;
  stopStreaming: (parentMessageId?: string | null) => void;
  regenerateMessage: (messageId: string) => Promise<void>;
  getContextSnapshotForMod: () => ReadonlyChatContextSnapshot;
  // Derived State
  activeConversationData: DbConversation | null;
  selectedProvider: AiProviderConfig | undefined;
  selectedModel: AiModelConfig | undefined;
  getApiKeyForProvider: (providerId: string) => string | undefined;
}

export function useLiteChatLogic(
  props: UseLiteChatLogicProps,
): UseLiteChatLogicReturn {
  const { dbConversations } = props;

  // --- Get Input State/Actions from Store ---
  const {
    promptInputValue,
    setPromptInputValue,
    attachedFiles,
    addAttachedFile,
    removeAttachedFile,
    clearAttachedFiles,
    selectedVfsPaths,
    addSelectedVfsPath,
    removeSelectedVfsPath,
    clearSelectedVfsPaths,
    clearAllInput,
  } = useInputStore(
    useShallow((state) => ({
      promptInputValue: state.promptInputValue,
      setPromptInputValue: state.setPromptInputValue,
      attachedFiles: state.attachedFiles,
      addAttachedFile: state.addAttachedFile,
      removeAttachedFile: state.removeAttachedFile,
      clearAttachedFiles: state.clearAttachedFiles,
      selectedVfsPaths: state.selectedVfsPaths,
      addSelectedVfsPath: state.addSelectedVfsPath,
      removeSelectedVfsPath: state.removeSelectedVfsPath,
      clearSelectedVfsPaths: state.clearSelectedVfsPaths,
      clearAllInput: state.clearAllInput,
    })),
  );

  // --- Select State/Actions from Other Stores ---
  const sidebarActions = useSidebarStore(
    useShallow((state): UseLiteChatLogicReturn["sidebarActions"] => ({
      selectItem: state.selectItem,
      createConversation: state.createConversation,
      createProject: state.createProject,
      deleteItem: state.deleteItem,
      renameItem: state.renameItem,
      exportConversation: state.exportConversation,
      importConversation: state.importConversation,
      exportAllConversations: state.exportAllConversations,
      updateConversationSystemPrompt: state.updateConversationSystemPrompt,
      toggleVfsEnabled: state.toggleVfsEnabled,
    })),
  );
  const { selectedItemId, selectedItemType, enableSidebar } = useSidebarStore(
    useShallow((state) => ({
      selectedItemId: state.selectedItemId,
      selectedItemType: state.selectedItemType,
      enableSidebar: state.enableSidebar,
    })),
  );

  const {
    setMessages: setCoreMessages,
    addMessage: coreAddMessage,
    updateMessage: coreUpdateMessage,
    setIsStreaming: setCoreIsStreaming,
    setError: setCoreError,
    addDbMessage: addCoreDbMessage,
    bulkAddMessages: bulkCoreAddMessages,
    handleSubmitCore: coreHandleSubmitCore,
    handleImageGenerationCore: coreHandleImageGenerationCore,
    stopStreamingCore: coreStopStreamingCore,
    regenerateMessageCore: coreRegenerateMessageCore,
    startWorkflowCore: coreStartWorkflowCore,
    finalizeWorkflowTask: coreFinalizeWorkflowTask,
  } = useCoreChatStore();

  const coreChatActions: UseLiteChatLogicReturn["coreChatActions"] = {
    setMessages: setCoreMessages,
    addMessage: coreAddMessage,
    updateMessage: coreUpdateMessage,
    setIsStreaming: setCoreIsStreaming,
    setError: setCoreError,
    addDbMessage: addCoreDbMessage,
    bulkAddMessages: bulkCoreAddMessages,
    handleSubmitCore: coreHandleSubmitCore,
    handleImageGenerationCore: coreHandleImageGenerationCore,
    stopStreamingCore: coreStopStreamingCore,
    regenerateMessageCore: coreRegenerateMessageCore,
    startWorkflowCore: coreStartWorkflowCore,
    finalizeWorkflowTask: coreFinalizeWorkflowTask,
  };

  const vfsActions = useVfsStore(
    useShallow((state): UseLiteChatLogicReturn["vfsActions"] => ({
      clearSelectedVfsPaths: state.clearSelectedVfsPaths,
      removeSelectedVfsPath: state.removeSelectedVfsPath,
    })),
  );
  const vfsState = useVfsStore(
    useShallow((state): UseLiteChatLogicReturn["vfsState"] => ({
      isVfsEnabledForItem: state.isVfsEnabledForItem,
      isVfsReady: state.isVfsReady,
      isVfsLoading: state.isVfsLoading,
      vfsError: state.vfsError,
      vfsKey: state.vfsKey,
    })),
  );

  const providerActions = useProviderStore(
    useShallow((state): UseLiteChatLogicReturn["providerActions"] => ({
      setSelectedProviderId: state.setSelectedProviderId,
      setSelectedModelId: state.setSelectedModelId,
      addDbProviderConfig: state.addDbProviderConfig,
      updateDbProviderConfig: state.updateDbProviderConfig,
      deleteDbProviderConfig: state.deleteDbProviderConfig,
      fetchModels: state.fetchModels,
      addApiKey: state.addApiKey,
      deleteApiKey: state.deleteApiKey,
    })),
  );
  const providerState = useProviderStore(
    useShallow((state): UseLiteChatLogicReturn["providerState"] => ({
      selectedProviderId: state.selectedProviderId,
      selectedModelId: state.selectedModelId,
      dbProviderConfigs: state.dbProviderConfigs,
      apiKeys: state.apiKeys,
      enableApiKeyManagement: state.enableApiKeyManagement,
      providerFetchStatus: state.providerFetchStatus,
    })),
  );

  const settingsActions = useSettingsStore(
    useShallow((state): UseLiteChatLogicReturn["settingsActions"] => ({
      setIsSettingsModalOpen: state.setIsSettingsModalOpen,
      setSearchTerm: state.setSearchTerm,
      setTheme: state.setTheme,
      setTemperature: state.setTemperature,
      setTopP: state.setTopP,
      setMaxTokens: state.setMaxTokens,
      setTopK: state.setTopK,
      setPresencePenalty: state.setPresencePenalty,
      setFrequencyPenalty: state.setFrequencyPenalty,
      setGlobalSystemPrompt: state.setGlobalSystemPrompt,
      setStreamingRefreshRateMs: state.setStreamingRefreshRateMs,
    })),
  );
  const settingsState = useSettingsStore(
    useShallow((state): UseLiteChatLogicReturn["settingsState"] => ({
      searchTerm: state.searchTerm,
      theme: state.theme,
      enableAdvancedSettings: state.enableAdvancedSettings,
      temperature: state.temperature,
      topP: state.topP,
      maxTokens: state.maxTokens,
      topK: state.topK,
      presencePenalty: state.presencePenalty,
      frequencyPenalty: state.frequencyPenalty,
      globalSystemPrompt: state.globalSystemPrompt,
      streamingRefreshRateMs: state.streamingRefreshRateMs,
      isSettingsModalOpen: state.isSettingsModalOpen,
    })),
  );

  const modActions = useModStore(
    useShallow((state): UseLiteChatLogicReturn["modActions"] => ({
      addDbMod: state.addDbMod,
      updateDbMod: state.updateDbMod,
      deleteDbMod: state.deleteDbMod,
    })),
  );
  const modState = useModStore(
    useShallow((state): UseLiteChatLogicReturn["modState"] => ({
      dbMods: state.dbMods,
      loadedMods: state.loadedMods,
      modSettingsTabs: state.modSettingsTabs,
      modPromptActions: state.modPromptActions,
      modMessageActions: state.modMessageActions,
    })),
  );

  // --- Memoized Callbacks ---
  const clearAllData = useCallback(async () => {
    if (
      window.confirm(
        `🚨 ARE YOU ABSOLUTELY SURE? 🚨

This will permanently delete ALL conversations, messages, and stored API keys from your browser. This action cannot be undone.`,
      )
    ) {
      if (
        window.confirm(
          `SECOND CONFIRMATION:

Really delete everything? Consider exporting first.`,
        )
      ) {
        try {
          await Promise.all([
            db.projects.clear(),
            db.conversations.clear(),
            db.messages.clear(),
            db.apiKeys.clear(),
            db.mods.clear(),
            db.providerConfigs.clear(),
          ]);
          toast.success("All local data cleared. Reloading the application...");
          setTimeout(() => window.location.reload(), 1500);
        } catch (error: unknown) {
          console.error("Failed to clear all data:", error);
          const message =
            error instanceof Error ? error.message : "Unknown error";
          toast.error(`Failed to clear data: ${message}`);
        }
      }
    }
  }, []);

  const getAllAvailableModelDefs = useCallback(
    (providerConfigId: string) => {
      const config = providerState.dbProviderConfigs.find(
        (p) => p.id === providerConfigId,
      );
      return config?.fetchedModels || [];
    },
    [providerState.dbProviderConfigs],
  );

  // --- Derived State ---
  const getApiKeyForProvider = useCallback(
    (providerId: string): string | undefined => {
      const config = providerState.dbProviderConfigs.find(
        (p) => p.id === providerId,
      );
      if (!config || !config.apiKeyId) return undefined;
      return providerState.apiKeys.find((k) => k.id === config.apiKeyId)?.value;
    },
    [providerState.dbProviderConfigs, providerState.apiKeys],
  );

  const selectedProvider = useMemo((): AiProviderConfig | undefined => {
    const config = providerState.dbProviderConfigs.find(
      (p) => p.id === providerState.selectedProviderId,
    );
    if (!config) return undefined;
    return {
      id: config.id,
      name: config.name,
      type: config.type,
      models: [],
      allAvailableModels: config.fetchedModels || [],
    };
  }, [providerState.selectedProviderId, providerState.dbProviderConfigs]);

  const selectedModel = useMemo((): AiModelConfig | undefined => {
    if (!providerState.selectedProviderId || !providerState.selectedModelId)
      return undefined;
    const config = providerState.dbProviderConfigs.find(
      (p) => p.id === providerState.selectedProviderId,
    );
    if (!config) return undefined;
    const modelInfo = (config.fetchedModels ?? []).find(
      (m: { id: string }) => m.id === providerState.selectedModelId,
    );
    if (!modelInfo) return undefined;

    let modelInstance: any = null;
    const currentApiKey = getApiKeyForProvider(config.id);

    try {
      switch (config.type) {
        case "openai":
          modelInstance = createOpenAI({ apiKey: currentApiKey })(modelInfo.id);
          break;
        case "google":
          modelInstance = createGoogleGenerativeAI({ apiKey: currentApiKey })(
            modelInfo.id,
          );
          break;
        case "openrouter":
          modelInstance = createOpenRouter({ apiKey: currentApiKey })(
            modelInfo.id,
          );
          break;
        case "ollama":
          modelInstance = createOllama({
            baseURL: config.baseURL ?? undefined,
          })(modelInfo.id);
          break;
        case "openai-compatible":
          if (!config.baseURL) {
            throw new Error("Base URL required for openai-compatible");
          }
          modelInstance = createOpenAICompatible({
            baseURL: config.baseURL,
            apiKey: currentApiKey,
            name: config.name || "Custom API",
          })(modelInfo.id);
          break;
        default:
          throw new Error(`Unsupported provider type: ${config.type}`);
      }
    } catch (e) {
      console.error(
        `Failed to instantiate model ${modelInfo.id} for provider ${config.name}:`,
        e,
      );
    }

    const supportsImageGen = config.type === "openai";
    const supportsTools = ["openai", "google", "openrouter"].includes(
      config.type,
    );

    return {
      id: modelInfo.id,
      name: modelInfo.name,
      instance: modelInstance,
      supportsImageGeneration: supportsImageGen,
      supportsToolCalling: supportsTools,
    };
  }, [
    providerState.selectedProviderId,
    providerState.selectedModelId,
    providerState.dbProviderConfigs,
    getApiKeyForProvider,
  ]);

  const getContextSnapshotForMod =
    useCallback((): ReadonlyChatContextSnapshot => {
      const currentCore = useCoreChatStore.getState();
      const currentSettings = useSettingsStore.getState();
      const currentDbConversations = dbConversations;
      const currentSelectedItemId = useSidebarStore.getState().selectedItemId;
      const currentSelectedItemType =
        useSidebarStore.getState().selectedItemType;
      const currentVfs = useVfsStore.getState();
      const currentProvider = useProviderStore.getState();

      let activeSystemPrompt: string | null = null;
      if (currentSettings.enableAdvancedSettings) {
        if (currentSelectedItemType === "conversation") {
          const convo = currentDbConversations.find(
            (c: DbConversation) => c.id === currentSelectedItemId,
          );
          if (convo?.systemPrompt && convo.systemPrompt.trim() !== "") {
            activeSystemPrompt = convo.systemPrompt;
          }
        }
        if (
          !activeSystemPrompt &&
          currentSettings.globalSystemPrompt &&
          currentSettings.globalSystemPrompt.trim() !== ""
        ) {
          activeSystemPrompt = currentSettings.globalSystemPrompt;
        }
      }

      const getApiKeyFunc = (id: string): string | undefined => {
        const config = currentProvider.dbProviderConfigs.find(
          (p) => p.id === id,
        );
        if (!config || !config.apiKeyId) return undefined;
        return currentProvider.apiKeys.find((k) => k.id === config.apiKeyId)
          ?.value;
      };

      return Object.freeze({
        selectedItemId: currentSelectedItemId,
        selectedItemType: currentSelectedItemType,
        messages: currentCore.messages,
        isStreaming: currentCore.isStreaming,
        selectedProviderId: currentProvider.selectedProviderId,
        selectedModelId: currentProvider.selectedModelId,
        activeSystemPrompt: activeSystemPrompt,
        temperature: currentSettings.temperature,
        maxTokens: currentSettings.maxTokens,
        theme: currentSettings.theme,
        isVfsEnabledForItem: currentVfs.isVfsEnabledForItem,
        getApiKeyForProvider: getApiKeyFunc,
      });
    }, [dbConversations]);

  const abortControllerRef = useRef<AbortController | null>(null);

  // --- AI Interaction Hook ---
  const { performAiStream, performImageGeneration } = useAiInteraction({
    selectedModel,
    selectedProvider,
    getApiKeyForProvider: useCallback(
      () => getApiKeyForProvider(providerState.selectedProviderId!),
      [getApiKeyForProvider, providerState.selectedProviderId],
    ),
    streamingRefreshRateMs: settingsState.streamingRefreshRateMs,
    addMessage: coreAddMessage,
    updateMessage: coreUpdateMessage,
    setIsAiStreaming: setCoreIsStreaming,
    setError: setCoreError,
    addDbMessage: addCoreDbMessage,
    abortControllerRef,
    getContextSnapshotForMod,
    bulkAddMessages: bulkCoreAddMessages,
  });

  // --- Interaction Handlers ---
  const handleFormSubmit = useCallback(
    async (
      promptValue: string,
      _files: File[], // _files is unused
      _vfsPaths: string[], // _vfsPaths is unused
      context: any,
    ) => {
      const commandMatch = promptValue.match(/^\/(\w+)\s*(.*)/s);
      const isWorkflowCommand =
        commandMatch &&
        ["race", "sequence", "parallel"].includes(commandMatch[1]);
      const isImageCommand = promptValue.startsWith("/imagine ");

      if (isWorkflowCommand) {
        const fullCommand = promptValue;
        if (!context.selectedItemId) {
          toast.error("Cannot start workflow: No conversation selected.");
          return;
        }
        try {
          const getApiKeyFunc = (id: string): string | undefined => {
            const config = providerState.dbProviderConfigs.find(
              (p) => p.id === id,
            );
            if (!config || !config.apiKeyId) return undefined;
            return providerState.apiKeys.find((k) => k.id === config.apiKeyId)
              ?.value;
          };
          const getProviderFunc = (
            id: string,
          ): AiProviderConfig | undefined => {
            const config = providerState.dbProviderConfigs.find(
              (p) => p.id === id,
            );
            if (!config) return undefined;
            return {
              id: config.id,
              name: config.name,
              type: config.type,
              models: [],
              allAvailableModels: config.fetchedModels || [],
            };
          };
          const getModelFunc = (
            provId: string,
            modId: string,
          ): AiModelConfig | undefined => {
            const config = providerState.dbProviderConfigs.find(
              (p) => p.id === provId,
            );
            if (!config) return undefined;
            const modelInfo = (config.fetchedModels ?? []).find(
              (m: { id: string }) => m.id === modId,
            );
            if (!modelInfo) return undefined;
            let modelInstance: any = null;
            const currentApiKey = getApiKeyFunc(config.id);
            try {
              switch (config.type) {
                case "openai":
                  modelInstance = createOpenAI({ apiKey: currentApiKey })(
                    modelInfo.id,
                  );
                  break;
                case "google":
                  modelInstance = createGoogleGenerativeAI({
                    apiKey: currentApiKey,
                  })(modelInfo.id);
                  break;
                case "openrouter":
                  modelInstance = createOpenRouter({ apiKey: currentApiKey })(
                    modelInfo.id,
                  );
                  break;
                case "ollama":
                  modelInstance = createOllama({
                    baseURL: config.baseURL ?? undefined,
                  })(modelInfo.id);
                  break;
                case "openai-compatible":
                  if (!config.baseURL) throw new Error("Base URL required");
                  modelInstance = createOpenAICompatible({
                    baseURL: config.baseURL,
                    apiKey: currentApiKey,
                    name: config.name || "Custom API",
                  })(modelInfo.id);
                  break;
                default:
                  throw new Error(`Unsupported provider type: ${config.type}`);
              }
            } catch (e) {
              console.error(`Failed to instantiate model ${modelInfo.id}:`, e);
            }
            const supportsImageGen = config.type === "openai";
            const supportsTools = ["openai", "google", "openrouter"].includes(
              config.type,
            );
            return {
              id: modelInfo.id,
              name: modelInfo.name,
              instance: modelInstance,
              supportsImageGeneration: supportsImageGen,
              supportsToolCalling: supportsTools,
            };
          };
          await coreStartWorkflowCore(
            context.selectedItemId,
            fullCommand,
            getApiKeyFunc,
            getProviderFunc,
            getModelFunc,
          );
          clearAllInput(); // Clear input state after starting workflow
        } catch (err) {
          console.error("Error starting workflow:", err);
        }
      } else if (isImageCommand) {
        try {
          const imagePrompt = context.contentToSendToAI
            .substring("/imagine ".length)
            .trim();
          await coreHandleImageGenerationCore(
            context.selectedItemId!,
            imagePrompt,
          );
          await performImageGeneration({
            conversationIdToUse: context.selectedItemId!,
            prompt: imagePrompt,
          });
          clearAllInput(); // Clear input state after image generation
        } catch (err) {
          console.error("Error in image generation flow:", err);
        }
      } else {
        try {
          await coreHandleSubmitCore(
            context.selectedItemId!,
            context.contentToSendToAI,
            context.vfsContextPaths,
          );
          const settings = useSettingsStore.getState();
          const activeSystemPrompt =
            getContextSnapshotForMod().activeSystemPrompt;
          const messagesForApi = convertDbMessagesToCoreMessages(
            useCoreChatStore.getState().messages,
          );
          await performAiStream({
            conversationIdToUse: context.selectedItemId!,
            messagesToSend: messagesForApi,
            currentTemperature: settings.temperature,
            currentMaxTokens: settings.maxTokens,
            currentTopP: settings.topP,
            currentTopK: settings.topK,
            currentPresencePenalty: settings.presencePenalty,
            currentFrequencyPenalty: settings.frequencyPenalty,
            systemPromptToUse: activeSystemPrompt,
          });
          clearAllInput(); // Clear input state after regular submission
        } catch (err) {
          console.error("Error during form submission flow:", err);
        }
      }
    },
    [
      coreHandleSubmitCore,
      performAiStream,
      getContextSnapshotForMod,
      coreStartWorkflowCore,
      coreHandleImageGenerationCore,
      performImageGeneration,
      providerState.dbProviderConfigs,
      providerState.apiKeys,
      clearAllInput, // Use the action from input store
    ],
  );

  const handleImageGenerationWrapper = useCallback(
    async (promptValue: string) => {
      const currentSelectedItemId = useSidebarStore.getState().selectedItemId;
      const currentSelectedItemType =
        useSidebarStore.getState().selectedItemType;

      if (
        !currentSelectedItemId ||
        currentSelectedItemType !== "conversation"
      ) {
        toast.error("No active conversation selected.");
        return;
      }
      try {
        await coreHandleImageGenerationCore(currentSelectedItemId, promptValue);
        await performImageGeneration({
          conversationIdToUse: currentSelectedItemId,
          prompt: promptValue,
        });
        // clearAllInput(); // Optionally clear input here too
      } catch (err) {
        console.error("Error in handleImageGenerationWrapper:", err);
      }
    },
    [coreHandleImageGenerationCore, performImageGeneration /*, clearAllInput*/],
  );

  const stopStreaming = useCallback(
    (parentMessageId: string | null = null) => {
      const activeWorkflows = useCoreChatStore.getState().activeWorkflows;
      const targetParentId =
        parentMessageId ?? [...activeWorkflows.keys()].pop();

      if (targetParentId && activeWorkflows.has(targetParentId)) {
        coreStopStreamingCore(targetParentId);
      } else {
        coreStopStreamingCore();
      }

      setTimeout(() => {
        if (
          !useCoreChatStore.getState().isStreaming &&
          abortControllerRef.current
        ) {
          console.log("[useLiteChatLogic] Clearing global abort ref.");
          abortControllerRef.current = null;
        }
      }, 0);
    },
    [coreStopStreamingCore],
  );

  const regenerateMessage = useCallback(
    async (messageId: string) => {
      try {
        const originalMessage = await db.messages.get(messageId);
        if (!originalMessage) {
          toast.error("Cannot regenerate: Original message not found in DB.");
          return;
        }
        const conversationId = originalMessage.conversationId;

        await coreRegenerateMessageCore(messageId);
        const currentMessages = useCoreChatStore.getState().messages;

        if (originalMessage.workflow) {
          toast.info("Re-running workflow...");
          const originalCommand = originalMessage.content as string;
          const getApiKeyFunc = (id: string): string | undefined =>
            getApiKeyForProvider(id);
          const getProviderFunc = (
            id: string,
          ): AiProviderConfig | undefined => {
            const config = providerState.dbProviderConfigs.find(
              (p) => p.id === id,
            );
            if (!config) return undefined;
            return {
              id: config.id,
              name: config.name,
              type: config.type,
              models: [],
              allAvailableModels: config.fetchedModels || [],
            };
          };
          const getModelFunc = (
            provId: string,
            modId: string,
          ): AiModelConfig | undefined => {
            const config = providerState.dbProviderConfigs.find(
              (p) => p.id === provId,
            );
            if (!config) return undefined;
            const modelInfo = (config.fetchedModels ?? []).find(
              (m: { id: string }) => m.id === modId,
            );
            if (!modelInfo) return undefined;
            let modelInstance: any = null;
            const currentApiKey = getApiKeyFunc(config.id);
            try {
              switch (config.type) {
                case "openai":
                  modelInstance = createOpenAI({ apiKey: currentApiKey })(
                    modelInfo.id,
                  );
                  break;
                case "google":
                  modelInstance = createGoogleGenerativeAI({
                    apiKey: currentApiKey,
                  })(modelInfo.id);
                  break;
                case "openrouter":
                  modelInstance = createOpenRouter({ apiKey: currentApiKey })(
                    modelInfo.id,
                  );
                  break;
                case "ollama":
                  modelInstance = createOllama({
                    baseURL: config.baseURL ?? undefined,
                  })(modelInfo.id);
                  break;
                case "openai-compatible":
                  if (!config.baseURL) throw new Error("Base URL required");
                  modelInstance = createOpenAICompatible({
                    baseURL: config.baseURL,
                    apiKey: currentApiKey,
                    name: config.name || "Custom API",
                  })(modelInfo.id);
                  break;
                default:
                  throw new Error(`Unsupported provider type: ${config.type}`);
              }
            } catch (e) {
              console.error(`Failed to instantiate model ${modelInfo.id}:`, e);
            }
            const supportsImageGen = config.type === "openai";
            const supportsTools = ["openai", "google", "openrouter"].includes(
              config.type,
            );
            return {
              id: modelInfo.id,
              name: modelInfo.name,
              instance: modelInstance,
              supportsImageGeneration: supportsImageGen,
              supportsToolCalling: supportsTools,
            };
          };
          await coreStartWorkflowCore(
            conversationId,
            originalCommand,
            getApiKeyFunc,
            getProviderFunc,
            getModelFunc,
          );
        } else if (
          originalMessage.role === "user" &&
          typeof originalMessage.content === "string" &&
          originalMessage.content.startsWith("/imagine ")
        ) {
          toast.warning(
            "Regenerating user image prompts not typical. Regenerate the assistant response instead.",
          );
        } else if (originalMessage.role === "assistant") {
          let precedingUserMessage: Message | undefined;
          const msgIndex = currentMessages.findIndex(
            (m) => m.createdAt! < originalMessage.createdAt!,
          );
          for (let i = msgIndex; i >= 0; i--) {
            if (currentMessages[i]?.role === "user") {
              precedingUserMessage = currentMessages[i];
              break;
            }
          }
          if (
            precedingUserMessage &&
            typeof precedingUserMessage.content === "string" &&
            precedingUserMessage.content.startsWith("/imagine ")
          ) {
            const imagePrompt = precedingUserMessage.content
              .substring("/imagine ".length)
              .trim();
            await performImageGeneration({
              conversationIdToUse: conversationId,
              prompt: imagePrompt,
            });
          } else {
            const historyForApi =
              convertDbMessagesToCoreMessages(currentMessages);
            const settings = useSettingsStore.getState();
            const activeSystemPrompt =
              getContextSnapshotForMod().activeSystemPrompt;
            await performAiStream({
              conversationIdToUse: conversationId,
              messagesToSend: historyForApi,
              currentTemperature: settings.temperature,
              currentMaxTokens: settings.maxTokens,
              currentTopP: settings.topP,
              currentTopK: settings.topK,
              currentPresencePenalty: settings.presencePenalty,
              currentFrequencyPenalty: settings.frequencyPenalty,
              systemPromptToUse: activeSystemPrompt,
            });
          }
        } else {
          toast.error("Cannot regenerate this message type.");
        }
      } catch (err) {
        console.error("Error during regeneration flow:", err);
      }
    },
    [
      coreRegenerateMessageCore,
      coreStartWorkflowCore,
      performAiStream,
      performImageGeneration,
      getContextSnapshotForMod,
      getApiKeyForProvider,
      providerState.dbProviderConfigs,
      providerState.apiKeys,
    ],
  );

  const activeConversationData = useMemo(() => {
    if (selectedItemType === "conversation" && selectedItemId) {
      return (
        dbConversations.find((c: DbConversation) => c.id === selectedItemId) ||
        null
      );
    }
    return null;
  }, [selectedItemId, selectedItemType, dbConversations]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.document?.documentElement) {
      return;
    }
    if (import.meta.env.VITEST) {
      return;
    }
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");
    let effectiveTheme = settingsState.theme;
    if (settingsState.theme === "system") {
      effectiveTheme =
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
    }
    root.classList.add(effectiveTheme);
  }, [settingsState.theme]);

  // --- Return all state, actions, derived data, and callbacks ---
  return {
    // Input State/Actions from useInputStore
    promptInputValue,
    setPromptInputValue,
    attachedFiles,
    addAttachedFile,
    removeAttachedFile,
    clearAttachedFiles,
    selectedVfsPaths,
    addSelectedVfsPath,
    removeSelectedVfsPath,
    clearSelectedVfsPaths,
    clearAllInput,

    // Store State & Actions
    sidebarActions,
    coreChatActions,
    vfsActions,
    providerActions,
    settingsActions,
    modActions,
    // Selection State
    selectedItemId,
    selectedItemType,
    enableSidebar,
    // Other store states
    vfsState,
    providerState,
    settingsState,
    modState,
    // Callbacks
    clearAllData,
    getAllAvailableModelDefs,
    handleFormSubmit,
    handleImageGenerationWrapper,
    stopStreaming,
    regenerateMessage,
    getContextSnapshotForMod,
    // Derived State
    activeConversationData,
    selectedProvider,
    selectedModel,
    getApiKeyForProvider,
  };
}
