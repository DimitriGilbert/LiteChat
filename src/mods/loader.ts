
import type {
  DbMod,
  ModInstance,
  ModEventPayloadMap,
  Tool, // Import Tool types
  ToolImplementation,
  ModMiddlewarePayloadMap, // Import payload map
  ModMiddlewareReturnMap, // Import return map
} from "./types";
import type { LiteChatModApi, ReadonlyChatContextSnapshot } from "./api";
import { toast } from "sonner";
import { modEvents } from "./events"; // Use modEvents instance
import { ModEvent } from "./events";
import type {
  CustomPromptAction,
  CustomMessageAction,
  CustomSettingTab,
} from "@/lib/types";
import type { ModMiddlewareHookName } from "./api";
import type { z } from "zod"; // Import z


interface RegistrationCallbacks {
  registerPromptAction: (action: CustomPromptAction) => () => void;
  registerMessageAction: (action: CustomMessageAction) => () => void;
  registerSettingsTab: (tab: CustomSettingTab) => () => void;
  // Add registerTool callback type
  registerTool: <PARAMETERS extends z.ZodSchema<any>>(
    toolName: string,
    definition: Tool<PARAMETERS>,
    implementation?: ToolImplementation<PARAMETERS>,
  ) => () => void;
  registerEventListener: <E extends keyof ModEventPayloadMap>(
    eventName: E,
    callback: (payload: ModEventPayloadMap[E]) => void,
  ) => () => void;
  // FIX: Add modId to the signature to match usage
  registerMiddleware: <H extends ModMiddlewareHookName>(
    hookName: H,
    callback: (
      payload: ModMiddlewarePayloadMap[H],
    ) => ModMiddlewareReturnMap[H] | Promise<ModMiddlewareReturnMap[H]>,
    modId: string, // Add modId here
  ) => () => void;
}

/**
 * Loads and executes enabled mods from the database.
 */
export async function loadMods(
  dbMods: DbMod[], // FIX: Use dbMods parameter
  registrationCallbacks: RegistrationCallbacks,
  getContextSnapshot: () => ReadonlyChatContextSnapshot,
): Promise<ModInstance[]> {
  console.log(`[ModLoader] Loading ${dbMods.length} mods from DB.`);

  // FIX: Filter enabled mods from dbMods
  const enabledMods = dbMods.filter((mod) => mod.enabled);
  console.log(`[ModLoader] ${enabledMods.length} mods are enabled.`);

  const instances = await Promise.all(
    // FIX: Use enabledMods and type the 'mod' parameter
    enabledMods.map(async (mod: DbMod) => {
      let scriptContent = mod.scriptContent;
      let modApi: LiteChatModApi | null = null;
      let instanceError: Error | string | null = null;
      const modId = mod.id; // Keep modId accessible

      try {
        // Pass the modId to createApiForMod so it can be used in registerMiddleware
        modApi = createApiForMod(
          mod, // Pass the full mod object
          registrationCallbacks,
          getContextSnapshot,
        );

        if (mod.sourceUrl) {
          try {
            console.log(
              `[ModLoader] Fetching script for mod ${mod.name} from ${mod.sourceUrl}`,
            );
            const response = await fetch(mod.sourceUrl);
            if (!response.ok) {
              throw new Error(
                `Failed to fetch mod script: ${response.statusText}`,
              );
            }
            scriptContent = await response.text();
            console.log(
              `[ModLoader] Fetched script for mod ${mod.name} successfully.`,
            );
          } catch (fetchError) {
            throw new Error(
              `Error fetching script from ${mod.sourceUrl}: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`,
            );
          }
        }

        if (!scriptContent) {
          throw new Error("Mod script content is empty.");
        }

        // Execute the mod script
        console.log(`[ModLoader] Executing script for mod ${mod.name}`);
        const modFunction = new Function("modApi", scriptContent);
        try {
          modFunction(modApi);
          console.log(`[ModLoader] Successfully executed mod ${mod.name}`);
        } catch (executionError) {
          instanceError =
            executionError instanceof Error
              ? executionError
              : String(executionError);
          console.error(
            `[ModLoader] Error executing script for mod ${mod.name} (ID: ${modId}):`,
            instanceError,
          );
          toast.error(
            `Error executing mod "${mod.name}": ${instanceError instanceof Error ? instanceError.message : instanceError}`,
          );
        }
      } catch (loadingError) {
        instanceError =
          loadingError instanceof Error ? loadingError : String(loadingError);
        console.error(
          `[ModLoader] Error loading mod ${mod.name} (ID: ${modId}):`,
          instanceError,
        );
        toast.error(
          `Error loading mod "${mod.name}": ${instanceError instanceof Error ? instanceError.message : instanceError}`,
        );
      } finally {
        // Ensure API exists even if loading/execution failed, for potential cleanup/error reporting
        if (!modApi) {
          modApi = createApiForMod(
            mod, // Pass the full mod object
            registrationCallbacks,
            getContextSnapshot,
          );
        }
        const instance: ModInstance = {
          id: modId,
          name: mod.name,
          api: modApi, // API is always attached
          error: instanceError ?? undefined, // Store error if one occurred
        };

        // Emit events based on success or failure
        if (instance.error) {
          modEvents.emit(ModEvent.MOD_ERROR, {
            id: modId,
            name: mod.name,
            error: instance.error,
          });
        } else {
          modEvents.emit(ModEvent.MOD_LOADED, { id: modId, name: mod.name });
        }
        return instance; // Return instance for Promise.all
      }
    }),
  );

  console.log(
    `[ModLoader] Finished loading. ${instances.length} instances created (including errors).`,
  );
  return instances;
}

