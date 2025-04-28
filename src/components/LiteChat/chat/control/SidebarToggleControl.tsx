// src/components/LiteChat/chat/control/SidebarToggleControl.tsx
import React from "react";
import { Button } from "@/components/ui/button";
import { PanelLeftCloseIcon, PanelRightCloseIcon } from "lucide-react";
import { useUIStateStore } from "@/store/ui.store";
import { useShallow } from "zustand/react/shallow";
import type { ChatControl } from "@/types/litechat/chat";
import { useControlRegistryStore } from "@/store/control.store";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"; // Added Tooltip

// Component to render the button (used by both renderers)
const ToggleButton: React.FC<{ isCollapsed: boolean; onClick: () => void }> = ({
  isCollapsed,
  onClick,
}) => (
  <Button
    variant="ghost"
    size="icon"
    // Ensure the event object is not passed to the store action
    onClick={() => onClick()}
    className="h-8 w-8" // Consistent size
    aria-label={isCollapsed ? "Open sidebar" : "Close sidebar"}
  >
    {isCollapsed ? (
      <PanelRightCloseIcon className="h-4 w-4" />
    ) : (
      <PanelLeftCloseIcon className="h-4 w-4" />
    )}
  </Button>
);

// Full renderer (might not be strictly needed if only used in footer)
// Removed export
const SidebarToggleControlComponent: React.FC = () => {
  const { isSidebarCollapsed, toggleSidebar } = useUIStateStore(
    useShallow((state) => ({
      isSidebarCollapsed: state.isSidebarCollapsed,
      toggleSidebar: state.toggleSidebar,
    })),
  );

  return (
    <ToggleButton isCollapsed={isSidebarCollapsed} onClick={toggleSidebar} />
  );
};

// Icon-only renderer for collapsed sidebar
// Removed export
const SidebarToggleIconRenderer: React.FC = () => {
  const { isSidebarCollapsed, toggleSidebar } = useUIStateStore(
    useShallow((state) => ({
      isSidebarCollapsed: state.isSidebarCollapsed,
      toggleSidebar: state.toggleSidebar,
    })),
  );

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <ToggleButton
            isCollapsed={isSidebarCollapsed}
            onClick={toggleSidebar}
          />
        </TooltipTrigger>
        <TooltipContent side="right">
          {isSidebarCollapsed ? "Open Sidebar" : "Close Sidebar"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
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
      iconRenderer: () => <SidebarToggleIconRenderer />, // Add icon renderer
      show: () => true, // Always show
      order: 10, // Place it before settings
    };
    const unregister = register(control);
    return unregister;
  }, [register]);

  return null;
};
