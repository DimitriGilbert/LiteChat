// src/context/chat-middleware.tsx
import { useCallback, useRef } from "react"; // Removed useState import
import { toast } from "sonner";
import type { z } from "zod";
import type {
  DbMod,
  ModInstance,
  ModMiddlewarePayloadMap,
  ModMiddlewareReturnMap,
  Tool,
  ToolImplementation,
  ModEventPayloadMap, // Import ModEventPayloadMap
} from "@/mods/types";
import { loadMods } from "@/mods/loader";
import { modEvents } from "@/mods/events";
import { ModEvent } from "@/mods/events";
import type {
  LiteChatModApi,
  ModMiddlewareHookName,
  ReadonlyChatContextSnapshot,
} from "@/mods/api";
import type {
  CustomPromptAction,
  CustomMessageAction,
  CustomSettingTab,
} from "@/lib/types";
import { useModContext } from "./mod-context";

// Define the type for the registration callbacks object
// Ensure this matches the definition in src/mods/loader.ts
interface RegistrationCallbacks {
  registerPromptAction: (action: CustomPromptAction) => () => void;
  registerMessageAction: (action: CustomMessageAction) => () => void;
  registerSettingsTab: (tab: CustomSettingTab) => () => void;
  registerTool: <PARAMETERS extends z.ZodSchema<any>>(
    toolName: string,
    definition: Tool<PARAMETERS>,
    implementation?: ToolImplementation<PARAMETERS>,
  ) => () => void;
  registerEventListener: <E extends keyof ModEventPayloadMap>( // Use imported ModEventPayloadMap
    eventName: E,
    callback: (payload: ModEventPayloadMap[E]) => void, // Use imported ModEventPayloadMap
  ) => () => void;
  // Update signature to include modId
  registerMiddleware: <H extends ModMiddlewareHookName>(
    hookName: H,
    callback: MiddlewareCallback<H>, // Callback type remains the same
    modId: string, // Add modId parameter
  ) => () => void;
}

type MiddlewareCallback<H extends ModMiddlewareHookName> = (
  payload: ModMiddlewarePayloadMap[H],
) => ModMiddlewareReturnMap[H] | Promise<ModMiddlewareReturnMap[H]>;

type MiddlewareRegistry = {
  [H in ModMiddlewareHookName]?: Array<{
    modId: string;
    callback: MiddlewareCallback<H>;
  }>;
};

