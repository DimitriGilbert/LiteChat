// src/components/lite-chat/chat.tsx
import React, {
  useState,
  useMemo,
  useCallback,
  useRef,
  useEffect,
} from "react";
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
  CustomMessageAction,
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
import { db } from "@/lib/db";
// Import AI SDK provider functions
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createOllama } from "ollama-ai-provider";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

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
  isSettingsModalOpen: boolean; // Prop for the main modal visibility
  setIsSettingsModalOpen: (isOpen: boolean) => void; // Prop for the main modal setter
  settingsProps: SettingsModalTabProps; // Pass the bundled props object
}

// Updated ChatWrapperProps
export interface ChatWrapperProps {
  className?: string;
  // Input state passed separately
  promptInputValue: string;
  setPromptInputValue: (value: string) => void;
  // Other props
  selectedItemId: string | null;
  selectedItemType: SidebarItemType | null;
  sidebarItems: SidebarItem[];
  messages: Message[];
  isLoadingMessages: boolean;
  isStreaming: boolean;
  error: string | null;
  attachedFiles: File[];
  selectedVfsPaths: string[];
  isVfsEnabledForItem: boolean;
  regenerateMessage: (messageId: string) => Promise<void>;
  addAttachedFile: (file: File) => void;
  removeAttachedFile: (fileName: string) => void;
  clearPromptInput: () => void;
  handleSubmitCore: (
    prompt: string,
    files: File[],
    vfsPaths: string[],
    context: any,
  ) => Promise<void>; // Updated signature
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
  setSelectedProviderId: (id: string | null) => void;
  setSelectedModelId: (id: string | null) => void;
  toggleVfsEnabledAction: (id: string, type: SidebarItemType) => Promise<void>;
  stopStreaming: () => void;
  customPromptActions: CustomPromptAction[];
  getContextSnapshotForMod: () => ReadonlyChatContextSnapshot;
  selectedModel: AiModelConfig | undefined;
  setError: (error: string | null) => void;
  removeSelectedVfsPath: (path: string) => void;
  modMessageActions: CustomMessageAction[]; // Added
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

  // console.log("[LiteChat] Rendering");

