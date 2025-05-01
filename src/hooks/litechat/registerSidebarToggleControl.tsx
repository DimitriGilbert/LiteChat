// src/hooks/litechat/registerSidebarToggleControl.tsx
// Entire file content provided
import React from "react";
import { Button } from "@/components/ui/button";
import { PanelLeftCloseIcon, PanelRightCloseIcon } from "lucide-react";
import { useControlRegistryStore } from "@/store/control.store";
import { useUIStateStore } from "@/store/ui.store";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function registerSidebarToggleControl() {
  const registerChatControl =
    useControlRegistryStore.getState().registerChatControl;

  const SidebarToggleComponent: React.FC = () => {
    // Get state and action directly inside the component instance
    const { isSidebarCollapsed, toggleSidebar } = useUIStateStore.getState();

    return (
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => toggleSidebar()}
              className="h-8 w-8"
              aria-label={
                isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"
              }
            >
              {isSidebarCollapsed ? (
                <PanelRightCloseIcon className="h-4 w-4" />
              ) : (
                <PanelLeftCloseIcon className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            {isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  registerChatControl({
    id: "core-sidebar-toggle",
    panel: "sidebar-footer", // Move to sidebar footer
    order: 10, // Adjust order as needed within the footer
    status: () => "ready",
    renderer: () => React.createElement(SidebarToggleComponent),
    iconRenderer: () => React.createElement(SidebarToggleComponent),
    show: () => true, // Always show the toggle
  });

  console.log("[Function] Registered Core Sidebar Toggle Control");
  // No cleanup needed or returned
}
