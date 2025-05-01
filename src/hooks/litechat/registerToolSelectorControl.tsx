// src/hooks/litechat/registerToolSelectorControl.tsx
// Entire file content provided
import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { WrenchIcon } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ToolSelectorControlComponent } from "@/components/LiteChat/prompt/control/ToolSelectorControlComponent";
import { useControlRegistryStore } from "@/store/control.store";
import { useConversationStore } from "@/store/conversation.store"; // Keep for context check
import { useInteractionStore } from "@/store/interaction.store";
import { useShallow } from "zustand/react/shallow";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
// InputStore is NOT needed here anymore for tools/steps

// --- Local State Management within Registration Scope ---
let transientEnabledTools = new Set<string>();
let transientMaxStepsOverride: number | null = null;
// Callback to allow the component to update the scoped variables
let updateScopedState: (
  updater: (prev: {
    enabledTools: Set<string>;
    maxStepsOverride: number | null;
  }) => {
    enabledTools: Set<string>;
    maxStepsOverride: number | null;
  },
) => void = () => {};
// --- End Local State Management ---

export function registerToolSelectorControl() {
  const registerPromptControl =
    useControlRegistryStore.getState().registerPromptControl;

  // Reset local state when registering (e.g., on app load/reload)
  transientEnabledTools = new Set<string>();
  transientMaxStepsOverride = null;

  const ToolSelectorTrigger: React.FC = () => {
    // --- State Hooks ---
    // Read conversation context for disabling the control
    const { selectedItemId, selectedItemType } = useConversationStore(
      useShallow((state) => ({
        selectedItemId: state.selectedItemId,
        selectedItemType: state.selectedItemType,
      })),
    );
    // Local state *within the component* for UI updates
    const [localState, setLocalState] = useState({
      enabledTools: transientEnabledTools,
      maxStepsOverride: transientMaxStepsOverride,
    });
    // Local state for popover's max steps input
    const [popoverMaxSteps, setPopoverMaxSteps] = useState<number | null>(
      localState.maxStepsOverride,
    );

    const isStreaming = useInteractionStore.getState().status === "streaming";
    const allToolsCount = Object.keys(
      useControlRegistryStore.getState().tools,
    ).length;

    // --- Update Scoped State ---
    // Provide a way for this component instance to update the scoped variables
    useEffect(() => {
      updateScopedState = (updater) => {
        const newState = updater({
          enabledTools: transientEnabledTools,
          maxStepsOverride: transientMaxStepsOverride,
        });
        transientEnabledTools = newState.enabledTools;
        transientMaxStepsOverride = newState.maxStepsOverride;
        // Update local component state to trigger re-render
        setLocalState(newState);
      };
      // Initial sync
      setLocalState({
        enabledTools: transientEnabledTools,
        maxStepsOverride: transientMaxStepsOverride,
      });
      // Cleanup function to avoid memory leaks if the control is ever unregistered
      return () => {
        updateScopedState = () => {};
      };
    }, []); // Empty dependency array ensures this runs once per mount

    // Update popover input when local state changes
    useEffect(() => {
      setPopoverMaxSteps(localState.maxStepsOverride);
    }, [localState.maxStepsOverride]);

    // --- Event Handlers ---
    const handlePopoverOpenChange = (open: boolean) => {
      // When closing, persist the popoverMaxSteps to the scoped variable
      if (!open && popoverMaxSteps !== localState.maxStepsOverride) {
        updateScopedState((prev) => ({
          ...prev,
          maxStepsOverride: popoverMaxSteps,
        }));
      }
    };

    // Callback for the child component to update enabled tools
    const handleSetEnabledTools = useCallback(
      (updater: (prev: Set<string>) => Set<string>) => {
        updateScopedState((prev) => ({
          ...prev,
          enabledTools: updater(prev.enabledTools),
        }));
      },
      [], // updateScopedState is stable within the effect
    );

    // --- Render Logic ---
    const hasActiveSettings =
      localState.enabledTools.size > 0 || localState.maxStepsOverride !== null;
    const isDisabled =
      isStreaming || allToolsCount === 0 || selectedItemType !== "conversation";

    return (
      <Popover onOpenChange={handlePopoverOpenChange}>
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button
                  variant={hasActiveSettings ? "secondary" : "ghost"}
                  size="icon"
                  className="h-8 w-8"
                  disabled={isDisabled}
                  aria-label="Configure Tools"
                >
                  <WrenchIcon className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent side="top">
              {isDisabled
                ? "Tools unavailable (select conversation)"
                : `Tools (${localState.enabledTools.size} enabled)`}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <PopoverContent className="w-auto p-0" align="start">
          {/* Pass local state and setters to the component */}
          <ToolSelectorControlComponent
            enabledTools={localState.enabledTools}
            setEnabledTools={handleSetEnabledTools} // Pass callback to update scoped state
            localMaxSteps={popoverMaxSteps} // Pass popover-specific state
            setLocalMaxSteps={setPopoverMaxSteps} // Pass popover-specific setter
            // Pass conversation details needed by the component (if any)
            conversationId={selectedItemId}
            conversationType={selectedItemType}
          />
        </PopoverContent>
      </Popover>
    );
  };

  registerPromptControl({
    id: "core-tool-selector",
    order: 50,
    triggerRenderer: () => React.createElement(ToolSelectorTrigger),
    getMetadata: () => {
      // Read directly from the scoped variables when metadata is requested
      return {
        enabledTools: Array.from(transientEnabledTools),
        // Include maxSteps override only if it's explicitly set (not null)
        ...(transientMaxStepsOverride !== null && {
          maxSteps: transientMaxStepsOverride,
        }),
      };
    },
    clearOnSubmit: () => {
      // Reset the scoped variables
      transientEnabledTools = new Set<string>();
      transientMaxStepsOverride = null;
      // Trigger a state update in the mounted component instance, if any
      updateScopedState(() => ({
        enabledTools: new Set<string>(),
        maxStepsOverride: null,
      }));
    },
    show: () =>
      Object.keys(useControlRegistryStore.getState().tools).length > 0,
  });

  console.log("[Function] Registered Core Tool Selector Control");
}
