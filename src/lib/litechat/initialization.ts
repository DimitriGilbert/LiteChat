// src/lib/litechat/initialization.ts
// FULL FILE
import { toast } from "sonner";
import { useConversationStore } from "@/store/conversation.store";
import { useModStore } from "@/store/mod.store";
import { useProviderStore } from "@/store/provider.store";
import { useSettingsStore } from "@/store/settings.store";
import { usePromptStateStore } from "@/store/prompt.store";
import { useProjectStore } from "@/store/project.store";
import { useUIStateStore } from "@/store/ui.store";
import { loadMods } from "@/modding/loader";
import type {
  ControlModule,
  ControlModuleConstructor,
} from "@/types/litechat/control";
import type { LiteChatModApi } from "@/types/litechat/modding";
import { rulesEvent } from "@/types/litechat/events/rules.events"; // Import rulesEvent
import { emitter } from "./event-emitter"; // Import emitter

interface CoreStores {
  loadSettings: () => Promise<void>;
  loadProviderData: () => Promise<void>;
  requestLoadRulesAndTags: () => void; // Changed signature
  loadSidebarItems: () => Promise<void>;
  loadDbMods: () => Promise<void>;
  setLoadedMods: (loadedMods: any[]) => void;
  getConversationById: (id: string | null) => any;
  getEffectiveProjectSettings: (projectId: string | null) => any;
  initializePromptState: (settings: any) => void;
  selectedItemId: string | null;
  selectedItemType: string | null;
}

function resolveDependencyOrder(
  modules: ControlModule[]
): ControlModule[] | null {
  const moduleMap = new Map<string, ControlModule>(
    modules.map((m) => [m.id, m])
  );
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const sorted: ControlModule[] = [];

  function visit(module: ControlModule): boolean {
    if (visited.has(module.id)) return true;
    if (visiting.has(module.id)) {
      console.error(
        `[Init] Circular dependency detected involving module: ${module.id}`
      );
      toast.error(`Initialization Error: Circular dependency in controls.`);
      return false;
    }
    visiting.add(module.id);
    for (const depId of module.dependencies ?? []) {
      const dependency = moduleMap.get(depId);
      if (!dependency) {
        console.error(
          `[Init] Missing dependency "${depId}" for module "${module.id}"`
        );
        toast.error(
          `Initialization Error: Missing dependency "${depId}" for "${module.id}".`
        );
        visiting.delete(module.id);
        return false;
      }
      if (!visit(dependency)) {
        visiting.delete(module.id);
        return false;
      }
    }
    visiting.delete(module.id);
    visited.add(module.id);
    sorted.push(module);
    return true;
  }

  for (const module of modules) {
    if (!visited.has(module.id)) {
      if (!visit(module)) {
        return null;
      }
    }
  }
  return sorted;
}

export async function loadCoreData(stores: CoreStores): Promise<void> {
  console.log("[Init] Core Data: Loading...");
  await stores.loadSettings();
  await stores.loadProviderData();
  stores.requestLoadRulesAndTags(); // Emit request instead of direct call
  await stores.loadSidebarItems();
  console.log("[Init] Core Data: Loaded.");
}

export async function initializeControlModules(
  moduleConstructors: ControlModuleConstructor[],
  modApi: LiteChatModApi
): Promise<ControlModule[]> {
  console.log(
    "[Init] Control Modules: Instantiation & Dependency Resolution START"
  );
  const moduleInstances = moduleConstructors.map((Ctor) => new Ctor());
  const sortedModules = resolveDependencyOrder(moduleInstances);

  if (!sortedModules) {
    console.error("[Init] Control Modules: Dependency resolution FAILED.");
    throw new Error("Failed to resolve control module dependency order.");
  }
  console.log(
    `[Init] Control Modules: Dependency order resolved (${sortedModules.length} modules):`,
    sortedModules.map((m) => m.id)
  );
  console.log(
    "[Init] Control Modules: Instantiation & Dependency Resolution COMPLETE"
  );

  console.log("[Init] Control Modules: Initialization START");
  for (const module of sortedModules) {
    try {
      await module.initialize(modApi);
    } catch (initError) {
      console.error(
        `[Init] Error initializing module "${module.id}":`,
        initError
      );
      toast.error(
        `Module Init Error (${module.id}): ${
          initError instanceof Error ? initError.message : String(initError)
        }`
      );
    }
  }
  console.log("[Init] Control Modules: Initialization COMPLETE.");
  return sortedModules;
}

