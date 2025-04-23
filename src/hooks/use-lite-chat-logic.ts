// src/hooks/use-lite-chat-logic.ts

import { useMemo, useCallback } from "react";
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
  DbProviderConfig,
  DbApiKey,
  DbProject, // Import DbProject
} from "@/lib/types";
import type { ReadonlyChatContextSnapshot } from "@/mods/api";
import { db } from "@/lib/db";
import { useAiInteraction } from "@/hooks/ai-interaction";
import { useChatStorage } from "./use-chat-storage";
import { useDerivedChatState } from "./use-derived-chat-state"; // Import new hook
import { useChatInteractions } from "./use-chat-interactions"; // Import new hook

interface UseLiteChatLogicProps {
  editingItemId: string | null;
  setEditingItemId: (id: string | null) => void;
  onEditComplete: (id: string) => void;
  dbConversations: DbConversation[];
  dbProjects: DbProject[]; // Add dbProjects prop
}

// Keep the return type the same for external compatibility
interface UseLiteChatLogicReturn {
  // Input State & Actions
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
  // State and Actions from Stores (Grouped)
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
  // Selection State
  selectedItemId: string | null;
  selectedItemType: SidebarItemType | null;
  enableSidebar: boolean;
  // Other store states
  vfsState: Pick<
    VfsState,
    | "isVfsEnabledForItem"
    | "isVfsReady"
    | "isVfsLoading"
    | "vfsError"
    | "vfsKey"
  >;
  providerState: ProviderState & {
    dbProviderConfigs: DbProviderConfig[];
    apiKeys: DbApiKey[];
  };
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
  // Interaction Handlers (from useChatInteractions)
  handleFormSubmit: (
    prompt: string,
    files: File[],
    vfsPaths: string[],
    context: any,
  ) => Promise<void>;
  handleImageGenerationWrapper: (prompt: string) => Promise<void>;
  stopStreaming: (parentMessageId?: string | null) => void;
  regenerateMessage: (messageId: string) => Promise<void>;
  // Utility Callbacks
  clearAllData: () => Promise<void>;
  getAllAvailableModelDefs: (
    providerConfigId: string,
  ) => { id: string; name: string }[];
  getContextSnapshotForMod: () => ReadonlyChatContextSnapshot;
  // Derived State (from useDerivedChatState)
  activeConversationData: DbConversation | null;
  selectedProvider: AiProviderConfig | undefined;
  selectedModel: AiModelConfig | undefined;
  getApiKeyForProvider: (providerId: string) => string | undefined;
}

