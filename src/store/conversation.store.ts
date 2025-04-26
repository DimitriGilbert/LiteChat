// src/store/conversation.store.ts
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { Conversation } from "@/types/litechat/chat";
import { useInteractionStore } from "./interaction.store";
import { PersistenceService } from "@/services/persistence.service";
import { nanoid } from "nanoid";
import { toast } from "sonner"; // Import toast

interface ConversationState {
  conversations: Conversation[];
  selectedConversationId: string | null;
  isLoading: boolean;
  error: string | null;
}
interface ConversationActions {
  loadConversations: () => Promise<void>;
  addConversation: (
    conversationData: Omit<Conversation, "id" | "createdAt" | "updatedAt">,
  ) => Promise<string>;
  updateConversation: (
    id: string,
    updates: Partial<Omit<Conversation, "id" | "createdAt">>, // Exclude id/createdAt from updates
  ) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  selectConversation: (id: string | null) => void;
  // Added actions
  importConversation: (file: File) => Promise<void>;
  exportAllConversations: () => Promise<void>;
}

export const useConversationStore = create(
  immer<ConversationState & ConversationActions>((set, get) => ({
    conversations: [],
    selectedConversationId: null,
    isLoading: false,
    error: null,

    loadConversations: async () => {
      set({ isLoading: true, error: null });
      try {
        const dbConvos = await PersistenceService.loadConversations();
        set({ conversations: dbConvos, isLoading: false });
      } catch (e) {
        console.error("ConversationStore: Error loading conversations", e);
        set({ error: "Failed load conversations", isLoading: false });
      }
    },

    addConversation: async (conversationData) => {
      const newId = nanoid();
      const now = new Date();
      const newConversation: Conversation = {
        id: newId,
        createdAt: now,
        updatedAt: now,
        ...conversationData,
      };
      // Optimistically update UI
      set((state) => {
        // Ensure no duplicates if called rapidly
        if (!state.conversations.some((c) => c.id === newConversation.id)) {
          // Add to the beginning for immediate visibility
          state.conversations.unshift(newConversation);
        }
      });
      try {
        await PersistenceService.saveConversation(newConversation);
        return newId;
      } catch (e) {
        console.error("ConversationStore: Error adding conversation", e);
        set((state) => ({
          error: "Failed to save new conversation",
          // Revert optimistic update on error
          conversations: state.conversations.filter((c) => c.id !== newId),
        }));
        throw e; // Re-throw for caller if needed
      }
    },

    updateConversation: async (id, updates) => {
      let originalConversation: Conversation | undefined;
      let updatedConversation: Conversation | null = null;

      set((state) => {
        const index = state.conversations.findIndex((c) => c.id === id);
        if (index !== -1) {
          originalConversation = { ...state.conversations[index] }; // Store original state
          // Apply updates and set updatedAt
          Object.assign(state.conversations[index], {
            ...updates,
            updatedAt: new Date(),
          });
          updatedConversation = state.conversations[index];
          // Re-sort after update to maintain order
          state.conversations.sort(
            (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
          );
        } else {
          console.warn(
            `ConversationStore: Conversation ${id} not found for update.`,
          );
        }
      });

      if (updatedConversation) {
        try {
          await PersistenceService.saveConversation(updatedConversation);
        } catch (e) {
          console.error("ConversationStore: Error updating conversation", e);
          set((state) => {
            // Revert optimistic update on error
            const index = state.conversations.findIndex((c) => c.id === id);
            if (index !== -1 && originalConversation) {
              state.conversations[index] = originalConversation;
              // Re-sort again after reverting
              state.conversations.sort(
                (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
              );
            }
            state.error = "Failed to save conversation update";
          });
          throw e;
        }
      }
    },

    deleteConversation: async (id) => {
      const currentSelectedId = get().selectedConversationId;
      const conversationToDelete = get().conversations.find((c) => c.id === id);
      if (!conversationToDelete) return; // Already deleted or never existed

      // Optimistically remove from UI
      set((state) => ({
        conversations: state.conversations.filter((c) => c.id !== id),
        selectedConversationId:
          currentSelectedId === id ? null : currentSelectedId,
      }));

      try {
        // Perform DB deletions
        await PersistenceService.deleteConversation(id);
        await PersistenceService.deleteInteractionsForConversation(id);

        // If the deleted conversation was selected, clear interactions in InteractionStore
        if (currentSelectedId === id) {
          useInteractionStore.getState().setCurrentConversationId(null);
        }
      } catch (e) {
        console.error("ConversationStore: Error deleting conversation", e);
        set((state) => {
          // Revert optimistic UI update on error
          // Add the conversation back (might need sorting)
          state.conversations.push(conversationToDelete);
          state.conversations.sort(
            (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
          );
          // Reset selection if it was changed
          if (currentSelectedId === id) {
            state.selectedConversationId = id;
          }
          state.error = "Failed to delete conversation";
        });
        throw e;
      }
    },

    selectConversation: (id) => {
      if (get().selectedConversationId !== id) {
        set({ selectedConversationId: id });
        // Trigger interaction loading in InteractionStore
        useInteractionStore.getState().setCurrentConversationId(id);
      } else {
        // If clicking the already selected conversation, maybe force a reload?
        // Or just do nothing. For now, do nothing.
        console.log(`Conversation ${id} already selected.`);
      }
    },

    // Added action implementations
    importConversation: async (file) => {
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        // TODO: Add validation logic for the imported data structure
        if (!data.conversation || !data.interactions) {
          throw new Error("Invalid import file format.");
        }
        const importedConversation: Conversation = data.conversation;
        const importedInteractions: Interaction[] = data.interactions;

        // Create a new conversation with imported title/metadata but new ID/timestamps
        const newId = await get().addConversation({
          title: importedConversation.title || "Imported Chat",
          metadata: importedConversation.metadata,
        });

        // Save interactions linked to the new conversation ID
        const interactionPromises = importedInteractions.map((i) =>
          PersistenceService.saveInteraction({
            ...i,
            conversationId: newId, // Link to new conversation
            id: nanoid(), // Generate new interaction ID
          }),
        );
        await Promise.all(interactionPromises);

        get().selectConversation(newId); // Select the newly imported conversation
        toast.success("Conversation imported successfully.");
      } catch (error) {
        console.error("ConversationStore: Error importing conversation", error);
        toast.error(
          `Import failed: ${error instanceof Error ? error.message : String(error)}`,
        );
        throw error;
      }
    },

    exportAllConversations: async () => {
      try {
        const conversations = await PersistenceService.loadConversations();
        const exportData = [];

        for (const convo of conversations) {
          const interactions =
            await PersistenceService.loadInteractionsForConversation(convo.id);
          exportData.push({ conversation: convo, interactions });
        }

        const jsonString = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonString], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `litechat_export_${new Date().toISOString().split("T")[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("All conversations exported.");
      } catch (error) {
        console.error(
          "ConversationStore: Error exporting conversations",
          error,
        );
        toast.error(
          `Export failed: ${error instanceof Error ? error.message : String(error)}`,
        );
        throw error;
      }
    },
  })),
);
