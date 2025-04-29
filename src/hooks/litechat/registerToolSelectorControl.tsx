// src/hooks/litechat/registerToolSelectorControl.ts
import React, { useState } from "react";
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
    const { selectedItemId, selectedItemType, getConversationById } =
      useConversationStore(
        useShallow((state) => ({
          selectedItemId: state.selectedItemId,
          selectedItemType: state.selectedItemType,
          getConversationById: state.getConversationById,
        })),
      );
    const isStreaming = useInteractionStore.getState().status === "streaming";
    const allToolsCount = Object.keys(
      useControlRegistryStore.getState().tools,
    ).length;

    const conversation =
      selectedItemType === "conversation" && selectedItemId
        ? getConversationById(selectedItemId)
        : null;

    const enabledToolsCount = conversation?.metadata?.enabledTools?.length ?? 0;
    const maxStepsOverride =
      conversation?.metadata?.toolMaxStepsOverride ?? null;

    // Local state for maxSteps override specific to the popover instance
    const [localMaxSteps, setLocalMaxSteps] = useState<number | null>(
      maxStepsOverride,
    );

    // Update local state if the conversation's override changes externally
    React.useEffect(() => {
      setLocalMaxSteps(maxStepsOverride);
    }, [maxStepsOverride]);

    const hasActiveSettings =
      enabledToolsCount > 0 || maxStepsOverride !== null;
    const isDisabled =
      isStreaming || allToolsCount === 0 || selectedItemType !== "conversation";

    return (
      <Popover
        onOpenChange={(open) => {
          // When closing, persist the localMaxSteps to the conversation
          if (!open) {
            useConversationStore
              .getState()
              .updateCurrentConversationToolSettings({
                toolMaxStepsOverride: localMaxSteps,
              });
          }
        }}
      >
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
                : `Tools (${enabledToolsCount} enabled)`}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <PopoverContent className="w-auto p-0" align="start">
          <ToolSelectorControlComponent
            localMaxSteps={localMaxSteps}
            setLocalMaxSteps={setLocalMaxSteps}
          />
        </PopoverContent>
      </Popover>
    );
  };

  registerPromptControl({
    id: "core-tool-selector",
    order: 50,
    // status: () => "ready", // Removed status
    triggerRenderer: () => React.createElement(ToolSelectorTrigger),
    getMetadata: () => {
      // Get current state when metadata is requested
      const { selectedItemId, selectedItemType, getConversationById } =
        useConversationStore.getState();
      const conversation =
        selectedItemType === "conversation" && selectedItemId
          ? getConversationById(selectedItemId)
          : null;
      return {
        enabledTools: conversation?.metadata?.enabledTools ?? [],
        // Include maxSteps override if set, otherwise it's handled by AIService default
        ...(conversation?.metadata?.toolMaxStepsOverride !== null && {
          maxSteps: conversation?.metadata?.toolMaxStepsOverride,
        }),
      };
    },
    show: () =>
      Object.keys(useControlRegistryStore.getState().tools).length > 0, // Show only if tools are registered
  });

  console.log("[Function] Registered Core Tool Selector Control");
  // No cleanup needed or returned
}
