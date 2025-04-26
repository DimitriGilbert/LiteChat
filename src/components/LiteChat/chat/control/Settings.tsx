// src/components/LiteChat/chat/control/Settings.tsx
import React from "react";
import { useUIStateStore } from "@/store/ui.store";
import { Button } from "@/components/ui/button";
import { SettingsIcon } from "lucide-react";
import type { ChatControl } from "@/types/litechat/chat";
import { useControlRegistryStore } from "@/store/control.store";
import { SettingsModal } from "@/components/LiteChat/settings/SettingsModal";
import { useShallow } from "zustand/react/shallow"; // Import useShallow

export const SettingsControlComponent: React.FC = () => {
  // Use a stable callback reference
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
  // Select multiple states with useShallow
  const { isModalOpen, toggleModal } = useUIStateStore(
    useShallow((state) => ({
      isModalOpen: state.isChatControlPanelOpen["settingsModal"] ?? false, // Default to false
      toggleModal: state.toggleChatControlPanel,
    })),
  );

  React.useEffect(() => {
    const control: ChatControl = {
      id: "core-settings-trigger",
      status: () => "ready", // Settings trigger is always ready
      panel: "header", // Example: Render trigger in header
      renderer: () => <SettingsControlComponent />,
      show: () => true, // Always show the trigger
      order: 100, // Example order, place it appropriately
      // Define how settings are displayed (e.g., a modal)
      settingsConfig: { tabId: "mainSettingsModal", title: "Settings" },
      // The actual modal component, controlled by UI state
      // Render the modal conditionally based on isModalOpen
      settingsRenderer: () =>
        isModalOpen ? (
          <SettingsModal
            isOpen={isModalOpen}
            onClose={() => toggleModal("settingsModal", false)} // Ensure it closes
          />
        ) : null,
    };
    const unregister = register(control);
    return unregister;
    // Re-register if modal state logic changes how it's rendered/controlled
  }, [register, isModalOpen, toggleModal]);

  // This hook doesn't render anything itself
  return null;
};
