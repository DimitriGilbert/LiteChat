// src/components/lite-chat/chat.tsx
import React, { useState, useMemo, useCallback, useRef } from "react";
// Corrected import: Use ChatProviderInner directly for setup
import ChatProviderInner from "@/context/chat-provider-inner";
import { ChatSide } from "./chat/chat-side";
import { ChatWrapper } from "./chat/chat-wrapper";
// Import ALL necessary store hooks
import { useSidebarStore } from "@/store/sidebar.store";
import { useCoreChatStore } from "@/store/core-chat.store";
import { useProviderStore } from "@/store/provider.store";
import { useSettingsStore } from "@/store/settings.store";
import { useVfsStore } from "@/store/vfs.store";
import { useModStore } from "@/store/mod.store";
import { useInputStore } from "@/store/input.store";
// Import useShallow for Zustand optimization
import { useShallow } from "zustand/react/shallow";
import type {
  SidebarItemType,
  LiteChatConfig,
  SidebarItem,
  DbProject,
  DbConversation,
  Message,
  MessageContent,
  DbProviderConfig,
  DbApiKey,
  CustomSettingTab,
  AiProviderConfig,
  AiModelConfig,
  CustomPromptAction,
} from "@/lib/types";
import type { DbMod, ModInstance } from "@/mods/types";
import { cn } from "@/lib/utils";
import { MenuIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ComponentType } from "react";
import { useAiInteraction } from "@/hooks/ai-interaction";
import { convertDbMessagesToCoreMessages } from "@/utils/chat-utils";
import { nanoid } from "nanoid";
import { toast } from "sonner";
import { modEvents, ModEvent } from "@/mods/events";
import { ReadonlyChatContextSnapshot } from "@/mods/api";
import { db } from "@/lib/db"; // Keep db import if needed for placeholders
import {
  EMPTY_CUSTOM_PROMPT_ACTIONS,
  EMPTY_CUSTOM_MESSAGE_ACTIONS,
  EMPTY_CUSTOM_SETTINGS_TABS,
} from "@/utils/chat-utils"; // Import defaults

// --- Prop Types for Children ---

// Define props for SettingsModal's tabs (passed down through ChatSide)
export interface SettingsModalTabProps {
  // General
  theme: "light" | "dark" | "system";
  setTheme: (theme: "light" | "dark" | "system") => void;
  // Providers
  dbProviderConfigs: DbProviderConfig[];
  apiKeys: DbApiKey[];
  addDbProviderConfig: (
    config: Omit<DbProviderConfig, "id" | "createdAt" | "updatedAt">,
  ) => Promise<string>;
  updateDbProviderConfig: (
    id: string,
    changes: Partial<DbProviderConfig>,
  ) => Promise<void>;
  deleteDbProviderConfig: (id: string) => Promise<void>;
  fetchModels: (providerConfigId: string) => Promise<void>;
  providerFetchStatus: Record<string, FetchStatus>;
  getAllAvailableModelDefs: (
    providerConfigId: string,
  ) => { id: string; name: string }[];
  // Assistant
  globalSystemPrompt: string | null;
  setGlobalSystemPrompt: (prompt: string | null) => void;
  // API Keys
  addApiKey: (
    name: string,
    providerId: string,
    value: string,
  ) => Promise<string>;
  deleteApiKey: (id: string) => Promise<void>;
  // Data Management
  importConversation: (file: File, parentId: string | null) => Promise<void>;
  exportAllConversations: () => Promise<void>;
  clearAllData: () => Promise<void>;
  // Mods
  dbMods: DbMod[];
  loadedMods: ModInstance[];
  addDbMod: (modData: Omit<DbMod, "id" | "createdAt">) => Promise<string>;
  updateDbMod: (id: string, changes: Partial<DbMod>) => Promise<void>;
  deleteDbMod: (id: string) => Promise<void>;
  // Flags
  enableAdvancedSettings: boolean;
  enableApiKeyManagement: boolean;
  // Custom Tabs
  customSettingsTabs: CustomSettingTab[];
}

// Renamed FetchStatus locally
type FetchStatus = "idle" | "fetching" | "error" | "success";

