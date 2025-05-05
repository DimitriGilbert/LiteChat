// src/components/LiteChat/prompt/control/auto-title/AutoTitleControlTrigger.tsx
// FULL FILE - Moved from registerAutoTitleControl.tsx
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { SparklesIcon } from "lucide-react";
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

// Props interface for communication with registration scope
interface AutoTitleControlTriggerProps {
  initialEnabled: boolean;
  onToggle: (enabled: boolean) => void;
}

export const AutoTitleControlTrigger: React.FC<
  AutoTitleControlTriggerProps
> = ({ initialEnabled, onToggle }) => {
  // Local state for UI elements, synced with parent via props/callbacks
  const [localAutoTitleEnabled, setLocalAutoTitleEnabled] =
    useState(initialEnabled);

  // Local state managed by events
  const [isStreaming, setIsStreaming] = useState(
    () => useInteractionStore.getState().status === "streaming",
  );
  const [isFirstInteraction, setIsFirstInteraction] = useState(false);

  // Get global setting
  const globalAutoTitleEnabled = useSettingsStore(
    (state) => state.autoTitleEnabled,
  );

  // Effect to sync local state if the initial prop changes (e.g., on clear)
  useEffect(() => {
    setLocalAutoTitleEnabled(initialEnabled);
  }, [initialEnabled]);

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
      // Reset turn state via callback if it's not the first interaction anymore
      if (!isFirst && localAutoTitleEnabled) {
        handleToggle(); // This calls the parent's toggle logic
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
    // Add localAutoTitleEnabled to dependencies for the reset logic
  }, [localAutoTitleEnabled]);

  const handleToggle = () => {
    const newState = !localAutoTitleEnabled;
    setLocalAutoTitleEnabled(newState);
    onToggle(newState); // Call the callback passed from registration
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
