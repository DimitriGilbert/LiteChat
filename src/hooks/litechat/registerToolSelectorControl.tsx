// src/hooks/litechat/registerToolSelectorControl.tsx
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
import { useConversationStore } from "@/store/conversation.store";
import { useInteractionStore } from "@/store/interaction.store";
import { useShallow } from "zustand/react/shallow";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useProviderStore } from "@/store/provider.store"; // Import provider store

// --- Local State Management within Registration Scope ---
let transientEnabledTools = new Set<string>();
let transientMaxStepsOverride: number | null = null;
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

  transientEnabledTools = new Set<string>();
  transientMaxStepsOverride = null;

  const ToolSelectorTrigger: React.FC = () => {
    const { selectedItemId, selectedItemType } = useConversationStore(
      useShallow((state) => ({
        selectedItemId: state.selectedItemId,
        selectedItemType: state.selectedItemType,
      })),
    );
    const [localState, setLocalState] = useState({
      enabledTools: transientEnabledTools,
      maxStepsOverride: transientMaxStepsOverride,
    });
    const [popoverMaxSteps, setPopoverMaxSteps] = useState<number | null>(
      localState.maxStepsOverride,
    );

    const isStreaming = useInteractionStore.getState().status === "streaming";
    const allToolsCount = Object.keys(
      useControlRegistryStore.getState().tools,
    ).length;

    useEffect(() => {
      updateScopedState = (updater) => {
        const newState = updater({
          enabledTools: transientEnabledTools,
          maxStepsOverride: transientMaxStepsOverride,
        });
        transientEnabledTools = newState.enabledTools;
        transientMaxStepsOverride = newState.maxStepsOverride;
        setLocalState(newState);
      };
      setLocalState({
        enabledTools: transientEnabledTools,
        maxStepsOverride: transientMaxStepsOverride,
      });
      return () => {
        updateScopedState = () => {};
      };
    }, []);

    useEffect(() => {
      setPopoverMaxSteps(localState.maxStepsOverride);
    }, [localState.maxStepsOverride]);

    const handlePopoverOpenChange = (open: boolean) => {
      if (!open && popoverMaxSteps !== localState.maxStepsOverride) {
        updateScopedState((prev) => ({
          ...prev,
          maxStepsOverride: popoverMaxSteps,
        }));
      }
    };

    const handleSetEnabledTools = useCallback(
      (updater: (prev: Set<string>) => Set<string>) => {
        updateScopedState((prev) => ({
          ...prev,
          enabledTools: updater(prev.enabledTools),
        }));
      },
      [],
    );

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
          <ToolSelectorControlComponent
            enabledTools={localState.enabledTools}
            setEnabledTools={handleSetEnabledTools}
            localMaxSteps={popoverMaxSteps}
            setLocalMaxSteps={setPopoverMaxSteps}
            conversationId={selectedItemId}
            conversationType={selectedItemType}
          />
        </PopoverContent>
      </Popover>
    );
  };

  registerPromptControl({
    id: "core-tool-selector",
    // order removed
    triggerRenderer: () => React.createElement(ToolSelectorTrigger),
    getMetadata: () => {
      return {
        enabledTools: Array.from(transientEnabledTools),
        ...(transientMaxStepsOverride !== null && {
          maxSteps: transientMaxStepsOverride,
        }),
      };
    },
    clearOnSubmit: () => {
      transientEnabledTools = new Set<string>();
      transientMaxStepsOverride = null;
      updateScopedState(() => ({
        enabledTools: new Set<string>(),
        maxStepsOverride: null,
      }));
    },
    show: () => {
      // Show only if the selected model supports tools
      const selectedModel = useProviderStore.getState().getSelectedModel();
      const hasRegisteredTools =
        Object.keys(useControlRegistryStore.getState().tools).length > 0;
      return (
        hasRegisteredTools &&
        (selectedModel?.metadata?.supported_parameters?.includes("tools") ??
          false)
      );
    },
  });

  console.log("[Function] Registered Core Tool Selector Control");
}
