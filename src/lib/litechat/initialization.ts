// src/lib/litechat/initialization.ts
// FULL FILE
import { toast } from "sonner";
import { useConversationStore } from "@/store/conversation.store";
import { useModStore } from "@/store/mod.store";
// Removed unused useProviderStore and useSettingsStore
import { usePromptStateStore } from "@/store/prompt.store";
import { useProjectStore } from "@/store/project.store";
import { useUIStateStore } from "@/store/ui.store";
import { loadMods } from "@/modding/loader";
import type {
  ControlModule,
  ControlModuleConstructor,
} from "@/types/litechat/control";
import type { LiteChatModApi } from "@/types/litechat/modding";
import { rulesEvent } from "@/types/litechat/events/rules.events";
import { emitter } from "./event-emitter";
import { appEvent } from "@/types/litechat/events/app.events";
import { settingsEvent } from "@/types/litechat/events/settings.events";
import { providerEvent } from "@/types/litechat/events/provider.events";
import { conversationEvent } from "@/types/litechat/events/conversation.events";
import { modEvent } from "@/types/litechat/events/mod.events";
import { promptEvent as promptStateEvent } from "@/types/litechat/events/prompt.events";
import { projectEvent } from "@/types/litechat/events/project.events";
import { InteractionService } from "@/services/interaction.service";
import { BundledConfigService } from "@/services/bundled-config.service";
import { StartupSyncService } from "@/services/startup-sync.service";
import i18next from "i18next";

