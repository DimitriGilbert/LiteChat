// src/context/chat-middleware.tsx
import { useCallback, useRef } from "react";
import { nanoid } from "nanoid";
import { toast } from "sonner";
import { loadMods } from "@/mods/loader";
import { modEvents, ModEvent, ModEventName } from "@/mods/events";
import {
  ModMiddlewareHook,
  type ReadonlyChatContextSnapshot,
  type ModMiddlewareHookName,
} from "@/mods/api";
import type {
  ModEventPayloadMap,
  ModMiddlewarePayloadMap,
  ModMiddlewareReturnMap,
  ProcessResponseChunkPayload,
  RenderMessagePayload,
} from "@/mods/types";
import type {
  CustomPromptAction,
  CustomMessageAction,
  CustomSettingTab,
} from "@/lib/types";

type RegistrationCallbacks = {
  registerPromptAction: (action: CustomPromptAction) => () => void;
  registerMessageAction: (action: CustomMessageAction) => () => void;
  registerSettingsTab: (tab: CustomSettingTab) => () => void;
  registerEventListener: <E extends ModEventName>(
    eventName: E,
    callback: (payload: ModEventPayloadMap[E]) => void,
  ) => () => void;
  registerMiddleware: <H extends ModMiddlewareHookName>(
    hookName: H,
    callback: (
      payload: ModMiddlewarePayloadMap[H],
    ) => ModMiddlewareReturnMap[H] | Promise<ModMiddlewareReturnMap[H]>,
  ) => () => void;
};

