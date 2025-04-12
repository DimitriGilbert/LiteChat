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
} from "@/lib/types";
// Import Mod types
import type {
  DbMod,
  ModInstance,
  // REMOVED: ModEventPayloadMap, // Now imported via ModEventName in events.ts
  // REMOVED: ModMiddlewarePayloadMap, // Now imported via ModMiddlewareHookName in api.ts
  // REMOVED: ModMiddlewareReturnMap, // Now imported via ModMiddlewareHookName in api.ts
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
// Import Mod Loader and related items
import { loadMods } from "@/mods/loader";
import { modEvents, ModEvent, ModEventName } from "@/mods/events"; // Import ModEvent constants and ModEventName type
import {
  ModMiddlewareHook, // Import middleware hook names
  type ReadonlyChatContextSnapshot,
  // REMOVED: type ModEventName, // Now imported from events.ts
  type ModMiddlewareHookName,
} from "@/mods/api";
// Import payload/return maps directly where needed (or keep in types.ts if preferred)
import type {
  ModEventPayloadMap,
  ModMiddlewarePayloadMap,
  ModMiddlewareReturnMap,
} from "@/mods/types";
import { nanoid } from "nanoid"; // Import nanoid for unique IDs

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
const EMPTY_DB_MODS: DbMod[] = []; // Added for initial state

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
  selectedApiKeyId: {} as Record<string, string | null>,
  setSelectedApiKeyId: () => {
    console.warn("API Key Management is disabled.");
  },
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
  getApiKeyForProvider: () => {
    return undefined;
  },
};

