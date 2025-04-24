// src/context/chat-middleware.tsx
import { useCallback, useRef } from "react";
import { toast } from "sonner";
import type { z } from "zod";
import type {
  DbMod,
  ModInstance,
  ModMiddlewarePayloadMap,
  ModMiddlewareReturnMap,
  Tool,
  ToolImplementation,
  ModEventPayloadMap,
} from "@/mods/types";
import { loadMods } from "@/mods/loader";
import { modEvents, ModEvent } from "@/mods/events";
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
// Import the store instead of the context hook
import { useModStore } from "@/store/mod.store";

interface RegistrationCallbacks {
  registerPromptAction: (action: CustomPromptAction) => () => void;
  registerMessageAction: (action: CustomMessageAction) => () => void;
  registerSettingsTab: (tab: CustomSettingTab) => () => void;
  registerTool: <PARAMETERS extends z.ZodSchema<any>>(
    toolName: string,
    definition: Tool<PARAMETERS>,
    implementation?: ToolImplementation<PARAMETERS>,
  ) => () => void;
  registerEventListener: <E extends keyof ModEventPayloadMap>(
    eventName: E,
    callback: (payload: ModEventPayloadMap[E]) => void,
  ) => () => void;
  registerMiddleware: <H extends ModMiddlewareHookName>(
    hookName: H,
    callback: MiddlewareCallback<H>,
    modId: string,
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
  // Get actions directly from the store's state
  const modStoreActions = useModStore.getState();
  const middlewareRegistry = useRef<MiddlewareRegistry>({});
  const eventListeners = useRef<Map<string, Set<(...args: any[]) => void>>>(
    new Map(),
  );
  const modApiInstances = useRef<Map<string, LiteChatModApi>>(new Map());

  const registerEventListener = useCallback(
    <E extends keyof ModEventPayloadMap>(
      eventName: E,
      callback: (payload: ModEventPayloadMap[E]) => void,
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
    // Use actions from the store state
    modStoreActions._clearRegisteredModItems();
    modStoreActions._clearRegisteredModTools();
  }, [modStoreActions]); // Add store actions to dependency array

  const loadModsWithContext = useCallback(
    async (
      dbMods: DbMod[],
      getContextSnapshot: () => ReadonlyChatContextSnapshot,
    ): Promise<ModInstance[]> => {
      clearModReferences();

      // Use actions directly from the store state
      const registrationCallbacks: RegistrationCallbacks = {
        registerPromptAction: modStoreActions._registerModPromptAction,
        registerMessageAction: modStoreActions._registerModMessageAction,
        registerSettingsTab: modStoreActions._registerModSettingsTab,
        registerTool: modStoreActions._registerModTool,
        registerEventListener: registerEventListener,
        registerMiddleware: <H extends ModMiddlewareHookName>(
          hookName: H,
          callback: MiddlewareCallback<H>,
          modId: string,
        ) => {
          if (!middlewareRegistry.current[hookName]) {
            middlewareRegistry.current[hookName] = [];
          }
          const middlewareList = middlewareRegistry.current[hookName]!;

          const registration = { modId, callback };
          middlewareList.push(registration);

          return () => {
            const currentList = middlewareRegistry.current[hookName];
            if (currentList) {
              middlewareRegistry.current[hookName] = currentList.filter(
                (reg) => reg.callback !== callback || reg.modId !== modId,
              ) as any;
            }
          };
        },
      };

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
      modStoreActions._registerModPromptAction,
      modStoreActions._registerModMessageAction,
      modStoreActions._registerModSettingsTab,
      modStoreActions._registerModTool,
      registerEventListener,
    ], // Update dependencies
  );

  const runMiddleware = useCallback(
    async <H extends ModMiddlewareHookName>(
      hookName: H,
      initialPayload: ModMiddlewarePayloadMap[H],
    ): Promise<ModMiddlewareReturnMap[H]> => {
      const callbacks = (middlewareRegistry.current[hookName] ?? []) as Array<{
        modId: string;
        callback: MiddlewareCallback<H>;
      }>;

      if (callbacks.length === 0) {
        return initialPayload as any;
      }

      let currentPayload = initialPayload;

      for (const { modId, callback } of callbacks) {
        try {
          const result = await callback(currentPayload);

          if (result === false) {
            return false as any;
          } else if (result === undefined || result === null) {
            // No change, continue with the current payload
          } else {
            currentPayload = result as any;
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          toast.error(`Middleware error in mod ${modId}: ${errorMessage}`);
          setError(`Middleware error in mod ${modId}: ${errorMessage}`);
          return false as any;
        }
      }

      return currentPayload as any;
    },
    [setError],
  );

  return {
    loadModsWithContext,
    runMiddleware,
    clearModReferences,
  };
}