interface CoreStores {
  requestLoadSettings: () => void;
  requestLoadProviderData: () => void;
  requestLoadRulesAndTags: () => void;
  requestLoadConversations: () => void;
  requestLoadProjects: () => void;
  requestLoadDbMods: () => void;
  setLoadedMods: (loadedMods: any[]) => void;
  getConversationById: (id: string | null) => any;
  getEffectiveProjectSettings: (projectId: string | null) => any;
  initializePromptState: (settings: any) => void; // This will be unused after refactor
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

export async function loadCoreData(
  _stores: CoreStores,
  modApi: LiteChatModApi
): Promise<void> {
  console.log("[Init] Core Data: Applying bundled configuration...");
  
  // Apply bundled user configuration first, before loading data
  await BundledConfigService.applyBundledConfig();

  console.log("[Init] Core Data: Requesting loads...");
  modApi.emit(settingsEvent.loadSettingsRequest, undefined);
  modApi.emit(providerEvent.loadInitialDataRequest, undefined);
  modApi.emit(rulesEvent.loadRulesAndTagsRequest, undefined);
  modApi.emit(conversationEvent.loadConversationsRequest, undefined);
  modApi.emit(projectEvent.loadProjectsRequest, undefined);

  await new Promise<void>((resolve) => {
    let settingsLoaded = false;
    let providersLoaded = false;
    let rulesLoaded = false;
    let conversationsLoaded = false;
    let projectsLoaded = false;

    const checkDone = () => {
      if (
        settingsLoaded &&
        providersLoaded &&
        rulesLoaded &&
        conversationsLoaded &&
        projectsLoaded
      ) {
        resolve();
      }
    };

    const unsubSettings = modApi.on(settingsEvent.loaded, () => {
      settingsLoaded = true;
      unsubSettings();
      checkDone();
    });
    const unsubProvider = modApi.on(providerEvent.initialDataLoaded, () => {
      providersLoaded = true;
      unsubProvider();
      checkDone();
    });
    const unsubRules = modApi.on(rulesEvent.dataLoaded, () => {
      rulesLoaded = true;
      unsubRules();
      checkDone();
    });
    const unsubConversations = modApi.on(
      conversationEvent.conversationsLoaded,
      () => {
        conversationsLoaded = true;
        unsubConversations();
        checkDone();
      }
    );
    const unsubProjects = modApi.on(projectEvent.loaded, () => {
      projectsLoaded = true;
      unsubProjects();
      checkDone();
    });
  });
  emitter.emit(appEvent.initializationPhaseCompleted, { phase: "coreData" });
  console.log("[Init] Core Data: Loaded (or load requested).");

  // Start background sync operations after core data is loaded
  setTimeout(() => {
    StartupSyncService.runStartupSync().catch(error => {
      console.warn("[Init] Startup sync failed:", error);
    });
  }, 1000);
}

export async function initializeControlModules(
  moduleConstructors: ControlModuleConstructor[],
  modApi: LiteChatModApi
): Promise<ControlModule[]> {
  console.log(
    "[Init] Control Modules: Instantiation & Dependency Resolution START"
  );
  const moduleInstances = moduleConstructors.map((Ctor) => new Ctor(modApi));

  // After module instantiation, register translations
  for (const Module of moduleConstructors) {
    if (Module.translations) {
      const language = i18next.language;
      if (Module.translations[language]) {
        const namespaces = Module.translations[language];
        for (const [ns, resources] of Object.entries(namespaces)) {
          i18next.addResourceBundle(language, ns, resources, true, true);
        }
      }
    }
  }

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
  emitter.emit(appEvent.initializationPhaseCompleted, {
    phase: "controlModulesInit",
  });
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
  emitter.emit(appEvent.initializationPhaseCompleted, {
    phase: "controlModulesRegister",
  });
  console.log("[Init] Control Modules: Registration COMPLETE.");
}

export async function loadAndProcessMods(
  _stores: CoreStores,
  modApi: LiteChatModApi
): Promise<void> {
  console.log("[Init] External Mods: Loading DB records...");
  modApi.emit(modEvent.loadDbModsRequest, undefined);
  await new Promise<void>((resolve) => {
    const unsub = modApi.on(modEvent.dbModsLoaded, () => {
      unsub();
      resolve();
    });
  });

  const currentDbMods = useModStore.getState().dbMods;
  console.log(
    `[Init] External Mods: Processing ${currentDbMods.length} mods...`
  );
  const loadedModInstances = await loadMods(currentDbMods);
  useModStore.getState().setLoadedMods(loadedModInstances);
  emitter.emit(appEvent.initializationPhaseCompleted, {
    phase: "externalMods",
  });
  console.log(
    `[Init] External Mods: ${loadedModInstances.length} mods processed.`
  );
}

export function initializeCoreUiStates(
  stores: CoreStores,
  modApi: LiteChatModApi
): void {
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

  modApi.emit(promptStateEvent.initializePromptStateRequest, {
    effectiveSettings: initialEffectiveSettings,
  });
  emitter.emit(appEvent.initializationPhaseCompleted, { phase: "uiStateSync" });
  console.log(
    "[Init] Core UI States: Initial prompt state synchronization requested."
  );
}

export async function performFullInitialization(
  moduleConstructors: ControlModuleConstructor[],
  coreModApi: LiteChatModApi
): Promise<ControlModule[]> {
  console.log("[Init] LiteChat Full Initialization START");
  // emitter.emit(appEvent.initializationPhaseStarted, { phase: "full" }); // Event does not exist, removing

  // Initialize core services event handlers early
  InteractionService.initializeCanvasEventHandlers();

  // Define CoreStores object with current store states and actions
  const stores: CoreStores = {
    requestLoadSettings: () =>
      coreModApi.emit(settingsEvent.loadSettingsRequest, undefined),
    requestLoadProviderData: () =>
      coreModApi.emit(providerEvent.loadInitialDataRequest, undefined),
    requestLoadRulesAndTags: () =>
      coreModApi.emit(rulesEvent.loadRulesAndTagsRequest, undefined),
    requestLoadConversations: () =>
      coreModApi.emit(conversationEvent.loadConversationsRequest, undefined),
    requestLoadProjects: () =>
      coreModApi.emit(projectEvent.loadProjectsRequest, undefined),
    requestLoadDbMods: () =>
      coreModApi.emit(modEvent.loadDbModsRequest, undefined),
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
    await loadCoreData(stores, coreModApi);
    initializedModules = await initializeControlModules(
      moduleConstructors,
      coreModApi
    );
    registerControlModules(initializedModules, coreModApi);
    await loadAndProcessMods(stores, coreModApi);
    initializeCoreUiStates(stores, coreModApi);
    emitter.emit(appEvent.initializationPhaseCompleted, { phase: "all" });
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
