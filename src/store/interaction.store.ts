// src/store/interaction.store.ts
// FULL FILE
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { Interaction } from "@/types/litechat/interaction";
import { PersistenceService } from "@/services/persistence.service";
import { emitter } from "@/lib/litechat/event-emitter";
import { interactionEvent } from "@/types/litechat/events/interaction.events";
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
    interactions: [],
    currentConversationId: null,
    streamingInteractionIds: [],
    activeStreamBuffers: {},
    activeReasoningBuffers: {},
    error: null,
    status: "idle",

    loadInteractions: async (conversationId) => {
      // This function is now called by setCurrentConversationId AFTER currentConversationId is set.
      // It should only proceed if the conversationId matches the store's currentConversationId.
      if (get().currentConversationId !== conversationId) {
        console.warn(
          `InteractionStore: loadInteractions called for ${conversationId}, but current is ${
            get().currentConversationId
          }. Aborting load.`
        );
        return;
      }

      const previousStatus = get().status;
      set({
        status: "loading",
        error: null,
        interactions: [], // Clear interactions for the new conversation
        streamingInteractionIds: [],
        activeStreamBuffers: {},
        activeReasoningBuffers: {},
      });
      if (previousStatus !== "loading") {
        emitter.emit(interactionEvent.statusChanged, { status: "loading" });
      }

      try {
        const dbInteractions =
          await PersistenceService.loadInteractionsForConversation(
            conversationId
          );
        dbInteractions.sort((a, b) => a.index - b.index);

        // Double-check after await, in case currentConversationId changed again
        if (get().currentConversationId === conversationId) {
          set({ interactions: dbInteractions, status: "idle" });
          emitter.emit(interactionEvent.statusChanged, { status: "idle" });
        } else {
          console.warn(
            `InteractionStore: loadInteractions for ${conversationId} completed, but currentConversationId changed during fetch to ${
              get().currentConversationId
            }. Discarding.`
          );
        }
      } catch (e) {
        console.error(
          `InteractionStore: Error loading interactions for ${conversationId}`,
          e
        );
        if (get().currentConversationId === conversationId) {
          set({ error: "Failed load interactions", status: "error" });
          emitter.emit(interactionEvent.statusChanged, { status: "error" });
        }
      }
    },

    _addInteractionToState: (interaction) => {
      set((state) => {
        if (state.currentConversationId !== interaction.conversationId) {
          console.warn(
            `InteractionStore: Attempted to add interaction for ${interaction.conversationId} but current is ${state.currentConversationId}. Skipping.`
          );
          return;
        }
        if (!state.interactions.some((i) => i.id === interaction.id)) {
          state.interactions.push(interaction);
          state.interactions.sort((a, b) => a.index - b.index);
        } else {
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
          if (
            state.currentConversationId !==
            state.interactions[index].conversationId
          ) {
            console.warn(
              `InteractionStore: Attempted to update interaction ${id} which is not in the current conversation ${state.currentConversationId}. Skipping.`
            );
            return;
          }
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
        }
      });
    },

    appendInteractionResponseChunk: (id, chunk) => {
      set((state) => {
        if (
          state.streamingInteractionIds.includes(id) &&
          state.currentConversationId ===
            state.interactions.find((i) => i.id === id)?.conversationId
        ) {
          state.activeStreamBuffers[id] =
            (state.activeStreamBuffers[id] || "") + chunk;
        }
      });
    },

    appendReasoningChunk: (id, chunk) => {
      set((state) => {
        if (
          state.streamingInteractionIds.includes(id) &&
          state.currentConversationId ===
            state.interactions.find((i) => i.id === id)?.conversationId
        ) {
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

    rateInteraction: async (interactionId, rating) => {
      const interaction = get().interactions.find(
        (i) => i.id === interactionId
      );
      if (!interaction) return;
      if (get().currentConversationId !== interaction.conversationId) return;
      get()._updateInteractionInState(interactionId, { rating });
      try {
        await PersistenceService.saveInteraction({ ...interaction, rating });
      } catch (error) {
        get()._updateInteractionInState(interactionId, {
          rating: interaction.rating,
        });
        toast.error("Failed to save rating.");
      }
    },

    setCurrentConversationId: async (id) => {
      const currentIdInStore = get().currentConversationId;

      if (currentIdInStore === id) {
        // If it's the same ID, but interactions are empty and not loading, force a reload.
        // This handles cases where a previous load might have failed or been interrupted.
        if (
          id &&
          get().interactions.length === 0 &&
          get().status !== "loading"
        ) {
          console.warn(
            `InteractionStore: Current ID ${id} matches, but no interactions. Forcing reload.`
          );
          // No need to `set` currentConversationId again, just call load.
          await get().loadInteractions(id);
        } else {
          console.log(
            `InteractionStore: setCurrentConversationId called with the same ID (${id}). No change needed or already handled.`
          );
        }
        return;
      }

      console.log(
        `InteractionStore: Setting current conversation ID from ${currentIdInStore} to ${id}`
      );
      // Synchronously update the currentConversationId.
      // This ensures that any subsequent calls to loadInteractions or other actions
      // within this async function operate on the *new* ID.
      set({ currentConversationId: id });

      if (id) {
        // Now that currentConversationId is updated, load interactions for it.
        await get().loadInteractions(id);
      } else {
        // If the new ID is null, clear out everything.
        get().clearInteractions(); // clearInteractions also sets currentConversationId to null.
      }
    },

    clearInteractions: () => {
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
        emitter.emit(interactionEvent.statusChanged, { status: "idle" });
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
        emitter.emit(interactionEvent.statusChanged, { status: newStatus });
      }
    },

    setStatus: (status) => {
      if (get().status !== status) {
        set({ status });
        emitter.emit(interactionEvent.statusChanged, { status });
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
        emitter.emit(interactionEvent.statusChanged, { status: "streaming" });
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
        emitter.emit(interactionEvent.statusChanged, { status: get().status });
      }
    },
  }))
);
