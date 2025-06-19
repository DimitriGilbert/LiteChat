// src/controls/components/settings/SettingsModal.tsx
// FULL FILE
import React, { memo, useState, useEffect, useMemo, useCallback } from "react";
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
// Removed unused useUIStateStore import
import {
  TabbedLayout,
  TabDefinition,
} from "@/components/LiteChat/common/TabbedLayout";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { ModalProviderProps } from "@/types/litechat/modding";

interface SettingsModalProps extends ModalProviderProps {
  // isOpen and onClose are already in ModalProviderProps
}

const SettingsModalComponent: React.FC<SettingsModalProps> = memo(
  ({ isOpen, onClose, initialTab: propsInitialTab }) => {
    const { modSettingsTabs } = useModStore(
      useShallow((state) => ({
        modSettingsTabs: state.modSettingsTabs || [],
      }))
    );

    const allTabs = useMemo(() => {
      const combined: TabDefinition[] = [
        ...modSettingsTabs.map((modTab: CustomSettingTab) => {
          const TabContentComponent = modTab.component;
          return {
            value: modTab.id,
            label: modTab.title,
            content: <TabContentComponent />,
            order: modTab.order ?? 999,
          };
        }),
      ];
      const sortedTabs = combined.sort(
        (a, b) => (a.order ?? 999) - (b.order ?? 999)
      );
      return sortedTabs;
    }, [modSettingsTabs]);

    const getDefaultTab = useCallback(() => {
      return allTabs.length > 0 ? allTabs[0].value : "general";
    }, [allTabs]);

    const [activeTabValue, setActiveTabValue] = useState<string>(
      getDefaultTab()
    );

    useEffect(() => {
      if (isOpen) {
        let targetTab = getDefaultTab();
        if (
          propsInitialTab &&
          allTabs.some((t) => t.value === propsInitialTab)
        ) {
          targetTab = propsInitialTab;
        } else if (propsInitialTab) {
          console.warn(
            `[SettingsModal] Initial tab "${propsInitialTab}" not found. Defaulting to "${targetTab}".`
          );
          toast.error(
            `Settings tab "${propsInitialTab}" not found. Opening default tab.`
          );
        }
        setActiveTabValue(targetTab);
      }
    }, [isOpen, propsInitialTab, allTabs, getDefaultTab]);

    const handleOpenChange = (open: boolean) => {
      if (!open) {
        onClose();
        // No need to call clearInitialSettingsTabs from UIStateStore here,
        // as initialTab is now a prop.
      }
    };

    const handleTabChangeByLayout = (value: string) => {
      setActiveTabValue(value);
    };

    return (
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent
          className={cn(
            "min-w-[95vw] h-[95vh] flex flex-col p-0",
            // "sm:w-[90vw] sm:h-[85vh]",
            // "md:w-[85vw] md:max-w-[1200px] md:h-[80vh]",
            // "lg:w-[75vw]",
            // "min-h-[500px] max-h-[95vh]"
          )}
        >
          <DialogHeader className="p-2 md:p-3 pb-1 md:pb-2 flex-shrink-0">
            <DialogTitle className="p-2">Settings</DialogTitle>
            <DialogDescription>
              Manage application settings, AI behavior, API keys, providers, and
              data.
            </DialogDescription>
          </DialogHeader>

          {allTabs.length > 0 ? (
            <TabbedLayout
              tabs={allTabs}
              key={activeTabValue} // Use activeTabValue as key to re-mount if it changes programmatically
              initialValue={activeTabValue} // Set initialValue for TabbedLayout
              onValueChange={handleTabChangeByLayout}
              className="flex-grow overflow-hidden px-4 md:px-6"
              listClassName="-mx-4 md:-mx-6 px-2 md:px-6 py-1 md:py-0"
              contentContainerClassName="flex-grow pb-4 md:pb-6"
              scrollable={true}
            />
          ) : (
            <div className="flex-grow flex items-center justify-center text-muted-foreground p-4">
              No settings tabs available or still loading. Check console for
              module registration errors.
            </div>
          )}

          <DialogFooter className="flex-shrink-0 border-t p-2 md:p-3 pt-1 md:pt-2 mt-auto">
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
