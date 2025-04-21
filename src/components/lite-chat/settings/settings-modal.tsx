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
// REMOVED store imports
import type { CustomSettingTab } from "@/lib/types";
// Import the bundled props type from chat.tsx
import type { SettingsModalTabProps } from "../chat";

// Define props based on what ChatSide passes down
interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settingsProps: SettingsModalTabProps; // Receive the bundled props
}

// Wrap component logic in a named function for React.memo
const SettingsModalComponent: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settingsProps, // Destructure the bundled props
}) => {
  // REMOVED store access

  // Handle modal open/close via props/callback
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
  };

  // Destructure props needed for conditional rendering and passing down
  const {
    enableAdvancedSettings,
    enableApiKeyManagement,
    customSettingsTabs,
    // Destructure all other props needed by tabs
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
  } = settingsProps;

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
              {/* Use customSettingsTabs from props */}
              {customSettingsTabs.map((tab: CustomSettingTab) => (
                <TabsTrigger key={tab.id} value={tab.id}>
                  {tab.title}
                </TabsTrigger>
              ))}
            </TabsList>

            <div>
              {/* Pass necessary props down to each settings tab */}
              <TabsContent value="general">
                <SettingsGeneral theme={theme} setTheme={setTheme} />
              </TabsContent>
              <TabsContent value="providers">
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
                  <SettingsAssistant
                    globalSystemPrompt={globalSystemPrompt}
                    setGlobalSystemPrompt={setGlobalSystemPrompt}
                  />
                </TabsContent>
              )}
              {enableApiKeyManagement && (
                <TabsContent value="apiKeys">
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
                <SettingsDataManagement
                  importConversation={importConversation}
                  exportAllConversations={exportAllConversations}
                  clearAllData={clearAllData}
                />
              </TabsContent>
              <TabsContent value="mods">
                <SettingsMods
                  dbMods={dbMods}
                  loadedMods={loadedMods}
                  addDbMod={addDbMod}
                  updateDbMod={updateDbMod}
                  deleteDbMod={deleteDbMod}
                />
              </TabsContent>
              {/* Render custom tabs from props */}
              {customSettingsTabs.map((tab: CustomSettingTab) => (
                <TabsContent key={tab.id} value={tab.id}>
                  {/* Custom tabs need a way to get context/props */}
                  {/* This requires a more defined API for custom tabs */}
                  <tab.component context={{} as any} />
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

// Export the memoized component
export const SettingsModal = React.memo(SettingsModalComponent);
