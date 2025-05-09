// src/store/interaction.store.ts
// FULL FILE
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { Interaction } from "@/types/litechat/interaction";
import { PersistenceService } from "@/services/persistence.service";
import { emitter } from "@/lib/litechat/event-emitter";
// Import new event constant
import { InteractionEvent } from "@/types/litechat/modding";
import { toast } from "sonner";

export interface InteractionState {
  interactions: Interaction[];
  currentConversationId: string | null;
  streamingInteractionIds: string[];
  activeStreamBuffers: Record<string, string>;
  activeReasoningBuffers: Record<string, string>;
  error: string | null;
  status: "idle" | "loading" | "streaming" | "error";
}
interface InteractionActions {
  loadInteractions: (conversationId: string) => Promise<void>;
  _addInteractionToState: (interaction: Interaction) => void;
  _updateInteractionInState: (
    id: string,
    updates: Partial<Omit<Interaction, "id">>
  ) => void;
  appendInteractionResponseChunk: (id: string, chunk: string) => void;
  appendReasoningChunk: (id: string, chunk: string) => void;
  _removeInteractionFromState: (id: string) => void;
  rateInteraction: (
    interactionId: string,
    rating: number | null
  ) => Promise<void>;
  setCurrentConversationId: (id: string | null) => Promise<void>;
  clearInteractions: () => void;
  setError: (error: string | null) => void;
  setStatus: (status: InteractionState["status"]) => void;
  _addStreamingId: (id: string) => void;
  _removeStreamingId: (id: string) => void;
}

