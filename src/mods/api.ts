// src/mods/api.ts
import type {
  CustomPromptAction,
  CustomMessageAction,
  CustomSettingTab,
  ChatContextProps,
} from "@/lib/types";
import type {
  ModEventPayloadMap,
  ModMiddlewarePayloadMap,
  ModMiddlewareReturnMap,
} from "./types";
// Removed unused ModEventName import

// --- Readonly Context Snapshot ---
// Define a specific type for the read-only snapshot provided to mods
export type ReadonlyChatContextSnapshot = Readonly<
  Pick<
    ChatContextProps,
    | "selectedItemId"
    | "selectedItemType"
    | "messages"
    | "isStreaming"
    | "selectedProviderId"
    | "selectedModelId"
    | "activeSystemPrompt"
    | "temperature"
    | "maxTokens"
    | "theme"
    | "isVfsEnabledForItem"
    | "getApiKeyForProvider"
    // Add other safe properties as needed
  >
>;

// --- Middleware Hook Names ---
export const ModMiddlewareHook = {
  SUBMIT_PROMPT: "middleware:submitPrompt",
  PROCESS_RESPONSE_CHUNK: "middleware:processResponseChunk",
  RENDER_MESSAGE: "middleware:renderMessage",
  VFS_WRITE: "middleware:vfsWrite",
  // Add other hook names here...
} as const;

export type ModMiddlewareHookName =
  (typeof ModMiddlewareHook)[keyof typeof ModMiddlewareHook];

// --- Mod API Interface ---
export interface LiteChatModApi {
  // --- Registration ---
  /** Registers a button to be added to the prompt input area. Returns an unsubscribe function. */
  registerPromptAction: (action: CustomPromptAction) => () => void;
  /** Registers a button to be added to message bubbles. Returns an unsubscribe function. */
  registerMessageAction: (action: CustomMessageAction) => () => void;
  /** Registers a new tab in the main Settings modal. Returns an unsubscribe function. */
  registerSettingsTab: (tab: CustomSettingTab) => () => void;

  // --- Event Listening ---
  /**
   * Listens for specific events within LiteChat.
   * @param eventName The name of the event to listen for (e.g., ModEvent.CHAT_SELECTED).
   * @param callback The function to execute when the event occurs.
   * @returns An unsubscribe function to remove the listener.
   */
  on: <E extends keyof ModEventPayloadMap>( // Changed constraint
    eventName: E,
    callback: (payload: ModEventPayloadMap[E]) => void,
  ) => () => void;

  // --- Middleware ---
  /**
   * Adds a middleware function to intercept and potentially modify data or cancel actions.
   * Middleware functions are executed sequentially in the order they were registered.
   * @param hookName The name of the middleware hook point (e.g., ModMiddlewareHook.SUBMIT_PROMPT).
   * @param callback The middleware function. It receives the payload and should return the modified payload or `false` to cancel the action.
   * @returns An unsubscribe function to remove the middleware.
   */
  addMiddleware: <H extends ModMiddlewareHookName>(
    hookName: H,
    callback: (
      payload: ModMiddlewarePayloadMap[H],
    ) => ModMiddlewareReturnMap[H] | Promise<ModMiddlewareReturnMap[H]>, // Allow async middleware
  ) => () => void;

  // --- Context Access ---
  /** Returns a read-only snapshot of the current chat state. */
  getContextSnapshot: () => ReadonlyChatContextSnapshot;

  // --- Utilities ---
  /** Displays a toast notification. */
  showToast: (
    type: "success" | "error" | "info" | "warning",
    message: string,
  ) => void;
  /** Logs messages to the console, prefixed with the mod's name. */
  log: (level: "log" | "warn" | "error", ...args: any[]) => void;

  // --- Mod Info ---
  /** The unique ID of this mod instance. */
  readonly modId: string;
  /** The user-defined name of this mod. */
  readonly modName: string;
}
