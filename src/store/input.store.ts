// src/store/input.store.ts
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { VfsFileObject } from "@/types/litechat/vfs"; // Import the new type

export interface InputState {
  promptInputValue: string;
  attachedFiles: File[]; // Files attached for the *next* submission
  selectedVfsFiles: VfsFileObject[]; // Renamed from selectedVfsPaths for clarity
}

export interface InputActions {
  setPromptInputValue: (value: string) => void;
  // Attached File Actions
  addAttachedFile: (file: File) => void;
  removeAttachedFile: (fileName: string) => void;
  clearAttachedFiles: () => void;
  // VFS File Actions (Renamed)
  setSelectedFiles: (files: VfsFileObject[]) => void; // New action
  clearSelectedFiles: () => void; // Renamed
  // Combined Clear Action
  clearAllInput: () => void;
}

export const useInputStore = create(
  immer<InputState & InputActions>((set) => ({
    // Initial State
    promptInputValue: "",
    attachedFiles: [],
    selectedVfsFiles: [], // Renamed

    // Actions
    setPromptInputValue: (value) => {
      set({ promptInputValue: value });
    },

    // Attached File Actions
    addAttachedFile: (file) => {
      set((state) => {
        // Prevent adding duplicates by name
        if (!state.attachedFiles.some((f) => f.name === file.name)) {
          state.attachedFiles.push(file);
        } else {
          console.warn(
            `InputStore: File "${file.name}" already attached. Skipping.`,
          );
        }
      });
    },
    removeAttachedFile: (fileName) => {
      set((state) => {
        state.attachedFiles = state.attachedFiles.filter(
          (f) => f.name !== fileName,
        );
      });
    },
    clearAttachedFiles: () => {
      set({ attachedFiles: [] });
    },

    // VFS File Actions (Renamed/Added)
    setSelectedFiles: (files) => {
      set({ selectedVfsFiles: files });
    },
    clearSelectedFiles: () => {
      set({ selectedVfsFiles: [] });
    },

    // Combined Clear Action (used after successful submission)
    clearAllInput: () => {
      set({
        promptInputValue: "",
        attachedFiles: [],
        selectedVfsFiles: [], // Renamed
      });
    },
  })),
);
