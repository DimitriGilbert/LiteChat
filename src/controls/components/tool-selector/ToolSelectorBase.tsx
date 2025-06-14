import React, { useState, useMemo, useCallback } from "react";
import { useControlRegistryStore } from "@/store/control.store";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { SearchIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ToolSelectorBaseProps {
  enabledTools: Set<string>;
  onToggleTool: (toolName: string, checked: boolean) => void;
  onToggleAll: (enable: boolean, availableToolNames: string[]) => void;
  disabled?: boolean;
  className?: string;
  maxSteps?: number | null;
  onMaxStepsChange?: (steps: number | null) => void;
  globalDefaultMaxSteps?: number;
  showMaxSteps?: boolean;
  disabledMessage?: string;
}

// Utility function to truncate text
const truncateText = (text: string, maxLength: number = 80): string => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
};

export const ToolSelectorBase: React.FC<ToolSelectorBaseProps> = ({
  enabledTools,
  onToggleTool,
  onToggleAll,
  disabled = false,
  className,
  maxSteps,
  onMaxStepsChange,
  globalDefaultMaxSteps = 5,
  showMaxSteps = false,
  disabledMessage,
}) => {
  const allTools = useControlRegistryStore((state) => state.tools);
  const [filterText, setFilterText] = useState("");

  const availableTools = useMemo(() => {
    return Object.entries(allTools)
      .map(([name, { definition, modId }]) => ({
        name,
        description: definition.description ?? "No description provided.",
        modId,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allTools]);

  const filteredTools = useMemo(() => {
    const lowerFilter = filterText.trim().toLowerCase();
    if (!lowerFilter) {
      return availableTools;
    }
    return availableTools.filter(
      (tool) =>
        tool.name.toLowerCase().includes(lowerFilter) ||
        tool.description.toLowerCase().includes(lowerFilter) ||
        tool.modId.toLowerCase().includes(lowerFilter)
    );
  }, [availableTools, filterText]);

  const handleMaxStepsChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!onMaxStepsChange) return;
    
    const value = e.target.value;
    if (value === "") {
      onMaxStepsChange(null);
      return;
    }
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue)) {
      const clampedValue = Math.max(1, Math.min(20, numValue));
      onMaxStepsChange(clampedValue);
    } else {
      onMaxStepsChange(null);
    }
  }, [onMaxStepsChange]);

  const displayMaxSteps = maxSteps === null ? "" : String(maxSteps);

  return (
    <div className={cn("p-4 max-w-2xl space-y-3", className)}>
      <h4 className="text-sm font-medium">Available Tools</h4>
      <div className="relative">
        <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Filter tools..."
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          className="pl-8 h-9"
          disabled={disabled}
        />
      </div>
      <div className="flex justify-between items-center">
        <Label className="text-xs text-muted-foreground">
          {filteredTools.length} tools shown ({enabledTools.size} enabled)
        </Label>
        <div className="space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onToggleAll(true, availableTools.map(t => t.name))}
            disabled={disabled || availableTools.length === 0}
          >
            Enable All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onToggleAll(false, availableTools.map(t => t.name))}
            disabled={disabled || availableTools.length === 0 || enabledTools.size === 0}
          >
            Disable All
          </Button>
        </div>
      </div>
      <div className="border rounded-md bg-background/50">
        {disabled && disabledMessage ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            {disabledMessage}
          </p>
        ) : availableTools.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No tools registered.
          </p>
        ) : filteredTools.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No tools match filter.
          </p>
        ) : (
          <ScrollArea className="h-96 w-full">
            <div className="p-2 space-y-1">
              {filteredTools.map((tool) => (
                <div
                  key={tool.name}
                  className="flex items-center justify-between p-1.5 rounded hover:bg-muted"
                >
                  <Switch
                    id={`tool-switch-${tool.name}`}
                    checked={enabledTools.has(tool.name)}
                    onCheckedChange={(checked) => onToggleTool(tool.name, checked)}
                    className="flex-shrink-0"
                    disabled={disabled}
                  />
                  <div className="flex-grow pl-2 space-y-0.5">
                    <Label
                      htmlFor={`tool-switch-${tool.name}`}
                      className={cn(
                        "block text-sm font-medium",
                        disabled ? "cursor-not-allowed" : "cursor-pointer"
                      )}
                    >
                      {tool.name}
                    </Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="block text-xs text-muted-foreground break-words cursor-help">
                          {truncateText(tool.description)}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-sm">
                        <div className="space-y-1">
                          <div className="font-medium">{tool.name}</div>
                          <div className="text-xs opacity-90">From: {tool.modId}</div>
                          <div className="text-xs">{tool.description}</div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
      {showMaxSteps && (
        <div className="pt-2">
          <Label htmlFor="local-max-steps" className="text-xs font-medium">
            Max Tool Steps (This Turn)
          </Label>
          <Input
            id="local-max-steps"
            type="number"
            min="1"
            max="20"
            step="1"
            value={displayMaxSteps}
            onChange={handleMaxStepsChange}
            className="w-20 h-8 text-xs mt-1"
            placeholder={String(globalDefaultMaxSteps)}
            disabled={disabled}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Overrides the global setting for the next message only (1-20). Leave
            blank to use default.
          </p>
        </div>
      )}
    </div>
  );
}; 