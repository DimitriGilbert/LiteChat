// src/modding/loader.ts
// FULL FILE
import {
  type DbMod,
  type ModInstance,
  type LiteChatModApi,
} from "@/types/litechat/modding";
import { modEvent } from "@/types/litechat/events/mod.events";
import { appEvent } from "@/types/litechat/events/app.events";
import { createModApi } from "./api-factory";
import { toast } from "sonner";
import { emitter } from "@/lib/litechat/event-emitter";

export async function loadMods(dbMods: DbMod[]): Promise<ModInstance[]> {
  const enabledMods = dbMods.filter((mod) => mod.enabled);
  const instances = await Promise.all(
    enabledMods.map(async (mod): Promise<ModInstance> => {
      let scriptContent = mod.scriptContent,
        modApi: LiteChatModApi | null = null,
        instanceError: Error | string | null = null;
      try {
        modApi = createModApi(mod);
        if (mod.sourceUrl) {
          console.log(
            `[ModLoader] Fetching script for ${mod.name} from ${mod.sourceUrl}`
          );
          try {
            const response = await fetch(mod.sourceUrl);
            if (!response.ok) {
              throw new Error(
                `Failed to fetch mod script: ${response.status} ${response.statusText}`
              );
            }
            scriptContent = await response.text();
            console.log(
              `[ModLoader] Successfully fetched script for ${mod.name}`
            );
          } catch (fetchError) {
            console.error(
              `[ModLoader] Error fetching script from ${mod.sourceUrl}:`,
              fetchError
            );
            throw fetchError;
          }
        }
        if (!scriptContent) throw new Error("Mod script content is empty.");

        const modFunction = new Function("modApi", scriptContent);
        modFunction(modApi);
        console.log(`[ModLoader] Successfully executed script for ${mod.name}`);
      } catch (e) {
        instanceError = e instanceof Error ? e : String(e);
        console.error(`[ModLoader] Error loading mod "${mod.name}":`, e);
        toast.error(
          `Error loading mod "${mod.name}": ${
            instanceError instanceof Error
              ? instanceError.message
              : instanceError
          }`
        );
      }

      if (!modApi) modApi = createModApi(mod);

      const instance: ModInstance = {
        id: mod.id,
        name: mod.name,
        api: modApi,
        error: instanceError,
      };

      emitter.emit(instance.error ? modEvent.modError : modEvent.modLoaded, {
        id: mod.id,
        name: mod.name,
        error: instance.error ?? "unknown error",
      });

      return instance;
    })
  );

  emitter.emit(appEvent.loaded, undefined);
  console.log(`[ModLoader] Finished processing ${instances.length} mods.`);
  return instances;
}