export function registerControlModules(
  modules: ControlModule[],
  modApi: LiteChatModApi
): void {
  console.log("[Init] Control Modules: Registration START");
  for (const module of modules) {
    try {
      module.register(modApi);
    } catch (regError) {
      console.error(
        `[Init] Error registering module "${module.id}":`,
        regError
      );
      toast.error(
        `Module Registration Error (${module.id}): ${
          regError instanceof Error ? regError.message : String(regError)
        }`
      );
    }
  }
  console.log("[Init] Control Modules: Registration COMPLETE.");
}

export async function loadAndProcessMods(stores: CoreStores): Promise<void> {
  console.log("[Init] External Mods: Loading DB records...");
  await stores.loadDbMods();
  const currentDbMods = useModStore.getState().dbMods;
  console.log(
    `[Init] External Mods: Processing ${currentDbMods.length} mods...`
  );
  const loadedModInstances = await loadMods(currentDbMods);
  stores.setLoadedMods(loadedModInstances);
  console.log(
    `[Init] External Mods: ${loadedModInstances.length} mods processed.`
  );
}

export function initializeCoreUiStates(stores: CoreStores): void {
  console.log("[Init] Core UI States: Initializing...");
  const initialSelItemId = stores.selectedItemId;
  const initialSelItemType = stores.selectedItemType;

  const initialProjectId =
    initialSelItemType === "project"
      ? initialSelItemId
      : initialSelItemType === "conversation"
      ? stores.getConversationById(initialSelItemId)?.projectId ?? null
      : null;

  const initialEffectiveSettings =
    stores.getEffectiveProjectSettings(initialProjectId);
  stores.initializePromptState(initialEffectiveSettings);
  console.log(
    "[Init] Core UI States: Initial prompt state synchronized with context."
  );
}

export async function performFullInitialization(
  moduleConstructors: ControlModuleConstructor[],
  coreModApi: LiteChatModApi
): Promise<ControlModule[]> {
  console.log("LiteChat: Full initialization sequence START.");
  const stores: CoreStores = {
    loadSettings: useSettingsStore.getState().loadSettings,
    loadProviderData: useProviderStore.getState().loadInitialData,
    requestLoadRulesAndTags: () =>
      emitter.emit(rulesEvent.loadRulesAndTagsRequest, undefined), // Emit request
    loadSidebarItems: useConversationStore.getState().loadSidebarItems,
    loadDbMods: useModStore.getState().loadDbMods,
    setLoadedMods: useModStore.getState().setLoadedMods,
    getConversationById: useConversationStore.getState().getConversationById,
    getEffectiveProjectSettings:
      useProjectStore.getState().getEffectiveProjectSettings,
    initializePromptState: usePromptStateStore.getState().initializePromptState,
    selectedItemId: useConversationStore.getState().selectedItemId,
    selectedItemType: useConversationStore.getState().selectedItemType,
  };

  let initializedModules: ControlModule[] = [];
  try {
    await loadCoreData(stores);
    initializedModules = await initializeControlModules(
      moduleConstructors,
      coreModApi
    );
    registerControlModules(initializedModules, coreModApi);
    await loadAndProcessMods(stores);
    initializeCoreUiStates(stores);
    console.log("LiteChat: Full initialization sequence COMPLETE.");
  } catch (error) {
    console.error("LiteChat: Full initialization sequence FAILED:", error);
    toast.error(
      `Initialization sequence failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    useUIStateStore
      .getState()
      .setGlobalError("Initialization sequence failed.");
    throw error;
  }
  return initializedModules;
}