function createApiForMod(
  mod: DbMod, // Receive the full mod object
  registrationCallbacks: RegistrationCallbacks,
  getContextSnapshot: () => ReadonlyChatContextSnapshot,
): LiteChatModApi {
  const modId = mod.id; // Get modId from the mod object
  const modName = mod.name;

  const unsubscribeCallbacks: Set<() => void> = new Set();

  const api: LiteChatModApi = {
    modId,
    modName,

    registerPromptAction: (action) => {
      const unsubscribe = registrationCallbacks.registerPromptAction(action);
      unsubscribeCallbacks.add(unsubscribe);
      return unsubscribe;
    },
    registerMessageAction: (action) => {
      const unsubscribe = registrationCallbacks.registerMessageAction(action);
      unsubscribeCallbacks.add(unsubscribe);
      return unsubscribe;
    },
    registerSettingsTab: (tab) => {
      const unsubscribe = registrationCallbacks.registerSettingsTab(tab);
      unsubscribeCallbacks.add(unsubscribe);
      return unsubscribe;
    },
    registerTool: (toolName, definition, implementation) => {
      const unsubscribe = registrationCallbacks.registerTool(
        toolName,
        definition,
        implementation,
      );
      unsubscribeCallbacks.add(unsubscribe);
      return unsubscribe;
    },
    on: (eventName, callback) => {
      const unsubscribe = registrationCallbacks.registerEventListener(
        eventName,
        callback,
      );
      unsubscribeCallbacks.add(unsubscribe);
      return unsubscribe;
    },
    // This addMiddleware is the one exposed to the mod script
    addMiddleware: <H extends ModMiddlewareHookName>(
      hookName: H,
      // Use the specific callback type from the maps
      callback: (
        payload: ModMiddlewarePayloadMap[H],
      ) => ModMiddlewareReturnMap[H] | Promise<ModMiddlewareReturnMap[H]>,
    ) => {
      // Call the internal registration function, passing the modId
      // FIX: No need for 'as any' here if types align
      const unsubscribe = registrationCallbacks.registerMiddleware(
        hookName,
        callback,
        modId, // Pass the modId
      );
      unsubscribeCallbacks.add(unsubscribe);
      return unsubscribe;
    },

    getContextSnapshot: getContextSnapshot,

    showToast: (type, message) => {
      toast[type](`[${modName}] ${message}`);
    },
    log: (level, ...args) => {
      console[level](`[Mod: ${modName}]`, ...args);
    },


    // cleanup: () => {
    //   unsubscribeCallbacks.forEach(cb => cb());
    //   unsubscribeCallbacks.clear();
    //   console.log(`[Mod: ${modName}] Cleaned up registrations.`);
    // }
  };

  return api;
}
