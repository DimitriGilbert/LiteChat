// src/store/input.store.ts
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

// Define a unified structure for attached file metadata
export interface AttachedFileMetadata {
  id: string; // Unique ID for this attachment instance
  source: "direct" | "vfs";
  name: string;
  type: string; // MIME type
  size: number;
  // Store content directly in metadata
  contentText?: string; // For text files
  contentBase64?: string; // For non-text files
  // VFS path is only needed for VFS source
  path?: string;
}

export interface InputState {
  // Store metadata about files attached for the *next* submission
  attachedFilesMetadata: AttachedFileMetadata[];
}

export interface InputActions {
  // Add file (either direct upload or VFS selection)
  addAttachedFile: (fileData: Omit<AttachedFileMetadata, "id">) => void;
  // Remove file by its unique attachment ID
  removeAttachedFile: (attachmentId: string) => void;
  // Clear all attachments for the next prompt
  clearAttachedFiles: () => void;
}

export const useInputStore = create(
  immer<InputState & InputActions>((set) => ({
    // Initial State
    attachedFilesMetadata: [],

    // Actions
    addAttachedFile: (fileData) => {
      set((state) => {
        // Check for duplicates based on source and name/path
        const isDuplicate = state.attachedFilesMetadata.some((f) =>
          f.source === "direct" && fileData.source === "direct"
            ? f.name === fileData.name
            : f.source === "vfs" && fileData.source === "vfs"
              ? f.path === fileData.path
              : false,
        );

        if (!isDuplicate) {
          const newAttachment: AttachedFileMetadata = {
            id: crypto.randomUUID(),
            ...fileData,
          };
          state.attachedFilesMetadata.push(newAttachment);
        } else {
          console.warn(
            `InputStore: File "${fileData.name}" (source: ${fileData.source}) already attached. Skipping.`,
          );
        }
      });
    },
    removeAttachedFile: (attachmentId) => {
      set((state) => {
        state.attachedFilesMetadata = state.attachedFilesMetadata.filter(
          (f) => f.id !== attachmentId,
        );
      });
    },
    clearAttachedFiles: () => {
      set({ attachedFilesMetadata: [] });
    },
  })),
);
