// src/mods/events.ts
import mitt from "mitt";
import type { ModEventPayloadMap } from "./types"; // Import the payload map

// Define event names as constants (enum-like structure)
export const ModEvent = {
  APP_LOADED: "app:loaded",
  APP_ERROR: "app:error",
  CHAT_SELECTED: "chat:selected",
  CHAT_CREATED: "chat:created",
  CHAT_DELETED: "chat:deleted",
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
  // Add other event names here...
} as const; // Use 'as const' for stricter typing

// Infer the event name type from the ModEvent object keys
export type ModEventName = (typeof ModEvent)[keyof typeof ModEvent];

// Create a typed emitter using the event names and payload map
type EmitterEvents = {
  [K in ModEventName]: K extends keyof ModEventPayloadMap
    ? ModEventPayloadMap[K]
    : unknown; // Use 'unknown' for events without defined payloads
};

// Export a single instance of the typed emitter
export const modEvents = mitt<EmitterEvents>();
