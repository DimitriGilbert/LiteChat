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
// REMOVED: useChatStorage import (Live data selected directly in LiteChatInner)
import type {
  SidebarItemType,
  // REMOVED: DbProject import
  DbConversation,
  AiProviderConfig,
  AiModelConfig,
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

interface UseLiteChatLogicProps {
  editingItemId: string | null;
  setEditingItemId: (id: string | null) => void;
  onEditComplete: (id: string) => void;
  // Pass live data needed for derivations
  dbConversations: DbConversation[];
}

// Define the return type, excluding live data and volatile core state
interface UseLiteChatLogicReturn {
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
    | "setIsStreaming"
    | "setError"
    | "addDbMessage"
    | "bulkAddMessages"
    | "handleSubmitCore"
    | "handleImageGenerationCore"
    | "stopStreamingCore"
    | "regenerateMessageCore"
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
  >;
  modActions: Pick<ModActions, "addDbMod" | "updateDbMod" | "deleteDbMod">;
  // Selection State (Stable)
  selectedItemId: string | null;
  selectedItemType: SidebarItemType | null;
  enableSidebar: boolean;
  // Other store states (non-volatile)
  vfsState: Pick<
    VfsState,
    | "selectedVfsPaths"
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
    | "streamingThrottleRate"
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
  stopStreaming: () => void;
  regenerateMessage: (messageId: string) => Promise<void>;
  getContextSnapshotForMod: () => ReadonlyChatContextSnapshot;
  // Derived State
  activeConversationData: DbConversation | null;
  selectedProvider: AiProviderConfig | undefined;
  selectedModel: AiModelConfig | undefined;
  getApiKeyForProvider: (providerId: string) => string | undefined;
}

type FetchStatus = "idle" | "fetching" | "error" | "success";

// Apply the explicit return type here
export function useLiteChatLogic(
  props: UseLiteChatLogicProps,
): UseLiteChatLogicReturn {
  const {
    editingItemId,
    setEditingItemId,
    onEditComplete,
    dbConversations, // Receive live conversations needed for derivation
  } = props;

  // --- Select State/Actions from Stores ---

  // Sidebar state and actions (generally stable or less frequent updates)
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

  // Core Chat Actions (stable references)
  const {
    setMessages: setCoreMessages,
    setIsStreaming: setCoreIsStreaming,
    setError: setCoreError,
    addDbMessage: addCoreDbMessage,
    bulkAddMessages: bulkCoreAddMessages,
    handleSubmitCore: coreHandleSubmitCore,
    handleImageGenerationCore: coreHandleImageGenerationCore,
    stopStreamingCore: coreStopStreamingCore,
    regenerateMessageCore: coreRegenerateMessageCore,
  } = useCoreChatStore();

  const coreChatActions: UseLiteChatLogicReturn["coreChatActions"] = {
    setMessages: setCoreMessages,
    setIsStreaming: setCoreIsStreaming,
    setError: setCoreError,
    addDbMessage: addCoreDbMessage,
    bulkAddMessages: bulkCoreAddMessages,
    handleSubmitCore: coreHandleSubmitCore,
    handleImageGenerationCore: coreHandleImageGenerationCore,
    stopStreamingCore: coreStopStreamingCore,
    regenerateMessageCore: coreRegenerateMessageCore,
  };

  // VFS state and actions (less frequent updates)
  const vfsActions = useVfsStore(
    useShallow((state): UseLiteChatLogicReturn["vfsActions"] => ({
      clearSelectedVfsPaths: state.clearSelectedVfsPaths,
      removeSelectedVfsPath: state.removeSelectedVfsPath,
    })),
  );
  const vfsState = useVfsStore(
    useShallow((state): UseLiteChatLogicReturn["vfsState"] => ({
      selectedVfsPaths: state.selectedVfsPaths,
      isVfsEnabledForItem: state.isVfsEnabledForItem,
      isVfsReady: state.isVfsReady,
      isVfsLoading: state.isVfsLoading,
      vfsError: state.vfsError,
      vfsKey: state.vfsKey,
    })),
  );

  // Provider state and actions (less frequent updates)
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

  // Settings state and actions (less frequent updates)
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
      streamingThrottleRate: state.streamingThrottleRate,
      isSettingsModalOpen: state.isSettingsModalOpen,
    })),
  );

  // Mod state and actions (less frequent updates)
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
      // Select volatile state directly here for the snapshot
      const currentCore = useCoreChatStore.getState();
      const currentSettings = useSettingsStore.getState();
      // Use live data passed into the hook for snapshot consistency
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
        messages: currentCore.messages, // Include volatile state in snapshot
        isStreaming: currentCore.isStreaming, // Include volatile state in snapshot
        selectedProviderId: currentProvider.selectedProviderId,
        selectedModelId: currentProvider.selectedModelId,
        activeSystemPrompt: activeSystemPrompt,
        temperature: currentSettings.temperature,
        maxTokens: currentSettings.maxTokens,
        theme: currentSettings.theme,
        isVfsEnabledForItem: currentVfs.isVfsEnabledForItem,
        getApiKeyForProvider: getApiKeyFunc,
      });
    }, [dbConversations]); // Depend on live data passed in

  const abortControllerRef = useRef<AbortController | null>(null);

  const { performAiStream, performImageGeneration } = useAiInteraction({
    selectedModel,
    selectedProvider,
    getApiKeyForProvider: useCallback(
      () => getApiKeyForProvider(providerState.selectedProviderId!),
      [getApiKeyForProvider, providerState.selectedProviderId],
    ),
    streamingThrottleRate: settingsState.streamingThrottleRate,
    setLocalMessages: setCoreMessages,
    setIsAiStreaming: setCoreIsStreaming,
    setError: setCoreError,
    addDbMessage: addCoreDbMessage,
    abortControllerRef,
    getContextSnapshotForMod,
    bulkAddMessages: bulkCoreAddMessages,
  });

  // --- Interaction Handlers ---
  const handleFormSubmit = useCallback(
    async (prompt: string, files: File[], vfsPaths: string[], context: any) => {
      try {
        // Call the core action to save the user message first
        await coreHandleSubmitCore(
          context.selectedItemId!,
          context.contentToSendToAI,
          context.vfsContextPaths,
        );
        // Now, trigger the AI interaction using the hook's function
        const settings = useSettingsStore.getState();
        const activeSystemPrompt =
          getContextSnapshotForMod().activeSystemPrompt;
        // Get the *current* messages from the store *after* user message was added
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
      } catch (err) {
        // Error handling is done within coreHandleSubmitCore and performAiStream
        console.error("Error during form submission flow:", err);
      }
    },
    [coreHandleSubmitCore, performAiStream, getContextSnapshotForMod],
  );

  const handleImageGenerationWrapper = useCallback(
    async (prompt: string) => {
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
        // Call core action to save user message
        await coreHandleImageGenerationCore(currentSelectedItemId, prompt);
        // Trigger AI interaction
        await performImageGeneration({
          conversationIdToUse: currentSelectedItemId,
          prompt: prompt,
        });
      } catch (err) {
        // Error handling within core action and performImageGeneration
        console.error("Error in handleImageGenerationWrapper:", err);
      }
    },
    [coreHandleImageGenerationCore, performImageGeneration],
  );

  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    // Call the core action to update state
    coreStopStreamingCore();
  }, [coreStopStreamingCore]);

  const regenerateMessage = useCallback(
    async (messageId: string) => {
      try {
        // Call core action to prepare state (delete old message)
        await coreRegenerateMessageCore(messageId);

        // Get necessary info AFTER core action has updated the state
        const originalMessages = useCoreChatStore.getState().messages; // Get current messages
        const messageIndex = originalMessages.length; // The index where the new message will go
        if (messageIndex <= 0) return; // Should not happen if coreRegenerateMessageCore worked

        let precedingUserMessageIndex = -1;
        for (let i = messageIndex - 1; i >= 0; i--) {
          if (originalMessages[i].role === "user") {
            precedingUserMessageIndex = i;
            break;
          }
        }
        if (precedingUserMessageIndex === -1) return;

        const precedingUserMessage =
          originalMessages[precedingUserMessageIndex];
        const conversationId = precedingUserMessage.conversationId;
        if (!conversationId) return;

        // Determine if it was an image or text generation
        if (
          typeof precedingUserMessage.content === "string" &&
          precedingUserMessage.content.startsWith("/imagine ")
        ) {
          const imagePrompt = precedingUserMessage.content
            .substring("/imagine ".length)
            .trim();
          if (imagePrompt) {
            await performImageGeneration({
              conversationIdToUse: conversationId,
              prompt: imagePrompt,
            });
          } else {
            setCoreError("Cannot regenerate: Invalid image prompt found.");
            toast.error("Cannot regenerate: Invalid image prompt found.");
          }
        } else {
          // Text generation
          const historyForApi = convertDbMessagesToCoreMessages(
            originalMessages.slice(0, precedingUserMessageIndex + 1),
          );
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
      } catch (err) {
        // Errors handled within core action and perform* functions
        console.error("Error during regeneration flow:", err);
      }
    },
    [
      coreRegenerateMessageCore,
      setCoreError, // Keep direct access to setError if needed
      performAiStream,
      performImageGeneration,
      getContextSnapshotForMod,
    ],
  );

  // --- Derived State (Active Conversation Data) ---
  // Use the dbConversations passed into the hook
  const activeConversationData = useMemo(() => {
    if (selectedItemType === "conversation" && selectedItemId) {
      return (
        dbConversations.find((c: DbConversation) => c.id === selectedItemId) ||
        null
      );
    }
    return null;
  }, [selectedItemId, selectedItemType, dbConversations]); // Depend on live data passed in

  // --- Apply Theme Effect ---
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
  // Exclude live data from the return object
  return {
    // State & Actions
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
    // Other store states (non-volatile)
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