export interface ChatSideProps {
  className?: string;
  sidebarItems: SidebarItem[];
  editingItemId: string | null;
  selectedItemId: string | null;
  selectedItemType: SidebarItemType | null;
  onEditComplete: (id: string) => void;
  setEditingItemId: (id: string | null) => void;
  selectItem: (
    id: string | null,
    type: SidebarItemType | null,
  ) => Promise<void>;
  deleteItem: (id: string, type: SidebarItemType) => Promise<void>;
  renameItem: (
    id: string,
    newName: string,
    type: SidebarItemType,
  ) => Promise<void>;
  exportConversation: (conversationId: string | null) => Promise<void>;
  createConversation: (
    parentId: string | null,
    title?: string,
  ) => Promise<string>;
  createProject: (
    parentId: string | null,
    name?: string,
  ) => Promise<{ id: string; name: string }>;
  importConversation: (file: File, parentId: string | null) => Promise<void>;
  isSettingsModalOpen: boolean;
  setIsSettingsModalOpen: (isOpen: boolean) => void;
  settingsProps: SettingsModalTabProps;
}

// Updated ChatWrapperProps
export interface ChatWrapperProps {
  className?: string;
  selectedItemId: string | null;
  selectedItemType: SidebarItemType | null;
  sidebarItems: SidebarItem[];
  messages: Message[];
  isLoadingMessages: boolean;
  isStreaming: boolean;
  error: string | null;
  promptInputValue: string;
  attachedFiles: File[];
  selectedVfsPaths: string[];
  isVfsEnabledForItem: boolean;
  regenerateMessage: (messageId: string) => Promise<void>;
  setPromptInputValue: (value: string) => void;
  addAttachedFile: (file: File) => void;
  removeAttachedFile: (fileName: string) => void;
  clearPromptInput: () => void;
  handleSubmitCore: (
    currentConversationId: string,
    contentToSendToAI: MessageContent,
    vfsContextPaths?: string[],
  ) => Promise<void>;
  handleImageGenerationCore: (
    currentConversationId: string,
    prompt: string,
  ) => Promise<void>;
  clearSelectedVfsPaths: () => void;
  selectedProviderId: string | null;
  selectedModelId: string | null;
  dbProviderConfigs: DbProviderConfig[];
  apiKeys: DbApiKey[];
  enableApiKeyManagement: boolean;
  dbConversations: DbConversation[];
  createConversation: (
    parentId: string | null,
    title?: string,
  ) => Promise<string>;
  selectItem: (
    id: string | null,
    type: SidebarItemType | null,
  ) => Promise<void>;
  deleteItem: (id: string, type: SidebarItemType) => Promise<void>;
  updateDbProviderConfig: (
    id: string,
    changes: Partial<DbProviderConfig>,
  ) => Promise<void>;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  exportConversation: (conversationId: string | null) => Promise<void>;
  temperature: number;
  setTemperature: (temp: number) => void;
  topP: number | null;
  setTopP: (topP: number | null) => void;
  maxTokens: number | null;
  setMaxTokens: (tokens: number | null) => void;
  topK: number | null;
  setTopK: (topK: number | null) => void;
  frequencyPenalty: number | null;
  setFrequencyPenalty: (penalty: number | null) => void;
  presencePenalty: number | null;
  setPresencePenalty: (penalty: number | null) => void;
  globalSystemPrompt: string | null;
  activeConversationData: DbConversation | null;
  updateConversationSystemPrompt: (
    id: string,
    systemPrompt: string | null,
  ) => Promise<void>;
  isVfsReady: boolean;
  isVfsLoading: boolean;
  vfsError: string | null;
  vfsKey: string | null;
  enableAdvancedSettings: boolean;
  isSettingsModalOpen: boolean;
  setIsSettingsModalOpen: (isOpen: boolean) => void;
  setSelectedProviderId: (id: string | null) => void;
  setSelectedModelId: (id: string | null) => void;
  toggleVfsEnabledAction: (id: string, type: SidebarItemType) => Promise<void>;
  stopStreaming: () => void;
  customPromptActions: CustomPromptAction[];
  getContextSnapshotForMod: () => ReadonlyChatContextSnapshot; // Added
  selectedModel: AiModelConfig | undefined;
  setError: (error: string | null) => void;
  removeSelectedVfsPath: (path: string) => void;
}

