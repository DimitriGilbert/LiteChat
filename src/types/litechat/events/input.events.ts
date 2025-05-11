// src/types/litechat/events/stores/input.events.ts
// NEW FILE
export const inputStoreEvent = {
  // State Change Events
  attachedFilesChanged: "stores.input.attached.files.changed",

  // Action Request Events
  addAttachedFileRequest: "stores.input.add.attached.file.request",
  removeAttachedFileRequest: "stores.input.remove.attached.file.request",
  clearAttachedFilesRequest: "stores.input.clear.attached.files.request",
} as const;
