// src/context/chat-context.tsx
import React, { useMemo, useCallback, useState, useRef } from "react";
import type {
  AiProviderConfig,
  ChatContextProps,
  SidebarItemType,
  Message,
  DbConversation,
  DbProject,
} from "@/lib/types";
import { ChatContext } from "@/hooks/use-chat-context";
import { useProviderModelSelection } from "@/hooks/use-provider-model-selection";
import { useApiKeysManagement } from "@/hooks/use-api-keys-management";
import { useConversationManagement } from "@/hooks/use-conversation-management";
import { useChatSettings } from "@/hooks/use-chat-settings";
import { useAiInteraction } from "@/hooks/use-ai-interaction";
import { useChatInput } from "@/hooks/use-chat-input";
import { useMessageHandling } from "@/hooks/use-message-handling";
import { useChatStorage } from "@/hooks/use-chat-storage";
import { useVirtualFileSystem } from "@/hooks/use-virtual-file-system";
import { toast } from "sonner";
import { nanoid } from "nanoid";

// Props expected by the ChatProvider component
interface ChatProviderProps {
  children: React.ReactNode;
  providers: AiProviderConfig[];
  initialProviderId?: string | null;
  initialModelId?: string | null;
  initialSelectedItemId?: string | null;
  initialSelectedItemType?: SidebarItemType | null;
  streamingThrottleRate?: number;
}

// Helper to decode Uint8Array to string, handling potential errors
const decodeUint8Array = (arr: Uint8Array): string => {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(arr);
  } catch (e) {
    console.warn("Failed to decode Uint8Array as UTF-8, trying lossy:", e);
    // Fallback to lossy decoding if strict UTF-8 fails
    return new TextDecoder("utf-8", { fatal: false }).decode(arr);
  }
};