export function useChatMiddleware(setError: (error: string | null) => void) {
  const modContext = useModContext();
  const middlewareRegistry = useRef<MiddlewareRegistry>({});
  const eventListeners = useRef<Map<string, Set<(...args: any[]) => void>>>(
    new Map(),
  );
  const modApiInstances = useRef<Map<string, LiteChatModApi>>(new Map());

  const registerEventListener = useCallback(
    <E extends keyof ModEventPayloadMap>( // Use imported ModEventPayloadMap
      eventName: E,
      callback: (payload: ModEventPayloadMap[E]) => void, // Use imported ModEventPayloadMap
    ): (() => void) => {
      if (!eventListeners.current.has(eventName)) {
        eventListeners.current.set(eventName, new Set());
      }
      const listeners = eventListeners.current.get(eventName)!;
      listeners.add(callback);
      return () => {
        listeners.delete(callback);
        if (listeners.size === 0) {
          eventListeners.current.delete(eventName);
        }
      };
    },
    [],
  );

  const clearModReferences = useCallback(() => {
    middlewareRegistry.current = {};
    eventListeners.current.clear();
    modApiInstances.current.clear();
    modContext._clearRegisteredModItems();
    modContext._clearRegisteredModTools();
  }, [modContext]);

  const loadModsWithContext = useCallback(
    async (
      dbMods: DbMod[],
      getContextSnapshot: () => ReadonlyChatContextSnapshot,
    ): Promise<ModInstance[]> => {
      clearModReferences();

      // This definition now matches the updated interface in loader.ts
      const registrationCallbacks: RegistrationCallbacks = {
        registerPromptAction: modContext._registerModPromptAction,
        registerMessageAction: modContext._registerModMessageAction,
        registerSettingsTab: modContext._registerModSettingsTab,
        registerTool: modContext._registerModTool,
        registerEventListener: registerEventListener,
        // This function is passed to createApiForMod in loader.ts
        // It expects hookName, callback, and modId
        registerMiddleware: <H extends ModMiddlewareHookName>(
          hookName: H,
          callback: MiddlewareCallback<H>,
          modId: string, // modId is now an expected parameter
        ) => {
          if (!middlewareRegistry.current[hookName]) {
            // No assertion needed if MiddlewareRegistry type is correct
            middlewareRegistry.current[hookName] = [];
          }
          // No assertion needed if MiddlewareRegistry type is correct
          const middlewareList = middlewareRegistry.current[hookName]!;

          const registration = { modId, callback };
          middlewareList.push(registration);

          // Return the unsubscribe function
          return () => {
            const list = middlewareRegistry.current[hookName];
            if (list) {
              // No assertion needed if MiddlewareRegistry type is correct
              // @ts-expect-error we might need a fix for that, or not, I do not know
              middlewareRegistry.current[hookName] = list.filter(
                (reg) => reg !== registration,
              );
            }
          };
        },
      };

      // FIX: No TS error here now as the types match
      const instances = await loadMods(
        dbMods,
        registrationCallbacks,
        getContextSnapshot,
      );

      instances.forEach((instance) => {
        if (instance.api) {
          modApiInstances.current.set(instance.id, instance.api);
        }
      });

      // Ensure APP_LOADED listeners are correctly handled
      const appLoadedListeners =
        eventListeners.current.get(ModEvent.APP_LOADED) ?? new Set();
      modEvents.on(ModEvent.APP_LOADED, () => {
        appLoadedListeners.forEach((cb) => cb(undefined));
      });

      modEvents.emit(ModEvent.APP_LOADED);

      return instances;
    },
    [
      clearModReferences,
      modContext._registerModPromptAction,
      modContext._registerModMessageAction,
      modContext._registerModSettingsTab,
      modContext._registerModTool,
      registerEventListener,
    ], // Added missing dependencies from registrationCallbacks
  );

  const runMiddleware = useCallback(
    async <H extends ModMiddlewareHookName>(
      hookName: H,
      initialPayload: ModMiddlewarePayloadMap[H],
    ): Promise<ModMiddlewareReturnMap[H]> => {
      const callbacks = middlewareRegistry.current[hookName];
      if (!callbacks || callbacks.length === 0) {
        // FIX: Use 'as unknown as' for safer type assertion
        // If no middleware runs, the initial payload is the result.
        // The return type allows the payload type.
        return initialPayload as unknown as ModMiddlewareReturnMap[H];
      }

      let currentPayload = initialPayload;

      console.log(
        `[Middleware] Running ${callbacks.length} middleware for hook ${hookName}`,
      );

      for (const { modId, callback } of callbacks) {
        try {
          console.log(`[Middleware] Executing ${hookName} for mod ${modId}`);
          const result: ModMiddlewareReturnMap[H] =
            await callback(currentPayload);

          // Check for explicit cancellation first
          if (result === false) {
            console.log(
              `[Middleware] Mod ${modId} cancelled action for hook ${hookName}`,
            );
            // Return type allows boolean, so direct return is fine
            return false;
          } else if (result === undefined || result === null) {
            // No change, continue with the current payload
            console.warn(
              `[Middleware] Mod ${modId} returned undefined/null for hook ${hookName}. Assuming no change.`,
            );
          } else {
            // FIX: Use 'as unknown as' for safer type assertion
            // If not false/null/undefined, assume it's the modified payload
            currentPayload = result as unknown as ModMiddlewarePayloadMap[H];
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          console.error(
            `[Middleware] Error in mod ${modId} for hook ${hookName}:`,
            error,
          );
          toast.error(`Middleware error in mod ${modId}: ${errorMessage}`);
          setError(`Middleware error in mod ${modId}: ${errorMessage}`);
          // Return false to indicate cancellation due to error
          // Return type allows boolean, so direct return is fine
          return false;
        }
      }

      console.log(`[Middleware] Finished hook ${hookName}`);
      // FIX: Use 'as unknown as' for safer type assertion
      // The final payload is the result. Return type allows the payload type.
      return currentPayload as unknown as ModMiddlewareReturnMap[H];
    },
    [setError],
  );

  return {
    loadModsWithContext,
    runMiddleware,
    clearModReferences,
  };
}
