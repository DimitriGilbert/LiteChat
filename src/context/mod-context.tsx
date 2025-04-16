// src/context/mod-context.tsx
import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  useCallback,
} from "react";
import type {
  CustomPromptAction,
  CustomMessageAction,
  CustomSettingTab,
} from "@/lib/types";
import { DbMod, ModInstance } from "@/mods/types";
import { useChatStorage } from "@/hooks/use-chat-storage";
import { nanoid } from "nanoid";

const EMPTY_MOD_INSTANCES: ModInstance[] = [];
const EMPTY_DB_MODS: DbMod[] = [];

interface ModContextProps {
  dbMods: DbMod[];
  loadedMods: ModInstance[];
  addDbMod: (modData: Omit<DbMod, "id" | "createdAt">) => Promise<string>;
  updateDbMod: (id: string, changes: Partial<DbMod>) => Promise<void>;
  deleteDbMod: (id: string) => Promise<void>;
  modPromptActions: CustomPromptAction[];
  modMessageActions: CustomMessageAction[];
  modSettingsTabs: CustomSettingTab[];
  // Functions to be called by ChatProvider during mod loading
  _setLoadedMods: React.Dispatch<React.SetStateAction<ModInstance[]>>;
  _registerModPromptAction: (action: CustomPromptAction) => () => void;
  _registerModMessageAction: (action: CustomMessageAction) => () => void;
  _registerModSettingsTab: (tab: CustomSettingTab) => () => void;
  _clearRegisteredModItems: () => void;
}

const ModContext = createContext<ModContextProps | undefined>(undefined);

interface ModProviderProps {
  children: React.ReactNode;
}

export const ModProvider: React.FC<ModProviderProps> = ({ children }) => {
  const storage = useChatStorage();
  const [loadedMods, setLoadedMods] =
    useState<ModInstance[]>(EMPTY_MOD_INSTANCES);
  const [modPromptActions, setModPromptActions] = useState<
    CustomPromptAction[]
  >([]);
  const [modMessageActions, setModMessageActions] = useState<
    CustomMessageAction[]
  >([]);
  const [modSettingsTabs, setModSettingsTabs] = useState<CustomSettingTab[]>(
    [],
  );

  const registerModPromptAction = useCallback(
    (action: CustomPromptAction): (() => void) => {
      const actionId = action.id || nanoid();
      const actionWithId = { ...action, id: actionId };
      setModPromptActions((prev) => [...prev, actionWithId]);
      return () => {
        setModPromptActions((prev) => prev.filter((a) => a.id !== actionId));
      };
    },
    [],
  );

  const registerModMessageAction = useCallback(
    (action: CustomMessageAction): (() => void) => {
      const actionId = action.id || nanoid();
      const actionWithId = { ...action, id: actionId };
      setModMessageActions((prev) => [...prev, actionWithId]);
      return () => {
        setModMessageActions((prev) => prev.filter((a) => a.id !== actionId));
      };
    },
    [],
  );

  const registerModSettingsTab = useCallback(
    (tab: CustomSettingTab): (() => void) => {
      const tabId = tab.id || nanoid();
      const tabWithId = { ...tab, id: tabId };
      setModSettingsTabs((prev) => [...prev, tabWithId]);
      return () => {
        setModSettingsTabs((prev) => prev.filter((t) => t.id !== tabId));
      };
    },
    [],
  );

  const clearRegisteredModItems = useCallback(() => {
    setModPromptActions([]);
    setModMessageActions([]);
    setModSettingsTabs([]);
  }, []);

  const value = useMemo(
    () => ({
      dbMods: storage.mods || EMPTY_DB_MODS,
      loadedMods,
      addDbMod: storage.addMod,
      updateDbMod: storage.updateMod,
      deleteDbMod: storage.deleteMod,
      modPromptActions,
      modMessageActions,
      modSettingsTabs,
      _setLoadedMods: setLoadedMods,
      _registerModPromptAction: registerModPromptAction,
      _registerModMessageAction: registerModMessageAction,
      _registerModSettingsTab: registerModSettingsTab,
      _clearRegisteredModItems: clearRegisteredModItems,
    }),
    [
      storage.mods,
      loadedMods,
      storage.addMod,
      storage.updateMod,
      storage.deleteMod,
      modPromptActions,
      modMessageActions,
      modSettingsTabs,
      registerModPromptAction,
      registerModMessageAction,
      registerModSettingsTab,
      clearRegisteredModItems,
    ],
  );

  return <ModContext.Provider value={value}>{children}</ModContext.Provider>;
};

export const useModContext = (): ModContextProps => {
  const context = useContext(ModContext);
  if (context === undefined) {
    throw new Error("useModContext must be used within a ModProvider");
  }
  return context;
};
