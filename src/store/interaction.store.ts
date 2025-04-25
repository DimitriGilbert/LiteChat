import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { Interaction, InteractionStatus } from '@/types/litechat/interaction.types';
import { PersistenceService } from '@/services/persistence.service';

interface InteractionState {
  interactions: Interaction[]; currentConversationId: string | null;
  streamingInteractionIds: string[]; error: string | null;
  status: 'idle' | 'loading' | 'streaming' | 'error';
}
interface InteractionActions {
  loadInteractions: (conversationId: string) => Promise<void>;
  addInteraction: (interactionData: Omit<Interaction, 'index'>) => Promise<void>;
  updateInteraction: (id: string, updates: Partial<Interaction>) => Promise<void>;
  appendInteractionResponseChunk: (id: string, chunk: string) => void;
  setInteractionStatus: (id: string, status: InteractionStatus, error?: string) => void;
  setCurrentConversationId: (id: string | null) => void;
  clearInteractions: () => void; setError: (error: string | null) => void;
  setStatus: (status: InteractionState['status']) => void;
  _addStreamingId: (id: string) => void; _removeStreamingId: (id: string) => void;
  deleteInteraction: (id: string) => Promise<void>;
}

export const useInteractionStore = create(
  immer<InteractionState & InteractionActions>((set, get) => ({
    interactions: [], currentConversationId: null, streamingInteractionIds: [], error: null, status: 'idle',
    loadInteractions: async (conversationId) => {
      set({ status: 'loading', error: null, interactions: [], streamingInteractionIds: [] });
      try {
        const dbInteractions = await PersistenceService.loadInteractionsForConversation(conversationId);
        set({ interactions: dbInteractions, status: 'idle' });
      } catch (e) { set({ error: 'Failed load interactions', status: 'error' }); }
    },
    addInteraction: async (interactionData) => {
      const newIndex = get().interactions.reduce((max, i) => Math.max(max, i.index), -1) + 1;
      const interaction: Interaction = { ...interactionData, index: newIndex };
      set((state) => {
        if (!state.interactions.some(i => i.id === interaction.id)) {
          state.interactions.push(interaction);
          state.interactions.sort((a, b) => a.index - b.index);
          if (interaction.status === 'STREAMING') state._addStreamingId(interaction.id);
        }
      });
      await PersistenceService.saveInteraction(interaction);
    },
    updateInteraction: async (id, updates) => {
      let updatedInteraction: Interaction | null = null;
      set((state) => {
        const index = state.interactions.findIndex(i => i.id === id);
        if (index !== -1) {
          const { index: _, ...restUpdates } = updates;
          Object.assign(state.interactions[index], restUpdates);
          updatedInteraction = state.interactions[index];
          if (updates.status === 'STREAMING') state._addStreamingId(id);
          else if (['COMPLETED', 'ERROR', 'CANCELLED'].includes(updates.status ?? '')) {
             state._removeStreamingId(id);
             if(updates.status === 'ERROR') state.error = updates.metadata?.error || 'Unknown error';
          }
        }
      });
      if (updatedInteraction) await PersistenceService.saveInteraction(updatedInteraction);
    },
    appendInteractionResponseChunk: (id, chunk) => {
       set((state) => {
         const interaction = state.interactions.find(i => i.id === id);
         if (interaction?.status === 'STREAMING') {
            if (typeof interaction.response === 'string' || interaction.response === null) {
               interaction.response = (interaction.response || '') + chunk;
            } else console.warn('Appending chunk to non-string response not implemented');
         }
       });
    },
    setInteractionStatus: (id, status, error) => {
       get().updateInteraction(id, { status, metadata: { ...get().interactions.find(i=>i.id===id)?.metadata, error } });
    },
    setCurrentConversationId: (id) => {
      if (get().currentConversationId !== id) {
        set({ currentConversationId: id });
        if (id) get().loadInteractions(id); else get().clearInteractions();
      }
    },
    clearInteractions: () => set({ interactions: [], streamingInteractionIds: [], status: 'idle', error: null }),
    setError: (error) => set({ error, status: error ? 'error' : get().status === 'error' ? 'idle' : get().status }),
    setStatus: (status) => set({ status }),
    _addStreamingId: (id) => set((state) => { if (!state.streamingInteractionIds.includes(id)) { state.streamingInteractionIds.push(id); state.status = 'streaming'; } }),
    _removeStreamingId: (id) => set((state) => {
       state.streamingInteractionIds = state.streamingInteractionIds.filter(sid => sid !== id);
       if (state.streamingInteractionIds.length === 0) state.status = state.error ? 'error' : 'idle';
    }),
    deleteInteraction: async (id) => {
       set((state) => ({ interactions: state.interactions.filter(i => i.id !== id) }));
       await PersistenceService.deleteInteraction(id);
    },
  }))
);
