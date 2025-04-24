
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
  Tool,
  ToolImplementation,
} from "./types";




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


export const ModMiddlewareHook = {
  SUBMIT_PROMPT: "middleware:submitPrompt",
  PROCESS_RESPONSE_CHUNK: "middleware:processResponseChunk",
  RENDER_MESSAGE: "middleware:renderMessage",
  VFS_WRITE: "middleware:vfsWrite",
} as const;

export type ModMiddlewareHookName =
  (typeof ModMiddlewareHook)[keyof typeof ModMiddlewareHook];


export interface LiteChatModApi {
  // --- Registration ---
  /** Registers a button to be added to the prompt input area. Returns an unsubscribe function. */
  registerPromptAction: (action: CustomPromptAction) => () => void;
  /** Registers a button to be added to message bubbles. Returns an unsubscribe function. */
  registerMessageAction: (action: CustomMessageAction) => () => void;
  /** Registers a new tab in the main Settings modal. Returns an unsubscribe function. */
  registerSettingsTab: (tab: CustomSettingTab) => () => void;
  /**
   * Registers a tool that the AI can call.
   * @param toolName - The name the AI will use to call the tool.
   * @param toolDefinition - The definition of the tool (description, parameters).
   * @param implementation - Optional implementation function. If not provided here, it must be included in the toolDefinition.
   * @returns An unsubscribe function to remove the tool.
   */
  registerTool: <PARAMETERS extends import("zod").ZodSchema<any>>(
    toolName: string,
    toolDefinition: Tool<PARAMETERS>,
    implementation?: ToolImplementation<PARAMETERS>,
  ) => () => void;
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
    ) => ModMiddlewareReturnMap[H] | Promise<ModMiddlewareReturnMap[H]>,
  ) => () => void;
  /** Returns a read-only snapshot of the current chat state. */
  getContextSnapshot: () => ReadonlyChatContextSnapshot;
  /** Displays a toast notification. */
  showToast: (
    type: "success" | "error" | "info" | "warning",
    message: string,
  ) => void;
  /** Logs messages to the console, prefixed with the mod's name. */
  log: (level: "log" | "warn" | "error", ...args: any[]) => void;
  /** The unique ID of this mod instance. */
  readonly modId: string;
  /** The user-defined name of this mod. */
  readonly modName: string;
}
