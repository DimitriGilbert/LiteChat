// src/context/chat-context.tsx
import React, {
  useMemo,
  useCallback,
  useState,
  useRef,
  useEffect,
} from "react";
import type {
  AiProviderConfig,
  ChatContextProps,
  CoreChatContextProps,
  SidebarItemType,
  Message,
  DbConversation,
  DbProject,
  DbApiKey,
  SidebarItem,
  ProjectSidebarItem,
  ConversationSidebarItem,
  VfsContextObject,
  CustomPromptAction,
  CustomMessageAction,
  CustomSettingTab,
  DbProviderConfig,
  DbProviderType,
  AiModelConfig,
} from "@/lib/types";
import type {
  DbMod,
  ModInstance,
  ProcessResponseChunkPayload,
  RenderMessagePayload,
} from "@/mods/types";
import { ChatContext } from "@/hooks/use-chat-context";
import { CoreChatContext } from "@/context/core-chat-context";
import { useProviderModelSelection } from "@/hooks/use-provider-model-selection";
import {
  useApiKeysManagement,
  type UseApiKeysManagementReturn,
} from "@/hooks/use-api-keys-management";
import { useSidebarManagement } from "@/hooks/use-sidebar-management";
import { useChatSettings } from "@/hooks/use-chat-settings";
import { useAiInteraction } from "@/hooks/use-ai-interaction";
import { useMessageHandling } from "@/hooks/use-message-handling";
import { useChatStorage } from "@/hooks/use-chat-storage";
import { useVirtualFileSystem } from "@/hooks/use-virtual-file-system";
import { useState as useVfsState, useCallback as useVfsCallback } from "react";
import { toast } from "sonner";
import { loadMods } from "@/mods/loader";
import { modEvents, ModEvent, ModEventName } from "@/mods/events";
import {
  ModMiddlewareHook,
  type ReadonlyChatContextSnapshot,
  type ModMiddlewareHookName,
} from "@/mods/api";
import type {
  ModEventPayloadMap,
  ModMiddlewarePayloadMap,
  ModMiddlewareReturnMap,
} from "@/mods/types";
import { nanoid } from "nanoid";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createOllama } from "ollama-ai-provider";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

// Helper to decode Uint8Array safely
const decodeUint8Array = (arr: Uint8Array): string => {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(arr);
  } catch (e) {
    console.warn(
      "Failed to decode Uint8Array as strict UTF-8, trying lossy:",
      e,
    );
    return new TextDecoder("utf-8", { fatal: false }).decode(arr);
  }
};

const CODE_FILE_EXTENSIONS = new Set([
  "js",
  "jsx",
  "ts",
  "tsx",
  "html",
  "css",
  "scss",
  "less",
  "php",
  "py",
  "rb",
  "java",
  "cpp",
  "c",
  "cs",
  "go",
  "rs",
  "json",
  "yaml",
  "yml",
  "xml",
  "csv",
  "sql",
  "md",
  "markdown",
  "txt",
  "rst",
  "sh",
  "bash",
  "zsh",
  "fish",
  "bat",
  "ps1",
  "env",
  "ini",
  "conf",
  "config",
  "toml",
  "gradle",
  "dockerfile",
  "gitignore",
]);

const isCodeFile = (filename: string): boolean => {
  const extension = filename.split(".").pop()?.toLowerCase() || "";
  return CODE_FILE_EXTENSIONS.has(extension);
};

const EMPTY_API_KEYS: DbApiKey[] = [];
const EMPTY_SIDEBAR_ITEMS: SidebarItem[] = [];
const EMPTY_CUSTOM_SETTINGS_TABS: CustomSettingTab[] = [];
const EMPTY_CUSTOM_PROMPT_ACTIONS: CustomPromptAction[] = [];
const EMPTY_CUSTOM_MESSAGE_ACTIONS: CustomMessageAction[] = [];
const EMPTY_MOD_INSTANCES: ModInstance[] = [];
const EMPTY_DB_MODS: DbMod[] = [];
const EMPTY_DB_PROVIDER_CONFIGS: DbProviderConfig[] = [];
const EMPTY_ACTIVE_PROVIDERS: AiProviderConfig[] = [];

