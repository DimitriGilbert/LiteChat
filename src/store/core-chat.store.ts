// src/store/core-chat.store.ts
import { create } from "zustand";
import type { Message, MessageContent, DbMessage } from "@/lib/types"; // Keep DbMessage
import { nanoid } from "nanoid";
import { toast } from "sonner";
import { modEvents, ModEvent } from "@/mods/events";
import { convertDbMessagesToCoreMessages } from "@/utils/chat-utils";
import React from "react"; // Needed for MutableRefObject type

// --- Mock/Placeholder Dependencies ---
// These represent external dependencies that need proper injection (Task 8)

// Placeholder for AbortController - needs external management
const abortControllerRef: React.MutableRefObject<AbortController | null> = {
  current: null,
};

// Placeholder DB functions (simulating access via a service/hook result)
const storage = {
  getMessagesForConversation: async (
    conversationId: string,
  ): Promise<DbMessage[]> => {
    console.warn(
      "Placeholder storage.getMessagesForConversation called",
      conversationId,
    );
    // Simulate fetching data
    await new Promise((resolve) => setTimeout(resolve, 200));
    // Return dummy data matching the type
    if (conversationId === "error-case") {
      throw new Error("Simulated DB load error");
    }
    return []; // Return empty array for now
  },
  addDbMessage: async (
    messageData: Omit<DbMessage, "id" | "createdAt"> &
      Partial<Pick<DbMessage, "id" | "createdAt">>,
  ): Promise<string> => {
    console.warn("Placeholder storage.addDbMessage called", messageData);
    await new Promise((resolve) => setTimeout(resolve, 50));
    return messageData.id ?? nanoid(); // Return provided/new ID
  },
  deleteDbMessage: async (messageId: string): Promise<void> => {
    console.warn("Placeholder storage.deleteDbMessage called", messageId);
    await new Promise((resolve) => setTimeout(resolve, 50));
  },
  // Add bulkAddMessages placeholder if needed by AI interaction
  bulkAddMessages: async (messages: DbMessage[]): Promise<unknown> => {
    console.warn("Placeholder storage.bulkAddMessages called", messages);
    await new Promise((resolve) => setTimeout(resolve, 50));
    return true;
  },
};

// Placeholder AI Interaction functions (simulating access via a service/hook result)
const aiInteraction = {
  performAiStream: async (params: any): Promise<void> => {
    console.warn("Placeholder aiInteraction.performAiStream called", params);
    const { conversationIdToUse } = params;
    // Simulate streaming: Set streaming true, add placeholder, update, finalize
    useCoreChatStore.setState({ isStreaming: true, error: null });
    const assistantId = nanoid();
    const placeholder: Message = {
      id: assistantId,
      role: "assistant",
      content: "",
      createdAt: new Date(),
      isStreaming: true,
      conversationId: conversationIdToUse,
    };
    useCoreChatStore.getState().addMessage(placeholder);

    await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate delay 1
    useCoreChatStore
      .getState()
      .updateMessage(assistantId, { streamedContent: "Thinking..." }); // Update streamedContent

    await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate delay 2
    useCoreChatStore.getState().updateMessage(assistantId, {
      content: "This is a streamed response.", // Set final content
      isStreaming: false, // Mark as finished
      streamedContent: undefined, // Clear streamed content
    });

    useCoreChatStore.setState({ isStreaming: false });
    // Simulate saving the final message (would happen inside performAiStream)
    await storage.addDbMessage({
      id: assistantId,
      role: "assistant",
      content: "This is a streamed response.",
      createdAt: placeholder.createdAt,
      conversationId: conversationIdToUse,
    });
  },
  performImageGeneration: async (params: any): Promise<void> => {
    console.warn(
      "Placeholder aiInteraction.performImageGeneration called",
      params,
    );
    const { conversationIdToUse, prompt } = params;
    useCoreChatStore.setState({ isStreaming: true, error: null });
    const assistantId = nanoid();
    const placeholder: Message = {
      id: assistantId,
      role: "assistant",
      content: `Generating image for: ${prompt}...`,
      createdAt: new Date(),
      isStreaming: true, // Indicate loading state
      conversationId: conversationIdToUse,
    };
    useCoreChatStore.getState().addMessage(placeholder);

    await new Promise((resolve) => setTimeout(resolve, 2000)); // Simulate generation

    // Simulate result (e.g., a data URL)
    const imageUrl =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="; // 1x1 black pixel
    const finalContent: MessageContent = [
      { type: "text", text: `Generated image for: ${prompt}` },
      { type: "image", image: imageUrl },
    ];
    useCoreChatStore.getState().updateMessage(assistantId, {
      content: finalContent,
      isStreaming: false,
    });
    useCoreChatStore.setState({ isStreaming: false });
    // Simulate saving
    await storage.addDbMessage({
      id: assistantId,
      role: "assistant",
      content: finalContent,
      createdAt: placeholder.createdAt,
      conversationId: conversationIdToUse,
    });
  },
};

