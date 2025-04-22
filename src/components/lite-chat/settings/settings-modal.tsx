// src/components/lite-chat/settings/settings-modal.tsx
import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { SettingsGeneral } from "./settings-general";
import { SettingsAssistant } from "./settings-assistant";
import { SettingsApiKeys } from "./settings-api-keys";
import { SettingsDataManagement } from "./settings-data-management";
import { SettingsMods } from "./settings-mods";
import { SettingsProviders } from "./settings-providers";
import type {
  CustomSettingTab,
  DbProviderConfig,
  DbApiKey,
  DbMod,
  ModInstance,
} from "@/lib/types";
// REMOVED: import type { SettingsModalTabProps } from "../chat";

// Define individual props based on SettingsModalTabProps
interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  // General Settings Props
  theme: "light" | "dark" | "system";
  setTheme: (theme: "light" | "dark" | "system") => void;
  streamingRefreshRateMs: number;
  setStreamingRefreshRateMs: (rate: number) => void;
  // Provider Settings Props
  dbProviderConfigs: DbProviderConfig[];
  apiKeys: DbApiKey[];
  addDbProviderConfig: (
    config: Omit<DbProviderConfig, "id" | "createdAt" | "updatedAt">,
  ) => Promise<string>;
  updateDbProviderConfig: (
    id: string,
    changes: Partial<DbProviderConfig>,
  ) => Promise<void>;
  deleteDbProviderConfig: (id: string) => Promise<void>;
  fetchModels: (providerConfigId: string) => Promise<void>;
  providerFetchStatus: Record<
    string,
    "idle" | "fetching" | "error" | "success"
  >;
  getAllAvailableModelDefs: (
    providerConfigId: string,
  ) => { id: string; name: string }[];
  // Assistant Settings Props
  globalSystemPrompt: string | null;
  setGlobalSystemPrompt: (prompt: string | null) => void;
  // API Key Settings Props
  addApiKey: (
    name: string,
    providerId: string,
    value: string,
  ) => Promise<string>;
  deleteApiKey: (id: string) => Promise<void>;
  // Data Management Props
  importConversation: (file: File, parentId: string | null) => Promise<void>;
  exportAllConversations: () => Promise<void>;
  clearAllData: () => Promise<void>;
  // Mod Settings Props
  dbMods: DbMod[];
  loadedMods: ModInstance[];
  addDbMod: (modData: Omit<DbMod, "id" | "createdAt">) => Promise<string>;
  updateDbMod: (id: string, changes: Partial<DbMod>) => Promise<void>;
  deleteDbMod: (id: string) => Promise<void>;
  // Feature Flags
  enableAdvancedSettings: boolean;
  enableApiKeyManagement: boolean;
  // Custom Tabs
  customSettingsTabs: CustomSettingTab[];
}

