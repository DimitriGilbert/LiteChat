// src/store/interaction.store.ts
import { create } from "zustand";
import type { Interaction } from "@/types/litechat/interaction";
import { PersistenceService } from "@/services/persistence.service";

interface InteractionState {
  interactions: Interaction[];
  currentConversationId: string | null;
  streamingInteractionIds: string[];
  error: string | null;
  status: "idle" | "loading" | "streaming" | "error";
}
interface InteractionActions {
  loadInteractions: (conversationId: string) => Promise<void>;
  // --- Synchronous State Updates ONLY ---
  _addInteractionToState: (interaction: Interaction) => void;
  _updateInteractionInState: (
    id: string,
    updates: Partial<Omit<Interaction, "id" | "index">>,
  ) => void; // Renamed for clarity, still sync state update
  appendInteractionResponseChunk: (id: string, chunk: string) => void;
  _removeInteractionFromState: (id: string) => void;
  // --- Async Actions (Involving Persistence) ---
  addInteractionAndPersist: (
    // Renamed for clarity
    interactionData: Omit<Interaction, "index">,
  ) => Promise<Interaction>;
  updateInteractionAndPersist: (interaction: Interaction) => Promise<void>;
  deleteInteraction: (id: string) => Promise<void>;
  // --- Other Actions ---
  setCurrentConversationId: (id: string | null) => void;
  clearInteractions: () => void;
  setError: (error: string | null) => void;
  setStatus: (status: InteractionState["status"]) => void;
  _addStreamingId: (id: string) => void;
  _removeStreamingId: (id: string) => void;
}

export const useInteractionStore = create<
  InteractionState & InteractionActions
>((set, get) => ({
  // Initial State
  interactions: [],
  currentConversationId: null,
  streamingInteractionIds: [],
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
        return { interactions: newInteractions };
      }
      console.warn(
        `InteractionStore: Interaction ${interaction.id} already exists in state.`,
      );
      return {}; // No change
    });
  },

  _updateInteractionInState: (id, updates) => {
    set((state) => {
      const index = state.interactions.findIndex((i) => i.id === id);
      if (index !== -1) {
        const updatedInteraction = {
          ...state.interactions[index],
          ...updates,
          // Ensure metadata is merged correctly
          ...(updates.metadata && {
            metadata: {
              ...state.interactions[index].metadata,
              ...updates.metadata,
            },
          }),
        };
        const newInteractions = [...state.interactions];
        newInteractions[index] = updatedInteraction;
        return { interactions: newInteractions };
      } else {
        // Log clearly if not found during update attempt
        console.warn(
          `InteractionStore: Interaction ${id} not found for sync state update.`,
        );
        return {}; // No state change if not found
      }
    });
  },

  appendInteractionResponseChunk: (id, chunk) => {
    set((state) => {
      const index = state.interactions.findIndex(
        (i) => i.id === id && i.status === "STREAMING",
      );
      if (index !== -1) {
        const interaction = state.interactions[index];
        const updatedInteraction = {
          ...interaction,
          response: String(interaction.response ?? "") + chunk,
        };
        const newInteractions = [...state.interactions];
        newInteractions[index] = updatedInteraction;
        return { interactions: newInteractions };
      } else {
        // Don't warn if simply not streaming, only if interaction exists but isn't streaming
        const interactionExists = state.interactions.find((i) => i.id === id);
        if (interactionExists) {
          console.warn(
            `InteractionStore: Tried to append chunk to non-streaming interaction ${id} (Status: ${interactionExists.status})`,
          );
        } else {
          // This might happen if the update arrives before the add state is fully processed
          console.warn(
            `InteractionStore: Interaction ${id} not found for appending chunk.`,
          );
        }
        return {}; // No change
      }
    });
  },

  _removeInteractionFromState: (id) => {
    set((state) => ({
      interactions: state.interactions.filter((i) => i.id !== id),
    }));
  },

  // --- Async Actions ---
  addInteractionAndPersist: async (interactionData) => {
    const currentInteractions = get().interactions;
    const newIndex =
      currentInteractions.reduce((max, i) => Math.max(max, i.index), -1) + 1;
    const parentId =
      currentInteractions.length > 0
        ? currentInteractions[currentInteractions.length - 1].id
        : null;

    const newInteraction: Interaction = {
      ...interactionData,
      index: newIndex,
      parentId: parentId,
    };

    // Add to state first
    get()._addInteractionToState(newInteraction);

    // Then persist
    try {
      await PersistenceService.saveInteraction(newInteraction);
      return newInteraction;
    } catch (e) {
      console.error("InteractionStore: Error persisting added interaction", e);
      get()._removeInteractionFromState(newInteraction.id); // Revert state add
      set({ error: "Failed to save interaction" });
      throw e;
    }
  },

  updateInteractionAndPersist: async (interaction) => {
    // State should have been updated synchronously before calling this
    try {
      await PersistenceService.saveInteraction({ ...interaction });
    } catch (e) {
      console.error(
        `InteractionStore: Error persisting final update for ${interaction.id}`,
        e,
      );
      set({ error: "Failed to save final interaction state" });
      // Consider how to handle UI/state if final save fails (e.g., show error on the interaction card)
      throw e;
    }
  },

  deleteInteraction: async (id) => {
    const interactionToDelete = get().interactions.find((i) => i.id === id);
    if (!interactionToDelete) return;
    const interactionCopy = { ...interactionToDelete };

    get()._removeInteractionFromState(id);
    get()._removeStreamingId(id);

    try {
      await PersistenceService.deleteInteraction(id);
    } catch (e) {
      console.error("InteractionStore: Error deleting interaction", e);
      get()._addInteractionToState(interactionCopy); // Revert state
      if (interactionCopy.status === "STREAMING") {
        get()._addStreamingId(id);
      }
      set({ error: "Failed to delete interaction" });
      throw e;
    }
  },

  // --- Other Actions ---
  setCurrentConversationId: (id) => {
    if (get().currentConversationId !== id) {
      console.log(`InteractionStore: Setting current conversation ID to ${id}`);
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
      const newState: Partial<InteractionState> = { error };
      if (error) {
        newState.status = "error";
      } else if (state.status === "error") {
        newState.status =
          state.streamingInteractionIds.length > 0 ? "streaming" : "idle";
      }
      return newState;
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
        const newStreamingIds = [...state.streamingInteractionIds, id];
        let newStatus = state.status;
        if (newStreamingIds.length === 1) {
          newStatus = "streaming";
        }
        return {
          streamingInteractionIds: newStreamingIds,
          status: newStatus,
          error: null,
        };
      }
      return {};
    });
  },
  _removeStreamingId: (id) => {
    set((state) => {
      if (state.streamingInteractionIds.includes(id)) {
        const newStreamingIds = state.streamingInteractionIds.filter(
          (sid) => sid !== id,
        );
        let newStatus = state.status;
        if (newStreamingIds.length === 0 && state.status === "streaming") {
          newStatus = state.error ? "error" : "idle";
        }
        return { streamingInteractionIds: newStreamingIds, status: newStatus };
      }
      return {};
    });
  },
}));
