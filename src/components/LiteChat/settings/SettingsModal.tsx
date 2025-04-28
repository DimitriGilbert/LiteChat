// src/components/LiteChat/settings/SettingsModal.tsx
import React, { memo } from "react"; // Import memo
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
import { SettingsGit } from "./SettingsGit"; // Import the new Git settings component
import type { CustomSettingTab } from "@/types/litechat/modding";

import { useShallow } from "zustand/react/shallow";
import { useSettingsStore } from "@/store/settings.store";
import { useProviderStore, type ProviderState } from "@/store/provider.store";
import { useModStore } from "@/store/mod.store";
import { cn } from "@/lib/utils";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Wrap the component function with React.memo
const SettingsModalComponent: React.FC<SettingsModalProps> = memo(
  ({ isOpen, onClose }) => {
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

    const tabTriggerClass = cn(
      "px-3 py-1.5 text-sm font-medium rounded-md",
      "text-muted-foreground",
      "border border-transparent",
      "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      "data-[state=active]:bg-primary/10 data-[state=active]:text-primary",
      "data-[state=active]:border-primary",
      "dark:data-[state=active]:bg-primary/20 dark:data-[state=active]:text-primary",
      "dark:data-[state=active]:border-primary/70",
      "hover:bg-muted/50 hover:text-primary/80",
    );

    return (
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-[1200px] w-[90vw] h-[80vh] min-h-[550px] max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="p-6 pb-4 flex-shrink-0">
            <DialogTitle>Settings</DialogTitle>
            <DialogDescription>
              Manage application settings, AI behavior, API keys, providers, and
              data.
            </DialogDescription>
          </DialogHeader>

          <Tabs
            defaultValue="general"
            className="flex-grow flex flex-col overflow-hidden px-6"
          >
            <TabsList className="flex-shrink-0 sticky top-0 bg-background z-10 mb-4 flex-wrap h-auto justify-start border-b gap-1 p-1 -mx-6 px-6">
              <TabsTrigger value="general" className={tabTriggerClass}>
                General
              </TabsTrigger>
              <TabsTrigger value="providers" className={tabTriggerClass}>
                Providers & Models
              </TabsTrigger>
              {enableAdvancedSettings && (
                <TabsTrigger value="assistant" className={tabTriggerClass}>
                  Assistant
                </TabsTrigger>
              )}
              {/* Add Git Tab Trigger */}
              <TabsTrigger value="git" className={tabTriggerClass}>
                Git
              </TabsTrigger>
              <TabsTrigger value="data" className={tabTriggerClass}>
                Data
              </TabsTrigger>
              <TabsTrigger value="mods" className={tabTriggerClass}>
                Mods
              </TabsTrigger>
              {customSettingsTabs.map((tab: CustomSettingTab) => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className={tabTriggerClass}
                >
                  {tab.title}
                </TabsTrigger>
              ))}
            </TabsList>

            <div className="flex-grow overflow-y-auto pb-6 pr-2 -mr-2">
              <TabsContent value="general">
                <SettingsGeneral />
              </TabsContent>

              <TabsContent
                value="providers"
                className="flex flex-col data-[state=inactive]:hidden"
              >
                <Tabs defaultValue="model-order" className="flex flex-col">
                  <TabsList className="flex-shrink-0 gap-1 p-1">
                    <TabsTrigger
                      value="model-order"
                      className={tabTriggerClass}
                    >
                      Global Model Order
                    </TabsTrigger>
                    <TabsTrigger
                      value="provider-list"
                      className={tabTriggerClass}
                    >
                      Provider List & Config
                    </TabsTrigger>
                    {enableApiKeyManagement && (
                      <TabsTrigger value="api-keys" className={tabTriggerClass}>
                        API Keys
                      </TabsTrigger>
                    )}
                  </TabsList>
                  <div className="mt-4">
                    <TabsContent value="model-order">
                      <GlobalModelOrganizer />
                    </TabsContent>
                    <TabsContent value="provider-list">
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
              {/* Add Git Tab Content */}
              <TabsContent value="git" className="h-full">
                <SettingsGit />
              </TabsContent>
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

          <DialogFooter className="flex-shrink-0 border-t p-6 pt-4 mt-auto">
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  },
);
// Add display name for React DevTools
SettingsModalComponent.displayName = "SettingsModalComponent";

export const SettingsModal = SettingsModalComponent; // Export the memoized component
