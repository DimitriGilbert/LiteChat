// src/controls/components/tool-selector/ToolSelectorControlComponent.tsx
// FULL FILE
import React, { useCallback } from "react";
import { ToolSelectorBase } from "./ToolSelectorBase";
import { useSettingsStore } from "@/store/settings.store";
import type { ToolSelectorControlModule } from "@/controls/modules/ToolSelectorControlModule";

interface ToolSelectorControlComponentProps {
  module: ToolSelectorControlModule;
  popoverMaxSteps: number | null;
  setPopoverMaxSteps: (steps: number | null) => void;
  className?: string;
}

export const ToolSelectorControlComponent: React.FC<
  ToolSelectorControlComponentProps
> = ({ module, popoverMaxSteps, setPopoverMaxSteps, className }) => {
  const enabledTools = module.getEnabledTools();
  const selectedItemId = module.getSelectedItemId();
  const selectedItemType = module.getSelectedItemType();
  const globalDefaultMaxSteps = module.getGlobalDefaultMaxSteps();
  const autoToolSelectionEnabled = useSettingsStore((s) => s.autoToolSelectionEnabled);

  const handleToggleTool = useCallback(
    (toolName: string, checked: boolean) => {
      module.setEnabledTools((prev) => {
        const next = new Set(prev);
        if (checked) {
          next.add(toolName);
        } else {
          next.delete(toolName);
        }
        return next;
      });
    },
    [module]
  );

  const handleToggleAll = useCallback(
    (enable: boolean, availableToolNames: string[]) => {
      module.setEnabledTools(() => {
        if (enable) {
          return new Set(availableToolNames);
        } else {
          return new Set();
        }
      });
    },
    [module]
  );

  const handleAutoSelect = useCallback(() => {
    module.autoSelectTools();
  }, [module]);

  const isDisabled = selectedItemType !== "conversation" || !selectedItemId;
  const disabledMessage = "Select a conversation to manage tools.";

  return (
    <ToolSelectorBase
      enabledTools={enabledTools}
      onToggleTool={handleToggleTool}
      onToggleAll={handleToggleAll}
      onAutoSelect={autoToolSelectionEnabled ? handleAutoSelect : undefined}
      disabled={isDisabled}
      className={className}
      maxSteps={popoverMaxSteps}
      onMaxStepsChange={setPopoverMaxSteps}
      globalDefaultMaxSteps={globalDefaultMaxSteps}
      showMaxSteps={true}
      disabledMessage={disabledMessage}
    />
  );
};
