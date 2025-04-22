// src/store/input.store.ts
import { create } from "zustand";

export interface InputState {
  promptInputValue: string;
  attachedFiles: File[];
  selectedVfsPaths: string[]; // Added
}

export interface InputActions {
  setPromptInputValue: (value: string) => void;
  setAttachedFiles: (files: File[]) => void;
  addAttachedFile: (file: File) => void;
  removeAttachedFile: (fileName: string) => void;
  clearAttachedFiles: () => void; // Added
  // VFS Path Actions
  setSelectedVfsPaths: (paths: string[]) => void; // Added
  addSelectedVfsPath: (path: string) => void; // Added
  removeSelectedVfsPath: (path: string) => void; // Added
  clearSelectedVfsPaths: () => void; // Added
  // Combined Clear Action
  clearAllInput: () => void; // Renamed from clearPromptInput
}

export const useInputStore = create<InputState & InputActions>()((set) => ({
  // Initial State
  promptInputValue: "",
  attachedFiles: [],
  selectedVfsPaths: [], // Added

  // Actions
  setPromptInputValue: (promptInputValue) => set({ promptInputValue }),
  setAttachedFiles: (attachedFiles) => set({ attachedFiles }),
  addAttachedFile: (file) =>
    set((state) => ({
      attachedFiles: state.attachedFiles.some((f) => f.name === file.name)
        ? state.attachedFiles
        : [...state.attachedFiles, file],
    })),
  removeAttachedFile: (fileName) =>
    set((state) => ({
      attachedFiles: state.attachedFiles.filter((f) => f.name !== fileName),
    })),
  clearAttachedFiles: () => set({ attachedFiles: [] }), // Added specific clear action

  // VFS Path Actions
  setSelectedVfsPaths: (selectedVfsPaths) => set({ selectedVfsPaths }), // Added
  addSelectedVfsPath: (
    path, // Added
  ) =>
    set((state) => ({
      selectedVfsPaths: state.selectedVfsPaths.includes(path)
        ? state.selectedVfsPaths
        : [...state.selectedVfsPaths, path].sort(),
    })),
  removeSelectedVfsPath: (
    path, // Added
  ) =>
    set((state) => ({
      selectedVfsPaths: state.selectedVfsPaths.filter((p) => p !== path),
    })),
  clearSelectedVfsPaths: () => set({ selectedVfsPaths: [] }), // Added

  // Combined Clear Action
  clearAllInput: () =>
    set({ promptInputValue: "", attachedFiles: [], selectedVfsPaths: [] }),
}));
