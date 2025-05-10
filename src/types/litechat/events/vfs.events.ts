// src/types/litechat/events/vfs.events.ts
// NEW FILE
export const vfsEvent = {
  fileWritten: "vfs.fileWritten",
  fileRead: "vfs.fileRead",
  fileDeleted: "vfs.fileDeleted",
  contextChanged: "vfs.contextChanged",
} as const;
