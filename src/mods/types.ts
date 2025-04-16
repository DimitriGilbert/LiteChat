// src/mods/types.ts
import type { Message, SidebarItemType } from "@/lib/types";
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
export interface MessageBeforeSubmitPayload {
  prompt: string;
  attachedFiles: File[]; // Consider making ReadonlyArray<File>
  vfsPaths: string[];
}
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
  "message:beforeSubmit": MessageBeforeSubmitPayload;
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
export interface SubmitPromptPayload {
  prompt: string;
  originalUserPrompt: string;
  attachedFiles: File[]; // Consider ReadonlyArray<File>
  vfsPaths: string[];
  conversationId: string;
}
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
