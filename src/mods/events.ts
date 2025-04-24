
import mitt from "mitt";
import type { ModEventPayloadMap } from "./types";


export const ModEvent = {
  APP_LOADED: "app:loaded",
  APP_ERROR: "app:error",
  CHAT_SELECTED: "chat:selected",
  CHAT_CREATED: "chat:created",
  CHAT_DELETED: "chat:deleted",
  CHAT_RENAMED: "chat:renamed",
  CHAT_SYSTEM_PROMPT_UPDATED: "chat:systemPromptUpdated",
  CHAT_VFS_TOGGLED: "chat:vfsToggled",
  MESSAGE_BEFORE_SUBMIT: "message:beforeSubmit",
  MESSAGE_SUBMITTED: "message:submitted",
  RESPONSE_START: "response:start",
  RESPONSE_CHUNK: "response:chunk",
  RESPONSE_DONE: "response:done",
  VFS_FILE_WRITTEN: "vfs:fileWritten",
  VFS_FILE_READ: "vfs:fileRead",
  VFS_FILE_DELETED: "vfs:fileDeleted",
  VFS_CONTEXT_ADDED: "vfs:contextAdded",
  SETTINGS_OPENED: "settings:opened",
  SETTINGS_CLOSED: "settings:closed",
  MOD_LOADED: "mod:loaded",
  MOD_ERROR: "mod:error",
} as const;


export type ModEventName = (typeof ModEvent)[keyof typeof ModEvent];


type EmitterEvents = {
  [K in ModEventName]: K extends keyof ModEventPayloadMap
    ? ModEventPayloadMap[K]
    : unknown;
};


export const modEvents = mitt<EmitterEvents>();
