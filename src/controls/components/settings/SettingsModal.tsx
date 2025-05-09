// src/components/LiteChat/settings/SettingsModal.tsx

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
import { SettingsRulesAndTags } from "./SettingsRulesAndTags";
import { SettingsTheme } from "./SettingsTheme";
import type { CustomSettingTab } from "@/types/litechat/modding";
import { useShallow } from "zustand/react/shallow";
import { useSettingsStore } from "@/store/settings.store";
import { useModStore } from "@/store/mod.store";
import { useUIStateStore } from "@/store/ui.store";
import {
  TabbedLayout,
  TabDefinition,
} from "@/components/LiteChat/common/TabbedLayout";
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
      }))
    );
    const { customSettingsTabs } = useModStore(
      useShallow((state) => ({
        customSettingsTabs: state.modSettingsTabs || [],
      }))
    );
    const { initialSettingsTab, clearInitialSettingsTabs } = useUIStateStore(
      useShallow((state) => ({
        initialSettingsTab: state.initialSettingsTab,
        clearInitialSettingsTabs: state.clearInitialSettingsTabs,
      }))
    );

    const [activeTab, setActiveTab] = useState(initialSettingsTab || "general");

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

    const tabs = useMemo(() => {
      const coreTabs: TabDefinition[] = [
        {
          value: "general",
          label: "General",
          content: <SettingsGeneral />,
        },
        {
          value: "theme",
          label: "Theme",
          content: <SettingsTheme />,
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
        })
      );

      return [...coreTabs, ...modTabs];
    }, [enableAdvancedSettings, customSettingsTabs]);

    return (
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent
          className={cn(
            // Base styles
            "w-[95vw] h-[90vh] flex flex-col p-0",
            // Responsive overrides
            "sm:w-[90vw] sm:h-[85vh]",
            "md:w-[85vw] md:max-w-[1200px] md:h-[80vh]",
            "lg:w-[75vw]",
            "min-h-[500px] max-h-[95vh]"
          )}
        >
          <DialogHeader className="p-4 md:p-6 pb-2 md:pb-4 flex-shrink-0">
            <DialogTitle>Settings</DialogTitle>
            <DialogDescription>
              Manage application settings, AI behavior, API keys, providers, and
              data.
            </DialogDescription>
          </DialogHeader>

          <TabbedLayout
            tabs={tabs}
            initialValue={activeTab}
            onValueChange={handleTabChange}
            className="flex-grow overflow-hidden px-4 md:px-6"
            // Adjust list padding for mobile
            listClassName="-mx-4 md:-mx-6 px-2 md:px-6 py-1 md:py-0"
            // Adjust content padding for mobile
            contentContainerClassName="flex-grow overflow-y-auto pb-4 md:pb-6 pr-1 md:pr-2 -mr-1 md:-mr-2"
            scrollable={true}
          />

          <DialogFooter className="flex-shrink-0 border-t p-4 md:p-6 pt-3 md:pt-4 mt-auto">
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
);
SettingsModalComponent.displayName = "SettingsModalComponent";

export const SettingsModal = SettingsModalComponent;
