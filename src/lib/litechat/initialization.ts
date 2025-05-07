// src/lib/litechat/initialization.ts
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
import type { RegistrationFunction } from "@/components/LiteChat/LiteChat";

interface CoreStores {
  loadSettings: () => Promise<void>;
  loadProviderData: () => Promise<void>;
  loadRulesAndTags: () => Promise<void>;
  loadSidebarItems: () => Promise<void>;
  loadDbMods: () => Promise<void>;
  setLoadedMods: (loadedMods: any[]) => void; // Consider using ModInstance[] type
  getConversationById: (id: string | null) => any; // Consider using Conversation type
  getEffectiveProjectSettings: (projectId: string | null) => any; // Consider specific type
  initializePromptState: (settings: any) => void; // Consider specific type
  selectedItemId: string | null;
  selectedItemType: string | null;
}

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

export function registerControlsAndTools(
  controlsToRegister: RegistrationFunction[]
): void {
  console.log("LiteChat Init: Registering core controls and tools...");
  controlsToRegister.forEach((registerFn) => {
    try {
      registerFn();
    } catch (regError) {
      console.error(
        `LiteChat Init: Error running registration function:`,
        regError
      );
      toast.error(
        `Control registration error: ${
          regError instanceof Error ? regError.message : String(regError)
        }`
      );
    }
  });
  console.log("LiteChat Init: Core controls and tools registered.");
}

export async function loadAndProcessMods(stores: CoreStores): Promise<void> {
  console.log("LiteChat Init: Loading mods...");
  await stores.loadDbMods();
  console.log("LiteChat Init: DB Mods loaded.");
  const currentDbMods = useModStore.getState().dbMods; // Get fresh state
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
  controlsToRegister: RegistrationFunction[]
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

  try {
    await loadCoreData(stores);
    registerControlsAndTools(controlsToRegister);
    await loadAndProcessMods(stores);
    initializeCoreUiStates(stores); // This will use the latest state after loads
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
    throw error; // Re-throw to be caught by the top-level try/catch in LiteChat.tsx
  }
}
