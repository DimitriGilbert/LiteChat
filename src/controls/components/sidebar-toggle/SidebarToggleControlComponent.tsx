// src/controls/components/sidebar-toggle/SidebarToggleControlComponent.tsx
// FULL FILE
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { PanelLeftCloseIcon, PanelRightCloseIcon } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { SidebarToggleControlModule } from "@/controls/modules/SidebarToggleControlModule";

interface SidebarToggleControlComponentProps {
  module: SidebarToggleControlModule;
}

export const SidebarToggleControlComponent: React.FC<
  SidebarToggleControlComponentProps
> = ({ module }) => {
  const [, forceUpdate] = useState({});
  useEffect(() => {
    module.setNotifyCallback(() => forceUpdate({}));
    return () => module.setNotifyCallback(null);
  }, [module]);

  const isSidebarCollapsed = module.getIsSidebarCollapsed();

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            // Corrected: Wrap module.toggleSidebar in an arrow function
            onClick={() => module.toggleSidebar()}
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
