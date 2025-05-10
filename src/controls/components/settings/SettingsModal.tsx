// src/controls/components/settings/SettingsModal.tsx
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
import type { CustomSettingTab } from "@/types/litechat/modding";
import { useShallow } from "zustand/react/shallow";
import { useModStore } from "@/store/mod.store";
import { useUIStateStore } from "@/store/ui.store";
import {
  TabbedLayout,
  TabDefinition,
} from "@/components/LiteChat/common/TabbedLayout";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsModalComponent: React.FC<SettingsModalProps> = memo(
  ({ isOpen, onClose }) => {
    const { modSettingsTabs } = useModStore(
      useShallow((state) => ({
        modSettingsTabs: state.modSettingsTabs || [],
      }))
    );
    const { initialSettingsTab, clearInitialSettingsTabs } = useUIStateStore(
      useShallow((state) => ({
        initialSettingsTab: state.initialSettingsTab,
        clearInitialSettingsTabs: state.clearInitialSettingsTabs,
      }))
    );

    const allTabs = useMemo(() => {
      const combined: TabDefinition[] = [
        ...modSettingsTabs.map((modTab: CustomSettingTab) => ({
          value: modTab.id,
          label: modTab.title,
          content: React.isValidElement(modTab.component)
            ? modTab.component
            : typeof modTab.component === "function"
            ? React.createElement(modTab.component)
            : null,
          order: modTab.order ?? 999,
        })),
      ];
      return combined.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
    }, [modSettingsTabs]);

    const [activeTab, setActiveTab] = useState(
      allTabs.find((t) => t.value === initialSettingsTab)?.value ||
        allTabs[0]?.value ||
        "general"
    );

    useEffect(() => {
      if (isOpen) {
        const targetTabInfo = allTabs.find(
          (t) => t.value === initialSettingsTab
        );
        const defaultTabValue = allTabs[0]?.value || "general";
        const targetTabValue = targetTabInfo?.value || defaultTabValue;

        if (initialSettingsTab && !targetTabInfo && allTabs.length > 0) {
          toast.error(
            `Settings tab "${initialSettingsTab}" not found. Opening default tab "${defaultTabValue}".`
          );
        } else if (allTabs.length === 0 && isOpen) {
          toast.error(
            "No settings tabs available. This is likely an initialization error."
          );
        }
        setActiveTab(targetTabValue);
      }
    }, [isOpen, initialSettingsTab, allTabs]);

    const handleOpenChange = (open: boolean) => {
      if (!open) {
        onClose();
        clearInitialSettingsTabs();
      }
    };

    const handleTabChange = (value: string) => {
      setActiveTab(value);
    };

    return (
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent
          className={cn(
            "w-[95vw] h-[90vh] flex flex-col p-0",
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

          {allTabs.length > 0 ? (
            <TabbedLayout
              tabs={allTabs}
              initialValue={activeTab}
              onValueChange={handleTabChange}
              className="flex-grow overflow-hidden px-4 md:px-6"
              listClassName="-mx-4 md:-mx-6 px-2 md:px-6 py-1 md:py-0"
              contentContainerClassName="flex-grow overflow-y-auto pb-4 md:pb-6 pr-1 md:pr-2 -mr-1 md:-mr-2"
              scrollable={true}
            />
          ) : (
            <div className="flex-grow flex items-center justify-center text-muted-foreground p-4">
              No settings tabs available.
            </div>
          )}

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
