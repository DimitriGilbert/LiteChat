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
  settingsProps, // Destructure the bundled props object itself
}) => {
  // REMOVED store access

  // Handle modal open/close via props/callback
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
  };

  // Destructure only flags needed for conditional rendering here
  const {
    enableAdvancedSettings,
    enableApiKeyManagement,
    customSettingsTabs,
    // Pass the rest of settingsProps down directly where needed
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
              {/* Pass the entire settingsProps bundle down */}
              <TabsContent value="general">
                <SettingsGeneral settingsProps={settingsProps} />
              </TabsContent>
              <TabsContent value="providers">
                {/* SettingsProviders needs specific props, keep destructuring */}
                <SettingsProviders
                  dbProviderConfigs={settingsProps.dbProviderConfigs}
                  apiKeys={settingsProps.apiKeys}
                  addDbProviderConfig={settingsProps.addDbProviderConfig}
                  updateDbProviderConfig={settingsProps.updateDbProviderConfig}
                  deleteDbProviderConfig={settingsProps.deleteDbProviderConfig}
                  fetchModels={settingsProps.fetchModels}
                  providerFetchStatus={settingsProps.providerFetchStatus}
                  getAllAvailableModelDefs={
                    settingsProps.getAllAvailableModelDefs
                  }
                />
              </TabsContent>
              {enableAdvancedSettings && (
                <TabsContent value="assistant">
                  <SettingsAssistant
                    globalSystemPrompt={settingsProps.globalSystemPrompt}
                    setGlobalSystemPrompt={settingsProps.setGlobalSystemPrompt}
                  />
                </TabsContent>
              )}
              {enableApiKeyManagement && (
                <TabsContent value="apiKeys">
                  <SettingsApiKeys
                    apiKeys={settingsProps.apiKeys}
                    addApiKey={settingsProps.addApiKey}
                    deleteApiKey={settingsProps.deleteApiKey}
                    dbProviderConfigs={settingsProps.dbProviderConfigs}
                    enableApiKeyManagement={
                      settingsProps.enableApiKeyManagement
                    }
                  />
                </TabsContent>
              )}
              <TabsContent value="data">
                <SettingsDataManagement
                  importConversation={settingsProps.importConversation}
                  exportAllConversations={settingsProps.exportAllConversations}
                  clearAllData={settingsProps.clearAllData}
                />
              </TabsContent>
              <TabsContent value="mods">
                <SettingsMods
                  dbMods={settingsProps.dbMods}
                  loadedMods={settingsProps.loadedMods}
                  addDbMod={settingsProps.addDbMod}
                  updateDbMod={settingsProps.updateDbMod}
                  deleteDbMod={settingsProps.deleteDbMod}
                />
              </TabsContent>
              {/* Render custom tabs from props */}
              {customSettingsTabs.map((tab: CustomSettingTab) => (
                <TabsContent key={tab.id} value={tab.id}>
                  {/* Pass the context object to custom tabs */}
                  <tab.component context={settingsProps as any} />
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
