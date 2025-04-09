// src/context/chat-context.tsx
import React, { useMemo, useCallback, useState, useRef } from "react";
import type {
  AiProviderConfig,
  ChatContextProps,
  CoreChatContextProps, // Import Core type
  SidebarItemType,
  Message,
} from "@/lib/types";
import { ChatContext } from "@/hooks/use-chat-context";
import { CoreChatContext } from "@/context/core-chat-context"; // Import Core context
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

// Props expected by the ChatProvider component (remain the same)
interface ChatProviderProps {
  children: React.ReactNode;
  providers: AiProviderConfig[];
  initialProviderId?: string | null;
  initialModelId?: string | null;
  initialSelectedItemId?: string | null;
  initialSelectedItemType?: SidebarItemType | null;
  streamingThrottleRate?: number;
}

// Helper (remains the same)
const decodeUint8Array = (arr: Uint8Array): string => {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(arr);
  } catch (e) {
    console.warn("Failed to decode Uint8Array as UTF-8, trying lossy:", e);
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
  // --- Core State Management (Managed directly in ChatProvider) ---
  const [isStreaming, setIsStreaming] = useState(false); // Renamed from isAiStreaming
  const [messages, setMessages] = useState<Message[]>([]); // Renamed from localMessages
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [error, setErrorState] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const chatInput = useChatInput(); // Manages prompt, attachedFiles, selectedVfsPaths

  const setError = useCallback((newError: string | null) => {
    setErrorState(newError);
    if (newError) {
      console.error("Chat Error Context:", newError);
      // Consider adding toast here if desired for all errors
    }
  }, []);

  // --- Hook Instantiation (Optional Modules & Persistence) ---
  const providerModel = useProviderModelSelection({
    providers,
    initialProviderId,
    initialModelId,
  });
  const apiKeysMgmt = useApiKeysManagement();
  const storage = useChatStorage(); // Provides DB functions

  // Callback for stopping AI stream (used by conversationMgmt and messageHandling)
  const stopStreamingCallback = useCallback(() => {
    if (abortControllerRef.current) {
      // console.log("ChatProvider: Aborting stream via abortControllerRef");
      abortControllerRef.current.abort();
      abortControllerRef.current = null; // Clear ref after aborting
      // toast.info("AI response stopped."); // Toast moved to stopStreamingCore if needed
    } else {
      // console.log("ChatProvider: Stop requested but no active abortControllerRef");
    }
    // Update streaming state immediately
    setIsStreaming(false);
  }, []); // No dependencies needed

  const handleSelectItem = useCallback(
    (id: string | null, type: SidebarItemType | null) => {
      // Stop any ongoing stream when selection changes
      stopStreamingCallback();
      // Reset messages and loading state handled by useMessageHandling effect
    },
    [stopStreamingCallback],
  );

  const conversationMgmt = useConversationManagement({
    initialSelectedItemId,
    initialSelectedItemType,
    onSelectItem: handleSelectItem,
    toggleDbVfs: storage.toggleVfsEnabled, // Pass DB function
  });

  const chatSettings = useChatSettings({
    activeConversationData: conversationMgmt.activeConversationData,
    activeProjectData: conversationMgmt.activeProjectData,
  });

  // --- VFS Module ---
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

  // --- AI Interaction Hook (Receives core setters/DB functions) ---
  const aiInteraction = useAiInteraction({
    selectedModel: providerModel.selectedModel,
    selectedProvider: providerModel.selectedProvider,
    getApiKeyForProvider: apiKeysMgmt.getApiKeyForProvider,
    streamingThrottleRate,
    setLocalMessages: setMessages, // Pass core state setter
    setIsAiStreaming: setIsStreaming, // Pass core state setter
    setError, // Pass core error setter
    addDbMessage: storage.addDbMessage, // Pass DB function
    abortControllerRef, // Pass ref
  });

  // --- Message Handling Hook (Receives core state/setters/DB functions/AI func) ---
  const messageHandling = useMessageHandling({
    selectedConversationId:
      conversationMgmt.selectedItemType === "conversation"
        ? conversationMgmt.selectedItemId
        : null,
    performAiStream: aiInteraction.performAiStream, // Pass AI function
    stopStreamingCallback, // Pass stop callback
    activeSystemPrompt: chatSettings.activeSystemPrompt,
    temperature: chatSettings.temperature,
    maxTokens: chatSettings.maxTokens,
    topP: chatSettings.topP,
    topK: chatSettings.topK,
    presencePenalty: chatSettings.presencePenalty,
    frequencyPenalty: chatSettings.frequencyPenalty,
    isAiStreaming: isStreaming, // Pass core state
    setIsAiStreaming: setIsStreaming, // Pass core setter (for checks within hook)
    localMessages: messages, // Pass core state
    setLocalMessages: setMessages, // Pass core setter
    isLoadingMessages: isLoadingMessages, // Pass core state
    setIsLoadingMessages: setIsLoadingMessages, // Pass core setter
    error: error, // Pass core state
    setError, // Pass core setter
    addDbMessage: storage.addDbMessage, // Pass DB function
    deleteDbMessage: storage.deleteDbMessage, // Pass DB function
  });

  // --- Top-Level Handlers (Orchestration Layer) ---

  // This handleSubmit orchestrates optional features (like VFS)
  // before calling the core message submission logic.
  const handleSubmit = useCallback(
    async (e?: React.FormEvent<HTMLFormElement>) => {
      e?.preventDefault();
      const currentPrompt = chatInput.prompt.trim();
      const canSubmit =
        currentPrompt.length > 0 ||
        chatInput.attachedFiles.length > 0 ||
        chatInput.selectedVfsPaths.length > 0;

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

      let conversationIdToSubmit: string | null = null;
      let parentProjectId: string | null = null;

      // Determine target conversation/project
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

      // Create new conversation if needed
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
          // No need to select it here, createConversation handles selection
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
        vfs.configuredItemId === conversationMgmt.selectedItemId && // Ensure VFS is for the *current* item
        !vfs.isOperationLoading
      ) {
        try {
          await vfs.uploadFiles(chatInput.attachedFiles, "/");
          uploadInfo = `\n\n[User uploaded: ${chatInput.attachedFiles.map((f) => f.name).join(", ")}]`;
          chatInput.clearAttachedFiles(); // Clear only on success
        } catch (uploadErr) {
          console.error("Failed to upload attached files:", uploadErr);
          const message =
            uploadErr instanceof Error ? uploadErr.message : "Unknown error";
          toast.error(`Failed to upload attached file(s): ${message}`);
          uploadInfo = `\n\n[File upload failed: ${message}]`;
          // Do not clear attached files on failure
        }
      } else if (chatInput.attachedFiles.length > 0) {
        toast.warning(
          "Files attached, but Virtual Filesystem is not enabled or ready for this item. Files were not uploaded.",
        );
        uploadInfo = `\n\n[Files were attached but not uploaded (VFS inactive/misconfigured)]`;
        // Clear attached files even if upload didn't happen, as user intended submission
        chatInput.clearAttachedFiles();
      }

      // --- VFS Interaction: Include selected file content ---
      let vfsContextString = "";
      const pathsIncludedInContext: string[] = [];
      if (
        chatInput.selectedVfsPaths.length > 0 &&
        vfsEnabled &&
        vfs.isReady &&
        vfs.configuredItemId === conversationMgmt.selectedItemId && // Ensure VFS is for the *current* item
        !vfs.isOperationLoading
      ) {
        const contentPromises = chatInput.selectedVfsPaths.map(async (path) => {
          try {
            const fileData = await vfs.readFile(path);
            const fileContent = decodeUint8Array(fileData);
            // Simple truncation example (adjust as needed)
            const maxSize = 5000; // Example max size
            let formattedContent = "";
            if (fileContent.length > maxSize) {
              toast.warning(
                `File "${path}" is large (${fileContent.length} bytes) and will be truncated in context.`,
              );
              formattedContent = `<vfs_file path="${path}" truncated="true">\n${fileContent.substring(0, maxSize)}...\n</vfs_file>`;
            } else {
              formattedContent = `<vfs_file path="${path}">\n${fileContent}\n</vfs_file>`;
            }
            pathsIncludedInContext.push(path); // Track successful inclusions
            return formattedContent;
          } catch (readErr) {
            console.error(`Failed to read VFS file ${path}:`, readErr);
            const message =
              readErr instanceof Error ? readErr.message : "Unknown error";
            toast.error(
              `Failed to read file "${path}" for context: ${message}`,
            );
            return `<vfs_file path="${path}" error="Failed to read" />`;
          }
        });

        const resolvedContents = await Promise.all(contentPromises);
        if (resolvedContents.length > 0) {
          vfsContextString = `\n\n${resolvedContents.join("\n\n")}`;
        }
        // Clear selected paths after attempting to read them
        chatInput.clearSelectedVfsPaths();
      } else if (chatInput.selectedVfsPaths.length > 0) {
        toast.warning(
          "VFS files selected, but Virtual Filesystem is not enabled or ready for this item. Content not included.",
        );
        // Clear selected paths even if VFS wasn't ready
        chatInput.clearSelectedVfsPaths();
      }

      // --- Prepare and Send ---
      const originalUserPrompt = currentPrompt; // Keep original for display/DB
      // Construct the prompt that includes VFS info for the AI
      const promptToSendToAI =
        (vfsContextString ? vfsContextString + "\n\n" : "") +
        originalUserPrompt +
        (uploadInfo ? "\n\n" + uploadInfo : "");

      // Clear the input field visually
      chatInput.setPrompt("");

      // Call the core message handling logic if there's content to send
      if (promptToSendToAI.trim().length > 0) {
        await messageHandling.handleSubmitCore(
          originalUserPrompt, // Pass original prompt for DB/UI state
          conversationIdToSubmit,
          promptToSendToAI, // Pass potentially augmented prompt for AI
          pathsIncludedInContext, // Pass paths actually included
        );
      } else {
        // Handle cases where only file operations happened without a text prompt
        console.log(
          "Submission skipped: empty prompt after processing VFS/uploads.",
        );
        if (
          uploadInfo.includes("failed") ||
          vfsContextString.includes("error=")
        ) {
          // Error already toasted, maybe set general error state?
          // setError("Failed to process attached/selected files.");
        } else if (uploadInfo || vfsContextString) {
          // If only successful file ops happened, maybe add a system message?
          // For now, just log it.
          console.log(
            "VFS/Upload operations completed without user text prompt.",
          );
        }
      }
    },
    [
      chatInput,
      isStreaming,
      providerModel.selectedProvider,
      providerModel.selectedModel,
      conversationMgmt, // For selected item, createConversation
      vfsEnabled,
      vfs, // For VFS operations
      setError,
      messageHandling.handleSubmitCore, // Use the core handler
    ],
  );

  // This regenerateMessage ensures the correct context before calling core logic
  const regenerateMessage = useCallback(
    async (messageId: string) => {
      if (
        conversationMgmt.selectedItemType !== "conversation" ||
        !conversationMgmt.selectedItemId
      ) {
        toast.error("Please select the conversation containing the message.");
        return;
      }
      if (isStreaming) {
        toast.info("Please wait for the current response to finish.");
        return;
      }
      // Call the core regeneration logic
      await messageHandling.regenerateMessageCore(messageId);
    },
    [
      messageHandling.regenerateMessageCore, // Use the core handler
      conversationMgmt.selectedItemType,
      conversationMgmt.selectedItemId,
      isStreaming,
    ],
  );

  // This stopStreaming calls the core logic
  const stopStreaming = useCallback(() => {
    messageHandling.stopStreamingCore(); // Call the core handler
    toast.info("AI response stopped."); // Provide user feedback
  }, [messageHandling.stopStreamingCore]);

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
        // Import into the same project as the currently selected conversation
        parentId = conversationMgmt.activeConversationData?.parentId ?? null;
      }
      // Use the conversationMgmt hook's import function
      await conversationMgmt.importConversation(file, parentId);
    },
    [conversationMgmt], // Depends on conversationMgmt hook
  );

  // --- Context Value Construction ---

  // Core Context Value
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
      prompt: chatInput.prompt,
      setPrompt: chatInput.setPrompt,
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
      chatInput.prompt,
      chatInput.setPrompt,
      messageHandling.handleSubmitCore,
      messageHandling.stopStreamingCore,
      messageHandling.regenerateMessageCore,
      // abortControllerRef is stable
    ],
  );

  // Full Context Value (Superset)
  const fullContextValue: ChatContextProps = useMemo(
    () => ({
      // Provider/Model Selection
      providers,
      selectedProviderId: providerModel.selectedProviderId,
      setSelectedProviderId: providerModel.setSelectedProviderId,
      selectedModelId: providerModel.selectedModelId,
      setSelectedModelId: providerModel.setSelectedModelId,
      // API Key Management
      apiKeys: apiKeysMgmt.apiKeys,
      selectedApiKeyId: apiKeysMgmt.selectedApiKeyId,
      setSelectedApiKeyId: apiKeysMgmt.setSelectedApiKeyId,
      addApiKey: apiKeysMgmt.addApiKey,
      deleteApiKey: apiKeysMgmt.deleteApiKey,
      getApiKeyForProvider: apiKeysMgmt.getApiKeyForProvider,
      // Sidebar / Item Management
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
      // Core State (mirrored from coreContextValue)
      messages: coreContextValue.messages,
      isLoading: coreContextValue.isLoadingMessages, // Renamed field in full context
      isStreaming: coreContextValue.isStreaming,
      error: coreContextValue.error,
      setError: coreContextValue.setError,
      // Input Handling (Core + Optional)
      prompt: coreContextValue.prompt,
      setPrompt: coreContextValue.setPrompt,
      handleSubmit, // Top-level handler
      stopStreaming, // Top-level handler
      regenerateMessage, // Top-level handler
      attachedFiles: chatInput.attachedFiles,
      addAttachedFile: chatInput.addAttachedFile,
      removeAttachedFile: chatInput.removeAttachedFile,
      clearAttachedFiles: chatInput.clearAttachedFiles,
      selectedVfsPaths: chatInput.selectedVfsPaths,
      addSelectedVfsPath: chatInput.addSelectedVfsPath,
      removeSelectedVfsPath: chatInput.removeSelectedVfsPath,
      clearSelectedVfsPaths: chatInput.clearSelectedVfsPaths,
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
      // Import/Export
      exportConversation: conversationMgmt.exportConversation,
      importConversation: handleImportConversation, // Use the wrapped handler
      exportAllConversations: conversationMgmt.exportAllConversations,
      // Virtual File System
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
      // Dependencies for Full Context
      providers,
      providerModel,
      apiKeysMgmt,
      conversationMgmt,
      coreContextValue, // Include core context value as dependency
      handleSubmit,
      stopStreaming,
      regenerateMessage,
      chatInput, // For file/vfs path state
      chatSettings,
      streamingThrottleRate,
      handleImportConversation,
      vfsEnabled,
      vfs, // Include VFS object
    ],
  );

  return (
    // Provide both contexts. Core context is internal, Full context is for consumers.
    <CoreChatContext.Provider value={coreContextValue}>
      <ChatContext.Provider value={fullContextValue}>
        {children}
      </ChatContext.Provider>
    </CoreChatContext.Provider>
  );
};
