// src/store/interaction.store.ts
import { create } from "zustand";
import { immer } from "zustand/middleware/immer"; // Use immer middleware
import type { Interaction } from "@/types/litechat/interaction";
import { PersistenceService } from "@/services/persistence.service";

interface InteractionState {
  interactions: Interaction[];
  currentConversationId: string | null;
  streamingInteractionIds: string[];
  activeStreamBuffers: Record<string, string>; // New: Buffer for active streams
  error: string | null;
  status: "idle" | "loading" | "streaming" | "error";
}
interface InteractionActions {
  loadInteractions: (conversationId: string) => Promise<void>;
  // --- Synchronous State Updates ONLY ---
  _addInteractionToState: (interaction: Interaction) => void;
  _updateInteractionInState: (
    id: string,
    updates: Partial<Omit<Interaction, "id">>, // Allow updating index/parentId if needed internally
  ) => void;
  // Modified: Appends to buffer, not main interaction object
  appendInteractionResponseChunk: (id: string, chunk: string) => void;
  _removeInteractionFromState: (id: string) => void;
  // --- Async Actions (Involving Persistence) ---
  addInteractionAndPersist: (
    // Expects the base data, index/parentId will be calculated
    interactionData: Omit<Interaction, "index" | "parentId">,
  ) => Promise<Interaction>;
  updateInteractionAndPersist: (interaction: Interaction) => Promise<void>;
  deleteInteraction: (id: string) => Promise<void>;
  // --- Other Actions ---
  setCurrentConversationId: (id: string | null) => void;
  clearInteractions: () => void;
  setError: (error: string | null) => void;
  setStatus: (status: InteractionState["status"]) => void;
  _addStreamingId: (id: string) => void;
  _removeStreamingId: (id: string) => void; // Will now only manage buffer/list
}

