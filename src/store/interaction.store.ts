// src/store/interaction.store.ts
// FULL FILE
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { Interaction } from "@/types/litechat/interaction";
import { PersistenceService } from "@/services/persistence.service";
import { emitter } from "@/lib/litechat/event-emitter"; // Import emitter
import { ModEvent } from "@/types/litechat/modding"; // Import ModEvent

export interface InteractionState {
  interactions: Interaction[];
  currentConversationId: string | null;
  streamingInteractionIds: string[];
  activeStreamBuffers: Record<string, string>;
  error: string | null;
  status: "idle" | "loading" | "streaming" | "error";
}
interface InteractionActions {
  loadInteractions: (conversationId: string) => Promise<void>;
  // --- Synchronous State Updates ONLY ---
  _addInteractionToState: (interaction: Interaction) => void;
  _updateInteractionInState: (
    id: string,
    updates: Partial<Omit<Interaction, "id">>,
  ) => void;
  appendInteractionResponseChunk: (id: string, chunk: string) => void;
  _removeInteractionFromState: (id: string) => void;
  // --- Persistence Actions (Called by InteractionService) ---
  // Removed updateInteractionAndPersist - Persistence handled by service
  // Removed deleteInteraction - Persistence handled by service
  // --- Other Actions ---
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
        currentConversationId: conversationId,
      });
      if (previousStatus !== "loading") {
        emitter.emit(ModEvent.INTERACTION_STATUS_CHANGED, {
          status: "loading",
        });
      }
      try {
        const dbInteractions =
          await PersistenceService.loadInteractionsForConversation(
            conversationId,
          );
        dbInteractions.sort((a, b) => a.index - b.index);
        set({ interactions: dbInteractions, status: "idle" });
        emitter.emit(ModEvent.INTERACTION_STATUS_CHANGED, { status: "idle" });
      } catch (e) {
        console.error("InteractionStore: Error loading interactions", e);
        set({ error: "Failed load interactions", status: "error" });
        emitter.emit(ModEvent.INTERACTION_STATUS_CHANGED, { status: "error" });
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
            `InteractionStore: Interaction ${interaction.id} already exists. Updating instead.`,
          );
          const index = state.interactions.findIndex(
            (i) => i.id === interaction.id,
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
          // Create a new metadata object by merging
          let newMetadata = { ...(existingInteraction.metadata || {}) };
          if (updates.metadata) {
            newMetadata = { ...newMetadata, ...updates.metadata };
            // Ensure toolCalls and toolResults are copied if present in updates
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
          }

          // Create the updated interaction object
          const updatedInteraction = {
            ...existingInteraction,
            ...updates,
            metadata: newMetadata,
          };

          // Explicitly handle the 'response' field if it's in the updates
          if ("response" in updates) {
            updatedInteraction.response = updates.response;
          }

          // Update the interaction in the state array
          state.interactions[index] = updatedInteraction;
        } else {
          console.warn(
            `InteractionStore: Interaction ${id} not found for sync state update.`,
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

    _removeInteractionFromState: (id) => {
      set((state) => {
        state.interactions = state.interactions.filter((i) => i.id !== id);
      });
    },

    // --- Persistence Actions Removed ---
    // updateInteractionAndPersist removed
    // deleteInteraction removed

    // --- Other Actions ---
    setCurrentConversationId: async (id) => {
      if (get().currentConversationId !== id) {
        console.log(
          `InteractionStore: Setting current conversation ID to ${id}`,
        );
        if (id) {
          await get().loadInteractions(id);
        } else {
          get().clearInteractions();
        }
        // Note: CONTEXT_CHANGED event is emitted by ConversationStore.selectItem
      } else {
        console.log(
          `InteractionStore: Conversation ID ${id} is already current.`,
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
        status: "idle",
        error: null,
        currentConversationId: null,
      });
      if (previousStatus !== "idle") {
        emitter.emit(ModEvent.INTERACTION_STATUS_CHANGED, { status: "idle" });
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
          newStatus = state.status; // Keep current status if not error
        }
      });
      if (previousStatus !== newStatus) {
        emitter.emit(ModEvent.INTERACTION_STATUS_CHANGED, {
          status: newStatus,
        });
      }
    },
    setStatus: (status) => {
      if (get().status !== status) {
        set({ status });
        emitter.emit(ModEvent.INTERACTION_STATUS_CHANGED, { status });
      }
    },
    _addStreamingId: (id) => {
      let statusChanged = false;
      set((state) => {
        if (!state.streamingInteractionIds.includes(id)) {
          state.streamingInteractionIds.push(id);
          state.activeStreamBuffers[id] = "";
          if (state.streamingInteractionIds.length === 1) {
            state.status = "streaming";
            statusChanged = true;
          }
          state.error = null;
        }
      });
      if (statusChanged) {
        emitter.emit(ModEvent.INTERACTION_STATUS_CHANGED, {
          status: "streaming",
        });
      }
    },
    _removeStreamingId: (id) => {
      let statusChanged = false;
      set((state) => {
        const index = state.streamingInteractionIds.indexOf(id);
        if (index !== -1) {
          state.streamingInteractionIds.splice(index, 1);
          delete state.activeStreamBuffers[id];
          console.log(`InteractionStore: Cleaned up buffer for ${id}.`);
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
        emitter.emit(ModEvent.INTERACTION_STATUS_CHANGED, {
          status: get().status,
        });
      }
    },
  })),
);
