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
import type { CustomPromptAction, CustomMessageAction, CustomSettingTab } from "@/lib/types";

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
  const modMiddlewareCallbacksRef = useRef<Map<string, Map<string, any>>>(new Map());

  const runMiddleware = useCallback(
    async <H extends ModMiddlewareHookName>(
      hookName: H,
      initialPayload: ModMiddlewarePayloadMap[H],
    ): Promise<ModMiddlewareReturnMap[H] | false> => {
      const callbacksMap = modMiddlewareCallbacksRef.current.get(hookName);

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
            return initialPayload as unknown as ModMiddlewareReturnMap[H];
        }
      }

      let currentData:
        | ModMiddlewarePayloadMap[H]
        | ModMiddlewareReturnMap[H]
        | false = initialPayload;
      const callbacks = Array.from(callbacksMap.values());

      for (const callback of callbacks) {
        if (currentData === false) {
          break;
        }
        try {
          currentData = await callback(currentData as any);
        } catch (err) {
          console.error(
            `[Middleware] Error executing middleware for hook '${hookName}':`,
            err,
          );
          toast.error(`Middleware error during ${hookName}. Action cancelled.`);
          currentData = false;
          break;
        }
      }

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
      return currentData as ModMiddlewareReturnMap[H] | false;
    },
    [],
  );

  const registerModEventListener = useCallback(
    <E extends ModEventName>(
      eventName: E,
      callback: (payload: ModEventPayloadMap[E]) => void,
    ): (() => void) => {
      modEvents.on(eventName, callback);
      const unsubscribe = () => {
        modEvents.off(eventName, callback);
      };
      return unsubscribe;
    },
    [],
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
        getContextSnapshotForMod: () => ReadonlyChatContextSnapshot
      ) => {
        try {
          const instances = await loadMods(
            dbMods, 
            registrationCallbacks, 
            getContextSnapshotForMod
          );
          modEvents.emit(ModEvent.APP_LOADED);
          return instances;
        } catch (err: unknown) {
          if (err instanceof Error) {
            setError("Failed to load one or more mods." + err.message);
          } else {
            setError("Failed to load one or more mods.");
          }
          modEvents.emit(ModEvent.APP_LOADED);
          return [];
        }
      },
      [setError]
    ),
    
    // Helper for clearing mod references
    clearModReferences: useCallback(() => {
      modEventListenersRef.current.clear();
      modMiddlewareCallbacksRef.current.clear();
    }, [])
  };
}