// src/context/chat-context.tsx

import React, {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { streamText, type CoreMessage } from "ai";
import type { AiProviderConfig, ChatContextProps, Message } from "@/lib/types";
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
  const [systemPrompt, setSystemPrompt] = useState(
    "You are a helpful AI assitant that respond precisely and concisely to user requests",
  );
  const [topP, setTopP] = useState<number | null>(null);
  const [topK, setTopK] = useState<number | null>(null);
  const [presencePenalty, setPresencePenalty] = useState<number | null>(null);
  const [frequencyPenalty, setFrequencyPenalty] = useState<number | null>(null);
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Storage Hook (useLiveQuery for conversations/keys still active)
  const {
    conversations,
    createConversation: createDbConversation,
    deleteConversation: deleteDbConversation,
    renameConversation: renameDbConversation,
    // messages: dbMessages, // We won't directly use the live query result for localMessages anymore
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
    (id: string | null) => {
      if (isAiStreaming) {
        abortControllerRef.current?.abort();
        setIsAiStreaming(false);
      }
      // Don't clear localMessages here, the useEffect below will handle loading
      setIsLoadingMessages(true); // Show loading indicator
      setPrompt("");
      setError(null);
      clearAttachedFiles();
      setSelectedConversationId(id); // This triggers the useEffect below
    },
    [isAiStreaming, clearAttachedFiles, setError],
  );

  const createConversation = useCallback(
    async (title?: string): Promise<string> => {
      const newId = await createDbConversation(title);
      selectConversation(newId); // Select triggers load via useEffect
      return newId;
    },
    [createDbConversation, selectConversation],
  );

  const deleteConversation = useCallback(
    async (id: string): Promise<void> => {
      const currentSelectedId = selectedConversationId; // Capture before potential change
      await deleteDbConversation(id);
      if (currentSelectedId === id) {
        // Find the next available conversation *after* deletion
        const remainingConversations = await db.conversations
          .orderBy("updatedAt")
          .reverse()
          .toArray();
        selectConversation(remainingConversations[0]?.id ?? null);
      }
      // No need to manually update `conversations` state, useLiveQuery handles it
    },
    [deleteDbConversation, selectedConversationId, selectConversation],
  );

  const renameConversation = useCallback(
    async (id: string, newTitle: string): Promise<void> => {
      await renameDbConversation(id, newTitle);
      // No need to manually update `conversations` state, useLiveQuery handles it
    },
    [renameDbConversation],
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
  // *** MODIFIED EFFECT ***
  // This effect now ONLY runs when the selectedConversationId changes.
  // It fetches the messages for that conversation directly from the DB
  // and sets the localMessages state, which is used for rendering.
  useEffect(() => {
    // Only run if a conversation is selected
    if (selectedConversationId) {
      console.log(
        `Loading messages for ${selectedConversationId} directly from DB`,
      );
      setIsLoadingMessages(true);
      // Fetch messages directly from Dexie for the selected conversation
      db.messages
        .where("conversationId")
        .equals(selectedConversationId)
        .sortBy("createdAt")
        .then((messagesFromDb) => {
          // Populate localMessages with data fetched from DB
          setLocalMessages(
            messagesFromDb.map((dbMsg) => ({
              ...dbMsg,
              // Ensure runtime properties are reset correctly on load
              isStreaming: false,
              streamedContent: undefined,
              error: null,
            })),
          );
          setIsLoadingMessages(false);
        })
        .catch((err) => {
          // Handle potential errors during fetch
          console.error("Failed to load messages from DB:", err);
          setError(`Error loading chat: ${err.message}`);
          setLocalMessages([]); // Clear messages on error
          setIsLoadingMessages(false);
        });
    } else {
      // No conversation selected, clear messages and loading state
      setLocalMessages([]);
      setIsLoadingMessages(false);
    }
    // DEPEND ONLY ON selectedConversationId and setError
  }, [selectedConversationId, setError]); // <-- REMOVED dbMessages dependency

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

      // --- Manual State Update ---
      // Add the placeholder directly to localMessages for immediate UI update
      setLocalMessages((prev) => [...prev, assistantPlaceholder]);
      // --- End Manual State Update ---

      setIsAiStreaming(true);
      setError(null);

      abortControllerRef.current = new AbortController();

      const throttledStreamUpdate = throttle((streamedContentChunk: string) => {
        // --- Manual State Update ---
        // Update the placeholder in localMessages directly
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
        // --- End Manual State Update ---
      }, streamingThrottleRate);

      let finalContent = "";
      let streamError: Error | null = null;

      try {
        console.log(
          "Sending messages to AI:",
          JSON.stringify(messagesToSend, null, 2),
        );

        const result = streamText({
          model: selectedModel.instance,
          messages: messagesToSend,
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

        // --- Manual State Update ---
        // Update the final assistant message in localMessages directly
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
        // --- End Manual State Update ---

        // --- Persist Final Assistant Message to DB ---
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
            // Optionally update the message state again to show a save error?
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
      // setLocalMessages is implicitly used via the state updater functions
      // No need to list localMessages itself as a dependency here
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
          const newConvId = await createConversation("New Chat"); // This now selects and triggers load
          if (!newConvId)
            throw new Error("Failed to create a new conversation ID.");
          currentConversationId = newConvId; // Update ID for this submission
          console.log("New conversation created:", currentConversationId);
          // Wait a tick for the state update from selectConversation to potentially settle?
          // Or rely on the fact that addDbMessage below will use the correct ID.
          // await new Promise(resolve => setTimeout(resolve, 0));
        } catch (err: any) {
          console.error("Error creating conversation during submit:", err);
          setError(`Error: Could not start chat - ${err.message}`);
          return;
        }
      }

      // Re-check after potential conversation creation
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
      const userMessageTimestamp = new Date(); // Consistent timestamp

      try {
        const userMessageData = {
          role: "user" as const,
          content: userPromptContent,
          conversationId: currentConversationId,
          createdAt: userMessageTimestamp, // Use consistent timestamp
        };
        // Add to DB first
        userMessageId = await addDbMessage(userMessageData);
        // Prepare the object for state
        userMessageForState = {
          ...userMessageData,
          id: userMessageId, // Use ID from DB
        };
      } catch (dbError: any) {
        console.error("Error adding user message to DB:", dbError);
        setError(`Error: Could not save your message - ${dbError.message}`);
        return;
      }

      // --- Prepare Full Message List for AI (using current localMessages + new user message) ---
      // Use localMessages as it's the source of truth for the UI history at this point
      const currentHistory = localMessages
        .filter((m) => !m.error) // Exclude errored messages from history
        .map((m): CoreMessage => ({ role: m.role, content: m.content }));

      const messagesToSendForAI: CoreMessage[] = [];
      if (systemPrompt) {
        messagesToSendForAI.push({ role: "system", content: systemPrompt });
      }
      messagesToSendForAI.push(...currentHistory);
      messagesToSendForAI.push({
        role: userMessageForState.role,
        content: userMessageForState.content,
      });

      console.log(
        "Messages prepared for AI:",
        JSON.stringify(messagesToSendForAI, null, 2),
      );

      // --- Manual State Update ---
      // Add the user message directly to localMessages for immediate UI update
      setLocalMessages((prevMessages) => [
        ...prevMessages,
        userMessageForState,
      ]);
      // --- End Manual State Update ---

      // --- Call AI Stream ---
      try {
        const hasUserOrAssistantMessage = messagesToSendForAI.some(
          (m) => m.role !== "system",
        );
        if (!hasUserOrAssistantMessage) {
          console.error(
            "handleSubmit Error: Attempting to send empty or system-only message list to AI.",
          );
          setError("Internal Error: Cannot send empty message list.");
          // Revert the user message state update
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
        );
      } catch (err: any) {
        console.error("Error during AI stream setup/call:", err);
        setError(`Error: ${err.message}`);
        // Revert the user message state update if AI call setup fails
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
      systemPrompt,
      temperature,
      maxTokens,
      topP,
      topK,
      presencePenalty,
      frequencyPenalty,
      createConversation, // Needed for creating new chat on submit
      setPrompt,
      localMessages, // Needed for history construction
      // setLocalMessages is implicitly used via state updater
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

      // 1. Find the message index in localMessages
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

      // 2. Get history from localMessages up to the point *before* the message
      const historyForRegen = localMessages.slice(0, messageIndex);

      // 3. Construct the message list to send
      const messagesToSendForAI: CoreMessage[] = [];
      if (systemPrompt) {
        messagesToSendForAI.push({ role: "system", content: systemPrompt });
      }
      messagesToSendForAI.push(
        ...historyForRegen
          .filter((m) => !m.error) // Exclude errors from regen history
          .map((m): CoreMessage => ({ role: m.role, content: m.content })),
      );

      // 4. Remove the message to regenerate and subsequent messages from DB and state
      const messagesToDelete = localMessages.slice(messageIndex);
      await Promise.all(messagesToDelete.map((m) => deleteDbMessage(m.id)));

      // --- Manual State Update ---
      // Update local state immediately
      setLocalMessages((prev) => prev.slice(0, messageIndex));
      // --- End Manual State Update ---

      // 5. Call the stream function
      try {
        // Check history isn't empty (excluding system prompt)
        const hasUserOrAssistantMessage = messagesToSendForAI.some(
          (m) => m.role !== "system",
        );
        if (!hasUserOrAssistantMessage) {
          console.error(
            "Regenerate Error: Attempting to send empty or system-only message list to AI.",
          );
          setError("Internal Error: Cannot regenerate with empty history.");
          // Note: State already updated, maybe show error differently?
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
        );
      } catch (err: any) {
        console.error("Error during regeneration stream setup:", err);
        setError(`Error: ${err.message}`);
        // If setup fails, the state is already truncated. Maybe try reloading?
        // Or just display the error.
      }
    },
    [
      selectedConversationId,
      isAiStreaming,
      localMessages, // Needed for finding index, slicing, and history
      deleteDbMessage,
      performAiStream,
      setError,
      systemPrompt,
      temperature,
      maxTokens,
      topP,
      topK,
      presencePenalty,
      frequencyPenalty,
      // setLocalMessages implicitly used
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
      systemPrompt,
      setSystemPrompt,
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
      setMaxTokens,
      systemPrompt,
      setSystemPrompt,
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
