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
  // Removed unused types
  // DbProviderConfig,
  // DbApiKey,
  // DbMod,
  // ModInstance,
} from "@/lib/types";
// Import store hooks
import { useShallow } from "zustand/react/shallow";
import { useSettingsStore } from "@/store/settings.store";
import { useModStore } from "@/store/mod.store";
// Import useProviderStore and ProviderState
import { useProviderStore, type ProviderState } from "@/store/provider.store";
// Removed unused store imports

// Remove props interface, keep only isOpen and onClose
interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsModalComponent: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  // --- Fetch state from stores ---
  const { enableAdvancedSettings } = useSettingsStore(
    useShallow((state) => ({
      enableAdvancedSettings: state.enableAdvancedSettings,
    })),
  );
  // Add type annotation here
  const { enableApiKeyManagement } = useProviderStore(
    useShallow((state: ProviderState) => ({
      enableApiKeyManagement: state.enableApiKeyManagement,
    })),
  );
  const { customSettingsTabs } = useModStore(
    useShallow((state) => ({
      customSettingsTabs: state.modSettingsTabs,
    })),
  );

  // --- Callbacks ---
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
  };

  // --- Custom Tab Context (Placeholder - Custom tabs need refactoring) ---
  // Custom tabs will need to be refactored to use store hooks directly
  // instead of relying on a passed context object.
  // For now, we'll pass an empty object or remove the prop entirely.
  const customTabContext = {}; // Placeholder

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
                {/* SettingsGeneral will fetch its own data */}
                <SettingsGeneral />
              </TabsContent>
              <TabsContent value="providers">
                {/* SettingsProviders will fetch its own data */}
                <SettingsProviders />
              </TabsContent>
              {enableAdvancedSettings && (
                <TabsContent value="assistant">
                  {/* SettingsAssistant will fetch its own data */}
                  <SettingsAssistant />
                </TabsContent>
              )}
              {enableApiKeyManagement && (
                <TabsContent value="apiKeys">
                  {/* SettingsApiKeys will fetch its own data */}
                  <SettingsApiKeys />
                </TabsContent>
              )}
              <TabsContent value="data">
                {/* SettingsDataManagement will fetch its own data */}
                <SettingsDataManagement />
              </TabsContent>
              <TabsContent value="mods">
                {/* SettingsMods will fetch its own data */}
                <SettingsMods />
              </TabsContent>
              {customSettingsTabs.map((tab: CustomSettingTab) => (
                <TabsContent key={tab.id} value={tab.id}>
                  {/* Pass placeholder context - needs refactor */}
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
