// src/components/LiteChat/settings/settings-modal.tsx
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
import { SettingsGeneral } from "./SettingsGeneral"; // Correct import
import { SettingsAssistant } from "./SettingsAssistant";
import { SettingsApiKeys } from "./SettingsApiKeys";
import { SettingsDataManagement } from "./SettingsDataManagement";
import { SettingsMods } from "./SettingsMods";
import { SettingsProviders } from "./SettingsProviders";
// Corrected import path and type name
import type { CustomSettingTab } from "@/types/litechat/modding";

import { useShallow } from "zustand/react/shallow";
import { useSettingsStore } from "@/store/settings.store";
import { useModStore } from "@/store/mod.store";

// Corrected import and added type export
import { useProviderStore, type ProviderState } from "@/store/provider.store";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsModalComponent: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { enableAdvancedSettings } = useSettingsStore(
    useShallow((state) => ({
      enableAdvancedSettings: state.enableAdvancedSettings, // Now exists
    })),
  );
  const { enableApiKeyManagement } = useProviderStore(
    useShallow((state: ProviderState) => ({
      enableApiKeyManagement: state.enableApiKeyManagement, // Now exists
    })),
  );
  // Assuming modSettingsTabs will be added to ModStore
  const { customSettingsTabs } = useModStore(
    useShallow((state) => ({
      customSettingsTabs: state.modSettingsTabs || [], // Use default empty array
    })),
  );

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
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
              {/* Render custom mod tabs */}
              {customSettingsTabs.map((tab: CustomSettingTab) => (
                <TabsTrigger key={tab.id} value={tab.id}>
                  {tab.title}
                </TabsTrigger>
              ))}
            </TabsList>

            <div>
              <TabsContent value="general">
                {/* SettingsGeneral uses useSettingsStore */}
                <SettingsGeneral />
              </TabsContent>
              <TabsContent value="providers">
                {/* SettingsProviders uses useProviderStore */}
                <SettingsProviders />
              </TabsContent>
              {enableAdvancedSettings && (
                <TabsContent value="assistant">
                  {/* SettingsAssistant uses useSettingsStore */}
                  <SettingsAssistant />
                </TabsContent>
              )}
              {enableApiKeyManagement && (
                <TabsContent value="apiKeys">
                  {/* SettingsApiKeys uses useProviderStore */}
                  <SettingsApiKeys />
                </TabsContent>
              )}
              <TabsContent value="data">
                {/* SettingsDataManagement uses useConversationStore and PersistenceService */}
                <SettingsDataManagement />
              </TabsContent>
              <TabsContent value="mods">
                {/* SettingsMods uses useModStore */}
                <SettingsMods />
              </TabsContent>
              {/* Render custom mod tab content */}
              {customSettingsTabs.map((tab: CustomSettingTab) => (
                <TabsContent key={tab.id} value={tab.id}>
                  {/* Render the component provided by the mod */}
                  {/* Ensure tab.component is a valid React component */}
                  {React.isValidElement(tab.component) ? (
                    tab.component
                  ) : typeof tab.component === "function" ? (
                    <tab.component />
                  ) : null}
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