export const useInteractionStore = create(
  immer<InteractionState & InteractionActions>((set, get) => ({
    // Initial State
    interactions: [],
    currentConversationId: null,
    streamingInteractionIds: [],
    activeStreamBuffers: {}, // Initialize buffer
    error: null,
    status: "idle",

    // --- Async Load ---
    loadInteractions: async (conversationId) => {
      if (!conversationId) {
        get().clearInteractions();
        return;
      }
      set({
        status: "loading",
        error: null,
        interactions: [],
        streamingInteractionIds: [],
        activeStreamBuffers: {}, // Clear buffer on load
        currentConversationId: conversationId,
      });
      try {
        const dbInteractions =
          await PersistenceService.loadInteractionsForConversation(
            conversationId,
          );
        dbInteractions.sort((a, b) => a.index - b.index);
        set({ interactions: dbInteractions, status: "idle" });
      } catch (e) {
        console.error("InteractionStore: Error loading interactions", e);
        set({ error: "Failed load interactions", status: "error" });
      }
    },

    // --- Synchronous State Updates ONLY ---
    _addInteractionToState: (interaction) => {
      set((state) => {
        if (!state.interactions.some((i) => i.id === interaction.id)) {
          const newInteractions = [...state.interactions, interaction];
          newInteractions.sort((a, b) => a.index - b.index);
          state.interactions = newInteractions; // Update using immer
        } else {
          console.warn(
            `InteractionStore: Interaction ${interaction.id} already exists in state.`,
          );
        }
      });
    },

    _updateInteractionInState: (id, updates) => {
      set((state) => {
        const index = state.interactions.findIndex((i) => i.id === id);
        if (index !== -1) {
          // Get the existing interaction
          const existingInteraction = state.interactions[index];

          // Merge updates into the existing interaction object
          // Use Object.assign for top-level properties
          Object.assign(existingInteraction, updates);

          // Explicitly handle metadata merge to avoid issues with undefined
          if (updates.metadata) {
            existingInteraction.metadata = {
              ...(existingInteraction.metadata || {}), // Ensure existing metadata is an object
              ...updates.metadata,
            };
          }
          // Ensure other potentially nested objects are handled if necessary
        } else {
          console.warn(
            `InteractionStore: Interaction ${id} not found for sync state update.`,
          );
        }
      });
    },

    // --- Modified Chunk Appending ---
    appendInteractionResponseChunk: (id, chunk) => {
      set((state) => {
        // Only update the buffer if the ID is actively streaming
        if (state.streamingInteractionIds.includes(id)) {
          state.activeStreamBuffers[id] =
            (state.activeStreamBuffers[id] || "") + chunk;
        } else {
          console.warn(
            `InteractionStore: Tried to append chunk to non-streaming interaction buffer ${id}.`,
          );
        }
      });
    },

    _removeInteractionFromState: (id) => {
      set((state) => {
        state.interactions = state.interactions.filter((i) => i.id !== id);
      });
    },

    // --- Async Actions ---
    // This action is now primarily called by AIService to add the single interaction object
    addInteractionAndPersist: async (
      // Expects the base data, index/parentId will be calculated
      interactionData: Omit<Interaction, "index" | "parentId">,
    ) => {
      const currentInteractions = get().interactions;
      // Calculate index based on ALL interactions, not just for the current conversation
      // This assumes indices are globally unique or reset appropriately elsewhere if needed.
      // A safer approach might be to filter by conversationId if indices are per-conversation.
      // Let's assume indices are per-conversation for now.
      const conversationInteractions = currentInteractions.filter(
        (i) => i.conversationId === interactionData.conversationId,
      );
      const newIndex =
        conversationInteractions.reduce(
          (max, i) => Math.max(max, i.index),
          -1,
        ) + 1;
      const parentId =
        conversationInteractions.length > 0
          ? conversationInteractions[conversationInteractions.length - 1].id
          : null;

      const newInteraction: Interaction = {
        ...interactionData,
        index: newIndex,
        parentId: parentId,
      };

      get()._addInteractionToState(newInteraction); // Add synchronously

      try {
        await PersistenceService.saveInteraction(newInteraction);
        return newInteraction;
      } catch (e) {
        console.error(
          "InteractionStore: Error persisting added interaction",
          e,
        );
        get()._removeInteractionFromState(newInteraction.id); // Revert state
        set({ error: "Failed to save interaction" });
        throw e;
      }
    },

    updateInteractionAndPersist: async (interaction) => {
      try {
        // Ensure the interaction object passed here has the final content
        await PersistenceService.saveInteraction({ ...interaction });
      } catch (e) {
        console.error(
          `InteractionStore: Error persisting final update for ${interaction.id}`,
          e,
        );
        set({ error: "Failed to save final interaction state" });
        throw e;
      }
    },

    deleteInteraction: async (id) => {
      const interactionToDelete = get().interactions.find((i) => i.id === id);
      if (!interactionToDelete) return;
      const interactionCopy = { ...interactionToDelete };

      get()._removeInteractionFromState(id);
      get()._removeStreamingId(id); // Call this to update streaming state & buffer

      try {
        await PersistenceService.deleteInteraction(id);
      } catch (e) {
        console.error("InteractionStore: Error deleting interaction", e);
        get()._addInteractionToState(interactionCopy);
        if (interactionCopy.status === "STREAMING") {
          get()._addStreamingId(id); // Re-add if revert needed
        }
        set({ error: "Failed to delete interaction" });
        throw e;
      }
    },

    // --- Other Actions ---
    setCurrentConversationId: (id) => {
      if (get().currentConversationId !== id) {
        console.log(
          `InteractionStore: Setting current conversation ID to ${id}`,
        );
        if (id) {
          get().loadInteractions(id); // This clears buffers via set()
        } else {
          get().clearInteractions(); // This clears buffers
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
        activeStreamBuffers: {}, // Clear buffer
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
          state.activeStreamBuffers[id] = ""; // Initialize buffer
          if (state.streamingInteractionIds.length === 1) {
            state.status = "streaming";
          }
          state.error = null; // Clear error when streaming starts
        }
      });
    },
    _removeStreamingId: (id) => {
      set((state) => {
        const index = state.streamingInteractionIds.indexOf(id);
        if (index !== -1) {
          state.streamingInteractionIds.splice(index, 1); // Remove ID

          // Delete the buffer entry for the stopped stream
          delete state.activeStreamBuffers[id];
          console.log(`InteractionStore: Cleaned up buffer for ${id}.`);

          // Update global status if no streams are left
          if (
            state.streamingInteractionIds.length === 0 &&
            state.status === "streaming"
          ) {
            state.status = state.error ? "error" : "idle";
          }
        }
        // DO NOT modify state.interactions[interactionIndex].response here.
        // AIService is responsible for setting the final response.
      });
    },
  })),
);
