// src/store/interaction.store.ts
// FULL FILE
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { Interaction } from "@/types/litechat/interaction";
import { PersistenceService } from "@/services/persistence.service";
import { emitter } from "@/lib/litechat/event-emitter";
import {
  interactionEvent,
  InteractionEventPayloads,
} from "@/types/litechat/events/interaction.events";
import { toast } from "sonner";
import type { RegisteredActionHandler } from "@/types/litechat/control";

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
  setActiveStreamBuffer: (id: string, content: string) => void;
  appendStreamBuffer: (id: string, chunk: string) => void;
  removeActiveStreamBuffer: (id: string) => void;
  getRegisteredActionHandlers: () => RegisteredActionHandler[];
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
        interactions: [],
        streamingInteractionIds: [],
        activeStreamBuffers: {},
        activeReasoningBuffers: {},
      });
      if (previousStatus !== "loading") {
        emitter.emit(interactionEvent.statusChanged, {
          status: "loading",
        });
      }

      try {
        const dbInteractions =
          await PersistenceService.loadInteractionsForConversation(
            conversationId
          );
        dbInteractions.sort((a, b) => a.index - b.index);

        // --- PATCH: Merge in-memory interactions not present in dbInteractions ---
        const inMemory = get().interactions.filter(
          (i) => i.conversationId === conversationId
        );
        const dbIds = new Set(dbInteractions.map((i) => i.id));
        const merged = [
          ...dbInteractions,
          ...inMemory.filter((i) => !dbIds.has(i.id)),
        ];
        merged.sort((a, b) => a.index - b.index);
        // --- END PATCH ---

        if (get().currentConversationId === conversationId) {
          set({ interactions: merged, status: "idle" });
          emitter.emit(interactionEvent.loaded, {
            conversationId,
            interactions: merged,
          });
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
          emitter.emit(interactionEvent.statusChanged, {
            status: "error",
          });
          emitter.emit(interactionEvent.errorChanged, {
            error: "Failed load interactions",
          });
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
      emitter.emit(interactionEvent.added, { interaction });
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
      emitter.emit(interactionEvent.updated, {
        interactionId: id,
        updates,
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
      emitter.emit(interactionEvent.activeStreamBuffersChanged, {
        buffers: get().activeStreamBuffers,
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
      emitter.emit(interactionEvent.activeReasoningBuffersChanged, {
        buffers: get().activeReasoningBuffers,
      });
    },

    setActiveStreamBuffer: (id, content) => {
      set((state) => {
        if (state.streamingInteractionIds.includes(id)) {
          state.activeStreamBuffers[id] = content;
        }
      });
      emitter.emit(interactionEvent.activeStreamBuffersChanged, {
        buffers: get().activeStreamBuffers,
      });
    },

    appendStreamBuffer: (id, chunk) => {
      set((state) => {
        if (state.streamingInteractionIds.includes(id)) {
          if (state.activeStreamBuffers[id] === undefined) {
            state.activeStreamBuffers[id] = chunk;
          } else {
            state.activeStreamBuffers[id] += chunk;
          }
        }
      });
      emitter.emit(interactionEvent.activeStreamBuffersChanged, {
        buffers: get().activeStreamBuffers,
      });
    },

    removeActiveStreamBuffer: (id) => {
      set((state) => {
        delete state.activeStreamBuffers[id];
      });
    },

    _removeInteractionFromState: (id) => {
      set((state) => {
        state.interactions = state.interactions.filter((i) => i.id !== id);
      });
      // No specific event for internal removal, covered by load/clear
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
        emitter.emit(interactionEvent.interactionRated, {
          interactionId,
          rating,
        });
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
        if (
          id &&
          get().interactions.length === 0 &&
          get().status !== "loading"
        ) {
          console.warn(
            `InteractionStore: Current ID ${id} matches, but no interactions. Forcing reload.`
          );
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
      set({ currentConversationId: id });
      emitter.emit(interactionEvent.currentConversationIdChanged, {
        conversationId: id,
      });

      if (id) {
        await get().loadInteractions(id);
      } else {
        get().clearInteractions();
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
      emitter.emit(interactionEvent.currentConversationIdChanged, {
        conversationId: null,
      });
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
        emitter.emit(interactionEvent.statusChanged, {
          status: newStatus,
        });
      }
      emitter.emit(interactionEvent.errorChanged, { error });
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
        emitter.emit(interactionEvent.statusChanged, {
          status: "streaming",
        });
      }
      emitter.emit(interactionEvent.streamingIdsChanged, {
        streamingIds: get().streamingInteractionIds,
      });
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
        emitter.emit(interactionEvent.statusChanged, {
          status: get().status,
        });
      }
      emitter.emit(interactionEvent.streamingIdsChanged, {
        streamingIds: get().streamingInteractionIds,
      });
    },

    getRegisteredActionHandlers: (): RegisteredActionHandler[] => {
      const storeId = "interactionStore";
      const actions = get();
      return [
        {
          eventName: interactionEvent.loadInteractionsRequest,
          handler: (
            p: InteractionEventPayloads[typeof interactionEvent.loadInteractionsRequest]
          ) => actions.loadInteractions(p.conversationId),
          storeId,
        },
        {
          eventName: interactionEvent.rateInteractionRequest,
          handler: (
            p: InteractionEventPayloads[typeof interactionEvent.rateInteractionRequest]
          ) => actions.rateInteraction(p.interactionId, p.rating),
          storeId,
        },
        {
          eventName: interactionEvent.setCurrentConversationIdRequest,
          handler: (
            p: InteractionEventPayloads[typeof interactionEvent.setCurrentConversationIdRequest]
          ) => actions.setCurrentConversationId(p.id),
          storeId,
        },
        {
          eventName: interactionEvent.clearInteractionsRequest,
          handler: () => actions.clearInteractions(),
          storeId,
        },
        {
          eventName: interactionEvent.setErrorRequest,
          handler: (
            p: InteractionEventPayloads[typeof interactionEvent.setErrorRequest]
          ) => actions.setError(p.error),
          storeId,
        },
        {
          eventName: interactionEvent.setStatusRequest,
          handler: (
            p: InteractionEventPayloads[typeof interactionEvent.setStatusRequest]
          ) => actions.setStatus(p.status),
          storeId,
        },
      ];
    },
  }))
);
