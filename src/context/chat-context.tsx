import React, {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { streamText, type CoreMessage } from "ai"; // Import CoreMessage
import type { AiProviderConfig, ChatContextProps, Message } from "@/lib/types";
import { useChatStorage } from "@/hooks/use-chat-storage";
import { throttle } from "@/lib/throttle";
import { nanoid } from "nanoid";
import { useDebounce } from "@/hooks/use-debounce";
import { db } from "@/lib/db"; // Import db directly for export query
import { z } from "zod"; // Import zod for validation
import { toast } from "sonner";
import { ChatContext } from "@/hooks/use-chat-context";

interface ChatProviderProps {
  children: React.ReactNode;
  providers: AiProviderConfig[];
  initialProviderId?: string | null;
  initialModelId?: string | null;
  initialConversationId?: string | null;
  streamingThrottleRate?: number;
}

// Zod schema for validating imported messages (adjust as needed)
const messageImportSchema = z.object({
  id: z.string(), // Keep original ID? Or generate new? Let's keep for now.
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  createdAt: z
    .string()
    .datetime()
    .transform((dateStr) => new Date(dateStr)), // Parse date string
  // conversationId will be overridden
});
const conversationImportSchema = z.array(messageImportSchema);

export const ChatProvider: React.FC<ChatProviderProps> = ({
  children,
  providers,
  initialProviderId = null,
  initialModelId = null,
  initialConversationId = null,
  streamingThrottleRate = 42, // ~24fps
}) => {
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(
    initialProviderId,
  );
  const [selectedModelId, setSelectedModelId] = useState<string | null>(
    initialModelId,
  );
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(initialConversationId);
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [isAiStreaming, setIsAiStreaming] = useState(false);
  const [error, setErrorState] = useState<string | null>(null); // Rename internal state

  // Wrap setError to show toast
  const setError = useCallback((newError: string | null) => {
    setErrorState(newError);
    if (newError) {
      // Only show toast for new errors, not when clearing
      toast.error(newError);
    }
  }, []);

  // State for selected API key ID per provider
  const [selectedApiKeyId, setSelectedApiKeyIdState] = useState<
    Record<string, string | null>
  >({});

  // Input State
  const [prompt, setPrompt] = useState("");

  // File State (Placeholder)
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);

  // Advanced Settings State (Placeholders with defaults)
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState<number | null>(null); // null means provider default
  const [systemPrompt, setSystemPrompt] = useState(
    "You are a helpful AI assitant that respond precisely and concisely to user requests",
  ); // TODO: Load/Save from storage?
  const [topP, setTopP] = useState<number | null>(null);
  const [topK, setTopK] = useState<number | null>(null);
  const [presencePenalty, setPresencePenalty] = useState<number | null>(null);
  const [frequencyPenalty, setFrequencyPenalty] = useState<number | null>(null);

  const [theme, setTheme] = useState<"light" | "dark" | "system">("system"); // TODO: Load/Save, apply theme

  // Search State
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Storage Hook
  const {
    conversations,
    createConversation: createDbConversation,
    deleteConversation: deleteDbConversation,
    renameConversation: renameDbConversation,
    messages: dbMessages,
    addDbMessage,
    deleteDbMessage,
    getDbMessagesUpTo,
    apiKeys, // Get keys from storage hook
    addApiKey: addDbApiKey,
    deleteApiKey: deleteDbApiKey,
  } = useChatStorage(selectedConversationId);

  // Streaming Control
  const abortControllerRef = useRef<AbortController | null>(null);

  // --- API Key Management ---
  const setSelectedApiKeyId = useCallback(
    (providerId: string, keyId: string | null) => {
      setSelectedApiKeyIdState((prev) => ({ ...prev, [providerId]: keyId }));
      // TODO: Persist selection in localStorage?
    },
    [],
  );

  const addApiKey = useCallback(
    async (name: string, providerId: string, value: string) => {
      // Clear sensitive value quickly
      const keyToAdd = value;
      value = ""; // Clear from memory scope if possible
      const newId = await addDbApiKey(name, providerId, keyToAdd);
      // Auto-select the newly added key for its provider
      setSelectedApiKeyId(providerId, newId);
      return newId;
    },
    [addDbApiKey, setSelectedApiKeyId],
  );

  const deleteApiKey = useCallback(
    async (id: string) => {
      const keyToDelete = apiKeys.find((k) => k.id === id);
      await deleteDbApiKey(id);
      // If the deleted key was selected, deselect it
      if (keyToDelete && selectedApiKeyId[keyToDelete.providerId] === id) {
        setSelectedApiKeyId(keyToDelete.providerId, null);
      }
    },
    [apiKeys, deleteDbApiKey, selectedApiKeyId, setSelectedApiKeyId],
  );

  // Get the *value* of the currently selected API key for a given provider
  const getApiKeyForProvider = useCallback(
    (providerId: string): string | undefined => {
      const selectedId = selectedApiKeyId[providerId];
      if (!selectedId) return undefined;
      return apiKeys.find((key) => key.id === selectedId)?.value;
    },
    [apiKeys, selectedApiKeyId],
  );

  // --- Provider/Model Selection ---
  // ... (keep existing auto-selection logic) ...
  const selectedProvider = useMemo(
    () => providers.find((p) => p.id === selectedProviderId),
    [providers, selectedProviderId],
  );

  const selectedModel = useMemo(
    () => selectedProvider?.models.find((m) => m.id === selectedModelId),
    [selectedProvider, selectedModelId],
  );

  useEffect(() => {
    if (!selectedProviderId && providers.length > 0) {
      setSelectedProviderId(providers[0].id);
    }
  }, [providers, selectedProviderId]);

  useEffect(() => {
    if (
      selectedProvider &&
      !selectedModelId &&
      selectedProvider.models.length > 0
    ) {
      setSelectedModelId(selectedProvider.models[0].id);
    }
    if (
      selectedProviderId &&
      selectedModelId &&
      !providers
        .find((p) => p.id === selectedProviderId)
        ?.models.some((m) => m.id === selectedModelId)
    ) {
      const firstModel = providers.find((p) => p.id === selectedProviderId)
        ?.models[0];
      setSelectedModelId(firstModel?.id ?? null);
    }
  }, [providers, selectedProviderId, selectedModelId, selectedProvider]);

  // --- Conversation Management ---
  const selectConversation = useCallback(
    (id: string | null) => {
      // ... (keep existing implementation)
      if (isAiStreaming) {
        abortControllerRef.current?.abort();
        setIsAiStreaming(false);
      }
      setSelectedConversationId(id);
      setLocalMessages([]);
      setIsLoadingMessages(true);
      setPrompt("");
      setError(null); // Clear error on conversation change
      clearAttachedFiles(); // Clear files
    },
    [isAiStreaming], // Add clearAttachedFiles when implemented
  );

  const createConversation = useCallback(
    async (title?: string): Promise<string> => {
      // ... (keep existing implementation)
      const newId = await createDbConversation(title);
      selectConversation(newId);
      return newId;
    },
    [createDbConversation, selectConversation],
  );

  const deleteConversation = useCallback(
    async (id: string): Promise<void> => {
      // ... (keep existing implementation)
      await deleteDbConversation(id);
      if (selectedConversationId === id) {
        const nextConversation = conversations.find((c) => c.id !== id);
        selectConversation(nextConversation?.id ?? null);
      }
    },
    [
      deleteDbConversation,
      selectedConversationId,
      selectConversation,
      conversations,
    ],
  );

  const renameConversation = useCallback(
    async (id: string, newTitle: string): Promise<void> => {
      // ... (keep existing implementation)
      await renameDbConversation(id, newTitle);
    },
    [renameDbConversation],
  );

  const exportConversation = useCallback(
    async (conversationId: string | null) => {
      if (!conversationId) {
        toast.error("No conversation selected to export.");
        return;
      }
      try {
        const conversation = await db.conversations.get(conversationId);
        const messagesToExport = await db.messages
          .where("conversationId")
          .equals(conversationId)
          .sortBy("createdAt");

        if (!conversation || messagesToExport.length === 0) {
          toast.warning("Cannot export empty or non-existent conversation.");
          return;
        }

        // Prepare data (strip conversationId from messages for cleaner export?)
        const exportData = messagesToExport.map(
          ({ conversationId, ...msg }) => msg,
        );

        const jsonString = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonString], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        // Sanitize title for filename
        const filename = `${conversation.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_${conversationId.substring(0, 6)}.json`;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success(`Conversation "${conversation.title}" exported.`);
      } catch (err: any) {
        console.error("Export failed:", err);
        toast.error(`Export failed: ${err.message}`);
      }
    },
    [],
  ); // Dependency: none (uses db directly)

  const importConversation = useCallback(
    async (file: File) => {
      if (!file || file.type !== "application/json") {
        toast.error("Please select a valid JSON file.");
        return;
      }

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const jsonString = event.target?.result as string;
          const parsedData = JSON.parse(jsonString);

          // Validate structure
          const validationResult =
            conversationImportSchema.safeParse(parsedData);
          if (!validationResult.success) {
            console.error("Import validation error:", validationResult.error);
            toast.error(
              `Import failed: Invalid file format. ${validationResult.error.errors[0]?.message || ""}`,
            );
            return;
          }

          const importedMessages = validationResult.data;

          if (importedMessages.length === 0) {
            toast.warning("Imported file contains no messages.");
            return;
          }

          // Create a new conversation for the import
          const newConversationTitle = `Imported: ${file.name.replace(/\.json$/i, "")}`;
          const newConversationId =
            await createDbConversation(newConversationTitle); // Use DB function

          // Add messages to the new conversation
          // Use Promise.all for potentially better performance on many messages
          await Promise.all(
            importedMessages.map((msg) =>
              addDbMessage({
                ...msg, // Spread validated message data (includes role, content, createdAt)
                conversationId: newConversationId, // Assign to the NEW conversation
                // id: nanoid(), // Optionally generate new IDs on import
              }),
            ),
          );

          // Select the newly imported conversation
          selectConversation(newConversationId); // Use the context's select function
          toast.success(
            `Conversation imported successfully as "${newConversationTitle}"!`,
          );
        } catch (err: any) {
          console.error("Import failed:", err);
          toast.error(
            `Import failed: ${err.message || "Could not read or parse file."}`,
          );
        }
      };
      reader.onerror = () => {
        toast.error("Failed to read the file.");
      };
      reader.readAsText(file);
    },
    [createDbConversation, addDbMessage, selectConversation],
  ); // Dependencies

  // --- Message Handling ---
  useEffect(() => {
    setIsLoadingMessages(true);
    setLocalMessages(dbMessages.map((m) => ({ ...m }))); // Map DbMessage to Message
    setIsLoadingMessages(false);
  }, [dbMessages]);

  // --- File Handling (Placeholders) ---
  const addAttachedFile = useCallback((file: File) => {
    setAttachedFiles((prev) => [...prev, file]);
    // TODO: Add validation (size, type, count)
  }, []);

  const removeAttachedFile = useCallback((fileName: string) => {
    setAttachedFiles((prev) => prev.filter((f) => f.name !== fileName));
  }, []);

  const clearAttachedFiles = useCallback(() => {
    setAttachedFiles([]);
  }, []);

  // --- Stop Streaming Function ---
  const stopStreaming = useCallback(() => {
    // ... (keep existing implementation)
    abortControllerRef.current?.abort();
    setIsAiStreaming(false);
    setLocalMessages((prev) =>
      prev.map((msg) =>
        msg.isStreaming
          ? {
              ...msg,
              isStreaming: false,
              content: msg.streamedContent || msg.content || "Stopped",
              streamedContent: undefined,
            }
          : msg,
      ),
    );
  }, []);

  // --- Core AI Call Logic ---
  const performAiStream = useCallback(
    async (
      // *** MODIFIED: Accept conversationId and the exact messages to send ***
      conversationIdToUse: string,
      messagesToSend: CoreMessage[], // The final array for the API
      currentTemperature: number,
      currentMaxTokens: number | null,
      currentTopP: number | null,
      currentTopK: number | null,
      currentPresencePenalty: number | null,
      currentFrequencyPenalty: number | null,
    ) => {
      // Use passed conversationIdToUse for checks and DB operations
      if (!conversationIdToUse) {
        console.error(
          "performAiStream called without valid conversationIdToUse",
        );
        throw new Error(
          "Internal Error: No active conversation ID provided for AI stream.",
        );
      }
      // Checks for model/provider still read from state (should be stable enough)
      if (!selectedModel || !selectedProvider) {
        console.error("performAiStream called without selectedModel/Provider");
        throw new Error("AI provider or model not selected.");
      }

      const apiKey = getApiKeyForProvider(selectedProvider.id);
      const needsKey =
        selectedProvider.requiresApiKey ?? selectedProvider.id !== "mock";

      if (needsKey && !apiKey) {
        console.error(
          `API Key missing for ${selectedProvider.name} (ID: ${selectedProvider.id})`,
        );
        throw new Error(
          `API Key for ${selectedProvider.name} is not set or selected.`,
        );
      }

      // Add placeholder for AI response
      const assistantMessageId = nanoid();
      const assistantPlaceholderTimestamp = new Date();
      const assistantPlaceholder: Message = {
        id: assistantMessageId,
        conversationId: conversationIdToUse, // Use passed ID
        role: "assistant",
        content: "",
        createdAt: assistantPlaceholderTimestamp,
        isStreaming: true,
        streamedContent: "",
        error: null,
      };
      setLocalMessages((prev) => [...prev, assistantPlaceholder]); // Update local state
      setIsAiStreaming(true);
      setError(null);

      abortControllerRef.current = new AbortController();

      // Throttled UI update logic remains the same
      const throttledStreamUpdate = throttle((streamedContentChunk: string) => {
        setLocalMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  streamedContent:
                    (msg.streamedContent || "") + streamedContentChunk,
                }
              : msg,
          ),
        );
      }, streamingThrottleRate);

      let finalContent = "";
      let streamError: Error | null = null;

      try {
        // *** MODIFIED: Use the passed messagesToSend directly ***
        console.log(
          "Sending messages to AI:",
          JSON.stringify(messagesToSend, null, 2),
        ); // DEBUG LOG

        const result = streamText({
          model: selectedModel.instance,
          messages: messagesToSend, // Use the passed array
          tools: selectedModel.tools,
          abortSignal: abortControllerRef.current.signal,
          temperature: currentTemperature,
          maxTokens: currentMaxTokens ?? undefined,
          topP: currentTopP ?? undefined,
          topK: currentTopK ?? undefined,
          presencePenalty: currentPresencePenalty ?? undefined,
          frequencyPenalty: currentFrequencyPenalty ?? undefined,
          // TODO: Pass API key if required
        });

        for await (const delta of result.textStream) {
          finalContent += delta;
          throttledStreamUpdate(delta);
        }
      } catch (err: any) {
        if (err.name === "AbortError") {
          console.log("Stream aborted.");
          // Read potentially updated streamedContent from state for abort case
          finalContent =
            localMessages.find((m) => m.id === assistantMessageId)
              ?.streamedContent || "Stopped";
        } else {
          console.error("streamText error:", err);
          streamError = err;
          finalContent = `Error: ${err.message || "Failed to get response"}`;
        }
      } finally {
        abortControllerRef.current = null;
        setIsAiStreaming(false);

        // Update local state with final/partial/error content
        setLocalMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  content: finalContent,
                  isStreaming: false,
                  streamedContent: undefined,
                  error: streamError ? streamError.message : null,
                }
              : msg,
          ),
        );

        // Persist the final assistant message to Dexie
        await addDbMessage({
          id: assistantMessageId,
          conversationId: conversationIdToUse, // Use passed ID
          role: "assistant",
          content: finalContent,
          createdAt: assistantPlaceholderTimestamp,
        });

        if (streamError && streamError.name !== "AbortError") {
          setError(`AI Error: ${streamError.message}`);
        } else if (streamError?.name === "AbortError") {
          setError(null);
        }
      }
    },
    [
      // Dependencies:
      selectedModel,
      selectedProvider,
      getApiKeyForProvider,
      addDbMessage,
      localMessages, // Still needed for abort case reading streamedContent
      streamingThrottleRate,
      setError,
      setLocalMessages,
      setIsAiStreaming,
      // Removed history construction logic dependencies
    ],
  );

  // --- Form Submission ---
  const handleSubmit = useCallback(
    async (e?: React.FormEvent<HTMLFormElement>) => {
      e?.preventDefault();
      const currentPrompt = prompt.trim();
      const canSubmit = currentPrompt.length > 0; // || attachedFiles.length > 0;

      if (!canSubmit || isAiStreaming) {
        return;
      }

      let currentConversationId = selectedConversationId;

      // --- Conversation Handling ---
      if (!currentConversationId) {
        try {
          console.log("No conversation selected, creating new one...");
          const newConvId = await createConversation("New Chat");
          if (!newConvId)
            throw new Error("Failed to create a new conversation ID.");
          currentConversationId = newConvId;
          console.log("New conversation created:", currentConversationId);
        } catch (err: any) {
          console.error("Error creating conversation during submit:", err);
          setError(`Error: Could not start chat - ${err.message}`);
          return;
        }
      }

      // --- Provider/Model Check ---
      if (!selectedProvider || !selectedModel) {
        setError("Error: Please select an AI Provider and Model first.");
        return;
      }

      // --- Prepare User Message ---
      const userPromptContent = currentPrompt;
      setPrompt(""); // Clear prompt early
      clearAttachedFiles();
      setError(null);

      let userMessageId: string;
      let userMessageForState: Message;
      try {
        const userMessageData = {
          role: "user" as const,
          content: userPromptContent,
          conversationId: currentConversationId,
        };
        userMessageId = await addDbMessage(userMessageData);
        userMessageForState = {
          ...userMessageData,
          id: userMessageId,
          createdAt: new Date(),
        };

        // Update local state immediately
        setLocalMessages((prevMessages) => [
          ...prevMessages,
          userMessageForState,
        ]);
      } catch (dbError: any) {
        console.error("Error adding user message to DB:", dbError);
        setError(`Error: Could not save your message - ${dbError.message}`);
        return;
      }

      // --- Prepare and Send to AI ---
      // Use a functional state update callback. Inside it, construct the history
      // and *immediately* call performAiStream.
      setLocalMessages((currentLocalMessages) => {
        // Construct the history from the *current* state, which includes the new user message
        const history = currentLocalMessages
          .filter((m) => m.conversationId === currentConversationId && !m.error)
          .map(
            (m): CoreMessage => ({
              role: m.role,
              content: m.content,
            }),
          );

        // Prepare the final message list for the AI
        const messagesToSendForAI: CoreMessage[] = [];
        if (systemPrompt) {
          messagesToSendForAI.push({ role: "system", content: systemPrompt });
        }
        messagesToSendForAI.push(...history);

        console.log(
          "Final messagesToSendForAI (inside state reader):",
          JSON.stringify(messagesToSendForAI, null, 2),
        );

        // *** CRITICAL: Check if the list is valid before calling AI ***
        // Check if there's at least one non-system message
        const hasUserOrAssistantMessage = messagesToSendForAI.some(
          (m) => m.role !== "system",
        );

        if (!hasUserOrAssistantMessage) {
          console.error(
            "handleSubmit Error: Attempting to send empty or system-only message list to AI.",
          );
          // Update error state *outside* the setter if possible, or handle carefully
          // Using setTimeout to break out of the setter context for the error update
          setTimeout(
            () => setError("Internal Error: Cannot send empty message list."),
            0,
          );
        } else {
          // *** Call performAiStream from *inside* the state setter callback ***
          // This ensures it runs *after* history is built based on the latest state.
          // We don't need to await it here as performAiStream handles its own async logic.
          performAiStream(
            currentConversationId, // Pass the definite ID
            messagesToSendForAI, // Pass the final message list
            temperature,
            maxTokens,
            topP,
            topK,
            presencePenalty,
            frequencyPenalty,
          ).catch((err) => {
            // Catch potential errors from performAiStream setup (like missing API key)
            console.error(
              "Error during AI stream setup/call (from state setter):",
              err,
            );
            // Update error state *outside* the setter context
            setTimeout(() => setError(`Error: ${err.message}`), 0);
          });
        }

        // This state update doesn't actually change the state,
        // it's just used as a reliable point to execute code after the previous update.
        return currentLocalMessages;
      });
    },
    [
      // Dependencies:
      prompt,
      selectedConversationId,
      selectedModel,
      selectedProvider,
      isAiStreaming,
      addDbMessage,
      performAiStream, // Dependency needed
      clearAttachedFiles,
      setError,
      systemPrompt,
      temperature,
      maxTokens,
      topP,
      topK,
      presencePenalty,
      frequencyPenalty,
      createConversation,
      setPrompt,
      setLocalMessages, // Dependency needed
      // attachedFiles
    ],
  );

  // --- Regeneration ---
  const regenerateMessage = useCallback(
    async (messageId: string) => {
      const conversationIdToUse = selectedConversationId;
      if (!conversationIdToUse || isAiStreaming) {
        console.warn(
          "Regeneration prevented: No active conversation or AI is streaming.",
        );
        return;
      }

      setError(null);

      // 1. Find the message index
      const messageIndex = localMessages.findIndex((m) => m.id === messageId);
      if (messageIndex < 0) {
        setError("Cannot regenerate non-existent message.");
        return;
      }
      const messageToRegenerate = localMessages[messageIndex];
      if (messageToRegenerate.role !== "assistant") {
        setError("Can only regenerate assistant messages.");
        return;
      }

      // 2. Get history up to the point *before* the message to regenerate
      const historyMessages = await getDbMessagesUpTo(
        conversationIdToUse,
        messageId,
      );

      // 3. Construct the message list to send for regeneration
      const messagesToSendForAI: CoreMessage[] = [];
      if (systemPrompt) {
        messagesToSendForAI.push({ role: "system", content: systemPrompt });
      }
      messagesToSendForAI.push(
        ...historyMessages.map(
          (m): CoreMessage => ({
            // Map DB messages to CoreMessage
            role: m.role,
            content: m.content,
            // TODO: Add multimodal content if needed
          }),
        ),
      );

      // 4. Remove the message to regenerate and subsequent messages from DB and state
      const messagesToDelete = localMessages.slice(messageIndex);
      await Promise.all(messagesToDelete.map((m) => deleteDbMessage(m.id)));
      setLocalMessages((prev) => prev.slice(0, messageIndex)); // Update local state

      // 5. Call the stream function with the truncated history
      try {
        // *** MODIFIED: Pass conversationIdToUse and the constructed messagesToSendForAI ***
        await performAiStream(
          conversationIdToUse, // Pass definite ID
          messagesToSendForAI, // Pass the history *before* regenerated message
          temperature,
          maxTokens,
          topP,
          topK,
          presencePenalty,
          frequencyPenalty,
        );
      } catch (err: any) {
        console.error("Error during regeneration stream setup:", err);
        setError(`Error: ${err.message}`);
      }
    },
    [
      // Dependencies:
      selectedConversationId,
      isAiStreaming,
      localMessages, // Needed for finding index and slicing
      getDbMessagesUpTo,
      deleteDbMessage,
      performAiStream, // Expects different args
      setError,
      systemPrompt, // Needed for constructing messagesToSendForAI
      temperature,
      maxTokens,
      topP,
      topK,
      presencePenalty,
      frequencyPenalty, // Settings
      setLocalMessages, // Needed for state update
    ],
  );

  // --- Export All Conversations ---
  const exportAllConversations = useCallback(async () => {
    try {
      const allConversations = await db.conversations.toArray();
      if (allConversations.length === 0) {
        toast.info("No conversations to export.");
        return;
      }

      const exportData = [];
      for (const conversation of allConversations) {
        const messages = await db.messages
          .where("conversationId")
          .equals(conversation.id)
          .sortBy("createdAt");
        exportData.push({
          title: conversation.title,
          createdAt: conversation.createdAt,
          updatedAt: conversation.updatedAt,
          // Keep original message IDs for potential re-import mapping?
          messages: messages.map(({ conversationId, ...msg }) => msg),
        });
      }

      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      link.download = `litechat_all_export_${timestamp}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success(`All ${allConversations.length} conversations exported.`);
    } catch (err: any) {
      console.error("Export All failed:", err);
      toast.error(`Export All failed: ${err.message}`);
    }
  }, []); // No dependencies needed

  // --- Context Value ---
  const contextValue: ChatContextProps = useMemo(
    () => ({
      providers,
      selectedProviderId,
      setSelectedProviderId,
      selectedModelId,
      setSelectedModelId,
      apiKeys, // Pass full list
      selectedApiKeyId, // Pass selected map
      setSelectedApiKeyId, // Pass setter
      addApiKey,
      deleteApiKey,
      getApiKeyForProvider,
      conversations,
      selectedConversationId,
      selectConversation,
      createConversation,
      deleteConversation,
      renameConversation,
      messages: localMessages,
      isLoading: isLoadingMessages,
      isStreaming: isAiStreaming,
      error, // Pass error state
      setError, // Pass error setter
      prompt,
      setPrompt,
      handleSubmit,
      stopStreaming,
      regenerateMessage, // Pass regeneration function
      attachedFiles, // Pass file state
      addAttachedFile,
      removeAttachedFile,
      clearAttachedFiles,
      temperature, // Pass settings state
      setTemperature,
      maxTokens,
      setMaxTokens,
      systemPrompt,
      setSystemPrompt,
      theme,
      setTheme,
      streamingThrottleRate,
      searchTerm,
      setSearchTerm,
      exportConversation,
      importConversation,
      exportAllConversations,
    }),
    [
      // Keep all previous dependencies
      providers,
      selectedProviderId,
      selectedModelId,
      apiKeys,
      selectedApiKeyId,
      setSelectedApiKeyId,
      addApiKey,
      deleteApiKey,
      getApiKeyForProvider,
      conversations,
      selectedConversationId,
      selectConversation,
      createConversation,
      deleteConversation,
      renameConversation,
      localMessages,
      isLoadingMessages,
      isAiStreaming,
      error,
      setError,
      prompt,
      setPrompt,
      handleSubmit,
      stopStreaming,
      regenerateMessage,
      attachedFiles,
      addAttachedFile,
      removeAttachedFile,
      clearAttachedFiles,
      temperature,
      setTemperature,
      maxTokens,
      setMaxTokens,
      systemPrompt,
      setSystemPrompt,
      theme,
      setTheme,
      streamingThrottleRate,
      searchTerm,
      exportConversation,
      importConversation,
      exportAllConversations,
    ],
  );

  // Apply theme (Example)
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");
    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light";
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
    // TODO: Persist theme choice in localStorage
  }, [theme]);

  return (
    <ChatContext.Provider value={contextValue}>{children}</ChatContext.Provider>
  );
};
