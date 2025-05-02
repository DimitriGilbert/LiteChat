// src/hooks/litechat/registerSettingsControl.tsx

import React from "react";
import { Button } from "@/components/ui/button";
import { SettingsIcon } from "lucide-react";
import { SettingsModal } from "@/components/LiteChat/settings/SettingsModal";
import { useControlRegistryStore } from "@/store/control.store";
import { useUIStateStore } from "@/store/ui.store";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function registerSettingsControl() {
  const registerChatControl =
    useControlRegistryStore.getState().registerChatControl;
  const toggleChatControlPanel =
    useUIStateStore.getState().toggleChatControlPanel;
  const setInitialSettingsTabs =
    useUIStateStore.getState().setInitialSettingsTabs;

  const SettingsTriggerComponent: React.FC = () => {
    const handleOpenSettings = (
      initialTab?: string,
      initialSubTab?: string,
    ) => {
      setInitialSettingsTabs(initialTab || null, initialSubTab || null);
      toggleChatControlPanel("settingsModal", true);
    };

    return (
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleOpenSettings()} // Open default tab
              className="h-8 w-8"
              aria-label="Open Settings"
            >
              <SettingsIcon className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Settings</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  const SettingsModalRenderer: React.FC = () => {
    const isOpen =
      useUIStateStore.getState().isChatControlPanelOpen["settingsModal"] ??
      false;
    const handleClose = () => toggleChatControlPanel("settingsModal", false);
    return <SettingsModal isOpen={isOpen} onClose={handleClose} />;
  };

  registerChatControl({
    id: "core-settings-trigger",
    panel: "sidebar-footer",
    order: 1000,
    status: () => "ready",
    renderer: () => React.createElement(SettingsTriggerComponent),
    iconRenderer: () => React.createElement(SettingsTriggerComponent),
    settingsRenderer: () => React.createElement(SettingsModalRenderer),
    show: () => true,
  });

  console.log("[Function] Registered Core Settings Control");
  // No cleanup needed or returned
}
