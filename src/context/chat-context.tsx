import React, {
  createContext,
  useState,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { streamText, type CoreMessage } from "ai"; // Import CoreMessage
import type {
  AiProviderConfig,
  ChatContextProps,
  DbMessage,
  Message,
  DbApiKey,
} from "@/lib/types";
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
  const [systemPrompt, setSystemPrompt] = useState(""); // TODO: Load/Save from storage?
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
      history: CoreMessage[],
      currentSystemPrompt: string,
      currentTemperature: number,
      currentMaxTokens: number | null,
    ) => {
      if (!selectedConversationId || !selectedModel || !selectedProvider) {
        throw new Error("Missing context for AI call");
      }

      const apiKey = getApiKeyForProvider(selectedProvider.id);
      // API Key Check
      if (selectedProvider.id !== "mock" && !apiKey) {
        // Allow mock provider without key
        throw new Error(
          `API Key for ${selectedProvider.name} is not set or selected.`,
        );
      }

      // Add placeholder for AI response
      const assistantMessageId = nanoid();
      const assistantPlaceholderTimestamp = new Date();
      const assistantPlaceholder: Message = {
        id: assistantMessageId,
        conversationId: selectedConversationId,
        role: "assistant",
        content: "",
        createdAt: assistantPlaceholderTimestamp,
        isStreaming: true,
        streamedContent: "",
        error: null,
      };
      setLocalMessages((prev) => [...prev, assistantPlaceholder]);
      setIsAiStreaming(true);
      setError(null); // Clear previous errors

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
        // Construct messages with potential system prompt
        const messagesToSend: CoreMessage[] = [];
        if (currentSystemPrompt) {
          messagesToSend.push({ role: "system", content: currentSystemPrompt });
        }
        messagesToSend.push(...history);

        // TODO: Integrate file handling here
        // If attachedFiles exist, modify the *last* message in messagesToSend
        // according to the provider's multimodal format (e.g., OpenAI content array)
        // This requires async reading of files (e.g., to base64)

        const result = await streamText({
          model: selectedModel.instance,
          messages: messagesToSend,
          tools: selectedModel.tools,
          abortSignal: abortControllerRef.current.signal,
          // Pass API key if required by the provider's client-side setup
          // Note: Some providers might need configuration during `create...` instead
          // headers: apiKey ? { 'Authorization': `Bearer ${apiKey}` } : undefined,
          // Pass other settings
          temperature: currentTemperature,
          maxTokens: currentMaxTokens ?? undefined, // Pass null/undefined if not set
          // Pass the API key directly if the provider supports it
          // This depends HEAVILY on the specific provider SDK implementation
          // Example for OpenAI (check if @ai-sdk/openai supports this pattern):
          // apiKey: apiKey,
        });

        for await (const delta of result.textStream) {
          finalContent += delta;
          throttledStreamUpdate(delta);
        }
        // TODO: Handle tool calls if needed from result
      } catch (err: any) {
        if (err.name === "AbortError") {
          console.log("Stream aborted.");
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
                  error: streamError ? streamError.message : null, // Store error message on the message itself
                }
              : msg,
          ),
        );

        // Persist the final assistant message to Dexie
        await addDbMessage({
          id: assistantMessageId,
          conversationId: selectedConversationId,
          role: "assistant",
          content: finalContent, // Save final/partial/error content
          createdAt: assistantPlaceholderTimestamp,
        });

        // Set global error if one occurred during the stream
        if (streamError) {
          setError(`AI Error: ${streamError.message}`);
        }
      }
    },
    [
      selectedConversationId,
      selectedModel,
      selectedProvider,
      getApiKeyForProvider,
      addDbMessage,
      localMessages, // Needed for abort case
      streamingThrottleRate,
      setError,
      // Dependencies for settings passed as args: none needed here
    ],
  );

  // --- Form Submission ---
  const handleSubmit = useCallback(
    async (e?: React.FormEvent<HTMLFormElement>) => {
      e?.preventDefault();
      const currentPrompt = prompt.trim();
      if (
        !currentPrompt ||
        !selectedConversationId ||
        !selectedModel ||
        !selectedProvider ||
        isAiStreaming
      ) {
        return;
      }

      // TODO: Handle file attachments here before clearing prompt/files
      // Convert files to appropriate format if needed

      setPrompt("");
      clearAttachedFiles(); // Clear files after grabbing content
      setError(null); // Clear previous errors

      // 1. Add user message
      // TODO: Modify userMessageData.content if files are attached (multimodal)
      const userMessageData = {
        role: "user" as const,
        content: currentPrompt, // Include file representations here if multimodal
        conversationId: selectedConversationId,
      };
      const userMessageId = await addDbMessage(userMessageData);
      const userMessageForState: Message = {
        ...userMessageData,
        id: userMessageId,
        createdAt: new Date(),
      };
      setLocalMessages((prev) => [...prev, userMessageForState]);

      // 2. Prepare history
      const history: CoreMessage[] = [...localMessages, userMessageForState]
        .filter((m) => !m.error) // Exclude errored messages from history? Or keep them? Decide policy.
        .map((m) => ({
          role: m.role,
          content: m.content,
          // TODO: Add multimodal content here if needed
        }));

      // 3. Call the stream function
      try {
        await performAiStream(history, systemPrompt, temperature, maxTokens);
      } catch (err: any) {
        console.error("Error during AI stream setup:", err);
        setError(`Error: ${err.message}`);
      }
    },
    [
      prompt,
      selectedConversationId,
      selectedModel,
      selectedProvider,
      isAiStreaming,
      addDbMessage,
      localMessages,
      performAiStream,
      clearAttachedFiles,
      setError,
      systemPrompt, // Add settings dependencies
      temperature,
      maxTokens,
      // attachedFiles // Add file dependency
    ],
  );

  // --- Regeneration ---
  const regenerateMessage = useCallback(
    async (messageId: string) => {
      if (!selectedConversationId || isAiStreaming) return;

      setError(null); // Clear errors

      // 1. Find the message to regenerate and the one *before* it (usually user prompt)
      const messageIndex = localMessages.findIndex((m) => m.id === messageId);
      if (messageIndex < 1) {
        setError(
          "Cannot regenerate the first message or non-existent message.",
        );
        return;
      }
      const messageToRegenerate = localMessages[messageIndex];
      // const precedingMessage = localMessages[messageIndex - 1];

      if (messageToRegenerate.role !== "assistant") {
        setError("Can only regenerate assistant messages.");
        return;
      }

      // 2. Get history up to the point *before* the message to regenerate
      const historyMessages = await getDbMessagesUpTo(
        selectedConversationId,
        messageId,
      );
      const history: CoreMessage[] = historyMessages.map((m) => ({
        role: m.role,
        content: m.content,
        // TODO: Add multimodal content if needed
      }));

      // 3. Remove the message to regenerate and subsequent messages from DB and state
      const messagesToDelete = localMessages.slice(messageIndex);
      await Promise.all(messagesToDelete.map((m) => deleteDbMessage(m.id)));
      setLocalMessages((prev) => prev.slice(0, messageIndex));

      // 4. Call the stream function with the truncated history
      try {
        await performAiStream(history, systemPrompt, temperature, maxTokens);
      } catch (err: any) {
        console.error("Error during regeneration stream setup:", err);
        setError(`Error: ${err.message}`);
      }
    },
    [
      selectedConversationId,
      isAiStreaming,
      localMessages,
      getDbMessagesUpTo,
      deleteDbMessage,
      performAiStream,
      setError,
      systemPrompt, // Add settings dependencies
      temperature,
      maxTokens,
    ],
  );

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
      exportConversation, // Add export function
      importConversation, // Add import function
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