export const ChatProvider: React.FC<ChatProviderProps> = ({
  children,
  providers,
  initialProviderId = null,
  initialModelId = null,
  initialSelectedItemId = null,
  initialSelectedItemType = null,
  streamingThrottleRate = 42,
}) => {
  // --- Core State ---
  const [isAiStreaming, setIsAiStreaming] = useState(false);
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [error, setErrorState] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const setError = useCallback((newError: string | null) => {
    setErrorState(newError);
    if (newError) {
      console.error("Chat Error Context:", newError);
    }
  }, []);

  // --- Hook Instantiation ---
  const providerModel = useProviderModelSelection({
    providers,
    initialProviderId,
    initialModelId,
  });
  const apiKeysMgmt = useApiKeysManagement();
  const storage = useChatStorage();
  const handleSelectItem = useCallback(
    (id: string | null, type: SidebarItemType | null) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        toast.info("AI response stopped due to selection change.");
      }
    },
    [],
  );
  const conversationMgmt = useConversationManagement({
    initialSelectedItemId,
    initialSelectedItemType,
    onSelectItem: handleSelectItem,
    toggleDbVfs: storage.toggleVfsEnabled,
  });
  const chatSettings = useChatSettings({
    activeConversationData: conversationMgmt.activeConversationData,
    activeProjectData: conversationMgmt.activeProjectData,
  });
  const chatInput = useChatInput();

  const vfsEnabled = useMemo(() => {
    if (conversationMgmt.selectedItemType === "conversation") {
      return conversationMgmt.activeConversationData?.vfsEnabled ?? false;
    }
    if (conversationMgmt.selectedItemType === "project") {
      return conversationMgmt.activeProjectData?.vfsEnabled ?? false;
    }
    return false;
  }, [
    conversationMgmt.selectedItemType,
    conversationMgmt.activeConversationData,
    conversationMgmt.activeProjectData,
  ]);

  const vfs = useVirtualFileSystem({
    itemId: conversationMgmt.selectedItemId,
    itemType: conversationMgmt.selectedItemType,
    isEnabled: vfsEnabled,
  });

  const aiInteraction = useAiInteraction({
    selectedModel: providerModel.selectedModel,
    selectedProvider: providerModel.selectedProvider,
    getApiKeyForProvider: apiKeysMgmt.getApiKeyForProvider,
    streamingThrottleRate,
    setLocalMessages,
    setIsAiStreaming,
    setError,
    addDbMessage: storage.addDbMessage,
    abortControllerRef,
  });

  const messageHandling = useMessageHandling({
    selectedConversationId:
      conversationMgmt.selectedItemType === "conversation"
        ? conversationMgmt.selectedItemId
        : null,
    performAiStream: aiInteraction.performAiStream,
    stopStreamingCallback: () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    },
    activeSystemPrompt: chatSettings.activeSystemPrompt,
    temperature: chatSettings.temperature,
    maxTokens: chatSettings.maxTokens,
    topP: chatSettings.topP,
    topK: chatSettings.topK,
    presencePenalty: chatSettings.presencePenalty,
    frequencyPenalty: chatSettings.frequencyPenalty,
    isAiStreaming,
    setIsAiStreaming,
    localMessages,
    setLocalMessages,
    isLoadingMessages,
    setIsLoadingMessages,
    error,
    setError,
    addDbMessage: storage.addDbMessage,
    deleteDbMessage: storage.deleteDbMessage,
  });

  // --- Top-Level Handlers ---

  const handleSubmit = useCallback(
    async (e?: React.FormEvent<HTMLFormElement>) => {
      e?.preventDefault();
      const currentPrompt = chatInput.prompt.trim();
      const canSubmit =
        currentPrompt.length > 0 ||
        chatInput.attachedFiles.length > 0 ||
        chatInput.selectedVfsPaths.length > 0;

      if (!canSubmit) return;
      if (isAiStreaming) {
        toast.info("Please wait for the current response to finish.");
        return;
      }
      if (!providerModel.selectedProvider || !providerModel.selectedModel) {
        setError("Error: Please select an AI Provider and Model first.");
        toast.error("Please select an AI Provider and Model.");
        return;
      }

      let conversationIdToSubmit: string | null = null;
      let parentProjectId: string | null = null;

      if (
        conversationMgmt.selectedItemType === "project" &&
        conversationMgmt.selectedItemId
      ) {
        parentProjectId = conversationMgmt.selectedItemId;
      } else if (
        conversationMgmt.selectedItemType === "conversation" &&
        conversationMgmt.selectedItemId
      ) {
        parentProjectId =
          conversationMgmt.activeConversationData?.parentId ?? null;
        conversationIdToSubmit = conversationMgmt.selectedItemId;
      }

      if (!conversationIdToSubmit) {
        try {
          const title = currentPrompt.substring(0, 50) || "New Chat";
          const newConvId = await conversationMgmt.createConversation(
            parentProjectId,
            title,
          );
          if (!newConvId)
            throw new Error("Failed to get ID for new conversation.");
          conversationIdToSubmit = newConvId;
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

      // --- VFS Interaction: Upload attached files ---
      let uploadInfo = "";
      if (
        chatInput.attachedFiles.length > 0 &&
        vfsEnabled &&
        vfs.isReady &&
        vfs.configuredItemId === conversationMgmt.selectedItemId &&
        !vfs.isOperationLoading
      ) {
        try {
          await vfs.uploadFiles(chatInput.attachedFiles, "/");
          uploadInfo = `

[User uploaded: ${chatInput.attachedFiles.map((f) => f.name).join(", ")}]`;
          chatInput.clearAttachedFiles();
        } catch (uploadErr) {
          console.error("Failed to upload attached files:", uploadErr);
          toast.error(
            `Failed to upload attached file(s): ${uploadErr instanceof Error ? uploadErr.message : "Unknown error"}`,
          );
          uploadInfo = `

[File upload failed: ${uploadErr instanceof Error ? uploadErr.message : "Unknown error"}]`;
        }
      } else if (chatInput.attachedFiles.length > 0) {
        toast.warning(
          "Files attached, but Virtual Filesystem is not enabled or ready. Files were not uploaded.",
        );
        uploadInfo = `

[Files were attached but not uploaded (VFS inactive)]`;
        chatInput.clearAttachedFiles();
      }

      // --- VFS Interaction: Include selected file content ---
      let vfsContextString = "";
      const pathsIncludedInContext: string[] = [];
      if (
        chatInput.selectedVfsPaths.length > 0 &&
        vfsEnabled &&
        vfs.isReady &&
        vfs.configuredItemId === conversationMgmt.selectedItemId &&
        !vfs.isOperationLoading
      ) {
        const contentPromises = chatInput.selectedVfsPaths.map(async (path) => {
          try {
            const fileData = await vfs.readFile(path);
            const fileContent = decodeUint8Array(fileData);
            let formattedContent = "";
            if (fileContent.length > 1 * 1024 * 1024) {
              toast.warning(
                `File "${path}" is large and only the beginning will be included.`,
              );
              formattedContent = `<vfs_file path="${path}" truncated="true">
${fileContent.substring(0, 10000)}...
</vfs_file>`;
            } else {
              formattedContent = `<vfs_file path="${path}">
${fileContent}
</vfs_file>`;
            }
            pathsIncludedInContext.push(path);
            return formattedContent;
          } catch (readErr) {
            console.error(`Failed to read VFS file ${path}:`, readErr);
            toast.error(
              `Failed to read file "${path}" for context: ${readErr instanceof Error ? readErr.message : "Unknown error"}`,
            );
            return `<vfs_file path="${path}" error="Failed to read" />`;
          }
        });

        const resolvedContents = await Promise.all(contentPromises);
        vfsContextString = `

${resolvedContents.join("\n\n")}`;
      } else if (chatInput.selectedVfsPaths.length > 0) {
        toast.warning(
          "VFS files selected, but Virtual Filesystem is not enabled or ready. Content not included.",
        );
        chatInput.clearSelectedVfsPaths();
      }

      // --- Prepare and Send ---
      const originalUserPrompt = currentPrompt;
      const promptToSendToAI =
        (vfsContextString ? vfsContextString + "\n\n" : "") +
        originalUserPrompt +
        (uploadInfo ? "\n\n" + uploadInfo : ""); // Append upload info for AI context too
      chatInput.setPrompt("");

      if (promptToSendToAI.trim().length > 0) {
        await messageHandling.handleSubmit(
          originalUserPrompt,
          conversationIdToSubmit,
          promptToSendToAI,
          pathsIncludedInContext,
        );
        chatInput.clearSelectedVfsPaths();
      } else {
        console.log("Submission skipped: empty prompt after processing.");
        if (
          uploadInfo.includes("failed") ||
          vfsContextString.includes("error=")
        ) {
          toast.error("Failed to process attached/selected files.");
        }
        chatInput.clearSelectedVfsPaths();
      }
    },
    [
      chatInput,
      isAiStreaming,
      providerModel.selectedProvider,
      providerModel.selectedModel,
      conversationMgmt,
      vfsEnabled,
      vfs,
      setError,
      messageHandling,
    ],
  );

  const regenerateMessage = useCallback(
    async (messageId: string) => {
      if (
        conversationMgmt.selectedItemType !== "conversation" ||
        !conversationMgmt.selectedItemId
      ) {
        toast.error("Please select the conversation containing the message.");
        return;
      }
      if (isAiStreaming) {
        toast.info("Please wait for the current response to finish.");
        return;
      }
      await messageHandling.regenerateMessage(messageId);
    },
    [
      messageHandling,
      conversationMgmt.selectedItemType,
      conversationMgmt.selectedItemId,
      isAiStreaming,
    ],
  );

  const handleImportConversation = useCallback(
    async (file: File) => {
      let parentId: string | null = null;
      if (
        conversationMgmt.selectedItemType === "project" &&
        conversationMgmt.selectedItemId
      ) {
        parentId = conversationMgmt.selectedItemId;
      } else if (
        conversationMgmt.selectedItemType === "conversation" &&
        conversationMgmt.selectedItemId
      ) {
        parentId = conversationMgmt.activeConversationData?.parentId ?? null;
      }
      await conversationMgmt.importConversation(file, parentId);
    },
    [conversationMgmt],
  );

  // --- Context Value Construction ---
  const contextValue: ChatContextProps = useMemo(
    () => ({
      providers,
      selectedProviderId: providerModel.selectedProviderId,
      setSelectedProviderId: providerModel.setSelectedProviderId,
      selectedModelId: providerModel.selectedModelId,
      setSelectedModelId: providerModel.setSelectedModelId,
      apiKeys: apiKeysMgmt.apiKeys,
      selectedApiKeyId: apiKeysMgmt.selectedApiKeyId,
      setSelectedApiKeyId: apiKeysMgmt.setSelectedApiKeyId,
      addApiKey: apiKeysMgmt.addApiKey,
      deleteApiKey: apiKeysMgmt.deleteApiKey,
      getApiKeyForProvider: apiKeysMgmt.getApiKeyForProvider,
      sidebarItems: conversationMgmt.sidebarItems,
      selectedItemId: conversationMgmt.selectedItemId,
      selectedItemType: conversationMgmt.selectedItemType,
      selectItem: conversationMgmt.selectItem,
      createConversation: conversationMgmt.createConversation,
      createProject: conversationMgmt.createProject,
      deleteItem: conversationMgmt.deleteItem,
      renameItem: conversationMgmt.renameItem,
      updateConversationSystemPrompt:
        conversationMgmt.updateConversationSystemPrompt,
      activeConversationData: conversationMgmt.activeConversationData,
      activeProjectData: conversationMgmt.activeProjectData,
      messages: localMessages,
      isLoading: isLoadingMessages,
      isStreaming: isAiStreaming,
      error,
      setError,
      prompt: chatInput.prompt,
      setPrompt: chatInput.setPrompt,
      attachedFiles: chatInput.attachedFiles,
      addAttachedFile: chatInput.addAttachedFile,
      removeAttachedFile: chatInput.removeAttachedFile,
      clearAttachedFiles: chatInput.clearAttachedFiles,
      selectedVfsPaths: chatInput.selectedVfsPaths,
      addSelectedVfsPath: chatInput.addSelectedVfsPath,
      removeSelectedVfsPath: chatInput.removeSelectedVfsPath,
      clearSelectedVfsPaths: chatInput.clearSelectedVfsPaths,
      handleSubmit,
      stopStreaming: messageHandling.stopStreaming,
      regenerateMessage,
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
      exportConversation: conversationMgmt.exportConversation,
      importConversation: handleImportConversation,
      exportAllConversations: conversationMgmt.exportAllConversations,
      vfsEnabled,
      toggleVfsEnabled: conversationMgmt.toggleVfsEnabled,
      vfs: {
        isReady: vfs.isReady,
        configuredItemId: vfs.configuredItemId,
        isLoading: vfs.isLoading,
        isOperationLoading: vfs.isOperationLoading,
        error: vfs.error,
        listFiles: vfs.listFiles,
        readFile: vfs.readFile,
        writeFile: vfs.writeFile,
        deleteItem: vfs.deleteItem,
        createDirectory: vfs.createDirectory,
        downloadFile: vfs.downloadFile,
        uploadFiles: vfs.uploadFiles,
        uploadAndExtractZip: vfs.uploadAndExtractZip,
        downloadAllAsZip: vfs.downloadAllAsZip,
        rename: vfs.rename,
      },
    }),
    [
      providers,
      providerModel,
      apiKeysMgmt,
      conversationMgmt,
      localMessages,
      isLoadingMessages,
      isAiStreaming,
      error,
      setError,
      chatInput,
      handleSubmit,
      messageHandling,
      regenerateMessage,
      chatSettings,
      streamingThrottleRate,
      handleImportConversation,
      vfsEnabled,
      vfs,
    ],
  );

  return (
    <ChatContext.Provider value={contextValue}>{children}</ChatContext.Provider>
  );
};