export function useLiteChatLogic(
  props: UseLiteChatLogicProps,
): UseLiteChatLogicReturn {
  const { dbConversations, dbProjects } = props; // Destructure dbProjects
  const storage = useChatStorage();

  // --- Get Input State/Actions ---
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

  // --- Select State/Actions from Stores (Keep this aggregation) ---
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

  const coreChatActions = useCoreChatStore(
    useShallow((state): UseLiteChatLogicReturn["coreChatActions"] => ({
      setMessages: state.setMessages,
      addMessage: state.addMessage,
      updateMessage: state.updateMessage,
      setIsStreaming: state.setIsStreaming,
      setError: state.setError,
      addDbMessage: state.addDbMessage,
      bulkAddMessages: state.bulkAddMessages,
      handleSubmitCore: state.handleSubmitCore,
      handleImageGenerationCore: state.handleImageGenerationCore,
      stopStreamingCore: state.stopStreamingCore,
      regenerateMessageCore: state.regenerateMessageCore,
      startWorkflowCore: state.startWorkflowCore,
      finalizeWorkflowTask: state.finalizeWorkflowTask,
    })),
  );

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

  const {
    setSelectedProviderId: storeSetSelectedProviderId,
    setSelectedModelId: storeSetSelectedModelId,
    addDbProviderConfig: storeAddDbProviderConfig,
    updateDbProviderConfig: storeUpdateDbProviderConfig,
    deleteDbProviderConfig: storeDeleteDbProviderConfig,
    fetchModels: storeFetchModels,
    addApiKey: storeAddApiKey,
    deleteApiKey: storeDeleteApiKey,
  } = useProviderStore();

  const providerStateFromStore = useProviderStore(
    useShallow(
      (
        state,
      ): Omit<
        UseLiteChatLogicReturn["providerState"],
        "dbProviderConfigs" | "apiKeys"
      > => ({
        selectedProviderId: state.selectedProviderId,
        selectedModelId: state.selectedModelId,
        enableApiKeyManagement: state.enableApiKeyManagement,
        providerFetchStatus: state.providerFetchStatus,
      }),
    ),
  );

  const dbProviderConfigs = useMemo(
    () => storage.providerConfigs || [],
    [storage.providerConfigs],
  );
  const apiKeys = useMemo(() => storage.apiKeys || [], [storage.apiKeys]);

  const providerState: UseLiteChatLogicReturn["providerState"] = useMemo(
    () => ({
      ...providerStateFromStore,
      dbProviderConfigs,
      apiKeys,
    }),
    [providerStateFromStore, dbProviderConfigs, apiKeys],
  );

  const providerActions: UseLiteChatLogicReturn["providerActions"] = useMemo(
    () => ({
      setSelectedProviderId: (id) =>
        storeSetSelectedProviderId(id, dbProviderConfigs),
      setSelectedModelId: storeSetSelectedModelId,
      addDbProviderConfig: storeAddDbProviderConfig,
      updateDbProviderConfig: storeUpdateDbProviderConfig,
      deleteDbProviderConfig: storeDeleteDbProviderConfig,
      fetchModels: (id) => storeFetchModels(id, dbProviderConfigs, apiKeys),
      addApiKey: storeAddApiKey,
      deleteApiKey: storeDeleteApiKey,
    }),
    [
      storeSetSelectedProviderId,
      storeSetSelectedModelId,
      storeAddDbProviderConfig,
      storeUpdateDbProviderConfig,
      storeDeleteDbProviderConfig,
      storeFetchModels,
      storeAddApiKey,
      storeDeleteApiKey,
      dbProviderConfigs,
      apiKeys,
    ],
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

  // --- Context Snapshot (Remains Here) ---
  const getContextSnapshotForMod =
    useCallback((): ReadonlyChatContextSnapshot => {
      // Fetch current state from stores *inside* the callback
      const currentCore = useCoreChatStore.getState();
      const currentSettings = useSettingsStore.getState();
      const currentSidebar = useSidebarStore.getState();
      const currentVfs = useVfsStore.getState();
      const currentProviderState = useProviderStore.getState();
      // Use the already available db data
      const currentDbConversations = dbConversations;
      const currentDbConfigs = dbProviderConfigs;
      const currentApiKeys = apiKeys;

      let activeSystemPrompt: string | null = null;
      if (currentSettings.enableAdvancedSettings) {
        if (currentSidebar.selectedItemType === "conversation") {
          const convo = currentDbConversations.find(
            (c: DbConversation) => c.id === currentSidebar.selectedItemId,
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
        const config = currentDbConfigs.find((p) => p.id === id);
        if (!config || !config.apiKeyId) return undefined;
        return currentApiKeys.find((k) => k.id === config.apiKeyId)?.value;
      };

      return Object.freeze({
        selectedItemId: currentSidebar.selectedItemId,
        selectedItemType: currentSidebar.selectedItemType,
        messages: currentCore.messages,
        isStreaming: currentCore.isStreaming,
        selectedProviderId: currentProviderState.selectedProviderId,
        selectedModelId: currentProviderState.selectedModelId,
        activeSystemPrompt: activeSystemPrompt,
        temperature: currentSettings.temperature,
        maxTokens: currentSettings.maxTokens,
        theme: currentSettings.theme,
        isVfsEnabledForItem: currentVfs.isVfsEnabledForItem,
        getApiKeyForProvider: getApiKeyFunc,
      });
    }, [dbConversations, dbProviderConfigs, apiKeys]); // Dependencies are stable or memoized

  // --- Use Derived State Hook ---
  const {
    activeConversationData,
    // activeItemData, // Not directly exposed by useLiteChatLogic currently
    selectedProvider,
    selectedModel,
    getApiKeyForProvider,
  } = useDerivedChatState({
    selectedItemId,
    selectedItemType,
    dbConversations,
    dbProjects, // Pass dbProjects
    dbProviderConfigs,
    apiKeys,
    selectedProviderId: providerState.selectedProviderId,
    selectedModelId: providerState.selectedModelId,
  });

  // --- Use AI Interaction Hook ---
  const { performAiStream } = useAiInteraction({
    selectedModel,
    selectedProvider,
    getApiKeyForProvider: useCallback(
      () => getApiKeyForProvider(providerState.selectedProviderId!),
      [getApiKeyForProvider, providerState.selectedProviderId],
    ),
    streamingRefreshRateMs: settingsState.streamingRefreshRateMs,
    addMessage: coreChatActions.addMessage,
    updateMessage: coreChatActions.updateMessage,
    setIsAiStreaming: coreChatActions.setIsStreaming,
    setError: coreChatActions.setError,
    addDbMessage: coreChatActions.addDbMessage,
    getContextSnapshotForMod: getContextSnapshotForMod, // Pass function below
    bulkAddMessages: coreChatActions.bulkAddMessages,
  });

  // --- Use Chat Interactions Hook ---
  const {
    handleFormSubmit,
    handleImageGenerationWrapper,
    stopStreaming,
    regenerateMessage,
  } = useChatInteractions({
    selectedItemId,
    selectedItemType,
    dbProviderConfigs,
    coreChatActions,
    inputActions: { clearAllInput },
    performAiStream,
    getContextSnapshotForMod: getContextSnapshotForMod, // Pass function below
    getApiKeyForProvider,
  });

  // --- Utility Callbacks (Remain Here) ---
  const clearAllData = useCallback(async () => {
    // ... (implementation remains the same)
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
            db.appState.clear(),
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
      const config = dbProviderConfigs.find((p) => p.id === providerConfigId);
      return config?.fetchedModels || [];
    },
    [dbProviderConfigs],
  );

  // --- Return Structure (Matches Original) ---
  return {
    // Input State/Actions
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
    // Store Actions (Grouped)
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
    // Interaction Handlers (from new hook)
    handleFormSubmit,
    handleImageGenerationWrapper,
    stopStreaming,
    regenerateMessage,
    // Utility Callbacks
    clearAllData,
    getAllAvailableModelDefs,
    getContextSnapshotForMod,
    // Derived State (from new hook)
    activeConversationData,
    selectedProvider,
    selectedModel,
    getApiKeyForProvider,
  };
}
