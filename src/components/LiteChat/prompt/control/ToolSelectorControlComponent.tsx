// src/components/LiteChat/prompt/control/ToolSelectorControlComponent.tsx
import React, { useState, useMemo, useCallback, useEffect } from "react"; // Added useEffect
import { useControlRegistryStore } from "@/store/control.store";
import { useConversationStore } from "@/store/conversation.store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { SearchIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useShallow } from "zustand/react/shallow";
import { useSettingsStore } from "@/store/settings.store";

interface ToolSelectorControlComponentProps {
  className?: string;
  localMaxSteps: number | null;
  setLocalMaxSteps: (steps: number | null) => void;
}

export const ToolSelectorControlComponent: React.FC<
  ToolSelectorControlComponentProps
> = ({ className, localMaxSteps, setLocalMaxSteps }) => {
  const {
    selectedItemId,
    selectedItemType,
    getConversationById,
    updateCurrentConversationToolSettings,
  } = useConversationStore(
    useShallow((state) => ({
      selectedItemId: state.selectedItemId,
      selectedItemType: state.selectedItemType,
      getConversationById: state.getConversationById,
      updateCurrentConversationToolSettings:
        state.updateCurrentConversationToolSettings,
    })),
  );

  const allTools = useControlRegistryStore((state) => state.tools);
  const [filterText, setFilterText] = useState("");
  // --- Local state for visual switch representation ---
  const [localEnabledTools, setLocalEnabledTools] = useState<Set<string>>(
    new Set(),
  );

  // Effect to initialize/sync local state when conversation changes or component mounts
  useEffect(() => {
    if (selectedItemType === "conversation" && selectedItemId) {
      const conversation = getConversationById(selectedItemId);
      const storeEnabledTools = new Set(
        conversation?.metadata?.enabledTools ?? [],
      );
      setLocalEnabledTools(storeEnabledTools);
    } else {
      setLocalEnabledTools(new Set()); // Clear if no conversation selected
    }
    // Re-sync when the selected item changes
  }, [selectedItemId, selectedItemType, getConversationById]);

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

  const handleToggle = useCallback(
    (toolName: string, checked: boolean) => {
      // 1. Update local state immediately for UI feedback
      setLocalEnabledTools((prev) => {
        const next = new Set(prev);
        if (checked) {
          next.add(toolName);
        } else {
          next.delete(toolName);
        }
        return next;
      });

      // 2. Update the conversation store for persistence
      const newEnabledTools = new Set(localEnabledTools); // Use current local state as base
      if (checked) {
        newEnabledTools.add(toolName);
      } else {
        newEnabledTools.delete(toolName);
      }
      updateCurrentConversationToolSettings({
        enabledTools: Array.from(newEnabledTools),
      });
    },
    [localEnabledTools, updateCurrentConversationToolSettings], // Depend on local state and store action
  );

  const handleToggleAll = useCallback(
    (enable: boolean) => {
      const newEnabledSet = enable
        ? new Set(availableTools.map((t) => t.name))
        : new Set<string>();
      // 1. Update local state
      setLocalEnabledTools(newEnabledSet);
      // 2. Update store state
      updateCurrentConversationToolSettings({
        enabledTools: Array.from(newEnabledSet),
      });
    },
    [availableTools, updateCurrentConversationToolSettings],
  );

  const handleMaxStepsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === "") {
      setLocalMaxSteps(null);
      return;
    }
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue)) {
      setLocalMaxSteps(numValue);
    } else {
      setLocalMaxSteps(null);
    }
  };

  const displayMaxSteps = localMaxSteps === null ? "" : String(localMaxSteps);
  const isDisabled = selectedItemType !== "conversation" || !selectedItemId;

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
          {filteredTools.length} tools shown ({localEnabledTools.size} enabled)
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
              localEnabledTools.size === 0
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
                  // Read from local state for immediate feedback
                  checked={localEnabledTools.has(tool.name)}
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
          placeholder={String(useSettingsStore.getState().toolMaxSteps ?? 5)}
          disabled={isDisabled}
        />
        <p className="text-xs text-muted-foreground mt-1">
          Overrides the global setting for the next message only (1-20).
        </p>
      </div>
    </div>
  );
};
