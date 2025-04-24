
import type { Message, SidebarItemType, MessageContent } from "@/lib/types";
import type { LiteChatModApi } from "./api";
import type { Tool, ToolImplementation } from "./tools";



export interface DbMod {
  id: string;
  name: string;
  sourceUrl: string | null;
  scriptContent: string | null;
  enabled: boolean;
  createdAt: Date;
  loadOrder: number;
}



export interface ModInstance {
  id: string;
  name: string;
  api: LiteChatModApi;
  error?: Error | string;
}



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

export interface ChatRenamedPayload {
  id: string;
  type: SidebarItemType;
  newName: string;
}
export interface ChatSystemPromptUpdatedPayload {
  id: string;
  systemPrompt: string | null;
}
export interface ChatVfsToggledPayload {
  id: string;
  type: SidebarItemType;
  enabled: boolean;
}






export interface MessageSubmittedPayload {
  message: Message;
}
export interface ResponseStartPayload {
  conversationId: string;
}
export interface ResponseChunkPayload {
  chunk: string;
  conversationId: string;
}
export interface ResponseDonePayload {
  message: Partial<Message>;
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
  error?: Error;
}


export interface ModEventPayloadMap {
  "app:loaded": undefined;
  "app:error": AppErrorPayload;
  "chat:selected": ChatSelectedPayload;
  "chat:created": ChatCreatedPayload;
  "chat:deleted": ChatDeletedPayload;
  "chat:renamed": ChatRenamedPayload;
  "chat:systemPromptUpdated": ChatSystemPromptUpdatedPayload;
  "chat:vfsToggled": ChatVfsToggledPayload;
  // "message:beforeSubmit": MessageBeforeSubmitPayload;
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
}




/** Payload for the SUBMIT_PROMPT middleware hook. */
export interface SubmitPromptPayload {
  /** The prompt content, which can be a string or an array of parts (text/image). */
  prompt: MessageContent;
  /** VFS paths included in the context for this submission. */
  vfsPaths: string[];
  /** The ID of the conversation the prompt belongs to. */
  conversationId: string;
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


export interface ModMiddlewarePayloadMap {
  "middleware:submitPrompt": SubmitPromptPayload;
  "middleware:processResponseChunk": ProcessResponseChunkPayload;
  "middleware:renderMessage": RenderMessagePayload;
  "middleware:vfsWrite": VfsWritePayload;
}


export interface ModMiddlewareReturnMap {
  "middleware:submitPrompt": SubmitPromptReturn;
  "middleware:processResponseChunk": ProcessResponseChunkReturn;
  "middleware:renderMessage": RenderMessageReturn;
  "middleware:vfsWrite": VfsWriteReturn;
}


export type { Tool, ToolImplementation };
