// src/controls/components/settings-trigger/SettingsTriggerComponent.tsx
// NEW FILE (Restored Content)
import React from "react";
import { Button } from "@/components/ui/button";
import { SettingsIcon } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { SettingsControlModule } from "@/controls/modules/SettingsControlModule";

interface SettingsTriggerComponentProps {
  module: SettingsControlModule;
}

export const SettingsTriggerComponent: React.FC<
  SettingsTriggerComponentProps
> = ({ module }) => {
  const handleOpenSettings = (initialTab?: string, initialSubTab?: string) => {
    module.openSettingsModal(initialTab, initialSubTab);
  };

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleOpenSettings()}
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
