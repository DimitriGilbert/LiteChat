
import { create } from "zustand";

export interface InputState {
  promptInputValue: string;
  attachedFiles: File[];
  selectedVfsPaths: string[];
}

export interface InputActions {
  setPromptInputValue: (value: string) => void;
  setAttachedFiles: (files: File[]) => void;
  addAttachedFile: (file: File) => void;
  removeAttachedFile: (fileName: string) => void;
  clearAttachedFiles: () => void;
  // VFS Path Actions
  setSelectedVfsPaths: (paths: string[]) => void;
  addSelectedVfsPath: (path: string) => void;
  removeSelectedVfsPath: (path: string) => void;
  clearSelectedVfsPaths: () => void;
  // Combined Clear Action
  clearAllInput: () => void;
}

export const useInputStore = create<InputState & InputActions>()((set) => ({
  // Initial State
  promptInputValue: "",
  attachedFiles: [],
  selectedVfsPaths: [],

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
  clearAttachedFiles: () => set({ attachedFiles: [] }),

  // VFS Path Actions
  setSelectedVfsPaths: (selectedVfsPaths) => set({ selectedVfsPaths }),
  addSelectedVfsPath: (
    path,
  ) =>
    set((state) => ({
      selectedVfsPaths: state.selectedVfsPaths.includes(path)
        ? state.selectedVfsPaths
        : [...state.selectedVfsPaths, path].sort(),
    })),
  removeSelectedVfsPath: (
    path,
  ) =>
    set((state) => ({
      selectedVfsPaths: state.selectedVfsPaths.filter((p) => p !== path),
    })),
  clearSelectedVfsPaths: () => set({ selectedVfsPaths: [] }),

  // Combined Clear Action
  clearAllInput: () =>
    set({ promptInputValue: "", attachedFiles: [], selectedVfsPaths: [] }),
}));
