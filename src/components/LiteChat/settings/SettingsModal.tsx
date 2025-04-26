// src/components/LiteChat/settings/SettingsModal.tsx
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
import { SettingsGeneral } from "./SettingsGeneral";
import { SettingsAssistant } from "./SettingsAssistant";
import { SettingsApiKeys } from "./SettingsApiKeys";
import { SettingsDataManagement } from "./SettingsDataManagement";
import { SettingsMods } from "./SettingsMods";
import { SettingsProviders } from "./SettingsProviders";
import { GlobalModelOrganizer } from "./GlobalModelOrganizer";
// Separator is no longer needed here
import type { CustomSettingTab } from "@/types/litechat/modding";

import { useShallow } from "zustand/react/shallow";
import { useSettingsStore } from "@/store/settings.store";
import { useModStore } from "@/store/mod.store";
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
      enableAdvancedSettings: state.enableAdvancedSettings,
    })),
  );
  const { enableApiKeyManagement } = useProviderStore(
    useShallow((state: ProviderState) => ({
      enableApiKeyManagement: state.enableApiKeyManagement,
    })),
  );
  const { customSettingsTabs } = useModStore(
    useShallow((state) => ({
      customSettingsTabs: state.modSettingsTabs || [],
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

        {/* Outer Tabs for main sections */}
        <Tabs
          defaultValue="general"
          className="flex-grow flex flex-col overflow-hidden"
        >
          <TabsList className="flex-shrink-0 sticky top-0 bg-background z-10 mb-4 flex-wrap h-auto justify-start border-b">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="providers">Providers & Models</TabsTrigger>
            {enableAdvancedSettings && (
              <TabsTrigger value="assistant">Assistant</TabsTrigger>
            )}
            <TabsTrigger value="data">Data</TabsTrigger>
            <TabsTrigger value="mods">Mods</TabsTrigger>
            {customSettingsTabs.map((tab: CustomSettingTab) => (
              <TabsTrigger key={tab.id} value={tab.id}>
                {tab.title}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Content Area with scroll */}
          <div className="flex-grow overflow-y-auto pr-2 -mr-2">
            <TabsContent value="general">
              <SettingsGeneral />
            </TabsContent>

            {/* Providers Tab Content - Now contains nested tabs */}
            <TabsContent value="providers" className="h-full flex flex-col">
              {/* Nested Tabs for Provider Sub-sections */}
              <Tabs
                defaultValue="model-order" // Default to model order tab
                className="flex-grow flex flex-col overflow-hidden"
              >
                <TabsList className="flex-shrink-0">
                  <TabsTrigger value="model-order">
                    Global Model Order
                  </TabsTrigger>
                  <TabsTrigger value="provider-list">
                    Provider List & Config
                  </TabsTrigger>
                  {enableApiKeyManagement && (
                    <TabsTrigger value="api-keys">API Keys</TabsTrigger>
                  )}
                </TabsList>
                {/* Content for nested tabs */}
                <div className="flex-grow overflow-y-auto mt-4">
                  <TabsContent value="model-order">
                    {/* Global Organizer is now inside its own tab */}
                    <GlobalModelOrganizer />
                  </TabsContent>
                  <TabsContent value="provider-list" className="h-full">
                    <SettingsProviders />
                  </TabsContent>
                  {enableApiKeyManagement && (
                    <TabsContent value="api-keys">
                      <SettingsApiKeys />
                    </TabsContent>
                  )}
                </div>
              </Tabs>
            </TabsContent>

            {enableAdvancedSettings && (
              <TabsContent value="assistant">
                <SettingsAssistant />
              </TabsContent>
            )}
            <TabsContent value="data">
              <SettingsDataManagement />
            </TabsContent>
            <TabsContent value="mods">
              <SettingsMods />
            </TabsContent>
            {customSettingsTabs.map((tab: CustomSettingTab) => (
              <TabsContent key={tab.id} value={tab.id}>
                {React.isValidElement(tab.component) ? (
                  tab.component
                ) : typeof tab.component === "function" ? (
                  <tab.component />
                ) : null}
              </TabsContent>
            ))}
          </div>
        </Tabs>

        <DialogFooter className="flex-shrink-0 border-t pt-4 mt-4">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const SettingsModal = React.memo(SettingsModalComponent);
