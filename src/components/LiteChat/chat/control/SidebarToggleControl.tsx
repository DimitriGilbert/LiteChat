// src/components/LiteChat/chat/control/SidebarToggleControl.tsx
import React from "react";
import { Button } from "@/components/ui/button";
import { PanelLeftCloseIcon, PanelRightCloseIcon } from "lucide-react";
import { useUIStateStore } from "@/store/ui.store";
import { useShallow } from "zustand/react/shallow";
import type { ChatControl } from "@/types/litechat/chat";
import { useControlRegistryStore } from "@/store/control.store";

// Component to render the button
export const SidebarToggleControlComponent: React.FC = () => {
  const { isSidebarCollapsed, toggleSidebar } = useUIStateStore(
    useShallow((state) => ({
      isSidebarCollapsed: state.isSidebarCollapsed,
      toggleSidebar: state.toggleSidebar,
    })),
  );

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => toggleSidebar()}
      className="h-8 w-8" // Consistent size
      aria-label={isSidebarCollapsed ? "Open sidebar" : "Close sidebar"}
    >
      {isSidebarCollapsed ? (
        <PanelRightCloseIcon className="h-4 w-4" />
      ) : (
        <PanelLeftCloseIcon className="h-4 w-4" />
      )}
    </Button>
  );
};

// Registration Hook/Component
export const useSidebarToggleControlRegistration = () => {
  const register = useControlRegistryStore(
    (state) => state.registerChatControl,
  );

  React.useEffect(() => {
    const control: ChatControl = {
      id: "core-sidebar-toggle",
      status: () => "ready",
      panel: "sidebar-footer", // Place in the sidebar footer
      renderer: () => <SidebarToggleControlComponent />,
      show: () => true, // Always show
      order: 10, // Place it before settings
    };
    const unregister = register(control);
    return unregister;
  }, [register]);

  return null;
};
