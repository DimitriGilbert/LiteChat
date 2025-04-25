// src/store/interaction.store.ts
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type {
  Interaction,
  InteractionStatus,
} from "@/types/litechat/interaction";
import { PersistenceService } from "@/services/persistence.service";

interface InteractionState {
  interactions: Interaction[];
  currentConversationId: string | null;
  streamingInteractionIds: string[]; // IDs of interactions currently streaming
  error: string | null;
  status: "idle" | "loading" | "streaming" | "error"; // Overall status for the current conversation
}
interface InteractionActions {
  loadInteractions: (conversationId: string) => Promise<void>;
  addInteraction: (
    interactionData: Omit<Interaction, "index">, // Data without index
  ) => Promise<void>;
  updateInteraction: (
    id: string,
    updates: Partial<Omit<Interaction, "index">>, // Prevent index overwrite
  ) => Promise<void>;
  appendInteractionResponseChunk: (id: string, chunk: string) => void;
  setInteractionStatus: (
    id: string,
    status: InteractionStatus,
    error?: string,
  ) => void;
  setCurrentConversationId: (id: string | null) => void;
  clearInteractions: () => void;
  setError: (error: string | null) => void;
  setStatus: (status: InteractionState["status"]) => void;
  _addStreamingId: (id: string) => void; // Internal helper
  _removeStreamingId: (id: string) => void; // Internal helper
  deleteInteraction: (id: string) => Promise<void>;
}

