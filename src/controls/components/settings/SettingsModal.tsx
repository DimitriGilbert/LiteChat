// src/components/LiteChat/settings/SettingsModal.tsx
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

    // This effect should ONLY run when the modal opens OR when initialSettingsTab changes.
    // It sets the activeTabValue based on these conditions.
    useEffect(() => {
      if (isOpen) {
        let targetTab = getDefaultTab();
        if (
          initialSettingsTab &&
          allTabs.some((t) => t.value === initialSettingsTab)
        ) {
          targetTab = initialSettingsTab;
        } else if (initialSettingsTab) {
          // initialSettingsTab is set but not found
          console.warn(
            `[SettingsModal] Initial tab "${initialSettingsTab}" not found. Defaulting to "${targetTab}".`
          );
          toast.error(
            `Settings tab "${initialSettingsTab}" not found. Opening default tab.`
          );
        }
        // Only update if the determined targetTab is different from the current activeTabValue
        // This prevents overriding a user's click if initialSettingsTab hasn't changed.
        if (activeTabValue !== targetTab) {
          setActiveTabValue(targetTab);
        }
      }
    }, [isOpen, initialSettingsTab, allTabs, getDefaultTab]); // Removed activeTabValue from dependency array

    const handleOpenChange = (open: boolean) => {
      if (!open) {
        onClose();
        clearInitialSettingsTabs();
        // Optionally reset activeTabValue to default when modal closes,
        // so it opens to default next time unless initialSettingsTab is set.
        // setActiveTabValue(getDefaultTab());
      }
      // If opening, the useEffect above will handle setting the active tab.
    };

    // This function is passed to TabbedLayout's onValueChange
    const handleTabChangeByLayout = (value: string) => {
      setActiveTabValue(value); // Update our state when user clicks a tab
      // If the user manually changes the tab, clear the programmatic initial tab setting
      if (value !== initialSettingsTab) {
        clearInitialSettingsTabs();
      }
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
              key={activeTabValue}
              initialValue={activeTabValue}
              onValueChange={handleTabChangeByLayout}
              className="flex-grow overflow-hidden px-4 md:px-6"
              listClassName="-mx-4 md:-mx-6 px-2 md:px-6 py-1 md:py-0"
              contentContainerClassName="flex-grow overflow-y-auto pb-4 md:pb-6 pr-1 md:pr-2 -mr-1 md:-mr-2"
              scrollable={true}
            />
          ) : (
            <div className="flex-grow flex items-center justify-center text-muted-foreground p-4">
              No settings tabs available or still loading. Check console for
              module registration errors.
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