// Placeholder for getting settings - needs cross-store access (Task 8)
const getSettings = () => ({
  temperature: 0.7,
  maxTokens: null,
  topP: null,
  topK: null,
  presencePenalty: null,
  frequencyPenalty: null,
  activeSystemPrompt: null, // This needs proper derivation (global vs conversation)
});
// --- End Mock/Placeholder Dependencies ---

export interface CoreChatState {
  messages: Message[];
  isLoadingMessages: boolean;
  isStreaming: boolean;
  error: string | null;
  // AbortController Ref is managed externally
}

export interface CoreChatActions {
  setMessages: (messages: Message[] | ((prev: Message[]) => Message[])) => void; // Allow functional updates
  addMessage: (message: Message) => void;
  updateMessage: (messageId: string, updates: Partial<Message>) => void;
  removeMessage: (messageId: string) => void;
  setIsLoadingMessages: (isLoading: boolean) => void;
  setIsStreaming: (isStreaming: boolean) => void;
  setError: (error: string | null) => void;
  loadMessages: (conversationId: string | null) => Promise<void>;
  handleSubmitCore: (
    currentConversationId: string,
    contentToSendToAI: MessageContent,
    vfsContextPaths?: string[],
  ) => Promise<void>;
  handleImageGenerationCore: (
    currentConversationId: string,
    prompt: string,
  ) => Promise<void>;
  stopStreamingCore: () => void;
  regenerateMessageCore: (messageId: string) => Promise<void>;
  // Add missing actions
  addDbMessage: (
    messageData: Omit<DbMessage, "id" | "createdAt"> &
      Partial<Pick<DbMessage, "id" | "createdAt">>,
  ) => Promise<string>;
  bulkAddMessages: (messages: DbMessage[]) => Promise<unknown>;
}