export const useInteractionStore = create(
  immer<InteractionState & InteractionActions>((set, get) => ({
    // Initial State
    interactions: [],
    currentConversationId: null,
    streamingInteractionIds: [],
    error: null,
    status: "idle",

    // Actions
    loadInteractions: async (conversationId) => {
      if (!conversationId) {
        get().clearInteractions();
        return;
      }
      set({
        status: "loading",
        error: null,
        interactions: [],
        streamingInteractionIds: [], // Clear streams for new conversation
        currentConversationId: conversationId, // Ensure current ID is set
      });
      try {
        const dbInteractions =
          await PersistenceService.loadInteractionsForConversation(
            conversationId,
          );
        // Ensure interactions are sorted by index after loading
        dbInteractions.sort((a, b) => a.index - b.index);
        set({ interactions: dbInteractions, status: "idle" });
      } catch (e) {
        console.error("InteractionStore: Error loading interactions", e);
        set({ error: "Failed load interactions", status: "error" });
      }
    },

    addInteraction: async (interactionData) => {
      const currentInteractions = get().interactions;
      // Calculate the next index based on the highest existing index
      const newIndex =
        currentInteractions.reduce((max, i) => Math.max(max, i.index), -1) + 1;
      // Assign parentId based on the ID of the last interaction in the current list
      const parentId =
        currentInteractions.length > 0
          ? currentInteractions[currentInteractions.length - 1].id
          : null;

      const interaction: Interaction = {
        ...interactionData,
        index: newIndex,
        parentId: parentId, // Assign calculated parentId
      };

      // Optimistically update UI
      set((state) => {
        // Prevent duplicates
        if (!state.interactions.some((i) => i.id === interaction.id)) {
          state.interactions.push(interaction);
          // No need to sort here if always adding to the end with incrementing index
          if (interaction.status === "STREAMING") {
            state._addStreamingId(interaction.id); // Use internal helper
          }
        }
      });

      try {
        await PersistenceService.saveInteraction(interaction);
      } catch (e) {
        console.error("InteractionStore: Error adding interaction", e);
        set((state) => {
          // Revert optimistic update on error
          state.interactions = state.interactions.filter(
            (i) => i.id !== interaction.id,
          );
          if (interaction.status === "STREAMING") {
            state._removeStreamingId(interaction.id); // Use internal helper
          }
          state.error = "Failed to save interaction";
        });
        throw e;
      }
    },

    updateInteraction: async (id, updates) => {
      let originalInteraction: Interaction | undefined;
      let updatedInteraction: Interaction | null = null;
      const wasStreaming =
        get().interactions.find((i) => i.id === id)?.status === "STREAMING";

      set((state) => {
        const index = state.interactions.findIndex((i) => i.id === id);
        if (index !== -1) {
          originalInteraction = { ...state.interactions[index] }; // Store original
          // Directly assign updates (type already prevents 'index' overwrite)
          Object.assign(state.interactions[index], updates);
          updatedInteraction = state.interactions[index];

          // Manage streaming state
          const isNowStreaming = updatedInteraction.status === "STREAMING";
          const isFinished = ["COMPLETED", "ERROR", "CANCELLED"].includes(
            updatedInteraction.status ?? "",
          );

          if (isNowStreaming) {
            state._addStreamingId(id); // Use internal helper
          } else if (isFinished && wasStreaming) {
            state._removeStreamingId(id); // Use internal helper
          }

          // Handle error metadata specifically
          if (updates.status === "ERROR" && updates.metadata?.error) {
            state.error = updates.metadata.error; // Set global error if provided in metadata
          }
        } else {
          console.warn(
            `InteractionStore: Interaction ${id} not found for update.`,
          );
        }
      });

      if (updatedInteraction) {
        try {
          await PersistenceService.saveInteraction(updatedInteraction);
        } catch (e) {
          console.error("InteractionStore: Error updating interaction", e);
          set((state) => {
            // Revert optimistic update on error
            const index = state.interactions.findIndex((i) => i.id === id);
            if (index !== -1 && originalInteraction) {
              state.interactions[index] = originalInteraction;
              // Re-manage streaming state after revert
              if (originalInteraction.status === "STREAMING") {
                state._addStreamingId(id);
              } else if (wasStreaming) {
                state._removeStreamingId(id);
              }
            }
            state.error = "Failed to save interaction update";
          });
          throw e;
        }
      }
    },

    appendInteractionResponseChunk: (id, chunk) => {
      set((state) => {
        const interaction = state.interactions.find((i) => i.id === id);
        if (interaction?.status === "STREAMING") {
          if (
            typeof interaction.response === "string" ||
            interaction.response === null
          ) {
            interaction.response = (interaction.response || "") + chunk;
          } else {
            console.warn(
              "InteractionStore: Appending chunk to non-string/null response type is not fully implemented.",
              interaction.response,
            );
          }
        } else if (interaction) {
          console.warn(
            `InteractionStore: Tried to append chunk to non-streaming interaction ${id} (Status: ${interaction.status})`,
          );
        }
      });
    },

    setInteractionStatus: (id, status, error) => {
      const currentInteraction = get().interactions.find((i) => i.id === id);
      get().updateInteraction(id, {
        status,
        endedAt: ["COMPLETED", "ERROR", "CANCELLED"].includes(status)
          ? new Date()
          : null,
        metadata: {
          ...currentInteraction?.metadata,
          ...(error && { error: error }),
        },
      });
    },

    setCurrentConversationId: (id) => {
      if (get().currentConversationId !== id) {
        console.log(
          `InteractionStore: Setting current conversation ID to ${id}`,
        );
        if (id) {
          get().loadInteractions(id);
        } else {
          get().clearInteractions();
        }
      } else {
        console.log(
          `InteractionStore: Conversation ID ${id} is already current.`,
        );
      }
    },

    clearInteractions: () => {
      console.log("InteractionStore: Clearing interactions.");
      set({
        interactions: [],
        streamingInteractionIds: [],
        status: "idle",
        error: null,
        currentConversationId: null,
      });
    },

    setError: (error) => {
      set((state) => {
        state.error = error;
        if (error) {
          state.status = "error";
        } else if (state.status === "error") {
          state.status =
            state.streamingInteractionIds.length > 0 ? "streaming" : "idle";
        }
      });
    },

    setStatus: (status) => {
      if (get().status !== status) {
        set({ status });
      }
    },

    _addStreamingId: (id) => {
      set((state) => {
        if (!state.streamingInteractionIds.includes(id)) {
          state.streamingInteractionIds.push(id);
          if (state.streamingInteractionIds.length === 1) {
            state.status = "streaming";
            state.error = null;
          }
        }
      });
    },

    _removeStreamingId: (id) => {
      set((state) => {
        const initialLength = state.streamingInteractionIds.length;
        state.streamingInteractionIds = state.streamingInteractionIds.filter(
          (sid) => sid !== id,
        );
        if (initialLength > 0 && state.streamingInteractionIds.length === 0) {
          state.status = state.error ? "error" : "idle";
        }
      });
    },

    deleteInteraction: async (id) => {
      const interactionToDelete = get().interactions.find((i) => i.id === id);
      if (!interactionToDelete) return;

      set((state) => ({
        interactions: state.interactions.filter((i) => i.id !== id),
      }));
      get()._removeStreamingId(id);

      try {
        await PersistenceService.deleteInteraction(id);
      } catch (e) {
        console.error("InteractionStore: Error deleting interaction", e);
        set((state) => {
          state.interactions.push(interactionToDelete);
          state.interactions.sort((a, b) => a.index - b.index);
          if (interactionToDelete.status === "STREAMING") {
            state._addStreamingId(id);
          }
          state.error = "Failed to delete interaction";
        });
        throw e;
      }
    },
  })),
);