// --- LiteChat (Top Level) ---
interface LiteChatProps {
  config?: LiteChatConfig;
  className?: string;
  SideComponent?: ComponentType<ChatSideProps>;
  WrapperComponent?: ComponentType<ChatWrapperProps>;
}

export const LiteChat: React.FC<LiteChatProps> = ({
  config = {},
  className,
  SideComponent = ChatSide,
  WrapperComponent = ChatWrapper,
}) => {
  const { defaultSidebarOpen = true } = config;
  const [sidebarOpen, setSidebarOpen] = useState(defaultSidebarOpen);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  const handleEditComplete = useCallback((id: string) => {
    setEditingItemId((currentEditingId) => {
      if (currentEditingId === id) {
        return null;
      }
      return currentEditingId;
    });
  }, []);

  const handleSetEditingItemId = useCallback((id: string | null) => {
    setEditingItemId(id);
  }, []);

  console.log("[LiteChat] Rendering");

  return (
    // Use ChatProviderInner directly and pass correct prop names
    <ChatProviderInner
      config={config}
      // REMOVED: userCustomPromptActions={config.customPromptActions ?? EMPTY_CUSTOM_PROMPT_ACTIONS}
      // REMOVED: userCustomMessageActions={config.customMessageActions ?? EMPTY_CUSTOM_MESSAGE_ACTIONS}
      // REMOVED: userCustomSettingsTabs={config.customSettingsTabs ?? EMPTY_CUSTOM_SETTINGS_TABS}
    >
      <LiteChatInner
        className={className}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        enableSidebarConfig={config.enableSidebar ?? true}
        SideComponent={SideComponent}
        WrapperComponent={WrapperComponent}
        editingItemId={editingItemId}
        setEditingItemId={handleSetEditingItemId}
        onEditComplete={handleEditComplete}
      />
    </ChatProviderInner>
  );
};

// --- LiteChatInner (Central State Access & Prop Drilling) ---
interface LiteChatInnerProps {
  className?: string;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  enableSidebarConfig: boolean;
  SideComponent: ComponentType<ChatSideProps>;
  WrapperComponent: ComponentType<ChatWrapperProps>;
  editingItemId: string | null;
  setEditingItemId: (id: string | null) => void;
  onEditComplete: (id: string) => void;
}

// Placeholder storage for deleteDbMessage if not in core store yet
// REMOVE THIS once deleteDbMessage is confirmed in useCoreChatStore
const storage = {
  deleteDbMessage: async (id: string) => {
    console.warn("Using placeholder deleteDbMessage for ID:", id);
    await db.messages.delete(id); // Example using Dexie directly
  },
};

