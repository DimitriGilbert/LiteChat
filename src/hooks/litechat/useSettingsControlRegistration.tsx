// src/hooks/litechat/useSettingsControlRegistration.tsx
import React from "react";
import { useUIStateStore } from "@/store/ui.store";
import { Button } from "@/components/ui/button";
import { SettingsIcon } from "lucide-react";
import type { ChatControl } from "@/types/litechat/chat";
import { useControlRegistryStore } from "@/store/control.store";
import { SettingsModal } from "@/components/LiteChat/settings/SettingsModal";
import { useShallow } from "zustand/react/shallow";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const SettingsControlComponent: React.FC = () => {
  const toggleSettingsModal = useUIStateStore(
    (state) => state.toggleChatControlPanel,
  );

  const handleClick = () => {
    toggleSettingsModal("settingsModal");
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleClick}
      aria-label="Open Settings"
      className="h-8 w-8" // Consistent size
    >
      <SettingsIcon className="h-4 w-4" />
    </Button>
  );
};

const SettingsIconRenderer: React.FC = () => {
  const toggleSettingsModal = useUIStateStore(
    (state) => state.toggleChatControlPanel,
  );

  const handleClick = () => {
    toggleSettingsModal("settingsModal");
  };

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClick}
            className="h-8 w-8"
            aria-label="Open Settings"
          >
            <SettingsIcon className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">Settings</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export const useSettingsControlRegistration = () => {
  const register = useControlRegistryStore(
    (state) => state.registerChatControl,
  );
  const { isModalOpen, toggleModal } = useUIStateStore(
    useShallow((state) => ({
      isModalOpen: state.isChatControlPanelOpen["settingsModal"] ?? false,
      toggleModal: state.toggleChatControlPanel,
    })),
  );

  React.useEffect(() => {
    const control: ChatControl = {
      id: "core-settings-trigger",
      status: () => "ready",
      panel: "sidebar-footer",
      renderer: () => <SettingsControlComponent />,
      iconRenderer: () => <SettingsIconRenderer />,
      show: () => true,
      order: 100,
      settingsConfig: { tabId: "mainSettingsModal", title: "Settings" },
      settingsRenderer: () =>
        isModalOpen ? (
          <SettingsModal
            isOpen={isModalOpen}
            onClose={() => toggleModal("settingsModal", false)}
          />
        ) : null,
    };
    const unregister = register(control);
    return unregister;
  }, [register, isModalOpen, toggleModal]);

  return null;
};
