import React, { useCallback, useMemo } from "react";
import { ToolSelectorBase } from "./ToolSelectorBase";

interface ToolSelectorFormProps {
  selectedTools: string[];
  onToolsChange: (tools: string[]) => void;
  className?: string;
  disabled?: boolean;
  maxSteps?: number | null;
  onMaxStepsChange?: (steps: number | null) => void;
  globalDefaultMaxSteps?: number;
  showMaxSteps?: boolean;
}

export const ToolSelectorForm: React.FC<ToolSelectorFormProps> = ({
  selectedTools,
  onToolsChange,
  className,
  disabled = false,
  maxSteps,
  onMaxStepsChange,
  globalDefaultMaxSteps = 5,
  showMaxSteps = false,
}) => {
  const enabledToolsSet = useMemo(() => new Set(selectedTools), [selectedTools]);

  const handleToggleTool = useCallback(
    (toolName: string, checked: boolean) => {
      const newTools = checked
        ? [...selectedTools, toolName]
        : selectedTools.filter(t => t !== toolName);
      onToolsChange(newTools);
    },
    [selectedTools, onToolsChange]
  );

  const handleToggleAll = useCallback(
    (enable: boolean, availableToolNames: string[]) => {
      if (enable) {
        onToolsChange(availableToolNames);
      } else {
        onToolsChange([]);
      }
    },
    [onToolsChange]
  );

  return (
    <ToolSelectorBase
      enabledTools={enabledToolsSet}
      onToggleTool={handleToggleTool}
      onToggleAll={handleToggleAll}
      disabled={disabled}
      className={className}
      maxSteps={maxSteps}
      onMaxStepsChange={onMaxStepsChange}
      globalDefaultMaxSteps={globalDefaultMaxSteps}
      showMaxSteps={showMaxSteps}
    />
  );
}; 