  return (
    // Use ChatProviderInner directly and pass correct prop names
    <ChatProviderInner config={config}>
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
  // Wrap store actions in useCallback where appropriate if passed down directly
  // Sidebar Store
  const sidebarActions = useSidebarStore(
    useShallow((state) => ({
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
  const {
    enableSidebar: enableSidebarStore,
    selectedItemId,
    selectedItemType,
    dbProjects,
    dbConversations,
  } = useSidebarStore(
    useShallow((state) => ({
      enableSidebar: state.enableSidebar,
      selectedItemId: state.selectedItemId,
      selectedItemType: state.selectedItemType,
      dbProjects: state.dbProjects,
      dbConversations: state.dbConversations,
    })),
  );

  // Core Chat Store
  const coreChatActions = useCoreChatStore(
    useShallow((state) => ({
      setMessages: state.setMessages,
      setIsAiStreaming: state.setIsStreaming,
      setError: state.setError,
      addDbMessage: state.addDbMessage,
      bulkAddMessages: state.bulkAddMessages,
      handleSubmitCore: state.handleSubmitCore,
      handleImageGenerationCore: state.handleImageGenerationCore,
      stopStreamingCore: state.stopStreamingCore,
      regenerateMessageCore: state.regenerateMessageCore,
    })),
  );
  const { messages, isLoadingMessages, isStreaming, error } = useCoreChatStore(
    useShallow((state) => ({
      messages: state.messages,
      isLoadingMessages: state.isLoadingMessages,
      isStreaming: state.isStreaming,
      error: state.error,
    })),
  );

  // Input Store
  const promptInputValue = useInputStore((state) => state.promptInputValue);
  const inputActions = useInputStore(
    useShallow((state) => ({
      setPromptInputValue: state.setPromptInputValue,
      addAttachedFile: state.addAttachedFile,
      removeAttachedFile: state.removeAttachedFile,
      clearPromptInput: state.clearPromptInput,
    })),
  );
  const attachedFiles = useInputStore((state) => state.attachedFiles);

  // VFS Store
  const vfsActions = useVfsStore(
    useShallow((state) => ({
      clearSelectedVfsPaths: state.clearSelectedVfsPaths,
      removeSelectedVfsPath: state.removeSelectedVfsPath,
    })),
  );
  const {
    selectedVfsPaths,
    isVfsEnabledForItem,
    isVfsReady,
    isVfsLoading,
    vfsError,
    vfsKey,
  } = useVfsStore(
    useShallow((state) => ({
      selectedVfsPaths: state.selectedVfsPaths,
      isVfsEnabledForItem: state.isVfsEnabledForItem,
      isVfsReady: state.isVfsReady,
      isVfsLoading: state.isVfsLoading,
      vfsError: state.vfsError,
      vfsKey: state.vfsKey,
    })),
  );

  // Provider Store
  const providerActions = useProviderStore(
    useShallow((state) => ({
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
  const {
    selectedProviderId,
    selectedModelId,
    dbProviderConfigs,
    apiKeys,
    enableApiKeyManagement,
    providerFetchStatus,
  } = useProviderStore(
    useShallow((state) => ({
      selectedProviderId: state.selectedProviderId,
      selectedModelId: state.selectedModelId,
      dbProviderConfigs: state.dbProviderConfigs,
      apiKeys: state.apiKeys,
      enableApiKeyManagement: state.enableApiKeyManagement,
      providerFetchStatus: state.providerFetchStatus,
    })),
  );

  // Settings Store
  const isSettingsModalOpen = useSettingsStore(
    (state) => state.isSettingsModalOpen,
  );
  const settingsActions = useSettingsStore(
    useShallow((state) => ({
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
  const {
    searchTerm,
    theme,
    enableAdvancedSettings,
    temperature,
    topP,
    maxTokens,
    topK,
    presencePenalty,
    frequencyPenalty,
    globalSystemPrompt,
    streamingThrottleRate,
  } = useSettingsStore(
    useShallow((state) => ({
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
    })),
  );

  // Mod Store
  const modActions = useModStore(
    useShallow((state) => ({
      addDbMod: state.addDbMod,
      updateDbMod: state.updateDbMod,
      deleteDbMod: state.deleteDbMod,
    })),
  );
  const {
    dbMods,
    loadedMods,
    customSettingsTabs,
    modPromptActions,
    modMessageActions,
  } = useModStore(
    useShallow((state) => ({
      dbMods: state.dbMods,
      loadedMods: state.loadedMods,
      customSettingsTabs: state.modSettingsTabs,
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
      const config = dbProviderConfigs.find((p) => p.id === providerConfigId);
      return config?.fetchedModels || [];
    },
    [dbProviderConfigs],
  );

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
    let effectiveTheme = theme;
    if (theme === "system") {
      effectiveTheme =
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
    }
    root.classList.add(effectiveTheme);
  }, [theme]);

  // --- Derived State ---
  const enableSidebar = enableSidebarStore ?? enableSidebarConfig;

  const sidebarItems = useMemo(() => {
    // console.log(
    //   "[LiteChatInner] Recalculating sidebarItems...",
    //   `Projects: ${dbProjects?.length ?? 0}, Convos: ${dbConversations?.length ?? 0}`
    // );
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
    if (!selectedProviderId || !selectedModelId) return undefined;
    const config = dbProviderConfigs.find((p) => p.id === selectedProviderId);
    if (!config) return undefined;
    const modelInfo = (config.fetchedModels ?? []).find(
      (m: { id: string }) => m.id === selectedModelId,
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
    selectedProviderId,
    selectedModelId,
    dbProviderConfigs,
    getApiKeyForProvider,
  ]);

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

  const abortControllerRef = useRef<AbortController | null>(null);

  const { performAiStream, performImageGeneration } = useAiInteraction({
    selectedModel,
    selectedProvider,
    getApiKeyForProvider: useCallback(
      () => getApiKeyForProvider(selectedProviderId!),
      [getApiKeyForProvider, selectedProviderId],
    ),
    streamingThrottleRate,
    setLocalMessages: coreChatActions.setMessages,
    setIsAiStreaming: coreChatActions.setIsAiStreaming,
    setError: coreChatActions.setError,
    addDbMessage: coreChatActions.addDbMessage,
    abortControllerRef,
    getContextSnapshotForMod,
    bulkAddMessages: coreChatActions.bulkAddMessages,
  });

  // --- Interaction Handlers ---
  const handleFormSubmit = useCallback(
    async (prompt: string, files: File[], vfsPaths: string[], context: any) => {
      try {
        await coreChatActions.handleSubmitCore(
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
      } catch (err) {
        console.error("Error during form submission flow:", err);
      }
    },
    [
      coreChatActions.handleSubmitCore,
      performAiStream,
      getContextSnapshotForMod,
    ],
  );

  const handleImageGenerationWrapper = useCallback(
    async (prompt: string) => {
      if (!selectedItemId || selectedItemType !== "conversation") {
        toast.error("No active conversation selected.");
        return;
      }
      try {
        await coreChatActions.handleImageGenerationCore(selectedItemId, prompt);
        await performImageGeneration({
          conversationIdToUse: selectedItemId,
          prompt: prompt,
        });
      } catch (err) {
        console.error("Error in handleImageGenerationWrapper:", err);
      }
    },
    [
      selectedItemId,
      selectedItemType,
      coreChatActions.handleImageGenerationCore,
      performImageGeneration,
    ],
  );

  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    coreChatActions.stopStreamingCore();
  }, [coreChatActions.stopStreamingCore]);

  const regenerateMessage = useCallback(
    async (messageId: string) => {
      try {
        await coreChatActions.regenerateMessageCore(messageId);
        const originalMessages = useCoreChatStore.getState().messages;
        const messageIndex = originalMessages.findIndex(
          (m) => m.id === messageId,
        );
        if (messageIndex <= 0) return;
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
            coreChatActions.setError(
              "Cannot regenerate: Invalid image prompt found.",
            );
            toast.error("Cannot regenerate: Invalid image prompt found.");
          }
        } else {
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
        console.error("Error during regeneration:", err);
      }
    },
    [
      coreChatActions.regenerateMessageCore,
      coreChatActions.setError,
      performAiStream,
      performImageGeneration,
      getContextSnapshotForMod,
    ],
  );

  // --- Bundle props for SettingsModal ---
  const settingsProps: SettingsModalTabProps = useMemo(
    () => ({
      theme,
      setTheme: settingsActions.setTheme,
      dbProviderConfigs,
      apiKeys,
      addDbProviderConfig: providerActions.addDbProviderConfig,
      updateDbProviderConfig: providerActions.updateDbProviderConfig,
      deleteDbProviderConfig: providerActions.deleteDbProviderConfig,
      fetchModels: providerActions.fetchModels,
      providerFetchStatus,
      getAllAvailableModelDefs,
      globalSystemPrompt,
      setGlobalSystemPrompt: settingsActions.setGlobalSystemPrompt,
      addApiKey: providerActions.addApiKey,
      deleteApiKey: providerActions.deleteApiKey,
      importConversation: sidebarActions.importConversation,
      exportAllConversations: sidebarActions.exportAllConversations,
      clearAllData,
      dbMods,
      loadedMods,
      addDbMod: modActions.addDbMod,
      updateDbMod: modActions.updateDbMod,
      deleteDbMod: modActions.deleteDbMod,
      enableAdvancedSettings,
      enableApiKeyManagement,
      customSettingsTabs,
    }),
    [
      theme,
      settingsActions.setTheme,
      dbProviderConfigs,
      apiKeys,
      providerActions.addDbProviderConfig,
      providerActions.updateDbProviderConfig,
      providerActions.deleteDbProviderConfig,
      providerActions.fetchModels,
      providerFetchStatus,
      getAllAvailableModelDefs,
      globalSystemPrompt,
      settingsActions.setGlobalSystemPrompt,
      providerActions.addApiKey,
      providerActions.deleteApiKey,
      sidebarActions.importConversation,
      sidebarActions.exportAllConversations,
      clearAllData,
      dbMods,
      loadedMods,
      modActions.addDbMod,
      modActions.updateDbMod,
      modActions.deleteDbMod,
      enableAdvancedSettings,
      enableApiKeyManagement,
      customSettingsTabs,
    ],
  );

  // --- Bundle props for WrapperComponent ---
  const wrapperProps = useMemo(
    () => ({
      className: "h-full",
      selectedItemId,
      selectedItemType,
      sidebarItems,
      messages,
      isLoadingMessages,
      isStreaming,
      error,
      attachedFiles,
      selectedVfsPaths,
      isVfsEnabledForItem,
      regenerateMessage,
      addAttachedFile: inputActions.addAttachedFile,
      removeAttachedFile: inputActions.removeAttachedFile,
      clearPromptInput: inputActions.clearPromptInput,
      handleSubmitCore: handleFormSubmit,
      handleImageGenerationCore: handleImageGenerationWrapper,
      clearSelectedVfsPaths: vfsActions.clearSelectedVfsPaths,
      selectedProviderId,
      selectedModelId,
      dbProviderConfigs,
      apiKeys,
      enableApiKeyManagement,
      dbConversations,
      createConversation: sidebarActions.createConversation,
      selectItem: sidebarActions.selectItem,
      deleteItem: sidebarActions.deleteItem,
      updateDbProviderConfig: providerActions.updateDbProviderConfig,
      searchTerm,
      setSearchTerm: settingsActions.setSearchTerm,
      exportConversation: sidebarActions.exportConversation,
      temperature,
      setTemperature: settingsActions.setTemperature,
      topP,
      setTopP: settingsActions.setTopP,
      maxTokens,
      setMaxTokens: settingsActions.setMaxTokens,
      topK,
      setTopK: settingsActions.setTopK,
      presencePenalty,
      setPresencePenalty: settingsActions.setPresencePenalty,
      frequencyPenalty,
      setFrequencyPenalty: settingsActions.setFrequencyPenalty,
      globalSystemPrompt,
      activeConversationData,
      updateConversationSystemPrompt:
        sidebarActions.updateConversationSystemPrompt,
      isVfsReady,
      isVfsLoading,
      vfsError,
      vfsKey,
      enableAdvancedSettings,
      setSelectedProviderId: providerActions.setSelectedProviderId,
      setSelectedModelId: providerActions.setSelectedModelId,
      toggleVfsEnabledAction: sidebarActions.toggleVfsEnabledAction,
      stopStreaming,
      customPromptActions: modPromptActions,
      getContextSnapshotForMod,
      selectedModel,
      setError: coreChatActions.setError,
      removeSelectedVfsPath: vfsActions.removeSelectedVfsPath,
      modMessageActions,
    }),
    [
      selectedItemId,
      selectedItemType,
      sidebarItems,
      messages,
      isLoadingMessages,
      isStreaming,
      error,
      attachedFiles,
      selectedVfsPaths,
      isVfsEnabledForItem,
      regenerateMessage,
      inputActions.addAttachedFile,
      inputActions.removeAttachedFile,
      inputActions.clearPromptInput,
      handleFormSubmit,
      handleImageGenerationWrapper,
      vfsActions.clearSelectedVfsPaths,
      selectedProviderId,
      selectedModelId,
      dbProviderConfigs,
      apiKeys,
      enableApiKeyManagement,
      dbConversations,
      sidebarActions.createConversation,
      sidebarActions.selectItem,
      sidebarActions.deleteItem,
      providerActions.updateDbProviderConfig,
      searchTerm,
      settingsActions.setSearchTerm,
      sidebarActions.exportConversation,
      temperature,
      settingsActions.setTemperature,
      topP,
      settingsActions.setTopP,
      maxTokens,
      settingsActions.setMaxTokens,
      topK,
      settingsActions.setTopK,
      presencePenalty,
      settingsActions.setPresencePenalty,
      frequencyPenalty,
      settingsActions.setFrequencyPenalty,
      globalSystemPrompt,
      activeConversationData,
      sidebarActions.updateConversationSystemPrompt,
      isVfsReady,
      isVfsLoading,
      vfsError,
      vfsKey,
      enableAdvancedSettings,
      providerActions.setSelectedProviderId,
      providerActions.setSelectedModelId,
      sidebarActions.toggleVfsEnabledAction,
      stopStreaming,
      modPromptActions,
      getContextSnapshotForMod,
      selectedModel,
      coreChatActions.setError,
      vfsActions.removeSelectedVfsPath,
      modMessageActions,
    ],
  );

  // --- Bundle props for SideComponent ---
  const sideProps = useMemo(
    () => ({
      className: cn("w-72 flex-shrink-0", "hidden md:flex"),
      sidebarItems,
      editingItemId,
      selectedItemId,
      selectedItemType,
      isSettingsModalOpen,
      setIsSettingsModalOpen: settingsActions.setIsSettingsModalOpen,
      settingsProps,
      onEditComplete,
      setEditingItemId,
      selectItem: sidebarActions.selectItem,
      deleteItem: sidebarActions.deleteItem,
      renameItem: sidebarActions.renameItem,
      exportConversation: sidebarActions.exportConversation,
      createConversation: sidebarActions.createConversation,
      createProject: sidebarActions.createProject,
      importConversation: sidebarActions.importConversation,
    }),
    [
      sidebarItems,
      editingItemId,
      selectedItemId,
      selectedItemType,
      isSettingsModalOpen,
      settingsActions.setIsSettingsModalOpen,
      settingsProps,
      onEditComplete,
      setEditingItemId,
      sidebarActions.selectItem,
      sidebarActions.deleteItem,
      sidebarActions.renameItem,
      sidebarActions.exportConversation,
      sidebarActions.createConversation,
      sidebarActions.createProject,
      sidebarActions.importConversation,
    ],
  );

  // console.log(
  //   `[LiteChatInner] Rendering. Selected: ${selectedItemType} - ${selectedItemId}`
  // );

  return (
    <div
      className={cn(
        "flex h-full w-full overflow-hidden bg-gray-900 border border-gray-700 rounded-lg shadow-sm",
        className,
      )}
    >
      {enableSidebar && sidebarOpen && <SideComponent {...sideProps} />}

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
        {/* Pass wrapperProps AND input state separately */}
        <WrapperComponent
          {...wrapperProps}
          promptInputValue={promptInputValue}
          setPromptInputValue={inputActions.setPromptInputValue}
        />
      </div>
    </div>
  );
};
