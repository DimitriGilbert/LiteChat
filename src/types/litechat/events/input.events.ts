// src/types/litechat/events/input.events.ts
// FULL FILE
import type { AttachedFileMetadata } from "@/store/input.store";

export const inputEvent = {
  // State Change Events
  attachedFilesChanged: "input.attached.files.changed",

  // Action Request Events
  addAttachedFileRequest: "input.add.attached.file.request",
  removeAttachedFileRequest: "input.remove.attached.file.request",
  clearAttachedFilesRequest: "input.clear.attached.files.request",
} as const;

export interface InputEventPayloads {
  [inputEvent.attachedFilesChanged]: { files: AttachedFileMetadata[] };
  [inputEvent.addAttachedFileRequest]: Omit<AttachedFileMetadata, "id">;
  [inputEvent.removeAttachedFileRequest]: { attachmentId: string };
  [inputEvent.clearAttachedFilesRequest]: undefined;
}
