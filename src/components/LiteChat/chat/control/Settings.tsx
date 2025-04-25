import React from "react";
import { useUIStateStore } from "@/store/ui.store";
import { Button } from "@/components/ui/button";
import { SettingsIcon } from "lucide-react";
import type { ChatControl } from "@/types/litechat/chat";
import { useControlRegistryStore } from "@/store/control.store";
import { SettingsModal } from "@/components/LiteChat/common/SettingsModal"; // Assume modal exists

export const SettingsControlComponent: React.FC = () => {
  const toggleSettingsModal = useUIStateStore(
    (state) => () => state.toggleChatControlPanel("settingsModal"),
  );
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleSettingsModal}
      aria-label="Open Settings"
    >
      <SettingsIcon className="h-4 w-4" />
    </Button>
  );
};

// Registration Hook/Component
export const useSettingsControlRegistration = () => {
  const register = useControlRegistryStore(
    (state) => state.registerChatControl,
  );
  const isModalOpen = useUIStateStore(
    (state) => state.isChatControlPanelOpen["settingsModal"],
  );
  const toggleModal = useUIStateStore((state) => state.toggleChatControlPanel);

  React.useEffect(() => {
    const control: ChatControl = {
      id: "core-settings-trigger",
      status: () => "ready",
      panel: "header", // Example: Render trigger in header
      renderer: () => <SettingsControlComponent />,
      show: () => true,
      order: 100,
      // Define how settings are displayed (e.g., a modal)
      settingsConfig: { tabId: "mainSettingsModal", title: "Settings" },
      // The actual modal component, controlled by UI state
      settingsRenderer: () => (
        <SettingsModal
          isOpen={isModalOpen}
          onClose={() => toggleModal("settingsModal", false)}
        />
      ),
    };
    const unregister = register(control);
    return unregister;
  }, [register, isModalOpen, toggleModal]); // Re-register if modal state logic changes how it's rendered/controlled
};
