import React, {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { streamText, type CoreMessage } from "ai";
import type {
  AiProviderConfig,
  ChatContextProps,
  Message,
  DbConversation,
} from "@/lib/types";
import { useChatStorage } from "@/hooks/use-chat-storage";
import { throttle } from "@/lib/throttle";
import { nanoid } from "nanoid";
import { useDebounce } from "@/hooks/use-debounce";
import { db } from "@/lib/db"; // Import db directly
import { z } from "zod";
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

const messageImportSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  createdAt: z
    .string()
    .datetime()
    .transform((dateStr) => new Date(dateStr)),
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

  // --- State Management Change ---
  // localMessages is the primary source for the UI rendering.
  // It's updated manually on submit/stream and loaded initially from DB on convo switch.
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  // --- End State Management Change ---

  const [isAiStreaming, setIsAiStreaming] = useState(false);
  const [error, setErrorState] = useState<string | null>(null);

  const setError = useCallback((newError: string | null) => {
    setErrorState(newError);
    if (newError) {
      toast.error(newError);
    }
  }, []);

  const [selectedApiKeyId, setSelectedApiKeyIdState] = useState<
    Record<string, string | null>
  >({});
  const [prompt, setPrompt] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState<number | null>(null);

  const [globalSystemPrompt, setGlobalSystemPrompt] = useState(
    "You are a helpful AI assistant.", // Default global prompt
  );
  const [activeConversationData, setActiveConversationData] =
    useState<DbConversation | null>(null);
  const [topP, setTopP] = useState<number | null>(null);
  const [topK, setTopK] = useState<number | null>(null);
  const [presencePenalty, setPresencePenalty] = useState<number | null>(null);
  const [frequencyPenalty, setFrequencyPenalty] = useState<number | null>(null);
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");
  const [searchTerm, setSearchTerm] = useState("");

  // Storage Hook (useLiveQuery for conversations/keys still active)
  const {
    conversations,
    createConversation: createDbConversation,
    deleteConversation: deleteDbConversation,
    renameConversation: renameDbConversation,
    updateConversationSystemPrompt: updateDbConversationSystemPrompt,
    addDbMessage,
    deleteDbMessage,
    getDbMessagesUpTo,
    apiKeys,
    addApiKey: addDbApiKey,
    deleteApiKey: deleteDbApiKey,
  } = useChatStorage(selectedConversationId); // Pass ID for filtering other live queries

  const abortControllerRef = useRef<AbortController | null>(null);

  // --- API Key Management ---
  const setSelectedApiKeyId = useCallback(
    (providerId: string, keyId: string | null) => {
      setSelectedApiKeyIdState((prev) => ({ ...prev, [providerId]: keyId }));
    },
    [],
  );

  const addApiKey = useCallback(
    async (name: string, providerId: string, value: string) => {
      const keyToAdd = value;
      value = "";
      const newId = await addDbApiKey(name, providerId, keyToAdd);
      setSelectedApiKeyId(providerId, newId);
      return newId;
    },
    [addDbApiKey, setSelectedApiKeyId],
  );

  const deleteApiKey = useCallback(
    async (id: string) => {
      const keyToDelete = apiKeys.find((k) => k.id === id);
      await deleteDbApiKey(id);
      if (keyToDelete && selectedApiKeyId[keyToDelete.providerId] === id) {
        setSelectedApiKeyId(keyToDelete.providerId, null);
      }
    },
    [apiKeys, deleteDbApiKey, selectedApiKeyId, setSelectedApiKeyId],
  );

  const getApiKeyForProvider = useCallback(
    (providerId: string): string | undefined => {
      const selectedId = selectedApiKeyId[providerId];
      if (!selectedId) return undefined;
      return apiKeys.find((key) => key.id === selectedId)?.value;
    },
    [apiKeys, selectedApiKeyId],
  );

  // --- Provider/Model Selection ---
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

  // --- File Handling ---
  const addAttachedFile = useCallback((file: File) => {
    setAttachedFiles((prev) => [...prev, file]);
  }, []);

  const removeAttachedFile = useCallback((fileName: string) => {
    setAttachedFiles((prev) => prev.filter((f) => f.name !== fileName));
  }, []);

  const clearAttachedFiles = useCallback(() => {
    setAttachedFiles([]);
  }, []);

  // --- Conversation Management ---
  const selectConversation = useCallback(
    async (id: string | null) => {
      if (isAiStreaming) {
        abortControllerRef.current?.abort();
        setIsAiStreaming(false);
      }
      // Don't clear localMessages here, the useEffect below will handle loading
      setIsLoadingMessages(true); // Show loading indicator
      setPrompt("");
      setError(null);
      clearAttachedFiles();
      setSelectedConversationId(id);
      if (id) {
        try {
          const convoData = await db.conversations.get(id);
          setActiveConversationData(convoData ?? null);
        } catch (err) {
          console.error("Failed to load conversation data:", err);
          setActiveConversationData(null);
          setError("Failed to load conversation details.");
        }
      } else {
        setActiveConversationData(null); // Clear if no conversation selected
      }
    },
    [isAiStreaming, clearAttachedFiles, setError],
  );

  const createConversation = useCallback(
    async (
      title?: string,
      initialSystemPrompt?: string | null,
    ): Promise<string> => {
      const newId = await createDbConversation(title, initialSystemPrompt);
      selectConversation(newId);
      return newId;
    },
    [createDbConversation, selectConversation],
  );

  const updateConversationSystemPrompt = useCallback(
    async (id: string, systemPrompt: string | null): Promise<void> => {
      await updateDbConversationSystemPrompt(id, systemPrompt);
      // Refresh active conversation data if it's the currently selected one
      if (id === selectedConversationId) {
        const updatedConvoData = await db.conversations.get(id);
        setActiveConversationData(updatedConvoData ?? null);
      }
    },
    [updateDbConversationSystemPrompt, selectedConversationId],
  );

  const deleteConversation = useCallback(
    async (id: string): Promise<void> => {
      const currentSelectedId = selectedConversationId;
      await deleteDbConversation(id);
      if (currentSelectedId === id) {
        const remainingConversations = await db.conversations
          .orderBy("updatedAt")
          .reverse()
          .toArray();
        selectConversation(remainingConversations[0]?.id ?? null);
      }
    },
    [deleteDbConversation, selectedConversationId, selectConversation],
  );

  const renameConversation = useCallback(
    async (id: string, newTitle: string): Promise<void> => {
      await renameDbConversation(id, newTitle);
      // Refresh active conversation data if it's the currently selected one
      if (id === selectedConversationId) {
        const updatedConvoData = await db.conversations.get(id);
        setActiveConversationData(updatedConvoData ?? null);
      }
    },
    [renameDbConversation, selectedConversationId],
  );

  const exportConversation = useCallback(
    async (conversationId: string | null) => {
      // ... (implementation remains the same)
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

        const exportData = messagesToExport.map(
          ({ conversationId, ...msg }) => msg,
        );

        const jsonString = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonString], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
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
  );

  const importConversation = useCallback(
    async (file: File) => {
      // ... (implementation remains the same)
      if (!file || file.type !== "application/json") {
        toast.error("Please select a valid JSON file.");
        return;
      }

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const jsonString = event.target?.result as string;
          const parsedData = JSON.parse(jsonString);

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

          const newConversationTitle = `Imported: ${file.name.replace(/\.json$/i, "")}`;
          const newConversationId =
            await createDbConversation(newConversationTitle);

          await Promise.all(
            importedMessages.map((msg) =>
              addDbMessage({
                ...msg,
                conversationId: newConversationId,
              }),
            ),
          );

          selectConversation(newConversationId);
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
  );

  // --- Message Loading Effect ---
  useEffect(() => {
    if (selectedConversationId) {
      console.log(
        `Loading messages for ${selectedConversationId} directly from DB`,
      );
      setIsLoadingMessages(true);
      db.messages
        .where("conversationId")
        .equals(selectedConversationId)
        .sortBy("createdAt")
        .then((messagesFromDb) => {
          setLocalMessages(
            messagesFromDb.map((dbMsg) => ({
              ...dbMsg,
              isStreaming: false,
              streamedContent: undefined,
              error: null,
            })),
          );
          setIsLoadingMessages(false);
        })
        .catch((err) => {
          console.error("Failed to load messages from DB:", err);
          setError(`Error loading chat: ${err.message}`);
          setLocalMessages([]); // Clear messages on error
          setIsLoadingMessages(false);
        });
    } else {
      setLocalMessages([]);
      setIsLoadingMessages(false);
    }
  }, [selectedConversationId, setError]);

  const activeSystemPrompt = useMemo(() => {
    if (activeConversationData && activeConversationData.systemPrompt != null) {
      return activeConversationData.systemPrompt;
    }
    return globalSystemPrompt;
  }, [activeConversationData, globalSystemPrompt]);

  // --- Stop Streaming Function ---
  const stopStreaming = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsAiStreaming(false);
    // Update the message in localMessages directly
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
  }, []); // No dependency on localMessages needed here

  // --- Core AI Call Logic ---
  const performAiStream = useCallback(
    async (
      conversationIdToUse: string,
      messagesToSend: CoreMessage[],
      currentTemperature: number,
      currentMaxTokens: number | null,
      currentTopP: number | null,
      currentTopK: number | null,
      currentPresencePenalty: number | null,
      currentFrequencyPenalty: number | null,
      systemPromptToUse: string | null,
    ) => {
      if (!conversationIdToUse)
        throw new Error("Internal Error: No active conversation ID provided.");
      if (!selectedModel || !selectedProvider)
        throw new Error("AI provider or model not selected.");

      const apiKey = getApiKeyForProvider(selectedProvider.id);
      const needsKey =
        selectedProvider.requiresApiKey ?? selectedProvider.id !== "mock";
      if (needsKey && !apiKey)
        throw new Error(
          `API Key for ${selectedProvider.name} is not set or selected.`,
        );

      const assistantMessageId = nanoid();
      const assistantPlaceholderTimestamp = new Date();
      const assistantPlaceholder: Message = {
        id: assistantMessageId,
        conversationId: conversationIdToUse,
        role: "assistant",
        content: "",
        createdAt: assistantPlaceholderTimestamp,
        isStreaming: true,
        streamedContent: "",
        error: null,
      };

      setLocalMessages((prev) => [...prev, assistantPlaceholder]);

      setIsAiStreaming(true);
      setError(null);

      abortControllerRef.current = new AbortController();

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
        const messagesForApi: CoreMessage[] = [];
        if (systemPromptToUse) {
          messagesForApi.push({ role: "system", content: systemPromptToUse });
        }

        messagesForApi.push(
          ...messagesToSend.filter((m) => m.role !== "system"),
        );
        console.log(
          "Sending messages to AI:",
          JSON.stringify(messagesForApi, null, 2),
        );

        const result = streamText({
          model: selectedModel.instance,
          messages: messagesForApi,
          abortSignal: abortControllerRef.current.signal,
          temperature: currentTemperature,
          maxTokens: currentMaxTokens ?? undefined,
          topP: currentTopP ?? undefined,
          topK: currentTopK ?? undefined,
          presencePenalty: currentPresencePenalty ?? undefined,
          frequencyPenalty: currentFrequencyPenalty ?? undefined,
        });

        for await (const delta of result.textStream) {
          finalContent += delta;
          throttledStreamUpdate(delta);
        }
        console.log("Stream finished. Final raw content:", finalContent);
      } catch (err: any) {
        streamError = err;
        if (err.name === "AbortError") {
          console.log("Stream aborted by user.");
          // Read final content from state *before* the final update below
          setLocalMessages((prev) => {
            const abortedMsg = prev.find((m) => m.id === assistantMessageId);
            finalContent = abortedMsg?.streamedContent || "Stopped";
            return prev; // No state change here, just reading
          });
          streamError = null;
        } else {
          console.error("streamText error:", err);
          finalContent = `Error: ${err.message || "Failed to get response"}`;
        }
      } finally {
        abortControllerRef.current = null;
        setIsAiStreaming(false);

        console.log("Saving final content:", finalContent);
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

        if (!streamError) {
          await addDbMessage({
            id: assistantMessageId,
            conversationId: conversationIdToUse,
            role: "assistant",
            content: finalContent,
            createdAt: assistantPlaceholderTimestamp,
          }).catch((dbErr) => {
            console.error(
              "Failed to save final assistant message to DB:",
              dbErr,
            );
            setError(`Error saving response: ${dbErr.message}`);
            setLocalMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessageId
                  ? { ...msg, error: `Save failed: ${dbErr.message}` }
                  : msg,
              ),
            );
          });
        } else {
          setError(`AI Error: ${streamError.message}`);
        }
      }
    },
    [
      selectedModel,
      selectedProvider,
      getApiKeyForProvider,
      addDbMessage,
      streamingThrottleRate,
      setError,
    ],
  );

  // --- Form Submission ---
  const handleSubmit = useCallback(
    async (e?: React.FormEvent<HTMLFormElement>) => {
      e?.preventDefault();
      const currentPrompt = prompt.trim();
      const canSubmit = currentPrompt.length > 0;

      if (!canSubmit || isAiStreaming) {
        return;
      }

      let currentConversationId = selectedConversationId;

      if (!currentConversationId) {
        try {
          console.log("No conversation selected, creating new one...");
          // ## start - Pass activeSystemPrompt if creating new convo implicitly
          // Note: If user *explicitly* wants a different prompt for a new chat,
          // they should use the createConversation button/action directly.
          // This handles the case where submit happens with no convo selected.
          const newConvId = await createConversation(
            "New Chat",
            activeSystemPrompt,
          );
          // ## end
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

      if (!currentConversationId) {
        setError("Error: Could not determine active conversation.");
        return;
      }
      if (!selectedProvider || !selectedModel) {
        setError("Error: Please select an AI Provider and Model first.");
        return;
      }

      const userPromptContent = currentPrompt;
      setPrompt("");
      clearAttachedFiles();
      setError(null);

      let userMessageId: string;
      let userMessageForState: Message;
      const userMessageTimestamp = new Date();

      try {
        const userMessageData = {
          role: "user" as const,
          content: userPromptContent,
          conversationId: currentConversationId,
          createdAt: userMessageTimestamp,
        };
        userMessageId = await addDbMessage(userMessageData);
        userMessageForState = { ...userMessageData, id: userMessageId };
      } catch (dbError: any) {
        console.error("Error adding user message to DB:", dbError);
        setError(`Error: Could not save your message - ${dbError.message}`);
        return;
      }

      // --- Prepare Message List for AI (using localMessages + new user message) ---
      // The system prompt is handled *inside* performAiStream now
      const currentHistory = localMessages
        .filter((m) => !m.error)
        .map((m): CoreMessage => ({ role: m.role, content: m.content }));

      const messagesToSendForAI: CoreMessage[] = [
        ...currentHistory,
        {
          role: userMessageForState.role,
          content: userMessageForState.content,
        },
      ];

      console.log(
        "Messages prepared for AI (excluding system prompt):",
        JSON.stringify(messagesToSendForAI, null, 2),
      );

      setLocalMessages((prevMessages) => [
        ...prevMessages,
        userMessageForState,
      ]);

      try {
        const hasUserOrAssistantMessage = messagesToSendForAI.some(
          (m) => m.role !== "system",
        );
        if (!hasUserOrAssistantMessage) {
          console.error(
            "handleSubmit Error: Attempting to send empty message list to AI.",
          );
          setError("Internal Error: Cannot send empty message list.");
          setLocalMessages((prev) =>
            prev.filter((m) => m.id !== userMessageId),
          );
          return;
        }

        await performAiStream(
          currentConversationId,
          messagesToSendForAI,
          temperature,
          maxTokens,
          topP,
          topK,
          presencePenalty,
          frequencyPenalty,
          activeSystemPrompt,
        );
      } catch (err: any) {
        console.error("Error during AI stream setup/call:", err);
        setError(`Error: ${err.message}`);
        setLocalMessages((prev) => prev.filter((m) => m.id !== userMessageId));
      }
    },
    [
      prompt,
      selectedConversationId,
      selectedModel,
      selectedProvider,
      isAiStreaming,
      addDbMessage,
      performAiStream,
      clearAttachedFiles,
      setError,
      activeSystemPrompt,
      temperature,
      maxTokens,
      topP,
      topK,
      presencePenalty,
      frequencyPenalty,
      createConversation,
      setPrompt,
      localMessages,
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

      const historyForRegen = localMessages.slice(0, messageIndex);

      const messagesToSendForAI: CoreMessage[] = historyForRegen
        .filter((m) => !m.error)
        .map((m): CoreMessage => ({ role: m.role, content: m.content }));

      const messagesToDelete = localMessages.slice(messageIndex);
      await Promise.all(messagesToDelete.map((m) => deleteDbMessage(m.id)));

      setLocalMessages((prev) => prev.slice(0, messageIndex));

      try {
        const hasUserOrAssistantMessage = messagesToSendForAI.some(
          (m) => m.role !== "system",
        );
        if (!hasUserOrAssistantMessage) {
          console.error(
            "Regenerate Error: Attempting to send empty message list to AI.",
          );
          setError("Internal Error: Cannot regenerate with empty history.");
          return;
        }

        await performAiStream(
          conversationIdToUse,
          messagesToSendForAI,
          temperature,
          maxTokens,
          topP,
          topK,
          presencePenalty,
          frequencyPenalty,
          activeSystemPrompt,
        );
      } catch (err: any) {
        console.error("Error during regeneration stream setup:", err);
        setError(`Error: ${err.message}`);
      }
    },
    [
      selectedConversationId,
      isAiStreaming,
      localMessages,
      deleteDbMessage,
      performAiStream,
      setError,
      activeSystemPrompt,
      temperature,
      maxTokens,
      topP,
      topK,
      presencePenalty,
      frequencyPenalty,
    ],
  );

  // --- Export All Conversations ---
  const exportAllConversations = useCallback(async () => {
    // ... (implementation remains the same)
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
  }, []);

  // --- Context Value ---
  const contextValue: ChatContextProps = useMemo(
    () => ({
      providers,
      selectedProviderId,
      setSelectedProviderId,
      selectedModelId,
      setSelectedModelId,
      apiKeys,
      selectedApiKeyId,
      setSelectedApiKeyId,
      addApiKey,
      deleteApiKey,
      getApiKeyForProvider,
      conversations: conversations || [], // Use live query result for conversation list
      selectedConversationId,
      selectConversation,
      createConversation,
      deleteConversation,
      renameConversation,
      updateConversationSystemPrompt,
      messages: localMessages, // Use localMessages for rendering
      isLoading: isLoadingMessages,
      isStreaming: isAiStreaming,
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
      globalSystemPrompt,
      setGlobalSystemPrompt,
      activeSystemPrompt,
      topP, // Pass new settings
      setTopP,
      topK,
      setTopK,
      presencePenalty,
      setPresencePenalty,
      frequencyPenalty,
      setFrequencyPenalty,
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
      // Ensure all state and functions used in the value are listed
      providers,
      selectedProviderId,
      selectedModelId,
      apiKeys,
      selectedApiKeyId,
      setSelectedApiKeyId,
      addApiKey,
      deleteApiKey,
      getApiKeyForProvider,
      conversations, // From useLiveQuery
      selectedConversationId,
      selectConversation,
      createConversation,
      deleteConversation,
      renameConversation,
      updateConversationSystemPrompt,
      localMessages, // The UI message state
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
      globalSystemPrompt,
      setGlobalSystemPrompt,
      activeSystemPrompt,
      setMaxTokens,
      topP,
      setTopP,
      topK,
      setTopK,
      presencePenalty,
      setPresencePenalty,
      frequencyPenalty,
      setFrequencyPenalty,
      theme,
      setTheme,
      streamingThrottleRate,
      searchTerm,
      setSearchTerm, // Added setSearchTerm
      exportConversation,
      importConversation,
      exportAllConversations,
    ],
  );

  // Apply theme
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
  }, [theme]);

  return (
    <ChatContext.Provider value={contextValue}>{children}</ChatContext.Provider>
  );
};
