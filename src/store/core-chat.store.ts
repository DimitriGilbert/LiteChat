// src/store/core-chat.store.ts
import { create } from "zustand";
import type { Message, MessageContent, DbMessage } from "@/lib/types"; // Keep DbMessage
import { nanoid } from "nanoid";
import { toast } from "sonner";
import { modEvents, ModEvent } from "@/mods/events";
import { convertDbMessagesToCoreMessages } from "@/utils/chat-utils";
import React from "react"; // Needed for MutableRefObject type
import { db } from "@/lib/db"; // Import Dexie instance
import { Dexie } from "dexie"; // Import Dexie for Dexie.minKey/maxKey

// --- REMOVE Placeholder Dependencies ---
// const abortControllerRef: React.MutableRefObject<AbortController | null> = { current: null };
// const storage = { ... };
// const aiInteraction = { ... };
// const getSettings = () => { ... };
// --- End REMOVE Placeholder Dependencies ---

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
  deleteDbMessage: (messageId: string) => Promise<void>; // Add deleteDbMessage
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
        // Use Dexie directly
        const dbMessages = await db.messages
          .where("[conversationId+createdAt]")
          .between(
            [conversationId, Dexie.minKey],
            [conversationId, Dexie.maxKey],
          )
          .sortBy("createdAt");

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
      // This action needs access to the abortControllerRef, which is managed externally (e.g., in LiteChatInner)
      // The external component should call this action AND manage the ref.
      // For now, just update the state.
      console.warn(
        "stopStreamingCore called, but AbortController management is external.",
      );
      if (get().isStreaming) {
        set({ isStreaming: false });
        // Update any message that was actively streaming
        set((state) => ({
          messages: state.messages.map((msg) =>
            msg.isStreaming ? { ...msg, isStreaming: false } : msg,
          ),
        }));
        toast.info("Processing stopped.");
      }
    },

    handleSubmitCore: async (
      currentConversationId,
      contentToSendToAI,
      vfsContextPaths,
    ) => {
      // This action depends on external AI interaction logic and settings.
      // It should primarily handle saving the user message and triggering the external AI call.
      // The external AI call handler (useAiInteraction) will then update state via store actions.
      console.warn(
        "handleSubmitCore called - relies on external AI interaction hook.",
      );

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

      get().addMessage(userMessage);
      set({ error: null });

      try {
        await get().addDbMessage({
          id: userMessageId,
          conversationId: currentConversationId,
          role: "user",
          content: contentToSendToAI,
          createdAt: userMessageTimestamp,
          vfsContextPaths: vfsContextPaths,
        });
        modEvents.emit(ModEvent.MESSAGE_SUBMITTED, { message: userMessage });
        // Triggering the actual AI call is now the responsibility of the component using this store (e.g., LiteChatInner via useAiInteraction)
      } catch (err) {
        console.error("Failed to save user message:", err);
        set({ error: "Failed to save your message." });
        toast.error("Failed to save your message.");
        get().removeMessage(userMessageId);
        throw err; // Re-throw to indicate failure
      }
    },

    handleImageGenerationCore: async (currentConversationId, prompt) => {
      // Similar to handleSubmitCore, this triggers the external AI call.
      console.warn(
        "handleImageGenerationCore called - relies on external AI interaction hook.",
      );

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

      get().addMessage(userMessage);
      set({ error: null });

      try {
        await get().addDbMessage({
          id: userMessageId,
          conversationId: currentConversationId,
          role: "user",
          content: userMessageContent,
          createdAt: userMessageTimestamp,
        });
        modEvents.emit(ModEvent.MESSAGE_SUBMITTED, { message: userMessage });
        // Triggering the actual AI call is external
      } catch (err) {
        console.error("Failed to save user image prompt message:", err);
        set({ error: "Failed to save your image prompt." });
        toast.error("Failed to save your image prompt.");
        get().removeMessage(userMessageId);
        throw err; // Re-throw
      }
    },

    regenerateMessageCore: async (messageId) => {
      // This action also relies on external AI interaction logic.
      // It should handle deleting the old message and preparing for the external call.
      console.warn(
        "regenerateMessageCore called - relies on external AI interaction hook.",
      );

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

      // Find the preceding user message
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

      // Delete the old assistant message (DB and State)
      try {
        await get().deleteDbMessage(messageId); // Use store action
      } catch (err) {
        console.error("Failed to delete old assistant message from DB:", err);
        toast.warning("Could not delete previous message from database.");
      }
      const messagesToKeep = messages.slice(0, messageIndex);
      set({ messages: messagesToKeep });

      // The component calling this (e.g., LiteChatInner) will now
      // determine whether to call performAiStream or performImageGeneration
      // based on the precedingUserMessage.
    },

    // Implement DB actions using Dexie
    addDbMessage: async (messageData) => {
      try {
        const newMessage: DbMessage = {
          id: messageData.id ?? nanoid(),
          createdAt: messageData.createdAt ?? new Date(),
          role: messageData.role,
          content: messageData.content,
          conversationId: messageData.conversationId,
          vfsContextPaths: messageData.vfsContextPaths ?? undefined,
          tool_calls: messageData.tool_calls ?? undefined,
          tool_call_id: messageData.tool_call_id ?? undefined,
        };
        await db.messages.add(newMessage);
        const conversation = await db.conversations.get(
          messageData.conversationId,
        );
        const now = new Date();
        await db.conversations.update(messageData.conversationId, {
          updatedAt: now,
        });
        if (conversation?.parentId) {
          await db.projects.update(conversation.parentId, { updatedAt: now });
        }
        return newMessage.id;
      } catch (error) {
        console.error("Failed to add DB message:", error);
        toast.error(
          `Failed to save message: ${error instanceof Error ? error.message : String(error)}`,
        );
        throw error;
      }
    },
    bulkAddMessages: async (messages) => {
      if (messages.length === 0) return;
      try {
        const latestMessage = messages.reduce((latest, current) =>
          latest.createdAt > current.createdAt ? latest : current,
        );
        const conversationId = latestMessage.conversationId;
        const conversation = await db.conversations.get(conversationId);
        const now = new Date();

        await db.transaction(
          "rw",
          db.messages,
          db.conversations,
          db.projects,
          async () => {
            await db.messages.bulkAdd(messages);
            await db.conversations.update(conversationId, { updatedAt: now });
            if (conversation?.parentId) {
              await db.projects.update(conversation.parentId, {
                updatedAt: now,
              });
            }
          },
        );
      } catch (error) {
        console.error("Failed to bulk add DB messages:", error);
        toast.error(
          `Failed to save messages: ${error instanceof Error ? error.message : String(error)}`,
        );
        throw error;
      }
    },
    deleteDbMessage: async (messageId) => {
      try {
        await db.messages.delete(messageId);
      } catch (error) {
        console.error("Failed to delete DB message:", error);
        toast.error(
          `Failed to delete message: ${error instanceof Error ? error.message : String(error)}`,
        );
        throw error;
      }
    },
  }),
);