const SettingsModalComponent: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  // Destructure all individual props
  theme,
  setTheme,
  streamingRefreshRateMs,
  setStreamingRefreshRateMs,
  dbProviderConfigs,
  apiKeys,
  addDbProviderConfig,
  updateDbProviderConfig,
  deleteDbProviderConfig,
  fetchModels,
  providerFetchStatus,
  getAllAvailableModelDefs,
  globalSystemPrompt,
  setGlobalSystemPrompt,
  addApiKey,
  deleteApiKey,
  importConversation,
  exportAllConversations,
  clearAllData,
  dbMods,
  loadedMods,
  addDbMod,
  updateDbMod,
  deleteDbMod,
  enableAdvancedSettings,
  enableApiKeyManagement,
  customSettingsTabs,
}) => {
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
  };

  // Create the context object needed for custom tabs dynamically
  const customTabContext = {
    theme,
    setTheme,
    dbProviderConfigs,
    apiKeys,
    addDbProviderConfig,
    updateDbProviderConfig,
    deleteDbProviderConfig,
    fetchModels,
    providerFetchStatus,
    getAllAvailableModelDefs,
    globalSystemPrompt,
    setGlobalSystemPrompt,
    addApiKey,
    deleteApiKey,
    importConversation,
    exportAllConversations,
    clearAllData,
    dbMods,
    loadedMods,
    addDbMod,
    updateDbMod,
    deleteDbMod,
    enableAdvancedSettings,
    enableApiKeyManagement,
    customSettingsTabs,
    streamingRefreshRateMs,
    setStreamingRefreshRateMs,
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[1200px] w-[90vw] h-[80vh] min-h-[550px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Manage application settings, AI behavior, API keys, providers, and
            data.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-grow overflow-y-auto py-4 pr-2">
          <Tabs defaultValue="general">
            <TabsList className="flex-shrink-0 sticky top-0 bg-background z-10 mb-4 flex-wrap h-auto justify-start">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="providers">Providers</TabsTrigger>
              {enableAdvancedSettings && (
                <TabsTrigger value="assistant">Assistant</TabsTrigger>
              )}
              {enableApiKeyManagement && (
                <TabsTrigger value="apiKeys">API Keys</TabsTrigger>
              )}
              <TabsTrigger value="data">Data</TabsTrigger>
              <TabsTrigger value="mods">Mods</TabsTrigger>
              {customSettingsTabs.map((tab: CustomSettingTab) => (
                <TabsTrigger key={tab.id} value={tab.id}>
                  {tab.title}
                </TabsTrigger>
              ))}
            </TabsList>

            <div>
              <TabsContent value="general">
                {/* Pass individual props */}
                <SettingsGeneral
                  theme={theme}
                  setTheme={setTheme}
                  streamingRefreshRateMs={streamingRefreshRateMs}
                  setStreamingRefreshRateMs={setStreamingRefreshRateMs}
                  // Pass other general props if SettingsGeneral needs them
                />
              </TabsContent>
              <TabsContent value="providers">
                {/* Pass individual props */}
                <SettingsProviders
                  dbProviderConfigs={dbProviderConfigs}
                  apiKeys={apiKeys}
                  addDbProviderConfig={addDbProviderConfig}
                  updateDbProviderConfig={updateDbProviderConfig}
                  deleteDbProviderConfig={deleteDbProviderConfig}
                  fetchModels={fetchModels}
                  providerFetchStatus={providerFetchStatus}
                  getAllAvailableModelDefs={getAllAvailableModelDefs}
                />
              </TabsContent>
              {enableAdvancedSettings && (
                <TabsContent value="assistant">
                  {/* Pass individual props */}
                  <SettingsAssistant
                    globalSystemPrompt={globalSystemPrompt}
                    setGlobalSystemPrompt={setGlobalSystemPrompt}
                  />
                </TabsContent>
              )}
              {enableApiKeyManagement && (
                <TabsContent value="apiKeys">
                  {/* Pass individual props */}
                  <SettingsApiKeys
                    apiKeys={apiKeys}
                    addApiKey={addApiKey}
                    deleteApiKey={deleteApiKey}
                    dbProviderConfigs={dbProviderConfigs}
                    enableApiKeyManagement={enableApiKeyManagement}
                  />
                </TabsContent>
              )}
              <TabsContent value="data">
                {/* Pass individual props */}
                <SettingsDataManagement
                  importConversation={importConversation}
                  exportAllConversations={exportAllConversations}
                  clearAllData={clearAllData}
                />
              </TabsContent>
              <TabsContent value="mods">
                {/* Pass individual props */}
                <SettingsMods
                  dbMods={dbMods}
                  loadedMods={loadedMods}
                  addDbMod={addDbMod}
                  updateDbMod={updateDbMod}
                  deleteDbMod={deleteDbMod}
                />
              </TabsContent>
              {customSettingsTabs.map((tab: CustomSettingTab) => (
                <TabsContent key={tab.id} value={tab.id}>
                  {/* Pass the dynamically created context object */}
                  <tab.component context={customTabContext as any} />
                </TabsContent>
              ))}
            </div>
          </Tabs>
        </div>

        <DialogFooter className="flex-shrink-0 border-t pt-4">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const SettingsModal = React.memo(SettingsModalComponent);