export const useInteractionStore = create(
  immer<InteractionState & InteractionActions>((set, get) => ({
    // Initial State
    interactions: [],
    currentConversationId: null,
    streamingInteractionIds: [],
    activeStreamBuffers: {},
    activeReasoningBuffers: {},
    error: null,
    status: "idle",

    // --- Async Load ---
    loadInteractions: async (conversationId) => {
      if (!conversationId) {
        get().clearInteractions();
        return;
      }
      const previousStatus = get().status;
      set({
        status: "loading",
        error: null,
        interactions: [],
        streamingInteractionIds: [],
        activeStreamBuffers: {},
        activeReasoningBuffers: {},
        currentConversationId: conversationId,
      });
      if (previousStatus !== "loading") {
        // Use new event constant
        emitter.emit(InteractionEvent.STATUS_CHANGED, { status: "loading" });
      }
      try {
        const dbInteractions =
          await PersistenceService.loadInteractionsForConversation(
            conversationId
          );
        dbInteractions.sort((a, b) => a.index - b.index);
        set({ interactions: dbInteractions, status: "idle" });
        // Use new event constant
        emitter.emit(InteractionEvent.STATUS_CHANGED, { status: "idle" });
      } catch (e) {
        console.error("InteractionStore: Error loading interactions", e);
        set({ error: "Failed load interactions", status: "error" });
        // Use new event constant
        emitter.emit(InteractionEvent.STATUS_CHANGED, { status: "error" });
      }
    },

    // --- Synchronous State Updates ONLY ---
    _addInteractionToState: (interaction) => {
      set((state) => {
        if (!state.interactions.some((i) => i.id === interaction.id)) {
          state.interactions.push(interaction);
          state.interactions.sort((a, b) => a.index - b.index);
        } else {
          console.warn(
            `InteractionStore: Interaction ${interaction.id} already exists. Updating instead.`
          );
          const index = state.interactions.findIndex(
            (i) => i.id === interaction.id
          );
          if (index !== -1) {
            state.interactions[index] = {
              ...state.interactions[index],
              ...interaction,
            };
          }
        }
      });
    },

    _updateInteractionInState: (id, updates) => {
      set((state) => {
        const index = state.interactions.findIndex((i) => i.id === id);
        if (index !== -1) {
          const existingInteraction = state.interactions[index];
          let newMetadata = { ...(existingInteraction.metadata || {}) };
          if (updates.metadata) {
            newMetadata = { ...newMetadata, ...updates.metadata };
            if (
              updates.metadata.toolCalls !== undefined &&
              Array.isArray(updates.metadata.toolCalls)
            ) {
              newMetadata.toolCalls = [...updates.metadata.toolCalls];
            }
            if (
              updates.metadata.toolResults !== undefined &&
              Array.isArray(updates.metadata.toolResults)
            ) {
              newMetadata.toolResults = [...updates.metadata.toolResults];
            }
            if (updates.metadata.reasoning !== undefined) {
              newMetadata.reasoning = updates.metadata.reasoning;
            }
          }

          const updatedInteraction = {
            ...existingInteraction,
            ...updates,
            metadata: newMetadata,
          };

          if ("response" in updates) {
            updatedInteraction.response = updates.response;
          }
          if ("rating" in updates) {
            updatedInteraction.rating = updates.rating;
          }

          state.interactions[index] = updatedInteraction;
        } else {
          console.warn(
            `InteractionStore: Interaction ${id} not found for sync state update.`
          );
        }
      });
    },

    appendInteractionResponseChunk: (id, chunk) => {
      set((state) => {
        if (state.streamingInteractionIds.includes(id)) {
          state.activeStreamBuffers[id] =
            (state.activeStreamBuffers[id] || "") + chunk;
        }
      });
    },

    appendReasoningChunk: (id, chunk) => {
      set((state) => {
        if (state.streamingInteractionIds.includes(id)) {
          state.activeReasoningBuffers[id] =
            (state.activeReasoningBuffers[id] || "") + chunk;
        }
      });
    },

    _removeInteractionFromState: (id) => {
      set((state) => {
        state.interactions = state.interactions.filter((i) => i.id !== id);
      });
    },

    // --- Persistence Actions ---
    rateInteraction: async (interactionId, rating) => {
      const interaction = get().interactions.find(
        (i) => i.id === interactionId
      );
      if (!interaction) {
        console.error(
          `InteractionStore: Interaction ${interactionId} not found for rating.`
        );
        return;
      }
      get()._updateInteractionInState(interactionId, { rating });
      try {
        await PersistenceService.saveInteraction({ ...interaction, rating });
      } catch (error) {
        console.error(
          `InteractionStore: Failed to persist rating for ${interactionId}`,
          error
        );
        get()._updateInteractionInState(interactionId, {
          rating: interaction.rating,
        });
        toast.error("Failed to save rating.");
      }
    },

    // --- Other Actions ---
    setCurrentConversationId: async (id) => {
      if (get().currentConversationId !== id) {
        console.log(
          `InteractionStore: Setting current conversation ID to ${id}`
        );
        if (id) {
          await get().loadInteractions(id);
        } else {
          get().clearInteractions();
        }
      } else {
        console.log(
          `InteractionStore: Conversation ID ${id} is already current.`
        );
      }
    },
    clearInteractions: () => {
      console.log("InteractionStore: Clearing interactions.");
      const previousStatus = get().status;
      set({
        interactions: [],
        streamingInteractionIds: [],
        activeStreamBuffers: {},
        activeReasoningBuffers: {},
        status: "idle",
        error: null,
        currentConversationId: null,
      });
      if (previousStatus !== "idle") {
        // Use new event constant
        emitter.emit(InteractionEvent.STATUS_CHANGED, { status: "idle" });
      }
    },
    setError: (error) => {
      const previousStatus = get().status;
      let newStatus: InteractionState["status"] = "idle";
      set((state) => {
        state.error = error;
        if (error) {
          newStatus = "error";
          state.status = "error";
        } else if (state.status === "error") {
          newStatus =
            state.streamingInteractionIds.length > 0 ? "streaming" : "idle";
          state.status = newStatus;
        } else {
          newStatus = state.status;
        }
      });
      if (previousStatus !== newStatus) {
        // Use new event constant
        emitter.emit(InteractionEvent.STATUS_CHANGED, { status: newStatus });
      }
    },
    setStatus: (status) => {
      if (get().status !== status) {
        set({ status });
        // Use new event constant
        emitter.emit(InteractionEvent.STATUS_CHANGED, { status });
      }
    },
    _addStreamingId: (id) => {
      let statusChanged = false;
      set((state) => {
        if (!state.streamingInteractionIds.includes(id)) {
          state.streamingInteractionIds.push(id);
          state.activeStreamBuffers[id] = "";
          state.activeReasoningBuffers[id] = "";
          if (state.streamingInteractionIds.length === 1) {
            state.status = "streaming";
            statusChanged = true;
          }
          state.error = null;
        }
      });
      if (statusChanged) {
        // Use new event constant
        emitter.emit(InteractionEvent.STATUS_CHANGED, { status: "streaming" });
      }
    },
    _removeStreamingId: (id) => {
      let statusChanged = false;
      set((state) => {
        const index = state.streamingInteractionIds.indexOf(id);
        if (index !== -1) {
          state.streamingInteractionIds.splice(index, 1);
          delete state.activeStreamBuffers[id];
          delete state.activeReasoningBuffers[id];
          console.log(`InteractionStore: Cleaned up buffers for ${id}.`);
          if (
            state.streamingInteractionIds.length === 0 &&
            state.status === "streaming"
          ) {
            state.status = state.error ? "error" : "idle";
            statusChanged = true;
          }
        }
      });
      if (statusChanged) {
        // Use new event constant
        emitter.emit(InteractionEvent.STATUS_CHANGED, { status: get().status });
      }
    },
  }))
);
