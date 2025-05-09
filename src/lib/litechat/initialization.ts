// src/lib/litechat/initialization.ts
// FULL FILE
import { toast } from "sonner";
import { useConversationStore } from "@/store/conversation.store";
import { useModStore } from "@/store/mod.store";
import { useProviderStore } from "@/store/provider.store";
import { useSettingsStore } from "@/store/settings.store";
import { useRulesStore } from "@/store/rules.store";
import { usePromptStateStore } from "@/store/prompt.store";
import { useProjectStore } from "@/store/project.store";
import { useUIStateStore } from "@/store/ui.store";
import { loadMods } from "@/modding/loader";
// Import new ControlModule types
import type {
  ControlModule,
  ControlModuleConstructor,
} from "@/types/litechat/control";
import { createModApi } from "@/modding/api-factory"; // Needed for modApi instance
import type { LiteChatModApi } from "@/types/litechat/modding"; // Needed for modApi type

interface CoreStores {
  loadSettings: () => Promise<void>;
  loadProviderData: () => Promise<void>;
  loadRulesAndTags: () => Promise<void>;
  loadSidebarItems: () => Promise<void>;
  loadDbMods: () => Promise<void>;
  setLoadedMods: (loadedMods: any[]) => void;
  getConversationById: (id: string | null) => any;
  getEffectiveProjectSettings: (projectId: string | null) => any;
  initializePromptState: (settings: any) => void;
  selectedItemId: string | null;
  selectedItemType: string | null;
}

// --- Dependency Resolution (Topological Sort) ---
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
        `[Initialization] Circular dependency detected involving module: ${module.id}`
      );
      toast.error(`Initialization Error: Circular dependency in controls.`);
      return false; // Cycle detected
    }

    visiting.add(module.id);

    for (const depId of module.dependencies ?? []) {
      const dependency = moduleMap.get(depId);
      if (!dependency) {
        console.error(
          `[Initialization] Missing dependency "${depId}" for module "${module.id}"`
        );
        toast.error(
          `Initialization Error: Missing dependency "${depId}" for "${module.id}".`
        );
        visiting.delete(module.id);
        return false; // Missing dependency
      }
      if (!visit(dependency)) {
        visiting.delete(module.id);
        return false; // Cycle detected in dependency
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
        return null; // Error occurred
      }
    }
  }

  return sorted;
}
// --- End Dependency Resolution ---

export async function loadCoreData(stores: CoreStores): Promise<void> {
  console.log("LiteChat Init: Loading core data...");
  await stores.loadSettings();
  console.log("LiteChat Init: Settings loaded.");
  await stores.loadProviderData();
  console.log("LiteChat Init: Provider data loaded.");
  await stores.loadRulesAndTags();
  console.log("LiteChat Init: Rules and Tags loaded.");
  await stores.loadSidebarItems();
  console.log("LiteChat Init: Sidebar items loaded.");
}

// Renamed function, now handles instantiation, sorting, and initialization
export async function initializeControlModules(
  moduleConstructors: ControlModuleConstructor[],
  modApi: LiteChatModApi // Pass modApi instance
): Promise<ControlModule[]> {
  console.log("LiteChat Init: Instantiating control modules...");
  const moduleInstances = moduleConstructors.map((Ctor) => new Ctor());
  console.log(`LiteChat Init: ${moduleInstances.length} modules instantiated.`);

  console.log("LiteChat Init: Resolving control module dependencies...");
  const sortedModules = resolveDependencyOrder(moduleInstances);

  if (!sortedModules) {
    throw new Error("Failed to resolve control module dependency order.");
  }
  console.log(
    "LiteChat Init: Dependency order resolved:",
    sortedModules.map((m) => m.id)
  );

  console.log("LiteChat Init: Initializing control modules...");
  for (const module of sortedModules) {
    try {
      console.log(`LiteChat Init: Initializing module "${module.id}"...`);
      await module.initialize(modApi);
    } catch (initError) {
      console.error(
        `LiteChat Init: Error initializing module "${module.id}":`,
        initError
      );
      toast.error(
        `Module Initialization Error (${module.id}): ${
          initError instanceof Error ? initError.message : String(initError)
        }`
      );
      // Decide whether to continue or halt initialization
      // For now, let's continue but log the error
    }
  }
  console.log("LiteChat Init: Control modules initialized.");
  return sortedModules; // Return sorted instances
}

// Renamed function, now just handles registration
export function registerControlModules(
  modules: ControlModule[], // Accept initialized & sorted modules
  modApi: LiteChatModApi
): void {
  console.log("LiteChat Init: Registering control modules...");
  for (const module of modules) {
    try {
      console.log(`LiteChat Init: Registering module "${module.id}"...`);
      module.register(modApi);
    } catch (regError) {
      console.error(
        `LiteChat Init: Error registering module "${module.id}":`,
        regError
      );
      toast.error(
        `Module Registration Error (${module.id}): ${
          regError instanceof Error ? regError.message : String(regError)
        }`
      );
    }
  }
  console.log("LiteChat Init: Control modules registered.");
}

export async function loadAndProcessMods(stores: CoreStores): Promise<void> {
  console.log("LiteChat Init: Loading mods...");
  await stores.loadDbMods();
  console.log("LiteChat Init: DB Mods loaded.");
  const currentDbMods = useModStore.getState().dbMods;
  console.log(`LiteChat Init: Processing ${currentDbMods.length} mods...`);
  const loadedModInstances = await loadMods(currentDbMods);
  stores.setLoadedMods(loadedModInstances);
  console.log(`LiteChat Init: ${loadedModInstances.length} mods processed.`);
}

export function initializeCoreUiStates(stores: CoreStores): void {
  console.log("LiteChat Init: Initializing core UI states...");
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
    "LiteChat Init: Initial prompt state initialized.",
    initialEffectiveSettings
  );
}

export async function performFullInitialization(
  moduleConstructors: ControlModuleConstructor[] // Expect constructors now
): Promise<void> {
  const stores: CoreStores = {
    loadSettings: useSettingsStore.getState().loadSettings,
    loadProviderData: useProviderStore.getState().loadInitialData,
    loadRulesAndTags: useRulesStore.getState().loadRulesAndTags,
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

  // Create a minimal modApi instance for core controls
  // This assumes a 'core' mod doesn't really exist, but we need the API structure.
  const coreModApi = createModApi({
    id: "core",
    name: "LiteChat Core",
    sourceUrl: null,
    scriptContent: null,
    enabled: true,
    loadOrder: -1,
    createdAt: new Date(),
  });

  try {
    await loadCoreData(stores);
    const initializedModules = await initializeControlModules(
      moduleConstructors,
      coreModApi
    );
    registerControlModules(initializedModules, coreModApi); // Register after initialization
    await loadAndProcessMods(stores);
    initializeCoreUiStates(stores);
  } catch (error) {
    console.error("LiteChat: Full initialization sequence failed:", error);
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
}
