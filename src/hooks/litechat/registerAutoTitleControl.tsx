// src/hooks/litechat/registerAutoTitleControl.tsx
// FULL FILE
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { SparklesIcon } from "lucide-react";
import { useControlRegistryStore } from "@/store/control.store";
import { useInteractionStore } from "@/store/interaction.store";
import { useSettingsStore } from "@/store/settings.store";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { emitter } from "@/lib/litechat/event-emitter";
import { ModEvent } from "@/types/litechat/modding";

// --- Local State Management within Registration Scope ---
let turnAutoTitleEnabled = false; // Default to off for the turn
let updateScopedState: (enabled: boolean) => void = () => {};
// --- End Local State Management ---

// --- Trigger Component ---
const AutoTitleControlTrigger: React.FC = () => {
  // Local state for UI elements, updated by scoped state changes
  const [localAutoTitleEnabled, setLocalAutoTitleEnabled] =
    useState(turnAutoTitleEnabled);

  // Local state managed by events
  const [isStreaming, setIsStreaming] = useState(
    () => useInteractionStore.getState().status === "streaming",
  );
  const [isFirstInteraction, setIsFirstInteraction] = useState(false);

  // Get global setting
  const globalAutoTitleEnabled = useSettingsStore(
    (state) => state.autoTitleEnabled,
  );

  // Effect to manage the scoped state update function
  useEffect(() => {
    updateScopedState = (enabled: boolean) => {
      turnAutoTitleEnabled = enabled;
      setLocalAutoTitleEnabled(enabled); // Update component state
    };
    // Sync initial local state
    setLocalAutoTitleEnabled(turnAutoTitleEnabled);
    return () => {
      updateScopedState = () => {}; // Cleanup on unmount
    };
  }, []);

  // Subscribe to interaction status and context changes
  useEffect(() => {
    const handleStatusChange = (payload: {
      status: "idle" | "loading" | "streaming" | "error";
    }) => {
      setIsStreaming(payload.status === "streaming");
    };

    const checkFirstInteraction = () => {
      const interactionState = useInteractionStore.getState();
      const isFirst =
        interactionState.currentConversationId !== null &&
        interactionState.interactions.filter(
          (i) => i.conversationId === interactionState.currentConversationId,
        ).length === 0;
      setIsFirstInteraction(isFirst);
      // Reset turn state if it's not the first interaction anymore
      if (!isFirst) {
        updateScopedState(false);
      }
    };

    // Initial check
    checkFirstInteraction();

    // Subscriptions
    emitter.on(ModEvent.INTERACTION_STATUS_CHANGED, handleStatusChange);
    emitter.on(ModEvent.CONTEXT_CHANGED, checkFirstInteraction);
    emitter.on(ModEvent.INTERACTION_COMPLETED, checkFirstInteraction); // Re-check after completion

    // Cleanup
    return () => {
      emitter.off(ModEvent.INTERACTION_STATUS_CHANGED, handleStatusChange);
      emitter.off(ModEvent.CONTEXT_CHANGED, checkFirstInteraction);
      emitter.off(ModEvent.INTERACTION_COMPLETED, checkFirstInteraction);
    };
  }, []); // Empty dependency array ensures this runs once

  const handleToggle = () => {
    // Call the scoped state updater
    updateScopedState(!localAutoTitleEnabled);
  };

  // --- Visibility Logic moved into the component ---
  // Only show if globally enabled AND it's the first interaction
  if (!globalAutoTitleEnabled || !isFirstInteraction) {
    return null; // Render nothing if conditions aren't met
  }
  // --- End Visibility Logic ---

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={localAutoTitleEnabled ? "secondary" : "ghost"}
            size="icon"
            className="h-8 w-8"
            onClick={handleToggle}
            disabled={isStreaming}
            aria-label={
              localAutoTitleEnabled
                ? "Disable Auto-Title for this Chat"
                : "Enable Auto-Title for this Chat"
            }
          >
            <SparklesIcon
              className={cn(
                "h-4 w-4",
                localAutoTitleEnabled
                  ? "text-primary"
                  : "text-muted-foreground",
              )}
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">
          {localAutoTitleEnabled
            ? "Auto-Title Enabled (Click to Disable)"
            : "Auto-Title Disabled (Click to Enable)"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

// --- Registration Function ---
export function registerAutoTitleControl() {
  const registerPromptControl =
    useControlRegistryStore.getState().registerPromptControl;

  // Reset transient state on registration
  turnAutoTitleEnabled = false;

  registerPromptControl({
    id: "core-auto-title",
    status: () => "ready",
    triggerRenderer: () => React.createElement(AutoTitleControlTrigger),
    // getMetadata reads directly from the transient scoped state
    getMetadata: () => {
      // Only add metadata if the turn-specific toggle is enabled
      return turnAutoTitleEnabled
        ? { autoTitleEnabledForTurn: true }
        : undefined;
    },
    // clearOnSubmit resets the transient scoped state
    clearOnSubmit: () => {
      turnAutoTitleEnabled = false;
      // Trigger a state update in any mounted trigger component
      updateScopedState(false);
    },
    // Remove the show function - visibility is handled by the component now
    // show: () => { ... }
  });

  console.log("[Function] Registered Core Auto-Title Control");
}
