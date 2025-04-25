import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

interface UIState {
  isChatControlPanelOpen: Record<string, boolean>; isPromptControlPanelOpen: Record<string, boolean>;
  globalLoading: boolean; globalError: string | null;
}
interface UIActions {
  toggleChatControlPanel: (panelId: string, isOpen?: boolean) => void;
  togglePromptControlPanel: (controlId: string, isOpen?: boolean) => void;
  setGlobalLoading: (loading: boolean) => void; setGlobalError: (error: string | null) => void;
}

export const useUIStateStore = create(
  immer<UIState & UIActions>((set) => ({
    isChatControlPanelOpen: {}, isPromptControlPanelOpen: {}, globalLoading: false, globalError: null,
    toggleChatControlPanel: (pId, o) => set((s) => { s.isChatControlPanelOpen[pId] = o ?? !s.isChatControlPanelOpen[pId]; }),
    togglePromptControlPanel: (cId, o) => set((s) => { s.isPromptControlPanelOpen[cId] = o ?? !s.isPromptControlPanelOpen[cId]; }),
    setGlobalLoading: (l) => set({ globalLoading: l }),
    setGlobalError: (e) => set({ globalError: e }),
  }))
);
