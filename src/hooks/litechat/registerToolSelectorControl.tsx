// src/hooks/litechat/registerToolSelectorControl.tsx
// Entire file content provided - No changes needed here based on analysis
import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { WrenchIcon } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ToolSelectorControlComponent } from "@/components/LiteChat/prompt/control/ToolSelectorControlComponent";
import { useControlRegistryStore } from "@/store/control.store";
import { useConversationStore } from "@/store/conversation.store";
import { useInteractionStore } from "@/store/interaction.store";
import { useShallow } from "zustand/react/shallow";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function registerToolSelectorControl() {
  const registerPromptControl =
    useControlRegistryStore.getState().registerPromptControl;

  const ToolSelectorTrigger: React.FC = () => {
    // --- State Hooks ---
    const {
      selectedItemId,
      selectedItemType,
      getConversationById,
      updateCurrentConversationToolSettings
    } = useConversationStore(
      useShallow((state) => ({
        selectedItemId: state.selectedItemId,
        selectedItemType: state.selectedItemType,
        getConversationById: state.getConversationById,
        updateCurrentConversationToolSettings:
          state.updateCurrentConversationToolSettings
      })),
    );
    const isStreaming = useInteractionStore.getState().status === "streaming";
    const allToolsCount = Object.keys(
      useControlRegistryStore.getState().tools,
    ).length;

    // --- Derived State ---
    const conversation =
      selectedItemType === "conversation" && selectedItemId
        ? getConversationById(selectedItemId)
        : null;

    const enabledTools = useMemo(
      () => new Set(conversation?.metadata?.enabledTools ?? []),
      [conversation?.metadata?.enabledTools],
    );
    const maxStepsOverride =
      conversation?.metadata?.toolMaxStepsOverride ?? null;

    // --- Local State for Popover ---
    // Local state for maxSteps override specific to the popover instance
    const [localMaxSteps, setLocalMaxSteps] = useState<number | null>(
      maxStepsOverride,
    );

    // Update local state if the conversation's override changes externally
    useEffect(() => {
      setLocalMaxSteps(maxStepsOverride);
    }, [maxStepsOverride]);

    // --- Event Handlers ---
    const handlePopoverOpenChange = (open: boolean) => {
      // When closing, persist the localMaxSteps to the conversation
      if (!open && localMaxSteps !== maxStepsOverride) {
        updateCurrentConversationToolSettings({
          toolMaxStepsOverride: localMaxSteps,
        });
      }
    };

    // --- Render Logic ---
    const hasActiveSettings =
      enabledTools.size > 0 || maxStepsOverride !== null;
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
                : `Tools (${enabledTools.size} enabled)`}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <PopoverContent className="w-auto p-0" align="start">
          {/* Pass local state and setter to the component */}
          <ToolSelectorControlComponent
            localMaxSteps={localMaxSteps}
            setLocalMaxSteps={setLocalMaxSteps}
            // Pass conversation details needed by the component
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
      // Get current state when metadata is requested
      const { selectedItemId, selectedItemType, getConversationById } =
        useConversationStore.getState();
      const conversation =
        selectedItemType === "conversation" && selectedItemId
          ? getConversationById(selectedItemId)
          : null;

      // Read directly from conversation metadata
      const enabledTools = conversation?.metadata?.enabledTools ?? [];
      const maxStepsOverride =
        conversation?.metadata?.toolMaxStepsOverride ?? null;

      return {
        enabledTools: enabledTools,
        // Include maxSteps override only if it's explicitly set (not null)
        ...(maxStepsOverride !== null && { maxSteps: maxStepsOverride }),
      };
    },
    show: () =>
      Object.keys(useControlRegistryStore.getState().tools).length > 0
  });

  console.log("[Function] Registered Core Tool Selector Control");
  // No cleanup needed or returned
}
