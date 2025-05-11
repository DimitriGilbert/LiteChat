// src/store/input.store.ts
// FULL FILE
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { nanoid } from "nanoid";
import { emitter } from "@/lib/litechat/event-emitter";
import { inputStoreEvent } from "@/types/litechat/events/input.events";

// Define a unified structure for attached file metadata
export interface AttachedFileMetadata {
  id: string;
  source: "direct" | "vfs";
  name: string;
  type: string;
  size: number;
  // Store content directly in metadata
  contentText?: string;
  contentBase64?: string;
  // VFS path is only needed for VFS source
  path?: string;
}

export interface InputState {
  // Store metadata about files attached for the *next* submission
  attachedFilesMetadata: AttachedFileMetadata[];
  // Other transient states (tools, overrides) are managed locally by controls
}

export interface InputActions {
  // Add file (either direct upload or VFS selection)
  addAttachedFile: (fileData: Omit<AttachedFileMetadata, "id">) => void;
  // Remove file by its unique attachment ID
  removeAttachedFile: (attachmentId: string) => void;
  // Clear only attached files for the next prompt
  clearAttachedFiles: () => void;
}

export const useInputStore = create(
  immer<InputState & InputActions>((set, get) => ({
    // Initial State
    attachedFilesMetadata: [],

    // Actions
    addAttachedFile: (fileData) => {
      let added = false;
      set((state) => {
        // Check for duplicates based on source and name/path/size
        const isDuplicate = state.attachedFilesMetadata.some((f) =>
          f.source === "direct" && fileData.source === "direct"
            ? f.name === fileData.name && f.size === fileData.size
            : f.source === "vfs" && fileData.source === "vfs"
            ? f.path === fileData.path
            : false
        );

        if (!isDuplicate) {
          const newAttachment: AttachedFileMetadata = {
            id: nanoid(),
            ...fileData,
          };
          state.attachedFilesMetadata.push(newAttachment);
          added = true;
        } else {
          console.warn(
            `InputStore: File "${fileData.name}" (source: ${fileData.source}) already attached. Skipping.`
          );
        }
      });
      if (added) {
        emitter.emit(inputStoreEvent.attachedFilesChanged, {
          files: get().attachedFilesMetadata,
        });
      }
    },
    removeAttachedFile: (attachmentId) => {
      let removed = false;
      set((state) => {
        const initialLength = state.attachedFilesMetadata.length;
        state.attachedFilesMetadata = state.attachedFilesMetadata.filter(
          (f) => f.id !== attachmentId
        );
        removed = state.attachedFilesMetadata.length < initialLength;
      });
      if (removed) {
        emitter.emit(inputStoreEvent.attachedFilesChanged, {
          files: get().attachedFilesMetadata,
        });
      }
    },
    clearAttachedFiles: () => {
      const hadFiles = get().attachedFilesMetadata.length > 0;
      // Clear only attached files
      set({ attachedFilesMetadata: [] });
      if (hadFiles) {
        emitter.emit(inputStoreEvent.attachedFilesChanged, { files: [] });
      }
    },
  }))
);