interface ChatProviderProps {
  children: React.ReactNode;
  providers: AiProviderConfig[];
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
  providers,
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
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false); // State for settings modal

  // --- Mod State ---
  const [loadedMods, setLoadedMods] =
    useState<ModInstance[]>(EMPTY_MOD_INSTANCES);
  // State for items registered by mods
  const [modPromptActions, setModPromptActions] = useState<
    CustomPromptAction[]
  >([]);
  const [modMessageActions, setModMessageActions] = useState<
    CustomMessageAction[]
  >([]);
  const [modSettingsTabs, setModSettingsTabs] = useState<CustomSettingTab[]>(
    [],
  );
  // Use refs for listeners/middleware to avoid context re-renders on registration
  const modEventListenersRef = useRef<Map<string, Map<string, Function>>>(
    new Map(),
  ); // eventName -> listenerId -> listenerFn
  const modMiddlewareCallbacksRef = useRef<Map<string, Map<string, Function>>>(
    new Map(),
  ); // hookName -> middlewareId -> middlewareFn

  const setError = useCallback((newError: string | null) => {
    setErrorState(newError);
    if (newError) {
      console.error("Chat Error Context:", newError);
      // Phase 5: Emit 'error:app' event via modEvents
      modEvents.emit(ModEvent.APP_ERROR, { message: newError }); // Use ModEvent constant
    }
  }, []);

  // --- Hooks ---
  const providerModel = useProviderModelSelection({
    providers,
    initialProviderId,
    initialModelId,
  });
  const storage = useChatStorage(); // Includes mod storage functions now
  const realApiKeysMgmt = useApiKeysManagement({
    apiKeys: storage.apiKeys || EMPTY_API_KEYS,
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
      // Phase 5: Emit 'chat:selected' event
      modEvents.emit(ModEvent.CHAT_SELECTED, { id, type }); // Use ModEvent constant
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
  const aiInteraction = useAiInteraction({
    selectedModel: providerModel.selectedModel,
    selectedProvider: providerModel.selectedProvider,
    getApiKeyForProvider: apiKeysMgmt.getApiKeyForProvider,
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

  // --- Effect for Default API Key Selection ---
  useEffect(() => {
    if (!enableApiKeyManagement || !providerModel.selectedProviderId) {
      return;
    }
    const currentProviderId = providerModel.selectedProviderId;
    if (apiKeysMgmt.selectedApiKeyId[currentProviderId]) {
      return;
    }
    const providerConfig = providers.find((p) => p.id === currentProviderId);
    const needsKey =
      providerConfig?.requiresApiKey ?? currentProviderId !== "mock";
    if (!needsKey) {
      return;
    }
    const availableKeysForProvider = (storage.apiKeys || []).filter(
      (key) => key.providerId === currentProviderId,
    );
    if (availableKeysForProvider.length > 0) {
      const firstKey = availableKeysForProvider[0];
      apiKeysMgmt.setSelectedApiKeyId(currentProviderId, firstKey.id);
    }
  }, [
    providerModel.selectedProviderId,
    storage.apiKeys,
    providers,
    apiKeysMgmt,
    enableApiKeyManagement,
  ]);

  // --- Phase 5: Middleware Runner ---
  const runMiddleware = useCallback(
    async <H extends ModMiddlewareHookName>(
      hookName: H,
      initialPayload: ModMiddlewarePayloadMap[H],
    ): Promise<ModMiddlewareReturnMap[H] | false> => {
      const callbacksMap = modMiddlewareCallbacksRef.current.get(hookName);
      if (!callbacksMap || callbacksMap.size === 0) {
        return initialPayload; // No middleware registered for this hook
      }

      let currentPayload: ModMiddlewarePayloadMap[H] | false = initialPayload;

      // Execute callbacks sequentially
      // Convert Map values (functions) to an array to iterate with async/await
      const callbacks = Array.from(callbacksMap.values());

      for (const callback of callbacks) {
        if (currentPayload === false) {
          // If a previous middleware returned false, stop processing
          break;
        }
        try {
          // Await the result in case the middleware is async
          currentPayload = await callback(currentPayload);
        } catch (err) {
          console.error(
            `[Middleware] Error executing middleware for hook '${hookName}':`,
            err,
          );
          // Optionally stop processing on error, or just log and continue
          // For now, let's stop processing on error
          currentPayload = false;
          toast.error(`Middleware error during ${hookName}. Action cancelled.`);
          break;
        }
      }

      return currentPayload as ModMiddlewareReturnMap[H] | false; // Type assertion needed here
    },
    [], // No dependencies needed as it uses the ref
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
        setError("Error: Please select an AI Provider and Model first.");
        toast.error("Please select an AI Provider and Model.");
        return;
      }

      const needsKey =
        providerModel.selectedProvider.requiresApiKey ??
        providerModel.selectedProvider.id !== "mock";
      if (
        needsKey &&
        !apiKeysMgmt.getApiKeyForProvider(providerModel.selectedProvider.id)
      ) {
        const errorMsg = `API Key for ${providerModel.selectedProvider.name} is not set or selected.`;
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

      // Create conversation if needed
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
          newConvCreated = true; // Mark that a new conversation was created
          // Phase 5: Emit 'chat:created' event
          modEvents.emit(ModEvent.CHAT_CREATED, {
            // Use ModEvent constant
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

      // VFS context
      if (
        enableVfs &&
        isVfsEnabledForItem &&
        vfs.isReady &&
        vfs.configuredVfsKey === vfs.vfsKey &&
        vfsPathsToSubmit.length > 0
      ) {
        // Phase 5: Emit 'vfs:contextAdded' event
        modEvents.emit(ModEvent.VFS_CONTEXT_ADDED, {
          // Use ModEvent constant
          paths: vfsPathsToSubmit,
        });
        const vfsContentPromises = vfsPathsToSubmit.map(async (path) => {
          try {
            const contentBytes = await vfs.readFile(path); // readFile emits read event
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

      // Attached files context
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
        // Phase 5: Integrate 'middleware:submitPrompt'
        let submitPayload: ModMiddlewarePayloadMap[typeof ModMiddlewareHook.SUBMIT_PROMPT] =
          {
            prompt: promptToSendToAI,
            originalUserPrompt,
            attachedFiles: attachedFilesValue, // Pass reference, mods should treat as read-only
            vfsPaths: pathsIncludedInContext,
            conversationId: conversationIdToSubmit,
          };

        // Phase 5: Emit 'message:beforeSubmit' event (before middleware)
        modEvents.emit(ModEvent.MESSAGE_BEFORE_SUBMIT, {
          // Use ModEvent constant
          prompt: originalUserPrompt,
          attachedFiles: attachedFilesValue,
          vfsPaths: pathsIncludedInContext,
        });

        const middlewareResult = await runMiddleware(
          ModMiddlewareHook.SUBMIT_PROMPT,
          submitPayload,
        );

        if (middlewareResult === false) {
          console.log("[Middleware] Submission cancelled by mod.");
          toast.info("Submission cancelled by a mod.");
          // If a new conversation was created but submission is cancelled, delete it?
          if (newConvCreated && conversationIdToSubmit) {
            console.log(
              "[Middleware] Deleting newly created conversation due to cancelled submission.",
            );
            await sidebarMgmt.deleteItem(
              conversationIdToSubmit,
              "conversation",
            );
          }
          return;
        }
        // Use potentially modified payload from middleware
        submitPayload = middlewareResult;

        // Call the core message handler with the final (potentially modified) data
        await messageHandling.handleSubmitCore(
          submitPayload.originalUserPrompt, // Use original prompt for user message display
          submitPayload.conversationId, // Use potentially modified ID (though unlikely for this hook)
          submitPayload.prompt, // Use potentially modified prompt for AI
          submitPayload.vfsPaths, // Use potentially modified VFS paths
        );
        // 'message:submitted' event is now emitted inside handleSubmitCore
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
      apiKeysMgmt,
      enableApiKeyManagement,
      runMiddleware, // Add middleware runner as dependency
      // No dependency on messages here to avoid re-creating handler on message change
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
      // TODO: Phase 5 - Add 'middleware:regenerateMessage' hook if needed
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
      const actionId = action.id || nanoid(); // Ensure an ID exists
      const actionWithId = { ...action, id: actionId };
      setModPromptActions((prev) => [...prev, actionWithId]);
      // Return unsubscribe function
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
      // Use central emitter, store unsubscribe locally if needed for cleanup
      const unsubscribe = modEvents.on(eventName, callback);
      return unsubscribe; // Return the emitter's unsubscribe
    },
    [],
  );

  const registerModMiddleware = useCallback(
    <H extends ModMiddlewareHookName>(
      hookName: H,
      callback: (
        payload: ModMiddlewarePayloadMap[H],
      ) => ModMiddlewareReturnMap[H] | Promise<ModMiddlewareReturnMap[H]>, // Allow async
    ): (() => void) => {
      const middlewareId = nanoid();
      const currentMap = modMiddlewareCallbacksRef.current;

      if (!currentMap.has(hookName)) {
        currentMap.set(hookName, new Map());
      }
      currentMap.get(hookName)?.set(middlewareId, callback);

      // Return unsubscribe function
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
  // Defined within the provider to capture current state/refs
  const getContextSnapshotForMod =
    useCallback((): ReadonlyChatContextSnapshot => {
      // Selectively pick properties from the latest state/refs
      // Avoid passing the entire context object directly
      return Object.freeze({
        selectedItemId: activeItemId,
        selectedItemType: activeItemType,
        messages: messages, // Note: This is a snapshot
        isStreaming: isStreaming,
        selectedProviderId: providerModel.selectedProviderId,
        selectedModelId: providerModel.selectedModelId,
        activeSystemPrompt: chatSettings.activeSystemPrompt,
        temperature: chatSettings.temperature,
        maxTokens: chatSettings.maxTokens,
        theme: chatSettings.theme,
        isVfsEnabledForItem: isVfsEnabledForItem,
        getApiKeyForProvider: apiKeysMgmt.getApiKeyForProvider,
        // Add other safe, read-only properties or functions as needed
      });
    }, [
      activeItemId,
      activeItemType,
      messages, // Dependency needed, but be aware it's a snapshot
      isStreaming,
      providerModel.selectedProviderId,
      providerModel.selectedModelId,
      chatSettings.activeSystemPrompt,
      chatSettings.temperature,
      chatSettings.maxTokens,
      chatSettings.theme,
      isVfsEnabledForItem,
      apiKeysMgmt.getApiKeyForProvider,
    ]);

  // --- Mod Loader Initialization ---
  useEffect(() => {
    const dbMods = storage.mods || EMPTY_DB_MODS;
    console.log(`[ChatProvider] Found ${dbMods.length} mods in DB.`);

    // Clear previous mod state before loading new ones
    setModPromptActions([]);
    setModMessageActions([]);
    setModSettingsTabs([]);
    modEventListenersRef.current.clear(); // Clear listeners managed by provider
    modMiddlewareCallbacksRef.current.clear();
    // Note: We don't call modEvents.removeAllListeners() here,
    // as mods might register listeners directly via the exported `modEvents`.
    // The registration callbacks handle unsubscribing specific listeners added via API.

    if (dbMods.length > 0) {
      const registrationCallbacks = {
        registerPromptAction: registerModPromptAction,
        registerMessageAction: registerModMessageAction,
        registerSettingsTab: registerModSettingsTab,
        registerEventListener: registerModEventListener,
        registerMiddleware: registerModMiddleware,
      };

      console.log("[ChatProvider] Loading mods...");
      loadMods(dbMods, registrationCallbacks, getContextSnapshotForMod)
        .then((instances) => {
          setLoadedMods(instances);
          console.log(
            `[ChatProvider] Finished loading ${instances.length} mod instances.`,
          );
          // Phase 5: Emit 'app:loaded' event after mods are processed
          modEvents.emit(ModEvent.APP_LOADED); // Use ModEvent constant
        })
        .catch((err) => {
          console.error("[ChatProvider] Error during mod loading:", err);
          setError("Failed to load one or more mods.");
          // Phase 5: Emit 'app:loaded' even if mods failed, app might still work
          modEvents.emit(ModEvent.APP_LOADED); // Use ModEvent constant
        });
    } else {
      setLoadedMods(EMPTY_MOD_INSTANCES);
      // Phase 5: Emit 'app:loaded' event even if no mods
      modEvents.emit(ModEvent.APP_LOADED); // Use ModEvent constant
    }

    // Cleanup function (optional, if dynamic mod unloading is needed)
    // return () => {
    //   loadedMods.forEach(unloadMod); // Assuming unloadMod exists
    // };
  }, [
    storage.mods, // Re-run when mods change in the DB
    registerModPromptAction, // Include registration callbacks
    registerModMessageAction,
    registerModSettingsTab,
    registerModEventListener,
    registerModMiddleware,
    getContextSnapshotForMod,
    setError, // Include setError
  ]);

  // --- Settings Modal Event Emission ---
  const handleSettingsModalOpenChange = useCallback((open: boolean) => {
    setIsSettingsModalOpen(open);
    if (open) {
      modEvents.emit(ModEvent.SETTINGS_OPENED); // Use ModEvent constant
    } else {
      modEvents.emit(ModEvent.SETTINGS_CLOSED); // Use ModEvent constant
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

  // Combine built-in custom actions/tabs with mod-provided ones
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
      // Config flags
      enableApiKeyManagement,
      enableAdvancedSettings,
      // Providers & Models
      providers,
      selectedProviderId: providerModel.selectedProviderId,
      setSelectedProviderId: providerModel.setSelectedProviderId,
      selectedModelId: providerModel.selectedModelId,
      setSelectedModelId: providerModel.setSelectedModelId,
      // API Keys
      apiKeys: storage.apiKeys || EMPTY_API_KEYS,
      selectedApiKeyId: apiKeysMgmt.selectedApiKeyId,
      setSelectedApiKeyId: apiKeysMgmt.setSelectedApiKeyId,
      addApiKey: apiKeysMgmt.addApiKey,
      deleteApiKey: apiKeysMgmt.deleteApiKey,
      getApiKeyForProvider: apiKeysMgmt.getApiKeyForProvider,
      // Sidebar
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
      // Core Chat State
      messages: coreContextValue.messages,
      isLoading: coreContextValue.isLoadingMessages,
      isStreaming: coreContextValue.isStreaming,
      error: coreContextValue.error,
      setError: coreContextValue.setError,
      // Core Actions
      handleSubmit,
      stopStreaming,
      regenerateMessage,
      // VFS Selection
      selectedVfsPaths: selectedVfsPaths,
      addSelectedVfsPath: addSelectedVfsPath,
      removeSelectedVfsPath: removeSelectedVfsPath,
      clearSelectedVfsPaths: clearSelectedVfsPaths,
      // Settings
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
      // Data Management
      exportConversation: sidebarMgmt.exportConversation,
      importConversation: handleImportConversation,
      exportAllConversations: sidebarMgmt.exportAllConversations,
      clearAllData: storage.clearAllData,
      // VFS Management
      isVfsEnabledForItem: isVfsEnabledForItem,
      toggleVfsEnabled: handleToggleVfs,
      vfs: vfs,
      // DB Accessors
      getConversation: storage.getConversation,
      getProject: storage.getProject,
      // Extensibility (Combined)
      customPromptActions: combinedPromptActions,
      customMessageActions: combinedMessageActions,
      customSettingsTabs: combinedSettingsTabs,
      // Mod System State & Storage (Exposed for Settings UI)
      dbMods: storage.mods || EMPTY_DB_MODS, // Use EMPTY_DB_MODS default
      loadedMods: loadedMods,
      addDbMod: storage.addMod,
      updateDbMod: storage.updateMod,
      deleteDbMod: storage.deleteMod,
      // Settings Modal Control (for event emission)
      isSettingsModalOpen: isSettingsModalOpen,
      onSettingsModalOpenChange: handleSettingsModalOpenChange,
      // Note: Mod registration functions and event emitter are not directly exposed here.
      // Mods interact via the LiteChatModApi provided during loading.
      // Middleware callbacks are stored in modMiddlewareCallbacksRef for internal use (Phase 5).
    }),
    [
      // Config flags
      enableApiKeyManagement,
      enableAdvancedSettings,
      // Providers & Models
      providers,
      providerModel.selectedProviderId,
      providerModel.setSelectedProviderId,
      providerModel.selectedModelId,
      providerModel.setSelectedModelId,
      // API Keys
      storage.apiKeys,
      apiKeysMgmt,
      // Sidebar
      sidebarItems,
      sidebarMgmt,
      // Core Chat State
      coreContextValue.messages,
      coreContextValue.isLoadingMessages,
      coreContextValue.isStreaming,
      coreContextValue.error,
      coreContextValue.setError,
      // Core Actions
      handleSubmit,
      stopStreaming,
      regenerateMessage,
      // VFS Selection
      selectedVfsPaths,
      addSelectedVfsPath,
      removeSelectedVfsPath,
      clearSelectedVfsPaths,
      // Settings
      chatSettings,
      // Data Management
      handleImportConversation,
      storage.clearAllData,
      // VFS Management
      handleToggleVfs,
      isVfsEnabledForItem,
      vfs,
      // DB Accessors
      storage.getConversation,
      storage.getProject,
      // Extensibility (Combined)
      combinedPromptActions, // Now includes mod actions
      combinedMessageActions, // Now includes mod actions
      combinedSettingsTabs, // Now includes mod tabs
      // Mod System State & Storage
      storage.mods, // Use live query result
      loadedMods, // State holding loaded instances
      storage.addMod,
      storage.updateMod,
      storage.deleteMod,
      // Settings Modal Control
      isSettingsModalOpen,
      handleSettingsModalOpenChange,
      // Other
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
