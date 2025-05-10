// src/types/litechat/middleware.types.ts
// NEW FILE
import type { PromptObject, PromptTurnObject } from "./prompt";

/** Defines the names of available middleware hooks */
export enum ModMiddlewareHook {
  PROMPT_TURN_FINALIZE = "middleware.prompt.turnFinalize",
  INTERACTION_BEFORE_START = "middleware.interaction.beforeStart",
  INTERACTION_PROCESS_CHUNK = "middleware.interaction.processChunk",
}

/** Maps middleware hook names to their expected payload types */
export interface ModMiddlewarePayloadMap {
  [ModMiddlewareHook.PROMPT_TURN_FINALIZE]: { turnData: PromptTurnObject };
  [ModMiddlewareHook.INTERACTION_BEFORE_START]: {
    prompt: PromptObject;
    conversationId: string;
  };
  [ModMiddlewareHook.INTERACTION_PROCESS_CHUNK]: {
    interactionId: string;
    chunk: string;
  };
}

/** Maps middleware hook names to their expected return types */
export interface ModMiddlewareReturnMap {
  [ModMiddlewareHook.PROMPT_TURN_FINALIZE]:
    | { turnData: PromptTurnObject }
    | false;
  [ModMiddlewareHook.INTERACTION_BEFORE_START]:
    | { prompt: PromptObject }
    | false;
  [ModMiddlewareHook.INTERACTION_PROCESS_CHUNK]: { chunk: string } | false;
}

export type ModMiddlewareHookName = ModMiddlewareHook;
