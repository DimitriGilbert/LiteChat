import type React from 'react';
import type { z } from 'zod';
import type { PromptObject, PromptTurnObject, PromptControl } from './prompt';
import type { ChatControl } from './chat';
import type { Interaction } from './interaction';
import type { CoreMessage } from 'ai';

// --- Base Mod Types ---
export interface DbMod {
  id: string; name: string; sourceUrl: string | null; scriptContent: string | null;
  enabled: boolean; createdAt: Date; loadOrder: number;
}
export interface ModInstance {
  id: string; name: string; api: LiteChatModApi; error?: Error | string;
}

// --- Readonly Context Snapshot ---
export interface ReadonlyChatContextSnapshot {
  readonly selectedConversationId: string | null;
  readonly interactions: Readonly<Interaction[]>;
  readonly isStreaming: boolean;
  readonly selectedProviderId: string | null;
  readonly selectedModelId: string | null;
  readonly activeSystemPrompt: string | null;
  readonly temperature: number;
  readonly maxTokens: number | null;
  readonly theme: 'light' | 'dark' | 'system';
}

// --- Tooling ---
export interface Tool<P extends z.ZodSchema<any> = z.ZodSchema<any>> {
  description?: string; parameters: P;
  execute?: (args: z.infer<P>, context: ReadonlyChatContextSnapshot) => Promise<any>;
}
export type ToolImplementation<P extends z.ZodSchema<any> = z.ZodSchema<any>> = (
  args: z.infer<P>, context: ReadonlyChatContextSnapshot
) => Promise<any>;

// --- Events ---
export const ModEvent = {
  APP_LOADED: 'app:loaded', APP_ERROR: 'app:error',
  CONVERSATION_SELECTED: 'conversation:selected', CONVERSATION_CREATED: 'conversation:created',
  CONVERSATION_DELETED: 'conversation:deleted', CONVERSATION_RENAMED: 'conversation:renamed',
  INTERACTION_STARTED: 'interaction:started', INTERACTION_STREAM_CHUNK: 'interaction:stream_chunk',
  INTERACTION_COMPLETED: 'interaction:completed',
  PROMPT_SUBMITTED: 'prompt:submitted', // Before PromptWrapper middleware (uses PromptTurnObject)
  PROMPT_FINALISED: 'prompt:finalised', // After PromptWrapper middleware, before AIService call (uses PromptObject)
  SETTINGS_OPENED: 'settings:opened', SETTINGS_CLOSED: 'settings:closed',
  MOD_LOADED: 'mod:loaded', MOD_ERROR: 'mod:error',
} as const;
export type ModEventName = (typeof ModEvent)[keyof typeof ModEvent];
export interface ModEventPayloadMap {
  [ModEvent.APP_LOADED]: undefined; [ModEvent.APP_ERROR]: { message: string; error?: Error };
  [ModEvent.CONVERSATION_SELECTED]: { conversationId: string | null };
  [ModEvent.CONVERSATION_CREATED]: { conversationId: string };
  [ModEvent.CONVERSATION_DELETED]: { conversationId: string };
  [ModEvent.CONVERSATION_RENAMED]: { conversationId: string; newTitle: string };
  [ModEvent.INTERACTION_STARTED]: { interactionId: string; conversationId: string; type: Interaction['type'] };
  [ModEvent.INTERACTION_STREAM_CHUNK]: { interactionId: string; chunk: string };
  [ModEvent.INTERACTION_COMPLETED]: { interactionId: string; status: Interaction['status']; error?: string };
  [ModEvent.PROMPT_SUBMITTED]: { turnData: PromptTurnObject };
  [ModEvent.PROMPT_FINALISED]: { prompt: PromptObject };
  [ModEvent.SETTINGS_OPENED]: undefined; [ModEvent.SETTINGS_CLOSED]: undefined;
  [ModEvent.MOD_LOADED]: { id: string; name: string }; [ModEvent.MOD_ERROR]: { id: string; name: string; error: Error | string };
}

// --- Middleware ---
export const ModMiddlewareHook = {
  PROMPT_TURN_FINALIZE: 'middleware:prompt:turnFinalize', // Modify PromptTurnObject
  INTERACTION_BEFORE_START: 'middleware:interaction:beforeStart', // Modify final PromptObject (AI Payload)
  INTERACTION_PROCESS_CHUNK: 'middleware:interaction:processChunk',
  INTERACTION_BEFORE_RENDER: 'middleware:interaction:beforeRender',
} as const;
export type ModMiddlewareHookName = (typeof ModMiddlewareHook)[keyof typeof ModMiddlewareHook];
export interface ModMiddlewarePayloadMap {
  [ModMiddlewareHook.PROMPT_TURN_FINALIZE]: { turnData: PromptTurnObject };
  [ModMiddlewareHook.INTERACTION_BEFORE_START]: { prompt: PromptObject; conversationId: string };
  [ModMiddlewareHook.INTERACTION_PROCESS_CHUNK]: { interactionId: string; chunk: string };
  [ModMiddlewareHook.INTERACTION_BEFORE_RENDER]: { interaction: Interaction };
}
export interface ModMiddlewareReturnMap {
  [ModMiddlewareHook.PROMPT_TURN_FINALIZE]: { turnData: PromptTurnObject } | false;
  [ModMiddlewareHook.INTERACTION_BEFORE_START]: { prompt: PromptObject; conversationId: string } | false;
  [ModMiddlewareHook.INTERACTION_PROCESS_CHUNK]: { chunk: string } | false;
  [ModMiddlewareHook.INTERACTION_BEFORE_RENDER]: { interaction: Interaction } | false;
}

// --- Mod API ---
export interface LiteChatModApi {
  registerPromptControl: (control: PromptControl) => () => void;
  registerChatControl: (control: ChatControl) => () => void;
  registerTool: <P extends z.ZodSchema<any>>(toolName: string, definition: Tool<P>, implementation?: ToolImplementation<P>) => () => void;
  on: <E extends ModEventName>(eventName: E, callback: (payload: ModEventPayloadMap[E]) => void) => () => void;
  addMiddleware: <H extends ModMiddlewareHookName>(hookName: H, callback: (payload: ModMiddlewarePayloadMap[H]) => ModMiddlewareReturnMap[H] | Promise<ModMiddlewareReturnMap[H]>) => () => void;
  getContextSnapshot: () => ReadonlyChatContextSnapshot;
  showToast: (type: 'success' | 'error' | 'info' | 'warning', message: string) => void;
  log: (level: 'log' | 'warn' | 'error', ...args: any[]) => void;
  readonly modId: string; readonly modName: string;
}

// --- Mod Store Types ---
export interface ModState { dbMods: DbMod[]; loadedMods: ModInstance[]; isLoading: boolean; error: string | null; }
export interface ModActions {
  loadDbMods: () => Promise<void>;
  addDbMod: (modData: Omit<DbMod, 'id' | 'createdAt'>) => Promise<string>;
  updateDbMod: (id: string, changes: Partial<DbMod>) => Promise<void>;
  deleteDbMod: (id: string) => Promise<void>;
  setLoadedMods: (mods: ModInstance[]) => void;
}
