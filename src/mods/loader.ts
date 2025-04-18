// src/mods/loader.ts
import type { DbMod, ModInstance } from "./types";
import type { LiteChatModApi, ReadonlyChatContextSnapshot } from "./api";
import { toast } from "sonner";
import { modEvents } from "./events"; // Use modEvents instance
import { ModEvent } from "./events";
import type {
  CustomPromptAction,
  CustomMessageAction,
  CustomSettingTab,
} from "@/lib/types";
import type { ModEventName } from "./events";
import type { ModMiddlewareHookName } from "./api";

// Type for the registration callbacks passed from ChatProvider
interface RegistrationCallbacks {
  registerPromptAction: (action: CustomPromptAction) => () => void;
  registerMessageAction: (action: CustomMessageAction) => () => void;
  registerSettingsTab: (tab: CustomSettingTab) => () => void;
  registerEventListener: <E extends ModEventName>(
    eventName: E,
    callback: (payload: any) => void, // Use 'any' here, type safety is in the API definition
  ) => () => void;
  registerMiddleware: <H extends ModMiddlewareHookName>(
    hookName: H,
    callback: (payload: any) => any, // Use 'any' here, type safety is in the API definition
  ) => () => void;
}

/**
 * Loads and executes enabled mods from the database.
 * @param dbMods Array of mod data from the database.
 * @param registrationCallbacks Object containing functions to register actions, tabs, listeners, middleware.
 * @param getContextSnapshot Function to get a read-only snapshot of the current chat context.
 * @returns A promise that resolves to an array of loaded ModInstance objects.
 */
export async function loadMods(
  dbMods: DbMod[],
  registrationCallbacks: RegistrationCallbacks,
  getContextSnapshot: () => ReadonlyChatContextSnapshot,
): Promise<ModInstance[]> {
  const loadedInstances: ModInstance[] = [];
  const enabledMods = dbMods.filter((mod) => mod.enabled);

  console.log(
    `[ModLoader] Attempting to load ${enabledMods.length} enabled mods.`,
  );

  for (const mod of enabledMods) {
    let scriptContent = mod.scriptContent;
    let modApi: LiteChatModApi | null = null; // Initialize API object reference
    let instanceError: Error | string | null = null; // Store potential error

    try {
      // Create the API object for this specific mod *before* fetching/executing
      modApi = createApiForMod(mod, registrationCallbacks, getContextSnapshot);

      // Fetch script if sourceUrl is provided
      if (mod.sourceUrl) {
        console.log(
          `[ModLoader] Fetching script for mod "${mod.name}" from ${mod.sourceUrl}`,
        );
        const response = await fetch(mod.sourceUrl);
        if (!response.ok) {
          throw new Error(
            `Failed to fetch script: ${response.status} ${response.statusText}`,
          );
        }
        scriptContent = await response.text();
        console.log(
          `[ModLoader] Fetched script for mod "${mod.name}" successfully.`,
        );
      }

      if (!scriptContent) {
        throw new Error("Mod script content is empty.");
      }

      // Execute the script in a controlled environment
      console.log(
        `[ModLoader] Executing script for mod "${mod.name}" (ID: ${mod.id})`,
      );
      // Using Function constructor for basic sandboxing (limited effectiveness in browser)
      // The script should call registration functions on the provided `modApi` object.
      const modFunction = new Function("modApi", scriptContent);
      // Wrap execution in its own try-catch to differentiate execution errors
      try {
        modFunction(modApi);
        console.log(
          `[ModLoader] Script executed successfully for mod "${mod.name}".`,
        );
      } catch (executionError) {
        // Capture execution-specific errors
        instanceError =
          executionError instanceof Error
            ? executionError
            : String(executionError);
        console.error(
          `[ModLoader] Error *executing* mod "${mod.name}" (ID: ${mod.id}):`,
          executionError,
        );
        toast.error(
          `Error executing mod "${mod.name}": ${instanceError instanceof Error ? instanceError.message : instanceError}`,
        );
        // Re-throw or handle as needed - here we store it and continue to create the instance
      }
    } catch (loadingError) {
      // Capture loading/fetching/compilation errors
      instanceError =
        loadingError instanceof Error ? loadingError : String(loadingError);
      console.error(
        `[ModLoader] Error *loading* mod "${mod.name}" (ID: ${mod.id}):`,
        loadingError,
      );
      toast.error(
        `Error loading mod "${mod.name}": ${instanceError instanceof Error ? instanceError.message : instanceError}`,
      );
    } finally {
      // Always create an instance, including the error if one occurred
      // Ensure modApi is created even if loading fails early, for consistency
      if (!modApi) {
        modApi = createApiForMod(
          mod,
          registrationCallbacks,
          getContextSnapshot,
        );
      }

      const instance: ModInstance = {
        id: mod.id,
        name: mod.name,
        api: modApi, // Store the API instance
        error: instanceError ?? undefined, // Assign error if it exists
      };
      loadedInstances.push(instance);

      // Emit appropriate event based on whether an error occurred
      if (instance.error) {
        modEvents.emit(ModEvent.MOD_ERROR, {
          id: mod.id,
          name: mod.name,
          error: instance.error,
        });
      } else {
        modEvents.emit(ModEvent.MOD_LOADED, { id: mod.id, name: mod.name });
      }
    }
  }

  console.log(
    `[ModLoader] Finished loading. ${loadedInstances.length} instances created (including errors).`,
  );
  return loadedInstances;
}

/**
 * Creates the API object passed to a single mod's script.
 */
function createApiForMod(
  mod: DbMod,
  registrationCallbacks: RegistrationCallbacks,
  getContextSnapshot: () => ReadonlyChatContextSnapshot,
): LiteChatModApi {
  const modId = mod.id;
  const modName = mod.name;

  // Store unsubscribe functions for this mod
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
    on: (eventName, callback) => {
      // Type assertion needed because the callback in RegistrationCallbacks uses 'any'
      const unsubscribe = registrationCallbacks.registerEventListener(
        eventName,
        callback as (payload: any) => void,
      );
      unsubscribeCallbacks.add(unsubscribe);
      return unsubscribe;
    },
    addMiddleware: (hookName, callback) => {
      // Type assertion needed because the callback in RegistrationCallbacks uses 'any'
      const unsubscribe = registrationCallbacks.registerMiddleware(
        hookName,
        callback as (payload: any) => any,
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

    // TODO: Implement unload function if needed, which would call all unsubscribe callbacks
    // unload: () => {
    //   unsubscribeCallbacks.forEach(unsub => unsub());
    //   unsubscribeCallbacks.clear();
    //   console.log(`[ModLoader] Unloaded mod "${modName}" (ID: ${modId})`);
    // }
  };

  return api;
}