const DEFAULT_MODELS: Record<DbProviderType, { id: string; name: string }[]> = {
  openai: [
    { id: "gpt-4o", name: "GPT-4o" },
    { id: "gpt-4-turbo", name: "GPT-4 Turbo" },
    { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo" },
  ],
  google: [
    { id: "gemini-1.5-pro-latest", name: "Gemini 1.5 Pro" },
    { id: "gemini-1.5-flash-latest", name: "Gemini 1.5 Flash" },
    { id: "gemini-1.0-pro", name: "Gemini 1.0 Pro" },
  ],
  openrouter: [
    { id: "google/gemini-flash-1.5", name: "Gemini 1.5 Flash (OR)" },
    { id: "google/gemini-pro-1.5", name: "Gemini 1.5 Pro (OR)" },
    { id: "anthropic/claude-3-haiku", name: "Claude 3 Haiku (OR)" },
    { id: "anthropic/claude-3-sonnet", name: "Claude 3 Sonnet (OR)" },
    { id: "anthropic/claude-3-opus", name: "Claude 3 Opus (OR)" },
    { id: "mistralai/mistral-7b-instruct", name: "Mistral 7B Instruct (OR)" },
    { id: "mistralai/mixtral-8x7b-instruct", name: "Mixtral 8x7B (OR)" },
  ],
  ollama: [
    { id: "llama3", name: "Llama 3 (Ollama)" },
    { id: "mistral", name: "Mistral (Ollama)" },
    { id: "gemma", name: "Gemma (Ollama)" },
  ],
  "openai-compatible": [
    { id: "loaded-model-1", name: "Loaded Model 1" },
    { id: "loaded-model-2", name: "Loaded Model 2" },
  ],
};

const requiresApiKey = (type: DbProviderType | null): boolean => {
  return type === "openai" || type === "openrouter" || type === "google";
};

const dummyVfs: VfsContextObject = {
  isReady: false,
  isLoading: false,
  isOperationLoading: false,
  error: null,
  configuredVfsKey: null,
  listFiles: async () => {
    console.warn("VFS not enabled/ready");
    return [];
  },
  readFile: async () => {
    console.warn("VFS not enabled/ready");
    throw new Error("VFS not enabled/ready");
  },
  writeFile: async () => {
    console.warn("VFS not enabled/ready");
    throw new Error("VFS not enabled/ready");
  },
  deleteItem: async () => {
    console.warn("VFS not enabled/ready");
    throw new Error("VFS not enabled/ready");
  },
  createDirectory: async () => {
    console.warn("VFS not enabled/ready");
    throw new Error("VFS not enabled/ready");
  },
  downloadFile: async () => {
    console.warn("VFS not enabled/ready");
    throw new Error("VFS not enabled/ready");
  },
  uploadFiles: async () => {
    console.warn("VFS not enabled/ready");
    throw new Error("VFS not enabled/ready");
  },
  uploadAndExtractZip: async () => {
    console.warn("VFS not enabled/ready");
    throw new Error("VFS not enabled/ready");
  },
  downloadAllAsZip: async () => {
    console.warn("VFS not enabled/ready");
    throw new Error("VFS not enabled/ready");
  },
  rename: async () => {
    console.warn("VFS not enabled/ready");
    throw new Error("VFS not enabled/ready");
  },
  vfsKey: null,
};

const dummyApiKeysMgmt: UseApiKeysManagementReturn = {
  addApiKey: async () => {
    console.warn("API Key Management is disabled.");
    toast.error("API Key Management is disabled in configuration.");
    throw new Error("API Key Management is disabled.");
  },
  deleteApiKey: async () => {
    console.warn("API Key Management is disabled.");
    toast.error("API Key Management is disabled in configuration.");
    throw new Error("API Key Management is disabled.");
  },
};

interface ChatProviderProps {
  children: React.ReactNode;
  initialProviderId?: string | null;
  initialModelId?: string | null;
  initialSelectedItemId?: string | null;
  initialSelectedItemType?: SidebarItemType | null;
  streamingThrottleRate?: number;
  enableApiKeyManagement?: boolean;
  enableSidebar?: boolean;
  enableVfs?: boolean;
  enableAdvancedSettings?: boolean;
  customPromptActions?: CustomPromptAction[];
  customMessageActions?: CustomMessageAction[];
  customSettingsTabs?: CustomSettingTab[];
}

export const ChatProvider: React.FC<ChatProviderProps> = ({
  children,
  initialProviderId = null,
  initialModelId = null,
  initialSelectedItemId = null,
  initialSelectedItemType = null,
  streamingThrottleRate = 42,
  enableApiKeyManagement = true,
  enableSidebar = true,
  enableVfs = true,
  enableAdvancedSettings = true,
  customPromptActions = EMPTY_CUSTOM_PROMPT_ACTIONS,
  customMessageActions = EMPTY_CUSTOM_MESSAGE_ACTIONS,
  customSettingsTabs = EMPTY_CUSTOM_SETTINGS_TABS,
}) => {
  // --- Core State ---
  const [isStreaming, setIsStreaming] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [error, setErrorState] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // --- Mod State ---
  const [loadedMods, setLoadedMods] =
    useState<ModInstance[]>(EMPTY_MOD_INSTANCES);
  const [modPromptActions, setModPromptActions] = useState<
    CustomPromptAction[]
  >([]);
  const [modMessageActions, setModMessageActions] = useState<
    CustomMessageAction[]
  >([]);
  const [modSettingsTabs, setModSettingsTabs] = useState<CustomSettingTab[]>(
    [],
  );
  const modEventListenersRef = useRef<Map<string, Map<string, Function>>>(
    new Map(),
  );
  const modMiddlewareCallbacksRef = useRef<Map<string, Map<string, Function>>>(
    new Map(),
  );

  const setError = useCallback((newError: string | null) => {
    setErrorState(newError);
    if (newError) {
      console.error("Chat Error Context:", newError);
      modEvents.emit(ModEvent.APP_ERROR, { message: newError });
    }
  }, []);

  // --- Hooks ---
  const storage = useChatStorage();

  // --- Dynamic Provider Instantiation ---
  const activeProviders = useMemo<AiProviderConfig[]>(() => {
    const enabledConfigs = (
      storage.providerConfigs || EMPTY_DB_PROVIDER_CONFIGS
    ).filter((c) => c.isEnabled);
    const availableApiKeys = storage.apiKeys || EMPTY_API_KEYS;

    if (enabledConfigs.length === 0) {
      return EMPTY_ACTIVE_PROVIDERS;
    }

    const generatedProviders: AiProviderConfig[] = [];

    for (const config of enabledConfigs) {
      try {
        let providerInstance: any;
        let apiKey: string | undefined;

        if (config.apiKeyId) {
          apiKey = availableApiKeys.find(
            (k) => k.id === config.apiKeyId,
          )?.value;
          if (!apiKey && requiresApiKey(config.type)) {
            throw new Error(
              `API Key ID ${config.apiKeyId} configured but key not found or value missing.`,
            );
          }
        }

        switch (config.type) {
          case "openai":
            if (!apiKey) throw new Error("API Key required for OpenAI.");
            providerInstance = createOpenAI({ apiKey });
            break;
          case "google":
            if (!apiKey) throw new Error("API Key required for Google.");
            providerInstance = createGoogleGenerativeAI({ apiKey });
            break;
          case "openrouter":
            if (!apiKey) throw new Error("API Key required for OpenRouter.");
            providerInstance = createOpenRouter({ apiKey });
            break;
          case "ollama":
            providerInstance = createOllama({
              baseURL: config.baseURL ?? undefined,
            });
            break;
          case "openai-compatible":
            if (!config.baseURL)
              throw new Error("Base URL required for OpenAI-Compatible.");
            providerInstance = createOpenAICompatible({
              name: config.name ?? "OpenAI-Compatible",
              baseURL: config.baseURL,
              apiKey: apiKey,
            });
            break;
          default:
            throw new Error(`Unsupported provider type: ${config.type}`);
        }

        const availableModelDefs = DEFAULT_MODELS[config.type] || [];
        const models: AiModelConfig[] = availableModelDefs.map((modelDef) => ({
          id: modelDef.id,
          name: modelDef.name,
          instance: providerInstance(modelDef.id),
        }));

        if (models.length > 0) {
          generatedProviders.push({
            id: config.id,
            name: config.name,
            type: config.type,
            models: models,
          });
        }
      } catch (err) {
        console.error(
          `[ChatProvider] Failed to instantiate provider ${config.name} (ID: ${config.id}, Type: ${config.type}):`,
          err,
        );
        toast.error(
          `Failed to load provider "${config.name}": ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    return generatedProviders;
  }, [storage.providerConfigs, storage.apiKeys]);

  const providerModel = useProviderModelSelection({
    providers: activeProviders,
    initialProviderId,
    initialModelId,
  });

  const realApiKeysMgmt = useApiKeysManagement({
    addDbApiKey: storage.addApiKey,
    deleteDbApiKey: storage.deleteApiKey,
  });
  const apiKeysMgmt: UseApiKeysManagementReturn = useMemo(() => {
    return enableApiKeyManagement ? realApiKeysMgmt : dummyApiKeysMgmt;
  }, [enableApiKeyManagement, realApiKeysMgmt]);

  // --- VFS Selection State ---
  const [selectedVfsPaths, setSelectedVfsPaths] = useVfsState<string[]>([]);
  const addSelectedVfsPath = useVfsCallback((path: string) => {
    setSelectedVfsPaths((prev) =>
      prev.includes(path) ? prev : [...prev, path].sort(),
    );
  }, []);
  const removeSelectedVfsPath = useVfsCallback((path: string) => {
    setSelectedVfsPaths((prev) => prev.filter((p) => p !== path));
  }, []);
  const clearSelectedVfsPaths = useVfsCallback(() => {
    setSelectedVfsPaths([]);
  }, []);

  // --- Sidebar Management ---
  const [activeItemId, setActiveItemId] = useState<string | null>(
    initialSelectedItemId,
  );
  const [activeItemType, setActiveItemType] = useState<SidebarItemType | null>(
    initialSelectedItemType,
  );

  const handleSelectItem = useCallback(
    (id: string | null, type: SidebarItemType | null) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      setIsStreaming(false);
      clearSelectedVfsPaths();
      setMessages([]);
      setErrorState(null);
      setActiveItemId(id);
      setActiveItemType(type);
      setIsLoadingMessages(!!id);
      modEvents.emit(ModEvent.CHAT_SELECTED, { id, type });
    },
    [clearSelectedVfsPaths],
  );

  const sidebarItems = useMemo<SidebarItem[]>(() => {
    const allProjects = storage.projects || [];
    const allConversations = storage.conversations || [];
    const combinedItems: SidebarItem[] = [
      ...allProjects.map(
        (p): ProjectSidebarItem => ({ ...p, type: "project" }),
      ),
      ...allConversations.map(
        (c): ConversationSidebarItem => ({ ...c, type: "conversation" }),
      ),
    ];
    combinedItems.sort(
      (a, b) => (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0),
    );
    return combinedItems;
  }, [storage.projects, storage.conversations]);

  const realSidebarMgmt = useSidebarManagement({
    initialSelectedItemId,
    initialSelectedItemType,
    onSelectItem: handleSelectItem,
    dbCreateConversation: storage.createConversation,
    dbCreateProject: storage.createProject,
    dbDeleteConversation: storage.deleteConversation,
    dbDeleteProject: storage.deleteProject,
    dbRenameConversation: storage.renameConversation,
    dbRenameProject: storage.renameProject,
    dbUpdateConversationSystemPrompt: storage.updateConversationSystemPrompt,
    dbGetConversation: storage.getConversation,
    dbGetMessagesForConversation: storage.getMessagesForConversation,
    dbBulkAddMessages: storage.bulkAddMessages,
    dbUpdateConversationTimestamp: storage.updateConversationTimestamp,
    dbCountChildProjects: storage.countChildProjects,
    dbCountChildConversations: storage.countChildConversations,
    dbToggleVfsEnabled: storage.toggleVfsEnabled,
    sidebarItems: sidebarItems,
  });

  const dummySidebarMgmt = useMemo(
    () => ({
      selectedItemId: null,
      selectedItemType: null,
      selectItem: async () => {
        console.warn("Sidebar is disabled.");
      },
      createConversation: async () => {
        console.warn("Sidebar is disabled.");
        throw new Error("Sidebar is disabled.");
      },
      createProject: async () => {
        console.warn("Sidebar is disabled.");
        throw new Error("Sidebar is disabled.");
      },
      deleteItem: async () => {
        console.warn("Sidebar is disabled.");
      },
      renameItem: async () => {
        console.warn("Sidebar is disabled.");
      },
      updateConversationSystemPrompt: async () => {
        console.warn("Sidebar is disabled.");
      },
      exportConversation: async () => {
        console.warn("Sidebar is disabled.");
      },
      importConversation: async () => {
        console.warn("Sidebar is disabled.");
      },
      exportAllConversations: async () => {
        console.warn("Sidebar is disabled.");
      },
      toggleVfsEnabled: async () => {
        console.warn("Sidebar is disabled.");
      },
    }),
    [],
  );

  const sidebarMgmt = useMemo(() => {
    return enableSidebar ? realSidebarMgmt : dummySidebarMgmt;
  }, [enableSidebar, realSidebarMgmt, dummySidebarMgmt]);

  // --- Active Item Data ---
  const activeItemData = useMemo(() => {
    if (!activeItemId || !activeItemType) return null;
    const item = sidebarItems.find((i) => i.id === activeItemId);
    if (item && item.type === activeItemType) {
      return item;
    }
    return null;
  }, [activeItemId, activeItemType, sidebarItems]);

  const activeConversationData = useMemo(() => {
    return activeItemType === "conversation"
      ? (activeItemData as DbConversation | null)
      : null;
  }, [activeItemType, activeItemData]);

  // --- VFS Keying Logic ---
  const vfsKey = useMemo(() => {
    if (!enableVfs) return null;
    if (activeItemType === "project" && activeItemId) {
      return activeItemId;
    }
    if (activeItemType === "conversation" && activeConversationData) {
      return activeConversationData.parentId || "orphan";
    }
    return null;
  }, [enableVfs, activeItemType, activeItemId, activeConversationData]);

  // --- VFS Instantiation Logic ---
  const isVfsEnabledForItem = useMemo(
    () => (enableVfs ? (activeItemData?.vfsEnabled ?? false) : false),
    [enableVfs, activeItemData],
  );

  const realVfs = useVirtualFileSystem({
    itemId: activeItemId,
    itemType: activeItemType,
    isEnabled: isVfsEnabledForItem && !!activeItemId,
    vfsKey,
  });

  const vfs = useMemo(() => {
    if (enableVfs && isVfsEnabledForItem && activeItemId) {
      return realVfs;
    }
    return dummyVfs;
  }, [enableVfs, isVfsEnabledForItem, activeItemId, realVfs]);

  useEffect(() => {
    if (!isVfsEnabledForItem && selectedVfsPaths.length > 0) {
      clearSelectedVfsPaths();
    }
  }, [isVfsEnabledForItem, selectedVfsPaths, clearSelectedVfsPaths]);

  // --- Settings ---
  const chatSettings = useChatSettings({
    activeConversationData: activeConversationData,
    activeProjectData:
      activeItemType === "project"
        ? (activeItemData as DbProject | null)
        : null,
    enableAdvancedSettings: enableAdvancedSettings,
  });

  // --- AI Interaction ---
  // This function now gets the API key for the selected provider config
  const getApiKeyForSelectedProvider = useCallback((): string | undefined => {
    if (!providerModel.selectedProviderId) return undefined;
    const selectedDbConfig = (
      storage.providerConfigs || EMPTY_DB_PROVIDER_CONFIGS
    ).find((p) => p.id === providerModel.selectedProviderId);
    if (!selectedDbConfig) return undefined;
    if (!selectedDbConfig.apiKeyId) return undefined;
    return (storage.apiKeys || EMPTY_API_KEYS).find(
      (k) => k.id === selectedDbConfig.apiKeyId,
    )?.value;
  }, [
    providerModel.selectedProviderId,
    storage.providerConfigs,
    storage.apiKeys,
  ]);

  const aiInteraction = useAiInteraction({
    selectedModel: providerModel.selectedModel,
    selectedProvider: providerModel.selectedProvider,
    getApiKeyForProvider: getApiKeyForSelectedProvider,
    streamingThrottleRate,
    setLocalMessages: setMessages,
    setIsAiStreaming: setIsStreaming,
    setError,
    addDbMessage: storage.addDbMessage,
    abortControllerRef,
  });

  // --- Message Handling ---
  const messageHandling = useMessageHandling({
    selectedConversationId: activeConversationData?.id ?? null,
    performAiStream: aiInteraction.performAiStream,
    stopStreamingCallback: useCallback(() => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      setIsStreaming(false);
    }, []),
    activeSystemPrompt: chatSettings.activeSystemPrompt,
    temperature: chatSettings.temperature,
    maxTokens: chatSettings.maxTokens,
    topP: chatSettings.topP,
    topK: chatSettings.topK,
    presencePenalty: chatSettings.presencePenalty,
    frequencyPenalty: chatSettings.frequencyPenalty,
    isAiStreaming: isStreaming,
    setIsAiStreaming: setIsStreaming,
    localMessages: messages,
    setLocalMessages: setMessages,
    isLoadingMessages: isLoadingMessages,
    setIsLoadingMessages: setIsLoadingMessages,
    error: error,
    setError,
    addDbMessage: storage.addDbMessage,
    deleteDbMessage: storage.deleteDbMessage,
    getMessagesForConversation: storage.getMessagesForConversation,
  });

  // --- Phase 5: Middleware Runner ---
  const runMiddleware = useCallback(
    async <H extends ModMiddlewareHookName>(
      hookName: H,
      initialPayload: ModMiddlewarePayloadMap[H],
    ): Promise<ModMiddlewareReturnMap[H] | false> => {
      const callbacksMap = modMiddlewareCallbacksRef.current.get(hookName);

      // --- Case 1: No middleware registered ---
      if (!callbacksMap || callbacksMap.size === 0) {
        const hook: ModMiddlewareHookName = hookName;
        switch (hook) {
          case ModMiddlewareHook.PROCESS_RESPONSE_CHUNK:
            return (initialPayload as ProcessResponseChunkPayload)
              .chunk as unknown as ModMiddlewareReturnMap[H];
          case ModMiddlewareHook.RENDER_MESSAGE:
            return (initialPayload as RenderMessagePayload)
              .message as unknown as ModMiddlewareReturnMap[H];
          case ModMiddlewareHook.SUBMIT_PROMPT:
          case ModMiddlewareHook.VFS_WRITE:
            return initialPayload as unknown as ModMiddlewareReturnMap[H];
          default:
            return initialPayload as unknown as ModMiddlewareReturnMap[H];
        }
      }

      // --- Case 2: Middleware registered ---
      let currentData:
        | ModMiddlewarePayloadMap[H]
        | ModMiddlewareReturnMap[H]
        | false = initialPayload;
      const callbacks = Array.from(callbacksMap.values());

      for (const callback of callbacks) {
        if (currentData === false) {
          break;
        }
        try {
          currentData = await callback(currentData as any);
        } catch (err) {
          console.error(
            `[Middleware] Error executing middleware for hook '${hookName}':`,
            err,
          );
          toast.error(`Middleware error during ${hookName}. Action cancelled.`);
          currentData = false;
          break;
        }
      }

      if (currentData !== false && currentData === initialPayload) {
        const hook: ModMiddlewareHookName = hookName;
        switch (hook) {
          case ModMiddlewareHook.PROCESS_RESPONSE_CHUNK:
            return (initialPayload as ProcessResponseChunkPayload)
              .chunk as unknown as ModMiddlewareReturnMap[H];
          case ModMiddlewareHook.RENDER_MESSAGE:
            return (initialPayload as RenderMessagePayload)
              .message as unknown as ModMiddlewareReturnMap[H];
          default:
            return initialPayload as unknown as ModMiddlewareReturnMap[H];
        }
      }
      return currentData as ModMiddlewareReturnMap[H] | false;
    },
    [],
  );

  // --- Submit Handler ---
  const handleSubmit = useCallback(
    async (
      promptValue: string,
      attachedFilesValue: File[],
      vfsPathsToSubmit: string[],
    ) => {
      const currentPrompt = promptValue.trim();
      const canSubmit =
        currentPrompt.length > 0 ||
        attachedFilesValue.length > 0 ||
        vfsPathsToSubmit.length > 0;

      if (!canSubmit) return;
      if (isStreaming) {
        toast.info("Please wait for the current response to finish.");
        return;
      }
      if (!providerModel.selectedProvider || !providerModel.selectedModel) {
        setError("Error: Please select an active AI Provider and Model first.");
        toast.error("Please select an AI Provider and Model.");
        return;
      }

      // Check for API key using the *adjusted* logic
      const selectedDbConfig = (
        storage.providerConfigs || EMPTY_DB_PROVIDER_CONFIGS
      ).find((p) => p.id === providerModel.selectedProviderId);
      const needsKey =
        selectedDbConfig?.apiKeyId ||
        requiresApiKey(selectedDbConfig?.type ?? null);

      if (needsKey && !getApiKeyForSelectedProvider()) {
        const errorMsg = `API Key for ${providerModel.selectedProvider.name} is not set, selected, or linked. Check Settings -> Providers.`;
        setError(errorMsg);
        toast.error(errorMsg);
        if (!enableApiKeyManagement) {
          toast.info(
            "API Key management is disabled. Ensure keys are configured correctly if needed by the provider.",
          );
        }
        return;
      }

      let conversationIdToSubmit: string | null = null;
      let parentProjectId: string | null = null;

      if (activeItemType === "project" && activeItemId) {
        parentProjectId = activeItemId;
      } else if (activeItemType === "conversation" && activeItemId) {
        parentProjectId = activeConversationData?.parentId ?? null;
        conversationIdToSubmit = activeItemId;
      }

      let newConvCreated = false;
      if (!conversationIdToSubmit) {
        try {
          const title = currentPrompt.substring(0, 50) || "New Chat";
          const newConvId = await sidebarMgmt.createConversation(
            parentProjectId,
            title,
          );
          if (!newConvId)
            throw new Error("Failed to get ID for new conversation.");
          conversationIdToSubmit = newConvId;
          newConvCreated = true;
          modEvents.emit(ModEvent.CHAT_CREATED, {
            id: newConvId,
            type: "conversation",
            parentId: parentProjectId,
          });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : "Unknown error";
          setError(`Error: Could not start chat - ${message}`);
          toast.error(`Failed to start chat: ${message}`);
          return;
        }
      }

      if (!conversationIdToSubmit) {
        setError("Error: Could not determine target conversation for submit.");
        toast.error("Could not determine target conversation.");
        return;
      }

      // --- Prepare Context Prefix ---
      let contextPrefix = "";
      const pathsIncludedInContext: string[] = [];

      if (
        enableVfs &&
        isVfsEnabledForItem &&
        vfs.isReady &&
        vfs.configuredVfsKey === vfs.vfsKey &&
        vfsPathsToSubmit.length > 0
      ) {
        modEvents.emit(ModEvent.VFS_CONTEXT_ADDED, {
          paths: vfsPathsToSubmit,
        });
        const vfsContentPromises = vfsPathsToSubmit.map(async (path) => {
          try {
            const contentBytes = await vfs.readFile(path);
            const contentText = decodeUint8Array(contentBytes);
            pathsIncludedInContext.push(path);
            const fileExtension = path.split(".").pop()?.toLowerCase() || "";
            return `<vfs_file path="${path}" extension="${fileExtension}">
\`\`\`${fileExtension}
${contentText}
\`\`\`
</vfs_file>`;
          } catch (readErr) {
            console.error(`Error reading VFS file ${path}:`, readErr);
            toast.error(`Failed to read VFS file: ${path}`);
            return `<vfs_file path="${path}" error="Failed to read"/>`;
          }
        });
        const vfsContents = await Promise.all(vfsContentPromises);
        if (vfsContents.length > 0) {
          contextPrefix += vfsContents.join("\n") + "\n";
        }
      } else if (vfsPathsToSubmit.length > 0) {
        toast.warning("VFS not enabled for this chat. Selected files ignored.");
      }

      if (attachedFilesValue.length > 0) {
        const attachedContentPromises = attachedFilesValue.map(async (file) => {
          if (file.type.startsWith("text/") || isCodeFile(file.name)) {
            try {
              const contentText = await file.text();
              const fileExtension =
                file.name.split(".").pop()?.toLowerCase() || "";
              return `<attached_file name="${file.name}" type="${file.type}" extension="${fileExtension}">
\`\`\`${fileExtension}
${contentText}
\`\`\`
</attached_file>`;
            } catch (readErr) {
              let errmsg = "";
              if (readErr instanceof Error) {
                errmsg = readErr.message;
              } else {
                errmsg = String(readErr);
              }
              toast.error(
                `Failed to read attached file: ${file.name}\n${errmsg}`,
              );
              return `<attached_file name="${file.name}" type="${file.type}" error="Failed to read"/>`;
            }
          } else {
            toast.info(`Skipping unsupported file: ${file.name}`);
            return `<attached_file name="${file.name}" type="${file.type}" status="skipped_unsupported"/>`;
          }
        });
        const attachedContents = await Promise.all(attachedContentPromises);
        if (attachedContents.length > 0) {
          contextPrefix += attachedContents.join("\n") + "\n";
        }
      }

      const originalUserPrompt = currentPrompt;
      const promptToSendToAI = contextPrefix + originalUserPrompt;

      if (promptToSendToAI.trim().length > 0) {
        let submitPayload: ModMiddlewarePayloadMap[typeof ModMiddlewareHook.SUBMIT_PROMPT] =
          {
            prompt: promptToSendToAI,
            originalUserPrompt,
            attachedFiles: attachedFilesValue,
            vfsPaths: pathsIncludedInContext,
            conversationId: conversationIdToSubmit,
          };

        modEvents.emit(ModEvent.MESSAGE_BEFORE_SUBMIT, {
          prompt: originalUserPrompt,
          attachedFiles: attachedFilesValue,
          vfsPaths: pathsIncludedInContext,
        });

        const middlewareResult = await runMiddleware(
          ModMiddlewareHook.SUBMIT_PROMPT,
          submitPayload,
        );

        if (middlewareResult === false) {
          toast.info("Submission cancelled by a mod.");
          if (newConvCreated && conversationIdToSubmit) {
            await sidebarMgmt.deleteItem(
              conversationIdToSubmit,
              "conversation",
            );
          }
          return;
        }
        submitPayload = middlewareResult;

        await messageHandling.handleSubmitCore(
          submitPayload.originalUserPrompt,
          submitPayload.conversationId,
          submitPayload.prompt,
          submitPayload.vfsPaths,
        );
      }
    },
    [
      isStreaming,
      providerModel.selectedProvider,
      providerModel.selectedModel,
      activeItemId,
      activeItemType,
      activeConversationData,
      sidebarMgmt,
      setError,
      messageHandling,
      isVfsEnabledForItem,
      vfs,
      enableVfs,
      enableApiKeyManagement,
      // runMiddleware,
      getApiKeyForSelectedProvider,
      storage.providerConfigs,
      providerModel.selectedProviderId,
    ],
  );

  // --- Other Handlers ---
  const regenerateMessage = useCallback(
    async (messageId: string) => {
      if (activeItemType !== "conversation" || !activeItemId) {
        toast.error("Please select the conversation containing the message.");
        return;
      }
      if (isStreaming) {
        toast.info("Please wait for the current response to finish.");
        return;
      }
      await messageHandling.regenerateMessageCore(messageId);
    },
    [messageHandling, activeItemType, activeItemId, isStreaming],
  );

  const stopStreaming = useCallback(() => {
    messageHandling.stopStreamingCore();
    toast.info("AI response stopped.");
  }, [messageHandling]);

  const handleImportConversation = useCallback(
    async (file: File) => {
      let parentId: string | null = null;
      if (activeItemType === "project" && activeItemId) {
        parentId = activeItemId;
      } else if (activeItemType === "conversation" && activeItemId) {
        parentId = activeConversationData?.parentId ?? null;
      }
      await sidebarMgmt.importConversation(file, parentId);
    },
    [sidebarMgmt, activeItemType, activeItemId, activeConversationData],
  );

  const handleToggleVfs = useCallback(async () => {
    if (!activeItemId || !activeItemType) {
      toast.warning("No item selected.");
      return;
    }
    if (!enableVfs) {
      toast.error("Virtual Filesystem is disabled in configuration.");
      return;
    }
    await sidebarMgmt.toggleVfsEnabled(
      activeItemId,
      activeItemType,
      isVfsEnabledForItem,
    );
  }, [
    sidebarMgmt,
    activeItemId,
    activeItemType,
    isVfsEnabledForItem,
    enableVfs,
  ]);

  // --- Mod Registration Callbacks ---
  const registerModPromptAction = useCallback(
    (action: CustomPromptAction): (() => void) => {
      const actionId = action.id || nanoid();
      const actionWithId = { ...action, id: actionId };
      setModPromptActions((prev) => [...prev, actionWithId]);
      return () => {
        setModPromptActions((prev) => prev.filter((a) => a.id !== actionId));
      };
    },
    [],
  );

  const registerModMessageAction = useCallback(
    (action: CustomMessageAction): (() => void) => {
      const actionId = action.id || nanoid();
      const actionWithId = { ...action, id: actionId };
      setModMessageActions((prev) => [...prev, actionWithId]);
      return () => {
        setModMessageActions((prev) => prev.filter((a) => a.id !== actionId));
      };
    },
    [],
  );

  const registerModSettingsTab = useCallback(
    (tab: CustomSettingTab): (() => void) => {
      const tabId = tab.id || nanoid();
      const tabWithId = { ...tab, id: tabId };
      setModSettingsTabs((prev) => [...prev, tabWithId]);
      return () => {
        setModSettingsTabs((prev) => prev.filter((t) => t.id !== tabId));
      };
    },
    [],
  );

  const registerModEventListener = useCallback(
    <E extends ModEventName>(
      eventName: E,
      callback: (payload: ModEventPayloadMap[E]) => void,
    ): (() => void) => {
      modEvents.on(eventName, callback);
      const unsubscribe = () => {
        modEvents.off(eventName, callback);
      };
      return unsubscribe;
    },
    [],
  );

  const registerModMiddleware = useCallback(
    <H extends ModMiddlewareHookName>(
      hookName: H,
      callback: (
        payload: ModMiddlewarePayloadMap[H],
      ) => ModMiddlewareReturnMap[H] | Promise<ModMiddlewareReturnMap[H]>,
    ): (() => void) => {
      const middlewareId = nanoid();
      const currentMap = modMiddlewareCallbacksRef.current;
      if (!currentMap.has(hookName)) {
        currentMap.set(hookName, new Map());
      }
      currentMap.get(hookName)?.set(middlewareId, callback);
      return () => {
        const hookCallbacks = currentMap.get(hookName);
        if (hookCallbacks) {
          hookCallbacks.delete(middlewareId);
          if (hookCallbacks.size === 0) {
            currentMap.delete(hookName);
          }
        }
      };
    },
    [],
  );

  // --- Function to get Context Snapshot for Mods ---
  const getContextSnapshotForMod =
    useCallback((): ReadonlyChatContextSnapshot => {
      return Object.freeze({
        selectedItemId: activeItemId,
        selectedItemType: activeItemType,
        messages: messages,
        isStreaming: isStreaming,
        selectedProviderId: providerModel.selectedProviderId,
        selectedModelId: providerModel.selectedModelId,
        activeSystemPrompt: chatSettings.activeSystemPrompt,
        temperature: chatSettings.temperature,
        maxTokens: chatSettings.maxTokens,
        theme: chatSettings.theme,
        isVfsEnabledForItem: isVfsEnabledForItem,
        getApiKeyForProvider: getApiKeyForSelectedProvider,
      });
    }, [
      activeItemId,
      activeItemType,
      messages,
      isStreaming,
      providerModel.selectedProviderId,
      providerModel.selectedModelId,
      chatSettings.activeSystemPrompt,
      chatSettings.temperature,
      chatSettings.maxTokens,
      chatSettings.theme,
      isVfsEnabledForItem,
      getApiKeyForSelectedProvider,
    ]);

  // --- Mod Loader Initialization ---
  useEffect(() => {
    const dbMods = storage.mods || EMPTY_DB_MODS;
    setModPromptActions([]);
    setModMessageActions([]);
    setModSettingsTabs([]);
    modEventListenersRef.current.clear();
    modMiddlewareCallbacksRef.current.clear();

    if (dbMods.length > 0) {
      const registrationCallbacks = {
        registerPromptAction: registerModPromptAction,
        registerMessageAction: registerModMessageAction,
        registerSettingsTab: registerModSettingsTab,
        registerEventListener: registerModEventListener,
        registerMiddleware: registerModMiddleware,
      };
      loadMods(dbMods, registrationCallbacks, getContextSnapshotForMod)
        .then((instances) => {
          setLoadedMods(instances);
          modEvents.emit(ModEvent.APP_LOADED);
        })
        .catch((err: unknown) => {
          if (err instanceof Error) {
            setError("Failed to load one or more mods." + err.message);
          } else {
            setError("Failed to load one or more mods.");
          }
          modEvents.emit(ModEvent.APP_LOADED);
        });
    } else {
      setLoadedMods(EMPTY_MOD_INSTANCES);
      modEvents.emit(ModEvent.APP_LOADED);
    }
  }, [
    storage.mods,
    registerModPromptAction,
    registerModMessageAction,
    registerModSettingsTab,
    registerModEventListener,
    registerModMiddleware,
    getContextSnapshotForMod,
    setError,
  ]);

  // --- Settings Modal Event Emission ---
  const handleSettingsModalOpenChange = useCallback((open: boolean) => {
    setIsSettingsModalOpen(open);
    if (open) {
      modEvents.emit(ModEvent.SETTINGS_OPENED);
    } else {
      modEvents.emit(ModEvent.SETTINGS_CLOSED);
    }
  }, []);

  // --- Context Values ---
  const coreContextValue: CoreChatContextProps = useMemo(
    () => ({
      messages,
      setMessages,
      isLoadingMessages,
      setIsLoadingMessages,
      isStreaming,
      setIsStreaming,
      error,
      setError,
      handleSubmitCore: messageHandling.handleSubmitCore,
      stopStreamingCore: messageHandling.stopStreamingCore,
      regenerateMessageCore: messageHandling.regenerateMessageCore,
      abortControllerRef,
    }),
    [
      messages,
      isLoadingMessages,
      isStreaming,
      error,
      setError,
      messageHandling.handleSubmitCore,
      messageHandling.stopStreamingCore,
      messageHandling.regenerateMessageCore,
    ],
  );

  const combinedPromptActions = useMemo(
    () => [...customPromptActions, ...modPromptActions],
    [customPromptActions, modPromptActions],
  );
  const combinedMessageActions = useMemo(
    () => [...customMessageActions, ...modMessageActions],
    [customMessageActions, modMessageActions],
  );
  const combinedSettingsTabs = useMemo(
    () => [...customSettingsTabs, ...modSettingsTabs],
    [customSettingsTabs, modSettingsTabs],
  );

  const fullContextValue: ChatContextProps = useMemo(
    () => ({
      enableApiKeyManagement,
      enableAdvancedSettings,
      activeProviders: activeProviders,
      selectedProviderId: providerModel.selectedProviderId,
      setSelectedProviderId: providerModel.setSelectedProviderId,
      selectedModelId: providerModel.selectedModelId,
      setSelectedModelId: providerModel.setSelectedModelId,
      apiKeys: storage.apiKeys || EMPTY_API_KEYS,
      // API key selection is now handled in provider config, not in context
      // selectedApiKeyId: undefined,
      // setSelectedApiKeyId: undefined,
      addApiKey: apiKeysMgmt.addApiKey,
      deleteApiKey: apiKeysMgmt.deleteApiKey,
      getApiKeyForProvider: getApiKeyForSelectedProvider,
      dbProviderConfigs: storage.providerConfigs || EMPTY_DB_PROVIDER_CONFIGS,
      addDbProviderConfig: storage.addProviderConfig,
      updateDbProviderConfig: storage.updateProviderConfig,
      deleteDbProviderConfig: storage.deleteProviderConfig,
      sidebarItems: sidebarItems || EMPTY_SIDEBAR_ITEMS,
      selectedItemId: sidebarMgmt.selectedItemId,
      selectedItemType: sidebarMgmt.selectedItemType,
      selectItem: sidebarMgmt.selectItem,
      createConversation: sidebarMgmt.createConversation,
      createProject: sidebarMgmt.createProject,
      deleteItem: sidebarMgmt.deleteItem,
      renameItem: sidebarMgmt.renameItem,
      updateConversationSystemPrompt:
        sidebarMgmt.updateConversationSystemPrompt,
      messages: coreContextValue.messages,
      isLoading: coreContextValue.isLoadingMessages,
      isStreaming: coreContextValue.isStreaming,
      error: coreContextValue.error,
      setError: coreContextValue.setError,
      handleSubmit,
      stopStreaming,
      regenerateMessage,
      selectedVfsPaths: selectedVfsPaths,
      addSelectedVfsPath: addSelectedVfsPath,
      removeSelectedVfsPath: removeSelectedVfsPath,
      clearSelectedVfsPaths: clearSelectedVfsPaths,
      temperature: chatSettings.temperature,
      setTemperature: chatSettings.setTemperature,
      maxTokens: chatSettings.maxTokens,
      setMaxTokens: chatSettings.setMaxTokens,
      globalSystemPrompt: chatSettings.globalSystemPrompt,
      setGlobalSystemPrompt: chatSettings.setGlobalSystemPrompt,
      activeSystemPrompt: chatSettings.activeSystemPrompt,
      topP: chatSettings.topP,
      setTopP: chatSettings.setTopP,
      topK: chatSettings.topK,
      setTopK: chatSettings.setTopK,
      presencePenalty: chatSettings.presencePenalty,
      setPresencePenalty: chatSettings.setPresencePenalty,
      frequencyPenalty: chatSettings.frequencyPenalty,
      setFrequencyPenalty: chatSettings.setFrequencyPenalty,
      theme: chatSettings.theme,
      setTheme: chatSettings.setTheme,
      streamingThrottleRate,
      searchTerm: chatSettings.searchTerm,
      setSearchTerm: chatSettings.setSearchTerm,
      exportConversation: sidebarMgmt.exportConversation,
      importConversation: handleImportConversation,
      exportAllConversations: sidebarMgmt.exportAllConversations,
      clearAllData: storage.clearAllData,
      isVfsEnabledForItem: isVfsEnabledForItem,
      toggleVfsEnabled: handleToggleVfs,
      vfs: vfs,
      getConversation: storage.getConversation,
      getProject: storage.getProject,
      customPromptActions: combinedPromptActions,
      customMessageActions: combinedMessageActions,
      customSettingsTabs: combinedSettingsTabs,
      dbMods: storage.mods || EMPTY_DB_MODS,
      loadedMods: loadedMods,
      addDbMod: storage.addMod,
      updateDbMod: storage.updateMod,
      deleteDbMod: storage.deleteMod,
      isSettingsModalOpen: isSettingsModalOpen,
      onSettingsModalOpenChange: handleSettingsModalOpenChange,
    }),
    [
      enableApiKeyManagement,
      enableAdvancedSettings,
      activeProviders,
      providerModel.selectedProviderId,
      providerModel.setSelectedProviderId,
      providerModel.selectedModelId,
      providerModel.setSelectedModelId,
      storage.apiKeys,
      apiKeysMgmt,
      getApiKeyForSelectedProvider,
      storage.providerConfigs,
      storage.addProviderConfig,
      storage.updateProviderConfig,
      storage.deleteProviderConfig,
      sidebarItems,
      sidebarMgmt,
      coreContextValue.messages,
      coreContextValue.isLoadingMessages,
      coreContextValue.isStreaming,
      coreContextValue.error,
      coreContextValue.setError,
      handleSubmit,
      stopStreaming,
      regenerateMessage,
      selectedVfsPaths,
      addSelectedVfsPath,
      removeSelectedVfsPath,
      clearSelectedVfsPaths,
      chatSettings,
      handleImportConversation,
      storage.clearAllData,
      handleToggleVfs,
      isVfsEnabledForItem,
      vfs,
      storage.getConversation,
      storage.getProject,
      combinedPromptActions,
      combinedMessageActions,
      combinedSettingsTabs,
      storage.mods,
      loadedMods,
      storage.addMod,
      storage.updateMod,
      storage.deleteMod,
      isSettingsModalOpen,
      handleSettingsModalOpenChange,
      streamingThrottleRate,
    ],
  );

  useEffect(() => {
    console.log(
      `[ChatProvider] Active item state updated: ID=${activeItemId}, Type=${activeItemType}`,
    );
  }, [activeItemId, activeItemType]);

  return (
    <CoreChatContext.Provider value={coreContextValue}>
      <ChatContext.Provider value={fullContextValue}>
        {children}
      </ChatContext.Provider>
    </CoreChatContext.Provider>
  );
};