export function useChatMiddleware(setError: (error: string | null) => void) {
  // Use any[] for the callbacks to avoid linting warnings about using Function type
  const modEventListenersRef = useRef<Map<string, Map<string, any>>>(new Map());
  const modMiddlewareCallbacksRef = useRef<Map<string, Map<string, any>>>(
    new Map(),
  );

  const runMiddleware = useCallback(
    async <H extends ModMiddlewareHookName>(
      hookName: H,
      initialPayload: ModMiddlewarePayloadMap[H],
    ): Promise<ModMiddlewareReturnMap[H] | false> => {
      const callbacksMap = modMiddlewareCallbacksRef.current.get(hookName);

      // If no middleware registered for this hook, return the default value
      if (!callbacksMap || callbacksMap.size === 0) {
        const hook: ModMiddlewareHookName = hookName;
        switch (hook) {
          case ModMiddlewareHook.PROCESS_RESPONSE_CHUNK:
            return (initialPayload as ProcessResponseChunkPayload)
              .chunk as unknown as ModMiddlewareReturnMap[H];
          case ModMiddlewareHook.RENDER_MESSAGE:
            return (initialPayload as RenderMessagePayload)
              .message as unknown as ModMiddlewareReturnMap[H];
          case ModMiddlewareHook.SUBMIT_PROMPT:
          case ModMiddlewareHook.VFS_WRITE:
            return initialPayload as unknown as ModMiddlewareReturnMap[H];
          default:
            // Ensure all cases are handled or have a default
            return initialPayload as unknown as ModMiddlewareReturnMap[H];
        }
      }

      let currentData:
        | ModMiddlewarePayloadMap[H]
        | ModMiddlewareReturnMap[H]
        | false = initialPayload;
      const callbacks = Array.from(callbacksMap.values());

      for (const callback of callbacks) {
        // If a previous middleware cancelled the action, stop processing
        if (currentData === false) {
          break;
        }
        try {
          // Execute the middleware callback
          currentData = await callback(currentData as any); // Await handles both sync and async
        } catch (err) {
          // Handle errors during middleware execution
          const errorMessage = err instanceof Error ? err.message : String(err);
          console.error(
            `[Middleware] Error executing middleware for hook '${hookName}':`,
            err,
          );
          // TODO: Identify which mod caused the error if possible (needs structural change)
          toast.error(
            `Middleware error during ${hookName}: ${errorMessage}. Action cancelled.`,
          );
          setError(`Middleware Error (${hookName}): ${errorMessage}`); // Update global error state
          currentData = false; // Cancel the action
          break; // Stop processing further middleware for this hook
        }
      }

      // If the data wasn't modified by any middleware (and wasn't cancelled),
      // return the default value based on the hook type.
      if (currentData !== false && currentData === initialPayload) {
        const hook: ModMiddlewareHookName = hookName;
        switch (hook) {
          case ModMiddlewareHook.PROCESS_RESPONSE_CHUNK:
            return (initialPayload as ProcessResponseChunkPayload)
              .chunk as unknown as ModMiddlewareReturnMap[H];
          case ModMiddlewareHook.RENDER_MESSAGE:
            return (initialPayload as RenderMessagePayload)
              .message as unknown as ModMiddlewareReturnMap[H];
          default:
            return initialPayload as unknown as ModMiddlewareReturnMap[H];
        }
      }

      // Return the final data (potentially modified) or false if cancelled
      return currentData as ModMiddlewareReturnMap[H] | false;
    },
    [setError], // Added setError dependency
  );

  const registerModEventListener = useCallback(
    <E extends ModEventName>(
      eventName: E,
      callback: (payload: ModEventPayloadMap[E]) => void,
    ): (() => void) => {
      // Wrap the callback to catch errors during event handling
      const wrappedCallback = (payload: ModEventPayloadMap[E]) => {
        try {
          callback(payload);
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          // TODO: Identify which mod's listener failed if possible
          console.error(
            `[Event Listener] Error executing listener for event '${eventName}':`,
            err,
          );
          toast.error(`Mod Error during event ${eventName}: ${errorMessage}.`);
          // Optionally update global error state?
          // setError(`Mod Event Listener Error (${eventName}): ${errorMessage}`);
        }
      };

      modEvents.on(eventName, wrappedCallback);
      const unsubscribe = () => {
        modEvents.off(eventName, wrappedCallback);
      };
      return unsubscribe;
    },
    [], // Removed setError dependency here, as errors are handled locally
  );

  const registerModMiddleware = useCallback(
    <H extends ModMiddlewareHookName>(
      hookName: H,
      callback: (
        payload: ModMiddlewarePayloadMap[H],
      ) => ModMiddlewareReturnMap[H] | Promise<ModMiddlewareReturnMap[H]>,
    ): (() => void) => {
      const middlewareId = nanoid();
      const currentMap = modMiddlewareCallbacksRef.current;
      if (!currentMap.has(hookName)) {
        currentMap.set(hookName, new Map());
      }
      currentMap.get(hookName)?.set(middlewareId, callback);
      return () => {
        const hookCallbacks = currentMap.get(hookName);
        if (hookCallbacks) {
          hookCallbacks.delete(middlewareId);
          if (hookCallbacks.size === 0) {
            currentMap.delete(hookName);
          }
        }
      };
    },
    [],
  );

  return {
    modEventListenersRef,
    modMiddlewareCallbacksRef,
    runMiddleware,
    registerModEventListener,
    registerModMiddleware,

    // Helper for loading mods
    loadModsWithContext: useCallback(
      async (
        dbMods: any[],
        registrationCallbacks: RegistrationCallbacks,
        getContextSnapshotForMod: () => ReadonlyChatContextSnapshot,
      ) => {
        // Error handling is now more robust within loadMods itself
        try {
          const instances = await loadMods(
            dbMods,
            registrationCallbacks,
            getContextSnapshotForMod,
          );
          // APP_LOADED is emitted regardless of individual mod errors now
          modEvents.emit(ModEvent.APP_LOADED);
          return instances;
        } catch (err: unknown) {
          // This catch block might be less likely to be hit now,
          // but kept as a fallback.
          const message =
            err instanceof Error ? err.message : "Unknown loading error";
          setError(`Failed to load mods: ${message}`);
          console.error("[Middleware] Critical error during loadMods:", err);
          modEvents.emit(ModEvent.APP_LOADED); // Still emit loaded event
          return []; // Return empty array on critical failure
        }
      },
      [setError],
    ),

    // Helper for clearing mod references
    clearModReferences: useCallback(() => {
      // Note: This clears the *references* to callbacks, but doesn't
      // necessarily call any 'unload' logic within the mods themselves.
      modEventListenersRef.current.clear();
      modMiddlewareCallbacksRef.current.clear();
      // We also need to ensure event listeners registered via modEvents.on are cleared.
      // This is handled by the unsubscribe function returned by registerModEventListener.
      // Proper cleanup requires mods to be explicitly unloaded or the app to reload.
      console.warn(
        "[Middleware] Cleared mod references. Full cleanup may require mod unload logic or app reload.",
      );
    }, []),
  };
}
