// src/components/LiteChat/settings/SettingsModal.tsx
// Ensure the entire file content is provided
import React, { memo, useState, useEffect } from "react"; // Import useState, useEffect
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
// Removed SettingsApiKeys import (now part of SettingsProviders)
import { SettingsDataManagement } from "./SettingsDataManagement";
import { SettingsMods } from "./SettingsMods";
import { SettingsProviders } from "./SettingsProviders";
// Removed GlobalModelOrganizer import (now part of SettingsProviders)
// Removed SettingsGitConfig import (now part of SettingsGit)
// Removed SettingsGitSyncRepos import (now part of SettingsGit)
import { SettingsGit } from "./SettingsGit"; // Import the combined Git settings component
import type { CustomSettingTab } from "@/types/litechat/modding";

import { useShallow } from "zustand/react/shallow";
import { useSettingsStore } from "@/store/settings.store";
// Removed ProviderStore import (API key check moved)
import { useModStore } from "@/store/mod.store";
import { useUIStateStore } from "@/store/ui.store"; // Import UI store
import { cn } from "@/lib/utils";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsModalComponent: React.FC<SettingsModalProps> = memo(
  ({ isOpen, onClose }) => {
    const { enableAdvancedSettings } = useSettingsStore(
      useShallow((state) => ({
        enableAdvancedSettings: state.enableAdvancedSettings,
      })),
    );
    // Removed enableApiKeyManagement check here
    const { customSettingsTabs } = useModStore(
      useShallow((state) => ({
        customSettingsTabs: state.modSettingsTabs || [],
      })),
    );
    // Get initial tab state and clear action from UI store
    const {
      initialSettingsTab,
      // initialSettingsSubTab, // keep, might need later
      clearInitialSettingsTabs,
    } = useUIStateStore(
      useShallow((state) => ({
        initialSettingsTab: state.initialSettingsTab,
        initialSettingsSubTab: state.initialSettingsSubTab,
        clearInitialSettingsTabs: state.clearInitialSettingsTabs,
      })),
    );

    // Local state to manage the active tab, initialized from store
    const [activeTab, setActiveTab] = useState(initialSettingsTab || "general");
    // Removed activeSubTab state as sub-tabs are managed within their parent components now

    // Effect to update local state if the initial tab state changes while modal is open
    useEffect(() => {
      if (isOpen) {
        setActiveTab(initialSettingsTab || "general");
        // No need to set sub-tab here
      }
    }, [isOpen, initialSettingsTab]);

    const handleOpenChange = (open: boolean) => {
      if (!open) {
        onClose();
        // Clear the initial tab state when the dialog is closed
        clearInitialSettingsTabs();
      }
    };

    // Update local state when tab changes
    const handleTabChange = (value: string) => {
      setActiveTab(value);
      // No need to reset sub-tab here
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

          {/* Main Tabs */}
          <Tabs
            // Use local state for value and update on change
            value={activeTab}
            onValueChange={handleTabChange}
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

            {/* Use overflow-y-auto on the container for tab content */}
            <div className="flex-grow overflow-y-auto pb-6 pr-2 -mr-2">
              <TabsContent value="general">
                <SettingsGeneral />
              </TabsContent>

              {/* Providers content now directly renders SettingsProviders */}
              <TabsContent
                value="providers"
                className="data-[state=inactive]:hidden" // Keep content mounted but hidden
              >
                <SettingsProviders />
              </TabsContent>

              {enableAdvancedSettings && (
                <TabsContent value="assistant">
                  <SettingsAssistant />
                </TabsContent>
              )}

              {/* Git content now directly renders SettingsGit */}
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
SettingsModalComponent.displayName = "SettingsModalComponent";

export const SettingsModal = SettingsModalComponent;