export const useCoreChatStore = create<CoreChatState & CoreChatActions>()(
  (set, get) => ({
    // Initial State
    messages: [],
    isLoadingMessages: false,
    isStreaming: false,
    error: null,

    // --- Simple Setters ---
    // Allow functional updates for setMessages
    setMessages: (messagesOrUpdater) =>
      set((state) => ({
        messages:
          typeof messagesOrUpdater === "function"
            ? messagesOrUpdater(state.messages)
            : messagesOrUpdater,
      })),
    addMessage: (message) =>
      set((state) => ({ messages: [...state.messages, message] })),
    updateMessage: (messageId, updates) =>
      set((state) => ({
        messages: state.messages.map((msg) =>
          msg.id === messageId ? { ...msg, ...updates } : msg,
        ),
      })),
    removeMessage: (messageId) =>
      set((state) => ({
        messages: state.messages.filter((msg) => msg.id !== messageId),
      })),
    setIsLoadingMessages: (isLoadingMessages) => set({ isLoadingMessages }),
    setIsStreaming: (isStreaming) => set({ isStreaming }),
    setError: (error) => set({ error }),

    // --- Complex Actions ---
    loadMessages: async (conversationId) => {
      if (!conversationId) {
        set({ messages: [], error: null, isLoadingMessages: false });
        return;
      }
      set({ isLoadingMessages: true, error: null });
      try {
        // Dependency: storage.getMessagesForConversation
        const dbMessages =
          await storage.getMessagesForConversation(conversationId);
        // Explicitly type dbMsg here
        const uiMessages: Message[] = dbMessages.map((dbMsg: DbMessage) => ({
          id: dbMsg.id,
          conversationId: dbMsg.conversationId,
          role: dbMsg.role,
          content: dbMsg.content,
          createdAt: dbMsg.createdAt,
          vfsContextPaths: dbMsg.vfsContextPaths,
          tool_calls: dbMsg.tool_calls,
          tool_call_id: dbMsg.tool_call_id,
        }));
        set({ messages: uiMessages, isLoadingMessages: false });
      } catch (err) {
        console.error("Failed to load messages:", err);
        const message =
          err instanceof Error ? err.message : "Unknown loading error";
        set({
          error: `Failed to load messages: ${message}`,
          messages: [],
          isLoadingMessages: false,
        });
        toast.error(`Failed to load messages: ${message}`);
      }
    },

    stopStreamingCore: () => {
      // Dependency: abortControllerRef
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
        // Ensure streaming state is false
        set({ isStreaming: false });
        // Update any message that was actively streaming
        set((state) => ({
          messages: state.messages.map((msg) =>
            msg.isStreaming ? { ...msg, isStreaming: false } : msg,
          ),
        }));
        toast.info("Processing stopped.");
      } else {
        // If no controller, ensure streaming state is false anyway
        if (get().isStreaming) {
          set({ isStreaming: false });
        }
      }
    },

    handleSubmitCore: async (
      currentConversationId,
      contentToSendToAI,
      vfsContextPaths,
    ) => {
      const userMessageId = nanoid();
      const userMessageTimestamp = new Date();
      const userMessage: Message = {
        id: userMessageId,
        conversationId: currentConversationId,
        role: "user",
        content: contentToSendToAI,
        createdAt: userMessageTimestamp,
        vfsContextPaths: vfsContextPaths,
      };

      // Optimistic UI update
      get().addMessage(userMessage);
      set({ error: null }); // Clear previous errors

      try {
        // Dependency: storage.addDbMessage
        await storage.addDbMessage({
          id: userMessageId,
          conversationId: currentConversationId,
          role: "user",
          content: contentToSendToAI,
          createdAt: userMessageTimestamp,
          vfsContextPaths: vfsContextPaths,
        });
        // Dependency: modEvents
        modEvents.emit(ModEvent.MESSAGE_SUBMITTED, { message: userMessage });
      } catch (err) {
        console.error("Failed to save user message:", err);
        set({ error: "Failed to save your message." });
        toast.error("Failed to save your message.");
        // Rollback optimistic update
        get().removeMessage(userMessageId);
        return; // Stop processing if DB save fails
      }

      // Prepare for AI call
      const currentMessagesForApi = convertDbMessagesToCoreMessages(
        get().messages, // Get current messages from state
      );
      // Dependency: getSettings (for AI params)
      const settings = getSettings();
      // Dependency: aiInteraction.performAiStream
      try {
        // aiInteraction functions should handle setting state via store setters
        await aiInteraction.performAiStream({
          conversationIdToUse: currentConversationId,
          messagesToSend: currentMessagesForApi,
          currentTemperature: settings.temperature,
          currentMaxTokens: settings.maxTokens,
          currentTopP: settings.topP,
          currentTopK: settings.topK,
          currentPresencePenalty: settings.presencePenalty,
          currentFrequencyPenalty: settings.frequencyPenalty,
          systemPromptToUse: settings.activeSystemPrompt,
          // Pass necessary setters/refs if the real implementation needs them
          // (though ideally the service manages state via store actions)
          abortControllerRef: abortControllerRef,
        });
      } catch (err) {
        console.error("Error during performAiStream call:", err);
        const errorMsg =
          err instanceof Error ? err.message : "Unknown AI error";
        set({ error: `AI Error: ${errorMsg}` });
        toast.error(`AI Error: ${errorMsg}`);
        // Ensure streaming is off if an error bubbles up unexpectedly
        if (get().isStreaming) {
          set({ isStreaming: false });
        }
      }
    },

    handleImageGenerationCore: async (currentConversationId, prompt) => {
      const userMessageId = nanoid();
      const userMessageTimestamp = new Date();
      const userMessageContent = `/imagine ${prompt}`;

      const userMessage: Message = {
        id: userMessageId,
        conversationId: currentConversationId,
        role: "user",
        content: userMessageContent,
        createdAt: userMessageTimestamp,
      };

      // Optimistic UI update
      get().addMessage(userMessage);
      set({ error: null }); // Clear previous errors

      try {
        // Dependency: storage.addDbMessage
        await storage.addDbMessage({
          id: userMessageId,
          conversationId: currentConversationId,
          role: "user",
          content: userMessageContent,
          createdAt: userMessageTimestamp,
        });
        // Dependency: modEvents
        modEvents.emit(ModEvent.MESSAGE_SUBMITTED, { message: userMessage });
      } catch (err) {
        console.error("Failed to save user image prompt message:", err);
        set({ error: "Failed to save your image prompt." });
        toast.error("Failed to save your image prompt.");
        // Rollback optimistic update
        get().removeMessage(userMessageId);
        return; // Stop processing if DB save fails
      }

      // Dependency: aiInteraction.performImageGeneration
      try {
        await aiInteraction.performImageGeneration({
          conversationIdToUse: currentConversationId,
          prompt: prompt,
          // Pass necessary setters/refs if needed
          abortControllerRef: abortControllerRef,
        });
      } catch (err) {
        console.error("Error during performImageGeneration call:", err);
        const errorMsg =
          err instanceof Error ? err.message : "Unknown AI error";
        set({ error: `AI Image Error: ${errorMsg}` });
        toast.error(`AI Image Error: ${errorMsg}`);
        if (get().isStreaming) {
          set({ isStreaming: false });
        }
      }
    },

    regenerateMessageCore: async (messageId) => {
      const messages = get().messages;
      const messageIndex = messages.findIndex((m) => m.id === messageId);

      if (messageIndex === -1 || messages[messageIndex].role !== "assistant") {
        toast.error("Cannot regenerate this message.");
        return;
      }

      const conversationId = messages[messageIndex].conversationId;
      if (!conversationId) {
        toast.error("Cannot regenerate message: Missing conversation ID.");
        return;
      }

      if (get().isStreaming) {
        toast.warning("Please wait for the current response to finish.");
        return;
      }

      set({ error: null });

      // Find the preceding user message to determine context/type
      let precedingUserMessageIndex = -1;
      for (let i = messageIndex - 1; i >= 0; i--) {
        if (messages[i].role === "user") {
          precedingUserMessageIndex = i;
          break;
        }
      }

      if (precedingUserMessageIndex === -1) {
        toast.error("Cannot regenerate: Preceding user message not found.");
        return;
      }
      const precedingUserMessage = messages[precedingUserMessageIndex];

      // --- Delete the old assistant message (DB and State) ---
      try {
        // Dependency: storage.deleteDbMessage
        await storage.deleteDbMessage(messageId);
      } catch (err) {
        console.error("Failed to delete old assistant message from DB:", err);
        toast.warning("Could not delete previous message from database.");
      }
      // Remove the message to be regenerated and any subsequent messages from state
      const messagesToKeep = messages.slice(0, messageIndex);
      set({ messages: messagesToKeep });
      // --- End Deletion ---

      // --- Trigger appropriate generation ---
      if (
        typeof precedingUserMessage.content === "string" &&
        precedingUserMessage.content.startsWith("/imagine ")
      ) {
        // Regenerate Image
        const imagePrompt = precedingUserMessage.content
          .substring("/imagine ".length)
          .trim();
        if (imagePrompt) {
          // Call the store's own action
          await get().handleImageGenerationCore(conversationId, imagePrompt);
        } else {
          toast.error("Cannot regenerate: Invalid image prompt found.");
          set({ error: "Cannot regenerate: Invalid image prompt found." });
        }
      } else {
        // Regenerate Text
        // Use the messages *before* deletion for history
        const historyForApi = convertDbMessagesToCoreMessages(
          messages.slice(0, precedingUserMessageIndex + 1),
        );
        // Dependency: getSettings (for AI params)
        const settings = getSettings();
        // Dependency: aiInteraction.performAiStream
        try {
          await aiInteraction.performAiStream({
            conversationIdToUse: conversationId,
            messagesToSend: historyForApi,
            currentTemperature: settings.temperature,
            currentMaxTokens: settings.maxTokens,
            currentTopP: settings.topP,
            currentTopK: settings.topK,
            currentPresencePenalty: settings.presencePenalty,
            currentFrequencyPenalty: settings.frequencyPenalty,
            systemPromptToUse: settings.activeSystemPrompt,
            abortControllerRef: abortControllerRef,
          });
        } catch (err) {
          console.error("Error during regeneration performAiStream call:", err);
          const errorMsg =
            err instanceof Error ? err.message : "Unknown AI error";
          set({ error: `AI Error: ${errorMsg}` });
          toast.error(`AI Error: ${errorMsg}`);
          if (get().isStreaming) {
            set({ isStreaming: false });
          }
        }
      }
    },

    // Implement missing actions with placeholders
    addDbMessage: async (messageData) => {
      // This action should ideally just call the storage service
      return storage.addDbMessage(messageData);
    },
    bulkAddMessages: async (messages) => {
      // This action should ideally just call the storage service
      return storage.bulkAddMessages(messages);
    },
  }),
);
