import type { DbMod, ModInstance, LiteChatModApi } from '@/types/litechat/modding.types';
import { createModApi } from './api-factory';
import { toast } from 'sonner';
import { emitter } from '@/lib/litechat/event-emitter';

export async function loadMods(dbMods: DbMod[]): Promise<ModInstance[]> {
  const enabledMods = dbMods.filter((mod) => mod.enabled);
  const instances = await Promise.all(
    enabledMods.map(async (mod): Promise<ModInstance> => {
      let scriptContent = mod.scriptContent, modApi: LiteChatModApi | null = null, instanceError: Error | string | null = null;
      try {
        modApi = createModApi(mod);
        if (mod.sourceUrl) {
          console.log(`Fetching script for ${mod.name} from ${mod.sourceUrl}`);
          // scriptContent = await fetch(...); // Actual fetch logic needed
          scriptContent = `console.log('Mod ${mod.name} (URL) loaded!');`; // Placeholder
        }
        if (!scriptContent) throw new Error('Mod script empty.');
        const modFunction = new Function('modApi', scriptContent);
        modFunction(modApi);
      } catch (e) { instanceError = e instanceof Error ? e : String(e); toast.error(`Error loading mod "${mod.name}": ${instanceError instanceof Error ? instanceError.message : instanceError}`); }
      if (!modApi) modApi = createModApi(mod); // Ensure API exists
      const instance: ModInstance = { id: mod.id, name: mod.name, api: modApi, error: instanceError ?? undefined };
      emitter.emit(instance.error ? 'mod:error' : 'mod:loaded', { id: mod.id, name: mod.name, error: instance.error });
      return instance;
    })
  );
  emitter.emit('app:loaded', undefined);
  return instances;
}
