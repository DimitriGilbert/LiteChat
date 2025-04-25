import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { Conversation } from '@/types/litechat/chat.types';
import { useInteractionStore } from './interaction.store';
import { PersistenceService } from '@/services/persistence.service';
import { nanoid } from 'nanoid';

interface ConversationState {
  conversations: Conversation[]; selectedConversationId: string | null;
  isLoading: boolean; error: string | null;
}
interface ConversationActions {
  loadConversations: () => Promise<void>;
  addConversation: (conversationData: Omit<Conversation, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateConversation: (id: string, updates: Partial<Conversation>) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  selectConversation: (id: string | null) => void;
}

export const useConversationStore = create(
  immer<ConversationState & ConversationActions>((set, get) => ({
    conversations: [], selectedConversationId: null, isLoading: false, error: null,
    loadConversations: async () => {
      set({ isLoading: true, error: null });
      try {
        const dbConvos = await PersistenceService.loadConversations();
        set({ conversations: dbConvos, isLoading: false });
      } catch (e) { set({ error: 'Failed load conversations', isLoading: false }); }
    },
    addConversation: async (conversationData) => {
      const newId = nanoid(); const now = new Date();
      const newConversation: Conversation = { id: newId, createdAt: now, updatedAt: now, ...conversationData };
      set((state) => { if (!state.conversations.some(c => c.id === newConversation.id)) state.conversations.push(newConversation); });
      await PersistenceService.saveConversation(newConversation);
      return newId;
    },
    updateConversation: async (id, updates) => {
      let updatedConversation: Conversation | null = null;
      set((state) => {
        const index = state.conversations.findIndex(c => c.id === id);
        if (index !== -1) { Object.assign(state.conversations[index], { ...updates, updatedAt: new Date() }); updatedConversation = state.conversations[index]; }
      });
      if (updatedConversation) await PersistenceService.saveConversation(updatedConversation);
    },
    deleteConversation: async (id) => {
      const currentSelectedId = get().selectedConversationId;
      set((state) => ({ conversations: state.conversations.filter(c => c.id !== id), selectedConversationId: currentSelectedId === id ? null : currentSelectedId }));
      await PersistenceService.deleteConversation(id);
      await PersistenceService.deleteInteractionsForConversation(id);
      if (currentSelectedId === id) useInteractionStore.getState().setCurrentConversationId(null);
    },
    selectConversation: (id) => {
      if (get().selectedConversationId !== id) { set({ selectedConversationId: id }); useInteractionStore.getState().setCurrentConversationId(id); }
    },
  }))
);
