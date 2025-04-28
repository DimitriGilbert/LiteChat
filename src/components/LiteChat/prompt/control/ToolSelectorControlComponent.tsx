// src/components/LiteChat/prompt/control/ToolSelectorControlComponent.tsx
import React, { useState, useMemo, useCallback } from "react";
import { useControlRegistryStore } from "@/store/control.store";
import { useConversationStore } from "@/store/conversation.store"; // Import ConversationStore
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { SearchIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useShallow } from "zustand/react/shallow"; // Import useShallow
import { useSettingsStore } from "@/store/settings.store";

interface ToolSelectorControlComponentProps {
  className?: string;
  // Accept number or null for local state
  localMaxSteps: number | null;
  setLocalMaxSteps: (steps: number | null) => void;
  // onMaxStepsBlur prop removed
}

export const ToolSelectorControlComponent: React.FC<
  ToolSelectorControlComponentProps
> = ({
  className,
  localMaxSteps,
  setLocalMaxSteps,
  // onMaxStepsBlur removed
}) => {
  // Get state and actions from ConversationStore for the *selected* conversation
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

  // Derive enabled tools from the selected conversation's metadata
  const enabledTools = useMemo(() => {
    if (selectedItemType === "conversation" && selectedItemId) {
      const conversation = getConversationById(selectedItemId);
      // Ensure metadata and enabledTools exist, default to empty array
      return new Set(conversation?.metadata?.enabledTools ?? []);
    }
    return new Set<string>(); // Return empty set if no conversation selected
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

  // Corrected filtering logic
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
  }, [availableTools, filterText]); // Depend on filterText

  const handleToggle = useCallback(
    (toolName: string, checked: boolean) => {
      // Update the conversation store for enabled tools (this is persistent)
      const newEnabledTools = new Set(enabledTools);
      if (checked) {
        newEnabledTools.add(toolName);
      } else {
        newEnabledTools.delete(toolName);
      }
      updateCurrentConversationToolSettings({
        enabledTools: Array.from(newEnabledTools),
      });
    },
    [enabledTools, updateCurrentConversationToolSettings], // Depend on the store action and current state
  );

  const handleToggleAll = useCallback(
    (enable: boolean) => {
      // Update the conversation store for enabled tools
      const newEnabledTools = enable ? availableTools.map((t) => t.name) : [];
      updateCurrentConversationToolSettings({ enabledTools: newEnabledTools });
    },
    [availableTools, updateCurrentConversationToolSettings], // Depend on the store action
  );

  // Handler for max steps input change (updates local state via prop)
  const handleMaxStepsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow empty string temporarily, handle clamping in parent/onBlur
    if (value === "") {
      setLocalMaxSteps(null); // Use null to indicate empty
      return;
    }
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue)) {
      // Update local visual state immediately
      setLocalMaxSteps(numValue);
    } else {
      // If input is invalid (not empty, not number), set to null
      setLocalMaxSteps(null);
    }
  };

  // Determine display value, handling null for empty input
  const displayMaxSteps = localMaxSteps === null ? "" : String(localMaxSteps);

  // Disable if no conversation is selected
  const isDisabled = selectedItemType !== "conversation" || !selectedItemId;

  return (
    <div className={cn("p-4 h-[28rem] max-w-2xl space-y-3", className)}>
      {" "}
      {/* Increased height */}
      <h4 className="text-sm font-medium">Available Tools</h4>
      <div className="relative">
        <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Filter tools..."
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)} // Update filterText state
          className="pl-8 h-9"
          disabled={isDisabled} // Disable input
        />
      </div>
      <div className="flex justify-between items-center">
        <Label className="text-xs text-muted-foreground">
          {/* Correctly show filtered count */}
          {filteredTools.length} tools shown ({enabledTools.size} enabled)
        </Label>
        <div className="space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleToggleAll(true)}
            disabled={isDisabled || availableTools.length === 0} // Disable button
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
            } // Disable button
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
            {/* Iterate over filteredTools */}
            {filteredTools.map((tool) => (
              <div
                key={tool.name}
                className="flex items-center justify-between p-1.5 rounded hover:bg-muted"
              >
                <Switch
                  id={`tool-switch-${tool.name}`}
                  // Read from derived store state
                  checked={enabledTools.has(tool.name)}
                  onCheckedChange={(checked) =>
                    handleToggle(tool.name, checked)
                  }
                  className="flex-shrink-0"
                  disabled={isDisabled} // Disable switch
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
      {/* Max Steps Input */}
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
          value={displayMaxSteps} // Use display value
          onChange={handleMaxStepsChange}
          // onBlur removed
          className="w-20 h-8 text-xs mt-1"
          placeholder={String(useSettingsStore.getState().toolMaxSteps ?? 5)} // Show global default as placeholder
          disabled={isDisabled} // Disable input
        />
        <p className="text-xs text-muted-foreground mt-1">
          Overrides the global setting for the next message only (1-20).
        </p>
      </div>
    </div>
  );
};
