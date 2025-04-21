// src/store/input.store.ts
import { create } from "zustand";

export interface InputState {
  promptInputValue: string;
  attachedFiles: File[]; // Use File[] for easier state management than FileList
}

export interface InputActions {
  setPromptInputValue: (value: string) => void;
  setAttachedFiles: (files: File[]) => void;
  addAttachedFile: (file: File) => void;
  removeAttachedFile: (fileName: string) => void;
  clearPromptInput: () => void; // Clears both text and files
}

export const useInputStore = create<InputState & InputActions>()((set) => ({
  // Initial State
  promptInputValue: "",
  attachedFiles: [],

  // Actions
  setPromptInputValue: (promptInputValue) => set({ promptInputValue }),
  setAttachedFiles: (attachedFiles) => set({ attachedFiles }),
  addAttachedFile: (file) =>
    set((state) => ({
      // Avoid duplicates by name (simple check)
      attachedFiles: state.attachedFiles.some((f) => f.name === file.name)
        ? state.attachedFiles
        : [...state.attachedFiles, file],
    })),
  removeAttachedFile: (fileName) =>
    set((state) => ({
      attachedFiles: state.attachedFiles.filter((f) => f.name !== fileName),
    })),
  clearPromptInput: () => set({ promptInputValue: "", attachedFiles: [] }),
}));
