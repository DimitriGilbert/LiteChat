// src/store/core-chat.store.ts
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { toast } from "sonner";
import { nanoid } from "nanoid";
import { Dexie } from "dexie"; // Import Dexie
import {
  Message,
  DbMessage,
  MessageContent,
  Role,
  Workflow, // Import Workflow type
} from "@/lib/types";
import { db } from "@/lib/db";
import { convertDbMessagesToCoreMessages } from "@/utils/chat-utils";

export interface CoreChatState {
  messages: Message[];
  isLoadingMessages: boolean;
  isStreaming: boolean;
  error: string | null;
}

export interface CoreChatActions {
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  updateMessage: (id: string, updates: Partial<Message>) => void;
  removeMessage: (id: string) => void;
  setIsLoadingMessages: (isLoading: boolean) => void;
  setIsStreaming: (isStreaming: boolean) => void;
  setError: (error: string | null) => void;
  loadMessages: (conversationId: string) => Promise<void>;
  // DB interaction wrappers (can be moved to a dedicated storage store later)
  addDbMessage: (
    messageData: Omit<DbMessage, "id" | "createdAt"> &
      Partial<Pick<DbMessage, "id" | "createdAt">>,
  ) => Promise<string>;
  bulkAddMessages: (messages: DbMessage[]) => Promise<unknown>;
  // Core interaction logic placeholders (implementation in useAiInteraction/logic hook)
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
}

