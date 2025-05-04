// src/components/LiteChat/settings/SettingsModal.tsx
// FULL FILE
import React, { memo, useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SettingsGeneral } from "./SettingsGeneral";
import { SettingsAssistant } from "./SettingsAssistant";
import { SettingsDataManagement } from "./SettingsDataManagement";
import { SettingsMods } from "./SettingsMods";
import { SettingsProviders } from "./SettingsProviders";
import { SettingsGit } from "./SettingsGit";
// Import the new settings component
import { SettingsRulesAndTags } from "./SettingsRulesAndTags";
import type { CustomSettingTab } from "@/types/litechat/modding";
import { useShallow } from "zustand/react/shallow";
import { useSettingsStore } from "@/store/settings.store";
import { useModStore } from "@/store/mod.store";
import { useUIStateStore } from "@/store/ui.store";
import { TabbedLayout, TabDefinition } from "../common/TabbedLayout";

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
    const { customSettingsTabs } = useModStore(
      useShallow((state) => ({
        customSettingsTabs: state.modSettingsTabs || [],
      })),
    );
    const { initialSettingsTab, clearInitialSettingsTabs } = useUIStateStore(
      useShallow((state) => ({
        initialSettingsTab: state.initialSettingsTab,
        clearInitialSettingsTabs: state.clearInitialSettingsTabs,
      })),
    );

    // Local state to manage the active tab, initialized from store
    const [activeTab, setActiveTab] = useState(initialSettingsTab || "general");

    // Effect to update local state if the initial tab state changes while modal is open
    useEffect(() => {
      if (isOpen) {
        setActiveTab(initialSettingsTab || "general");
      }
    }, [isOpen, initialSettingsTab]);

    const handleOpenChange = (open: boolean) => {
      if (!open) {
        onClose();
        clearInitialSettingsTabs();
      }
    };

    const handleTabChange = (value: string) => {
      setActiveTab(value);
    };

    // Define tabs for the layout
    const tabs = useMemo(() => {
      const coreTabs: TabDefinition[] = [
        {
          value: "general",
          label: "General",
          content: <SettingsGeneral />,
        },
        {
          value: "providers",
          label: "Providers & Models",
          content: <SettingsProviders />,
        },
        ...(enableAdvancedSettings
          ? [
              {
                value: "assistant",
                label: "Assistant",
                content: <SettingsAssistant />,
              } as TabDefinition,
            ]
          : []),
        // Add the new Rules & Tags tab
        {
          value: "rules-tags",
          label: "Rules & Tags",
          content: <SettingsRulesAndTags />,
        },
        {
          value: "git",
          label: "Git",
          content: <SettingsGit />,
        },
        {
          value: "data",
          label: "Data",
          content: <SettingsDataManagement />,
        },
        {
          value: "mods",
          label: "Mods",
          content: <SettingsMods />,
        },
      ];

      const modTabs: TabDefinition[] = customSettingsTabs.map(
        (tab: CustomSettingTab) => ({
          value: tab.id,
          label: tab.title,
          content: React.isValidElement(tab.component) ? (
            tab.component
          ) : typeof tab.component === "function" ? (
            <tab.component />
          ) : null,
        }),
      );

      return [...coreTabs, ...modTabs];
    }, [enableAdvancedSettings, customSettingsTabs]);

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

          {/* Use TabbedLayout for the main settings sections */}
          <TabbedLayout
            tabs={tabs}
            initialValue={activeTab} // Pass initial value
            onValueChange={handleTabChange} // Handle value changes
            className="flex-grow overflow-hidden px-6" // Adjust padding if needed
            listClassName="-mx-6 px-6" // Adjust list padding
            contentContainerClassName="flex-grow overflow-y-auto pb-6 pr-2 -mr-2" // Ensure content grows and scrolls
            scrollable={true}
          />

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
