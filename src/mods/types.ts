// src/mods/types.ts
import type { Message, SidebarItemType, MessageContent } from "@/lib/types"; // Import MessageContent
import type { LiteChatModApi } from "./api";

// --- Database Schema for Mods ---
export interface DbMod {
  id: string;
  name: string;
  sourceUrl: string | null;
  scriptContent: string | null;
  enabled: boolean;
  createdAt: Date;
  loadOrder: number;
}

// --- Loaded Mod Instance ---
export interface ModInstance {
  id: string;
  name: string;
  api: LiteChatModApi; // The API instance provided to this mod
  error?: Error | string; // Error during loading/execution
}

// --- Event Payloads ---
// Define specific payload types for each event
export interface ChatSelectedPayload {
  id: string | null;
  type: SidebarItemType | null;
}
export interface ChatCreatedPayload {
  id: string;
  type: SidebarItemType;
  parentId: string | null;
}
export interface ChatDeletedPayload {
  id: string;
  type: SidebarItemType;
}
// This event seems deprecated or unused based on ChatSubmissionService logic
// export interface MessageBeforeSubmitPayload {
//   prompt: string;
//   attachedFiles: File[]; // Consider making ReadonlyArray<File>
//   vfsPaths: string[];
// }
export interface MessageSubmittedPayload {
  message: Message; // Use the Message type from lib/types
}
export interface ResponseStartPayload {
  conversationId: string;
}
export interface ResponseChunkPayload {
  chunk: string;
  conversationId: string;
}
export interface ResponseDonePayload {
  message: Message; // Use the Message type from lib/types
}
export interface VfsFileOpPayload {
  path: string;
}
export interface VfsContextAddedPayload {
  paths: string[];
}
export interface ModLoadedPayload {
  id: string;
  name: string;
}
export interface ModErrorPayload {
  id: string;
  name: string;
  error: Error | string;
}
export interface AppErrorPayload {
  message: string;
  error?: Error; // Optional original error object
}

// Map event names (string constants from ModEvent) to their payload types
export interface ModEventPayloadMap {
  "app:loaded": undefined;
  "app:error": AppErrorPayload;
  "chat:selected": ChatSelectedPayload;
  "chat:created": ChatCreatedPayload;
  "chat:deleted": ChatDeletedPayload;
  // "message:beforeSubmit": MessageBeforeSubmitPayload; // Removed as it seems unused
  "message:submitted": MessageSubmittedPayload;
  "response:start": ResponseStartPayload;
  "response:chunk": ResponseChunkPayload;
  "response:done": ResponseDonePayload;
  "vfs:fileWritten": VfsFileOpPayload;
  "vfs:fileRead": VfsFileOpPayload;
  "vfs:fileDeleted": VfsFileOpPayload;
  "vfs:contextAdded": VfsContextAddedPayload;
  "settings:opened": undefined;
  "settings:closed": undefined;
  "mod:loaded": ModLoadedPayload;
  "mod:error": ModErrorPayload;
  // Add other events here...
}

// --- Middleware Payloads & Returns ---
// Define specific payload and return types for each middleware hook

/** Payload for the SUBMIT_PROMPT middleware hook. */
export interface SubmitPromptPayload {
  /** The prompt content, which can be a string or an array of parts (text/image). */
  prompt: MessageContent;
  /** VFS paths included in the context for this submission. */
  vfsPaths: string[];
  /** The ID of the conversation the prompt belongs to. */
  conversationId: string;
  // Removed originalUserPrompt and attachedFiles as they are processed before this hook
}
/** Return type for the SUBMIT_PROMPT middleware hook. Can modify the payload or cancel submission. */
export type SubmitPromptReturn = SubmitPromptPayload | false;

export interface ProcessResponseChunkPayload {
  chunk: string;
  conversationId: string;
}
export type ProcessResponseChunkReturn = string | false;

export interface RenderMessagePayload {
  message: Message;
}
export type RenderMessageReturn = Message | false;

export interface VfsWritePayload {
  path: string;
  data: Uint8Array | string;
}
export type VfsWriteReturn = VfsWritePayload | false;

// Map middleware hook names (string constants from ModMiddlewareHook) to their payload types
export interface ModMiddlewarePayloadMap {
  "middleware:submitPrompt": SubmitPromptPayload;
  "middleware:processResponseChunk": ProcessResponseChunkPayload;
  "middleware:renderMessage": RenderMessagePayload;
  "middleware:vfsWrite": VfsWritePayload;
  // Add other middleware hooks here...
}

// Map middleware hook names to their return types
export interface ModMiddlewareReturnMap {
  "middleware:submitPrompt": SubmitPromptReturn;
  "middleware:processResponseChunk": ProcessResponseChunkReturn;
  "middleware:renderMessage": RenderMessageReturn;
  "middleware:vfsWrite": VfsWriteReturn;
  // Add other middleware hooks here...
}
