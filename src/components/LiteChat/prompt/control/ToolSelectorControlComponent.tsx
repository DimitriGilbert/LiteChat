// src/components/LiteChat/prompt/control/ToolSelectorControlComponent.tsx

import React, { useState, useMemo, useCallback } from "react";
import { useControlRegistryStore } from "@/store/control.store";
// ConversationStore removed
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { SearchIcon } from "lucide-react";
import { cn } from "@/lib/utils";
// useShallow removed
import { useSettingsStore } from "@/store/settings.store";
import type { SidebarItemType } from "@/types/litechat/chat";

interface ToolSelectorControlComponentProps {
  className?: string;
  // Accept transient state from parent component (which reads from scoped variable)
  enabledTools: Set<string>;
  setEnabledTools: (updater: (prev: Set<string>) => Set<string>) => void;
  localMaxSteps: number | null; // This is the popover's input state
  setLocalMaxSteps: (steps: number | null) => void; // Setter for popover's input state
  conversationId: string | null; // Keep for context if needed
  conversationType: SidebarItemType | null; // Keep for context if needed
}

export const ToolSelectorControlComponent: React.FC<
  ToolSelectorControlComponentProps
> = ({
  className,
  // Use props passed from trigger
  enabledTools,
  setEnabledTools,
  localMaxSteps,
  setLocalMaxSteps,
  conversationId,
  conversationType,
}) => {
  // --- Store Hooks ---
  const allTools = useControlRegistryStore((state) => state.tools);
  const globalDefaultMaxSteps = useSettingsStore((state) => state.toolMaxSteps);

  // --- Local UI State ---
  const [filterText, setFilterText] = useState("");

  // --- Derived State ---
  // enabledTools is now directly from props

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
        tool.modId.toLowerCase().includes(lowerFilter),
    );
  }, [availableTools, filterText]);

  // --- Event Handlers ---
  const handleToggle = useCallback(
    (toolName: string, checked: boolean) => {
      // Update the state via the passed setter prop
      setEnabledTools((prev) => {
        const next = new Set(prev);
        if (checked) {
          next.add(toolName);
        } else {
          next.delete(toolName);
        }
        return next;
      });
    },
    [setEnabledTools],
  );

  const handleToggleAll = useCallback(
    (enable: boolean) => {
      // Update the state via the passed setter prop
      setEnabledTools(() => {
        if (enable) {
          return new Set(availableTools.map((t) => t.name));
        } else {
          return new Set();
        }
      });
    },
    [availableTools, setEnabledTools],
  );

  const handleMaxStepsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === "") {
      setLocalMaxSteps(null); // Update popover state
      return;
    }
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue)) {
      // Clamp value between 1 and 20
      const clampedValue = Math.max(1, Math.min(20, numValue));
      setLocalMaxSteps(clampedValue); // Update popover state
    } else {
      setLocalMaxSteps(null); // Update popover state
    }
  };

  // --- Render Logic ---
  const displayMaxSteps = localMaxSteps === null ? "" : String(localMaxSteps);
  const isDisabled = conversationType !== "conversation" || !conversationId;

  return (
    <div className={cn("p-4 h-[28rem] max-w-2xl space-y-3", className)}>
      <h4 className="text-sm font-medium">Available Tools</h4>
      <div className="relative">
        <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Filter tools..."
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          className="pl-8 h-9"
          disabled={isDisabled}
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
            onClick={() => handleToggleAll(true)}
            disabled={isDisabled || availableTools.length === 0}
          >
            Enable All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleToggleAll(false)}
            disabled={
              isDisabled ||
              availableTools.length === 0 ||
              enabledTools.size === 0
            }
          >
            Disable All
          </Button>
        </div>
      </div>
      <ScrollArea className="h-56 border rounded-md p-2 bg-background/50">
        {isDisabled ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Select a conversation to manage tools.
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
          <div className="space-y-1">
            {filteredTools.map((tool) => (
              <div
                key={tool.name}
                className="flex items-center justify-between p-1.5 rounded hover:bg-muted"
              >
                <Switch
                  id={`tool-switch-${tool.name}`}
                  // Read directly from prop
                  checked={enabledTools.has(tool.name)}
                  onCheckedChange={(checked) =>
                    handleToggle(tool.name, checked)
                  }
                  className="flex-shrink-0"
                  disabled={isDisabled}
                />
                <Label
                  htmlFor={`tool-switch-${tool.name}`}
                  className={cn(
                    "text-sm font-normal flex-grow pl-2 space-y-0.5",
                    isDisabled ? "cursor-not-allowed" : "cursor-pointer",
                  )}
                  title={`${tool.name} (from ${tool.modId})`}
                >
                  <span className="block font-medium">{tool.name}</span>
                  <span className="block text-xs text-muted-foreground break-words">
                    {tool.description}
                  </span>
                </Label>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
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
          placeholder={String(globalDefaultMaxSteps ?? 5)}
          disabled={isDisabled}
        />
        <p className="text-xs text-muted-foreground mt-1">
          Overrides the global setting for the next message only (1-20). Leave
          blank to use default.
        </p>
      </div>
    </div>
  );
};