export const useCoreChatStore = create(
  immer<CoreChatState & CoreChatActions>((set, get) => ({
    messages: [],
    isLoadingMessages: false,
    isStreaming: false,
    error: null,

    setMessages: (messages) => {
      set((state) => {
        state.messages = messages;
      });
    },

    addMessage: (message) => {
      set((state) => {
        // Ensure message has an ID
        if (!message.id) {
          message.id = nanoid();
        }
        // Ensure createdAt is set
        if (!message.createdAt) {
          message.createdAt = new Date();
        }
        state.messages.push(message);
      });
    },

    updateMessage: (id, updates) => {
      set((state) => {
        const messageIndex = state.messages.findIndex((m) => m.id === id);
        if (messageIndex !== -1) {
          // Merge updates into the existing message object
          state.messages[messageIndex] = {
            ...state.messages[messageIndex],
            ...updates,
          };
        } else {
          console.warn(`[CoreChatStore] Message with ID ${id} not found.`);
        }
      });
    },

    removeMessage: (id) => {
      set((state) => {
        state.messages = state.messages.filter((m) => m.id !== id);
      });
    },

    setIsLoadingMessages: (isLoading) => {
      set((state) => {
        state.isLoadingMessages = isLoading;
      });
    },

    setIsStreaming: (isStreaming) => {
      set((state) => {
        state.isStreaming = isStreaming;
      });
    },

    setError: (error) => {
      set((state) => {
        state.error = error;
      });
    },

    loadMessages: async (conversationId) => {
      set((state) => {
        state.isLoadingMessages = true;
        state.messages = []; // Clear existing messages
        state.error = null;
      });
      try {
        const dbMessages = await db.messages
          .where("[conversationId+createdAt]")
          .between(
            [conversationId, Dexie.minKey],
            [conversationId, Dexie.maxKey],
          )
          .sortBy("createdAt");

        // Map DbMessage to Message, including children, workflow, providerId, modelId
        const uiMessages: Message[] = dbMessages.map((dbMsg) => ({
          id: dbMsg.id,
          role: dbMsg.role,
          content: dbMsg.content,
          conversationId: dbMsg.conversationId,
          createdAt: dbMsg.createdAt,
          vfsContextPaths: dbMsg.vfsContextPaths,
          tool_calls: dbMsg.tool_calls,
          tool_call_id: dbMsg.tool_call_id,
          tokensInput: dbMsg.tokensInput,
          tokensOutput: dbMsg.tokensOutput,
          children: dbMsg.children, // Map children
          workflow: dbMsg.workflow, // Map workflow
          providerId: dbMsg.providerId, // Map providerId
          modelId: dbMsg.modelId, // Map modelId
          // Initialize UI-only fields
          isStreaming: false,
          error: null,
        }));

        set((state) => {
          state.messages = uiMessages;
          state.isLoadingMessages = false;
        });
      } catch (error) {
        console.error("Failed to load messages:", error);
        const message =
          error instanceof Error ? error.message : "Unknown error";
        set((state) => {
          state.error = `Failed to load messages: ${message}`;
          state.isLoadingMessages = false;
        });
        toast.error(`Failed to load messages: ${message}`);
      }
    },

    // --- DB Wrappers ---
    addDbMessage: async (messageData) => {
      // This function now primarily relies on the useChatStorage hook's implementation
      // but we keep it here as an action for consistency if needed elsewhere.
      // The actual saving logic is in useChatStorage.
      // We just need to ensure the new fields are passed through if present.
      const newMessage: DbMessage = {
        id: messageData.id ?? nanoid(),
        createdAt: messageData.createdAt ?? new Date(),
        role: messageData.role,
        content: messageData.content,
        conversationId: messageData.conversationId!,
        vfsContextPaths: messageData.vfsContextPaths,
        tool_calls: messageData.tool_calls,
        tool_call_id: messageData.tool_call_id,
        children: messageData.children,
        workflow: messageData.workflow,
        providerId: messageData.providerId, // Pass providerId
        modelId: messageData.modelId, // Pass modelId
        tokensInput: messageData.tokensInput,
        tokensOutput: messageData.tokensOutput,
      };
      await db.messages.add(newMessage);
      await db.conversations.update(newMessage.conversationId, {
        updatedAt: new Date(),
      });
      return newMessage.id;
    },

    bulkAddMessages: async (messages) => {
      // Similar to addDbMessage, relies on useChatStorage implementation.
      // Ensures new fields are handled by Dexie during bulkAdd.
      if (messages.length === 0) return;
      const latestMessage = messages.reduce((latest, current) =>
        latest.createdAt > current.createdAt ? latest : current,
      );
      const conversationId = latestMessage.conversationId;
      await db.transaction(
        "rw",
        db.messages,
        db.conversations,
        db.projects,
        async () => {
          await db.messages.bulkAdd(messages);
          await db.conversations.update(conversationId, {
            updatedAt: new Date(),
          });
          // Optionally update project timestamp if needed
        },
      );
    },

    // --- Core Interaction Logic ---
    // These functions save the *user's* message and prepare for AI interaction.
    // The actual AI call is handled by useAiInteraction hook triggered by the logic hook.

    handleSubmitCore: async (
      currentConversationId,
      contentToSendToAI,
      vfsContextPaths,
    ) => {
      const userMessage: Message = {
        id: nanoid(),
        role: "user" as Role,
        content: contentToSendToAI,
        createdAt: new Date(),
        conversationId: currentConversationId,
        vfsContextPaths: vfsContextPaths,
      };

      // Add user message to UI immediately
      get().addMessage(userMessage);

      // Save user message to DB
      try {
        await get().addDbMessage({
          id: userMessage.id,
          conversationId: currentConversationId,
          role: userMessage.role,
          content: userMessage.content,
          createdAt: userMessage.createdAt,
          vfsContextPaths: userMessage.vfsContextPaths,
          // User messages don't have provider/model directly
        });
      } catch (dbErr) {
        const errorMsg = `Failed to save your message: ${dbErr instanceof Error ? dbErr.message : "Unknown DB error"}`;
        get().setError(errorMsg);
        toast.error(errorMsg);
        // Optionally remove the message from UI if save fails critically
        get().removeMessage(userMessage.id);
        throw dbErr; // Re-throw to stop further processing
      }
    },

    handleImageGenerationCore: async (currentConversationId, prompt) => {
      const userMessage: Message = {
        id: nanoid(),
        role: "user" as Role,
        content: `/imagine ${prompt}`, // Store the command
        createdAt: new Date(),
        conversationId: currentConversationId,
      };

      get().addMessage(userMessage);

      try {
        await get().addDbMessage({
          id: userMessage.id,
          conversationId: currentConversationId,
          role: userMessage.role,
          content: userMessage.content,
          createdAt: userMessage.createdAt,
        });
      } catch (dbErr) {
        const errorMsg = `Failed to save your image prompt: ${dbErr instanceof Error ? dbErr.message : "Unknown DB error"}`;
        get().setError(errorMsg);
        toast.error(errorMsg);
        get().removeMessage(userMessage.id);
        throw dbErr;
      }
    },

    stopStreamingCore: () => {
      set((state) => {
        if (state.isStreaming) {
          state.isStreaming = false;
          // Find the last streaming message and mark it as finished (potentially with error state)
          const lastMsgIndex = state.messages.length - 1;
          if (lastMsgIndex >= 0 && state.messages[lastMsgIndex].isStreaming) {
            state.messages[lastMsgIndex].isStreaming = false;
            state.messages[lastMsgIndex].error = "Cancelled by user.";
            state.messages[lastMsgIndex].content =
              state.messages[lastMsgIndex].streamedContent || ""; // Use streamed content if available
            state.messages[lastMsgIndex].streamedContent = undefined;
          }
          toast.info("AI response stopped.");
        }
      });
    },

    regenerateMessageCore: async (messageId) => {
      const messages = get().messages;
      const messageIndex = messages.findIndex((m) => m.id === messageId);

      if (messageIndex === -1) {
        toast.error("Original message not found for regeneration.");
        throw new Error("Original message not found");
      }

      // Find the preceding user message to determine context
      let precedingUserMessageIndex = -1;
      for (let i = messageIndex - 1; i >= 0; i--) {
        if (messages[i].role === "user") {
          precedingUserMessageIndex = i;
          break;
        }
      }

      if (precedingUserMessageIndex === -1) {
        toast.error("Could not find preceding user message for context.");
        throw new Error("Could not find preceding user message");
      }

      const conversationId = messages[messageIndex].conversationId;
      if (!conversationId) {
        toast.error("Conversation ID missing from message.");
        throw new Error("Conversation ID missing");
      }

      // Messages to keep (up to and including the preceding user message)
      const messagesToKeep = messages.slice(0, precedingUserMessageIndex + 1);
      const messageIdsToDelete = messages
        .slice(precedingUserMessageIndex + 1)
        .map((m) => m.id);

      // Update UI state first
      set((state) => {
        state.messages = messagesToKeep;
        state.error = null; // Clear previous errors
        state.isStreaming = false; // Ensure not stuck in streaming state
      });

      // Delete subsequent messages from DB
      try {
        await db.messages.bulkDelete(messageIdsToDelete);
        // Update conversation timestamp
        await db.conversations.update(conversationId, {
          updatedAt: new Date(),
        });
      } catch (dbErr) {
        console.error("Failed to delete messages during regeneration:", dbErr);
        toast.error("Failed to prepare for regeneration.");
        // Attempt to reload messages to restore state
        await get().loadMessages(conversationId);
        throw dbErr; // Re-throw
      }
    },
  })),
);
