// src/hooks/litechat/registerToolSelectorControl.tsx
// FULL FILE
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
// useShallow removed
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useProviderStore } from "@/store/provider.store";
import { emitter } from "@/lib/litechat/event-emitter";
import { ModEvent } from "@/types/litechat/modding";
import type { SidebarItemType } from "@/types/litechat/chat";

// --- Local State Management within Registration Scope ---
// This remains necessary to hold the *transient* state for the *next* prompt
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

// --- Trigger Component ---
const ToolSelectorTrigger: React.FC = () => {
  // Local state for UI elements, updated by scoped state changes
  const [localState, setLocalState] = useState({
    enabledTools: transientEnabledTools,
    maxStepsOverride: transientMaxStepsOverride,
  });
  const [popoverMaxSteps, setPopoverMaxSteps] = useState<number | null>(
    localState.maxStepsOverride,
  );
  const [popoverOpen, setPopoverOpen] = useState(false);

  // Local state managed by events
  const [isStreaming, setIsStreaming] = useState(
    () => useInteractionStore.getState().status === "streaming",
  );
  const [isVisible, setIsVisible] = useState(true);
  const [selectedItemType, setSelectedItemType] =
    useState<SidebarItemType | null>(
      () => useConversationStore.getState().selectedItemType,
    );
  const [selectedItemId, setSelectedItemId] = useState<string | null>(
    () => useConversationStore.getState().selectedItemId,
  );

  // Get tool count (relatively stable)
  const allToolsCount = Object.keys(
    useControlRegistryStore.getState().tools,
  ).length;

  // Effect to manage the scoped state update function
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
    // Sync initial local state
    setLocalState({
      enabledTools: transientEnabledTools,
      maxStepsOverride: transientMaxStepsOverride,
    });
    return () => {
      updateScopedState = () => {};
    };
  }, []);

  // Effect to sync popover input with local state
  useEffect(() => {
    setPopoverMaxSteps(localState.maxStepsOverride);
  }, [localState.maxStepsOverride]);

  // Subscribe to events
  useEffect(() => {
    const handleStatusChange = (payload: {
      status: "idle" | "loading" | "streaming" | "error";
    }) => {
      setIsStreaming(payload.status === "streaming");
    };
    const handleModelChange = (payload: { modelId: string | null }) => {
      if (!payload.modelId) {
        setIsVisible(false);
        return;
      }
      const { getSelectedModel } = useProviderStore.getState();
      const selectedModel = getSelectedModel();
      const hasRegisteredTools =
        Object.keys(useControlRegistryStore.getState().tools).length > 0;
      setIsVisible(
        hasRegisteredTools &&
          (selectedModel?.metadata?.supported_parameters?.includes("tools") ??
            false),
      );
    };
    const handleContextChange = (payload: {
      selectedItemId: string | null;
      selectedItemType: SidebarItemType | null;
    }) => {
      setSelectedItemType(payload.selectedItemType);
      setSelectedItemId(payload.selectedItemId);
    };

    // Initial checks
    handleModelChange({ modelId: useProviderStore.getState().selectedModelId });
    handleContextChange({
      selectedItemId: useConversationStore.getState().selectedItemId,
      selectedItemType: useConversationStore.getState().selectedItemType,
    });

    // Subscriptions
    emitter.on(ModEvent.INTERACTION_STATUS_CHANGED, handleStatusChange);
    emitter.on(ModEvent.MODEL_SELECTION_CHANGED, handleModelChange);
    emitter.on(ModEvent.CONTEXT_CHANGED, handleContextChange);

    // Cleanup
    return () => {
      emitter.off(ModEvent.INTERACTION_STATUS_CHANGED, handleStatusChange);
      emitter.off(ModEvent.MODEL_SELECTION_CHANGED, handleModelChange);
      emitter.off(ModEvent.CONTEXT_CHANGED, handleContextChange);
    };
  }, []);

  // --- Event Handlers ---
  const handlePopoverOpenChange = (open: boolean) => {
    setPopoverOpen(open);
    // Update transient state when popover closes if max steps changed
    if (!open && popoverMaxSteps !== localState.maxStepsOverride) {
      updateScopedState((prev) => ({
        ...prev,
        maxStepsOverride: popoverMaxSteps,
      }));
    }
  };

  const handleSetEnabledTools = useCallback(
    (updater: (prev: Set<string>) => Set<string>) => {
      // Update transient state via the scoped updater
      updateScopedState((prev) => ({
        ...prev,
        enabledTools: updater(prev.enabledTools),
      }));
    },
    [],
  );

  // --- Derived State for Rendering ---
  const hasActiveSettings =
    localState.enabledTools.size > 0 || localState.maxStepsOverride !== null;
  const isDisabled =
    isStreaming || allToolsCount === 0 || selectedItemType !== "conversation";

  if (!isVisible) {
    return null;
  }

  return (
    <Popover open={popoverOpen} onOpenChange={handlePopoverOpenChange}>
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
          enabledTools={localState.enabledTools} // Pass current local state
          setEnabledTools={handleSetEnabledTools} // Pass handler to update scoped state
          localMaxSteps={popoverMaxSteps} // Pass popover's input state
          setLocalMaxSteps={setPopoverMaxSteps} // Pass setter for popover's input state
          conversationId={selectedItemId}
          conversationType={selectedItemType}
        />
      </PopoverContent>
    </Popover>
  );
};

// --- Registration Function ---
export function registerToolSelectorControl() {
  const registerPromptControl =
    useControlRegistryStore.getState().registerPromptControl;

  // Reset transient state on registration (e.g., app load)
  transientEnabledTools = new Set<string>();
  transientMaxStepsOverride = null;

  registerPromptControl({
    id: "core-tool-selector",
    // order removed
    triggerRenderer: () => React.createElement(ToolSelectorTrigger),
    // getMetadata reads directly from the transient scoped state
    getMetadata: () => {
      // Return only if there are settings to apply
      if (
        transientEnabledTools.size > 0 ||
        transientMaxStepsOverride !== null
      ) {
        return {
          enabledTools: Array.from(transientEnabledTools),
          ...(transientMaxStepsOverride !== null && {
            maxSteps: transientMaxStepsOverride,
          }),
        };
      }
      return undefined;
    },
    // clearOnSubmit resets the transient scoped state
    clearOnSubmit: () => {
      transientEnabledTools = new Set<string>();
      transientMaxStepsOverride = null;
      // Trigger a state update in any mounted trigger component
      updateScopedState(() => ({
        enabledTools: new Set<string>(),
        maxStepsOverride: null,
      }));
    },
    // show function removed - component handles visibility
    // show: () => { ... }
  });

  console.log("[Function] Registered Core Tool Selector Control");
}