const LiteChatInner: React.FC<LiteChatInnerProps> = ({
  className,
  sidebarOpen,
  setSidebarOpen,
  enableSidebarConfig,
  SideComponent,
  WrapperComponent,
  editingItemId,
  setEditingItemId,
  onEditComplete,
}) => {
  // --- Select ALL necessary state and actions from stores ---
  // Use useShallow for selectors returning objects to prevent unnecessary re-renders
  // Sidebar Store
  const {
    enableSidebar: enableSidebarStore,
    selectedItemId,
    selectedItemType,
    dbProjects,
    dbConversations,
    selectItem,
    createConversation,
    createProject,
    deleteItem,
    renameItem,
    exportConversation,
    importConversation,
    exportAllConversations,
    updateConversationSystemPrompt,
    toggleVfsEnabledAction,
  } = useSidebarStore(
    useShallow((state) => ({
      enableSidebar: state.enableSidebar,
      selectedItemId: state.selectedItemId,
      selectedItemType: state.selectedItemType,
      dbProjects: state.dbProjects,
      dbConversations: state.dbConversations,
      selectItem: state.selectItem,
      createConversation: state.createConversation,
      createProject: state.createProject,
      deleteItem: state.deleteItem,
      renameItem: state.renameItem,
      exportConversation: state.exportConversation,
      importConversation: state.importConversation,
      exportAllConversations: state.exportAllConversations,
      updateConversationSystemPrompt: state.updateConversationSystemPrompt,
      toggleVfsEnabledAction: state.toggleVfsEnabled,
    })),
  );

  // Core Chat Store
  const {
    messages,
    setMessages,
    isLoadingMessages,
    isStreaming,
    setIsAiStreaming,
    error,
    setError,
    addDbMessage,
    bulkAddMessages,
    addLocalMessage,
    removeMessage,
    deleteDbMessage = storage.deleteDbMessage,
    handleSubmitCore,
    handleImageGenerationCore,
  } = useCoreChatStore(
    useShallow((state) => ({
      messages: state.messages,
      setMessages: state.setMessages,
      isLoadingMessages: state.isLoadingMessages,
      isStreaming: state.isStreaming,
      setIsAiStreaming: state.setIsStreaming,
      error: state.error,
      setError: state.setError,
      addDbMessage: state.addDbMessage,
      bulkAddMessages: state.bulkAddMessages,
      addLocalMessage: state.addMessage,
      removeMessage: state.removeMessage,
      deleteDbMessage: (state as any).deleteDbMessage,
      handleSubmitCore: state.handleSubmitCore,
      handleImageGenerationCore: state.handleImageGenerationCore,
    })),
  );

  // Input Store
  const {
    promptInputValue,
    attachedFiles,
    setPromptInputValue,
    addAttachedFile,
    removeAttachedFile,
    clearPromptInput,
  } = useInputStore(
    useShallow((state) => ({
      promptInputValue: state.promptInputValue,
      attachedFiles: state.attachedFiles,
      setPromptInputValue: state.setPromptInputValue,
      addAttachedFile: state.addAttachedFile,
      removeAttachedFile: state.removeAttachedFile,
      clearPromptInput: state.clearPromptInput,
    })),
  );

  // VFS Store
  const {
    selectedVfsPaths,
    clearSelectedVfsPaths,
    isVfsEnabledForItem,
    isVfsReady,
    isVfsLoading,
    vfsError,
    vfsKey,
    removeSelectedVfsPath,
  } = useVfsStore(
    useShallow((state) => ({
      selectedVfsPaths: state.selectedVfsPaths,
      clearSelectedVfsPaths: state.clearSelectedVfsPaths,
      isVfsEnabledForItem: state.isVfsEnabledForItem,
      isVfsReady: state.isVfsReady,
      isVfsLoading: state.isVfsLoading,
      vfsError: state.vfsError,
      vfsKey: state.vfsKey,
      removeSelectedVfsPath: state.removeSelectedVfsPath,
    })),
  );

  // Provider Store
  const {
    selectedProviderId,
    setSelectedProviderId,
    selectedModelId,
    setSelectedModelId,
    dbProviderConfigs,
    apiKeys,
    enableApiKeyManagement,
    addDbProviderConfig,
    updateDbProviderConfig,
    deleteDbProviderConfig,
    fetchModels,
    providerFetchStatus,
    addApiKey,
    deleteApiKey,
  } = useProviderStore(
    useShallow((state) => ({
      selectedProviderId: state.selectedProviderId,
      setSelectedProviderId: state.setSelectedProviderId,
      selectedModelId: state.selectedModelId,
      setSelectedModelId: state.setSelectedModelId,
      dbProviderConfigs: state.dbProviderConfigs,
      apiKeys: state.apiKeys,
      enableApiKeyManagement: state.enableApiKeyManagement,
      addDbProviderConfig: state.addDbProviderConfig,
      updateDbProviderConfig: state.updateDbProviderConfig,
      deleteDbProviderConfig: state.deleteDbProviderConfig,
      fetchModels: state.fetchModels,
      providerFetchStatus: state.providerFetchStatus,
      addApiKey: state.addApiKey,
      deleteApiKey: state.deleteApiKey,
    })),
  );

  // Settings Store
  const {
    isSettingsModalOpen,
    setIsSettingsModalOpen,
    searchTerm,
    setSearchTerm,
    theme,
    setTheme,
    enableAdvancedSettings,
    temperature,
    setTemperature,
    topP,
    setTopP,
    maxTokens,
    setMaxTokens,
    topK,
    setTopK,
    presencePenalty,
    setPresencePenalty,
    frequencyPenalty,
    setFrequencyPenalty,
    globalSystemPrompt,
    setGlobalSystemPrompt,
    streamingThrottleRate,
  } = useSettingsStore(
    useShallow((state) => ({
      isSettingsModalOpen: state.isSettingsModalOpen,
      setIsSettingsModalOpen: state.setIsSettingsModalOpen,
      searchTerm: state.searchTerm,
      setSearchTerm: state.setSearchTerm,
      theme: state.theme,
      setTheme: state.setTheme,
      enableAdvancedSettings: state.enableAdvancedSettings,
      temperature: state.temperature,
      setTemperature: state.setTemperature,
      topP: state.topP,
      setTopP: state.setTopP,
      maxTokens: state.maxTokens,
      setMaxTokens: state.setMaxTokens,
      topK: state.topK,
      setTopK: state.setTopK,
      presencePenalty: state.presencePenalty,
      setPresencePenalty: state.setPresencePenalty,
      frequencyPenalty: state.frequencyPenalty,
      setFrequencyPenalty: state.setFrequencyPenalty,
      globalSystemPrompt: state.globalSystemPrompt,
      setGlobalSystemPrompt: state.setGlobalSystemPrompt,
      streamingThrottleRate: state.streamingThrottleRate,
    })),
  );

  // Mod Store
  const {
    dbMods,
    loadedMods,
    addDbMod,
    updateDbMod,
    deleteDbMod,
    customSettingsTabs,
    modPromptActions,
  } = useModStore(
    useShallow((state) => ({
      dbMods: state.dbMods,
      loadedMods: state.loadedMods,
      addDbMod: state.addDbMod,
      updateDbMod: state.updateDbMod,
      deleteDbMod: state.deleteDbMod,
      customSettingsTabs: state.modSettingsTabs,
      modPromptActions: state.modPromptActions,
    })),
  );

  // Placeholder for clearAllData action
  const clearAllData = useCallback(async () => {
    console.warn("clearAllData not implemented in store");
    // Example: await useAppStore.getState().clearEverything();
  }, []);

  // Placeholder for getAllAvailableModelDefs
  const getAllAvailableModelDefs = useCallback(
    (providerConfigId: string) => {
      const config = dbProviderConfigs.find((p) => p.id === providerConfigId);
      return config?.fetchedModels || [];
    },
    [dbProviderConfigs],
  );

  // --- Derived State ---
  const enableSidebar = enableSidebarStore ?? enableSidebarConfig;

  const sidebarItems = useMemo(() => {
    console.log(
      "[LiteChatInner] Recalculating sidebarItems...",
      `Projects: ${dbProjects?.length ?? 0}, Convos: ${dbConversations?.length ?? 0}`,
    );
    const allProjects: DbProject[] = dbProjects || [];
    const allConversations: DbConversation[] = dbConversations || [];
    const combinedItems: SidebarItem[] = [
      ...allProjects.map((p: DbProject) => ({
        ...p,
        type: "project" as const,
      })),
      ...allConversations.map((c: DbConversation) => ({
        ...c,
        type: "conversation" as const,
      })),
    ];
    combinedItems.sort(
      (a, b) => (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0),
    );
    return combinedItems;
  }, [dbProjects, dbConversations]);

  const activeConversationData = useMemo(() => {
    if (selectedItemType === "conversation" && selectedItemId) {
      return (
        dbConversations.find((c: DbConversation) => c.id === selectedItemId) ||
        null
      );
    }
    return null;
  }, [selectedItemId, selectedItemType, dbConversations]);

  // Derive selectedProvider and selectedModel (needed for useAiInteraction)
  const getApiKeyForProvider = useCallback(
    (providerId: string): string | undefined => {
      const config = dbProviderConfigs.find((p) => p.id === providerId);
      if (!config || !config.apiKeyId) return undefined;
      return apiKeys.find((k) => k.id === config.apiKeyId)?.value;
    },
    [dbProviderConfigs, apiKeys],
  );

  const selectedProvider = useMemo((): AiProviderConfig | undefined => {
    const config = dbProviderConfigs.find((p) => p.id === selectedProviderId);
    if (!config) return undefined;
    return {
      id: config.id,
      name: config.name,
      type: config.type,
      models: [],
      allAvailableModels: config.fetchedModels || [],
    };
  }, [selectedProviderId, dbProviderConfigs]);

  const selectedModel = useMemo((): AiModelConfig | undefined => {
    if (!selectedProvider || !selectedModelId) return undefined;
    const config = dbProviderConfigs.find((p) => p.id === selectedProviderId);
    if (!config) return undefined;
    const modelInfo = (config.fetchedModels ?? []).find(
      (m: { id: string }) => m.id === selectedModelId,
    );
    if (!modelInfo) return undefined;
    let modelInstance: any = null;
    try {
      switch (
        config.type
        // ... (model instantiation logic as before) ...
      ) {
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
    selectedProvider,
    selectedModelId,
    dbProviderConfigs,
    selectedProviderId,
  ]);

  // --- Context Snapshot Function ---
  const getContextSnapshotForMod =
    useCallback((): ReadonlyChatContextSnapshot => {
      const currentSettings = useSettingsStore.getState();
      const currentSidebar = useSidebarStore.getState();
      const currentVfs = useVfsStore.getState();
      const currentCore = useCoreChatStore.getState();
      const currentProvider = useProviderStore.getState();

      let activeSystemPrompt: string | null = null;
      if (currentSettings.enableAdvancedSettings) {
        if (currentSidebar.selectedItemType === "conversation") {
          const convo = currentSidebar.dbConversations.find(
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
        const config = currentProvider.dbProviderConfigs.find(
          (p) => p.id === id,
        );
        if (!config || !config.apiKeyId) return undefined;
        return currentProvider.apiKeys.find((k) => k.id === config.apiKeyId)
          ?.value;
      };

      return Object.freeze({
        selectedItemId: currentSidebar.selectedItemId,
        selectedItemType: currentSidebar.selectedItemType,
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
    }, []);

  // --- Abort Controller Ref (Managed here) ---
  const abortControllerRef = useRef<AbortController | null>(null);

  // --- Instantiate useAiInteraction Hook ---
  const { performAiStream, performImageGeneration } = useAiInteraction({
    selectedModel,
    selectedProvider,
    getApiKeyForProvider: useCallback(
      () => getApiKeyForProvider(selectedProviderId!),
      [getApiKeyForProvider, selectedProviderId],
    ),
    streamingThrottleRate,
    setLocalMessages: setMessages,
    setIsAiStreaming: setIsAiStreaming,
    setError: setError,
    addDbMessage: addDbMessage,
    abortControllerRef,
    getContextSnapshotForMod,
    bulkAddMessages: bulkAddMessages,
  });

  // --- Interaction Handlers (Now use the hook results) ---
  // REMOVED: const handleSubmit = ... (unused variable)

  const handleImageGenerationWrapper = useCallback(
    async (prompt: string) => {
      if (!selectedItemId || selectedItemType !== "conversation") {
        toast.error("No active conversation selected.");
        return;
      }
      const userMessageId = nanoid();
      const userMessageTimestamp = new Date();
      const userMessageContent = `/imagine ${prompt}`;
      const userMessage: Message = {
        id: userMessageId,
        conversationId: selectedItemId,
        role: "user",
        content: userMessageContent,
        createdAt: userMessageTimestamp,
      };
      addLocalMessage(userMessage);
      setError(null);

      try {
        await addDbMessage({
          id: userMessageId,
          conversationId: selectedItemId,
          role: "user",
          content: userMessageContent,
          createdAt: userMessageTimestamp,
        });
        modEvents.emit(ModEvent.MESSAGE_SUBMITTED, { message: userMessage });

        await performImageGeneration({
          conversationIdToUse: selectedItemId,
          prompt: prompt,
        });
      } catch (err) {
        console.error("Image generation submission failed:", err);
        removeMessage(userMessageId);
      }
    },
    [
      selectedItemId,
      selectedItemType,
      addLocalMessage,
      setError,
      addDbMessage,
      performImageGeneration,
      removeMessage,
    ],
  );

  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsAiStreaming(false);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.isStreaming ? { ...msg, isStreaming: false } : msg,
        ),
      );
      toast.info("Processing stopped.");
    } else {
      if (isStreaming) setIsAiStreaming(false);
    }
  }, [setIsAiStreaming, setMessages, isStreaming]);

  const regenerateMessage = useCallback(
    async (messageId: string) => {
      const currentMessages = useCoreChatStore.getState().messages;
      const messageIndex = currentMessages.findIndex((m) => m.id === messageId);

      if (
        messageIndex === -1 ||
        currentMessages[messageIndex].role !== "assistant"
      ) {
        toast.error("Cannot regenerate this message.");
        return;
      }
      const conversationId = currentMessages[messageIndex].conversationId;
      if (!conversationId) return;
      if (isStreaming) {
        toast.warning("Please wait for the current response to finish.");
        return;
      }
      setError(null);

      let precedingUserMessageIndex = -1;
      for (let i = messageIndex - 1; i >= 0; i--) {
        if (currentMessages[i].role === "user") {
          precedingUserMessageIndex = i;
          break;
        }
      }
      if (precedingUserMessageIndex === -1) return;
      const precedingUserMessage = currentMessages[precedingUserMessageIndex];

      try {
        await deleteDbMessage(messageId);
      } catch (err) {
        console.error("Failed to delete old message from DB:", err);
      }
      const messagesToKeep = currentMessages.slice(0, messageIndex);
      setMessages(messagesToKeep);

      if (
        typeof precedingUserMessage.content === "string" &&
        precedingUserMessage.content.startsWith("/imagine ")
      ) {
        const imagePrompt = precedingUserMessage.content
          .substring("/imagine ".length)
          .trim();
        if (imagePrompt) {
          await handleImageGenerationWrapper(imagePrompt);
        } else {
          /* handle error */
        }
      } else {
        const historyForApi = convertDbMessagesToCoreMessages(
          currentMessages.slice(0, precedingUserMessageIndex + 1),
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
    },
    [
      isStreaming,
      setError,
      setMessages,
      performAiStream,
      handleImageGenerationWrapper,
      deleteDbMessage,
      getContextSnapshotForMod,
    ],
  );

  // --- Bundle props for SettingsModal ---
  const settingsProps: SettingsModalTabProps = useMemo(
    () => ({
      theme,
      setTheme,
      dbProviderConfigs,
      apiKeys,
      addDbProviderConfig,
      updateDbProviderConfig,
      deleteDbProviderConfig,
      fetchModels,
      providerFetchStatus,
      getAllAvailableModelDefs,
      globalSystemPrompt,
      setGlobalSystemPrompt,
      addApiKey,
      deleteApiKey,
      importConversation,
      exportAllConversations, // Added missing prop
      clearAllData,
      dbMods,
      loadedMods,
      addDbMod,
      updateDbMod,
      deleteDbMod,
      enableAdvancedSettings,
      enableApiKeyManagement,
      customSettingsTabs,
    }),
    [
      theme,
      setTheme,
      dbProviderConfigs,
      apiKeys,
      addDbProviderConfig,
      updateDbProviderConfig,
      deleteDbProviderConfig,
      fetchModels,
      providerFetchStatus,
      getAllAvailableModelDefs,
      globalSystemPrompt,
      setGlobalSystemPrompt,
      addApiKey,
      deleteApiKey,
      importConversation,
      exportAllConversations, // Added missing prop
      clearAllData,
      dbMods,
      loadedMods,
      addDbMod,
      updateDbMod,
      deleteDbMod,
      enableAdvancedSettings,
      enableApiKeyManagement,
      customSettingsTabs,
    ],
  );

  // --- Bundle props for WrapperComponent ---
  const wrapperProps: ChatWrapperProps = useMemo(
    () => ({
      className: "h-full",
      selectedItemId,
      selectedItemType,
      sidebarItems,
      messages,
      isLoadingMessages,
      isStreaming,
      error,
      promptInputValue,
      attachedFiles,
      selectedVfsPaths,
      isVfsEnabledForItem,
      regenerateMessage,
      setPromptInputValue,
      addAttachedFile,
      removeAttachedFile,
      clearPromptInput,
      handleSubmitCore, // Pass core handler
      handleImageGenerationCore, // Pass core handler
      clearSelectedVfsPaths,
      selectedProviderId,
      selectedModelId,
      dbProviderConfigs,
      apiKeys,
      enableApiKeyManagement,
      dbConversations,
      createConversation,
      selectItem,
      deleteItem,
      updateDbProviderConfig,
      searchTerm,
      setSearchTerm,
      exportConversation,
      temperature,
      setTemperature,
      topP,
      setTopP,
      maxTokens,
      setMaxTokens,
      topK,
      setTopK,
      presencePenalty,
      setPresencePenalty,
      frequencyPenalty,
      setFrequencyPenalty,
      globalSystemPrompt,
      activeConversationData,
      updateConversationSystemPrompt,
      isVfsReady,
      isVfsLoading,
      vfsError,
      vfsKey,
      enableAdvancedSettings,
      isSettingsModalOpen,
      setIsSettingsModalOpen,
      setSelectedProviderId,
      setSelectedModelId,
      toggleVfsEnabledAction,
      stopStreaming,
      customPromptActions: modPromptActions, // Pass mod actions
      getContextSnapshotForMod: getContextSnapshotForMod, // Pass down
      selectedModel: selectedModel, // Pass derived model
      setError, // Pass setError
      removeSelectedVfsPath, // Pass removeSelectedVfsPath
    }),
    [
      selectedItemId,
      selectedItemType,
      sidebarItems,
      messages,
      isLoadingMessages,
      isStreaming,
      error,
      promptInputValue,
      attachedFiles,
      selectedVfsPaths,
      isVfsEnabledForItem,
      regenerateMessage,
      setPromptInputValue,
      addAttachedFile,
      removeAttachedFile,
      clearPromptInput,
      handleSubmitCore,
      handleImageGenerationCore,
      clearSelectedVfsPaths,
      selectedProviderId,
      selectedModelId,
      dbProviderConfigs,
      apiKeys,
      enableApiKeyManagement,
      dbConversations,
      createConversation,
      selectItem,
      deleteItem,
      updateDbProviderConfig,
      searchTerm,
      setSearchTerm,
      exportConversation,
      temperature,
      setTemperature,
      topP,
      setTopP,
      maxTokens,
      setMaxTokens,
      topK,
      setTopK,
      presencePenalty,
      setPresencePenalty,
      frequencyPenalty,
      setFrequencyPenalty,
      globalSystemPrompt,
      activeConversationData,
      updateConversationSystemPrompt,
      isVfsReady,
      isVfsLoading,
      vfsError,
      vfsKey,
      enableAdvancedSettings,
      isSettingsModalOpen,
      setIsSettingsModalOpen,
      setSelectedProviderId,
      setSelectedModelId,
      toggleVfsEnabledAction,
      stopStreaming,
      modPromptActions,
      getContextSnapshotForMod, // Add dependency
      selectedModel,
      setError,
      removeSelectedVfsPath,
    ],
  );

  console.log(
    `[LiteChatInner] Rendering. Selected: ${selectedItemType} - ${selectedItemId}`,
  );

  return (
    <div
      className={cn(
        "flex h-full w-full overflow-hidden bg-gray-900 border border-gray-700 rounded-lg shadow-sm",
        className,
      )}
    >
      {enableSidebar && sidebarOpen && (
        <SideComponent
          className={cn("w-72 flex-shrink-0", "hidden md:flex")}
          sidebarItems={sidebarItems}
          editingItemId={editingItemId}
          selectedItemId={selectedItemId}
          selectedItemType={selectedItemType}
          isSettingsModalOpen={isSettingsModalOpen}
          settingsProps={settingsProps}
          onEditComplete={onEditComplete}
          setEditingItemId={setEditingItemId}
          selectItem={selectItem}
          deleteItem={deleteItem}
          renameItem={renameItem}
          exportConversation={exportConversation}
          createConversation={createConversation}
          createProject={createProject}
          importConversation={importConversation}
          setIsSettingsModalOpen={setIsSettingsModalOpen}
        />
      )}

      <div className="flex-grow flex flex-col relative w-full min-w-0">
        {enableSidebar && (
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "absolute top-3 left-3 z-10 text-gray-400 hover:text-white hover:bg-gray-700 md:hidden",
            )}
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
          >
            {sidebarOpen ? (
              <XIcon className="h-5 w-5" />
            ) : (
              <MenuIcon className="h-5 w-5" />
            )}
          </Button>
        )}

        <WrapperComponent {...wrapperProps} />
      </div>
    </div>
  );
};
