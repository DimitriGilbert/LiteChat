// src/hooks/litechat/useToolSelectorControlRegistration.tsx
import { useEffect, useState, useCallback, useRef } from "react"; // Added useRef
import { useControlRegistryStore } from "@/store/control.store";
import { useConversationStore } from "@/store/conversation.store";
import { ToolSelectorControlComponent } from "@/components/LiteChat/prompt/control/ToolSelectorControlComponent";
import { Button } from "@/components/ui/button";
import { WrenchIcon } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useUIStateStore } from "@/store/ui.store";
import { useShallow } from "zustand/react/shallow";
import { useSettingsStore } from "@/store/settings.store"; // Import settings store for default

const CONTROL_ID = "core-tool-selector";

export function useToolSelectorControlRegistration() {
  const registerPromptControl = useControlRegistryStore(
    (state) => state.registerPromptControl,
  );
  const isPanelOpen = useUIStateStore(
    (state) => state.isPromptControlPanelOpen[CONTROL_ID] ?? false,
  );
  const togglePanel = useUIStateStore(
    (state) => state.togglePromptControlPanel,
  );

  // Get selected conversation state (only needed for enabledTools display)
  const { selectedItemId, selectedItemType, getConversationById } =
    useConversationStore(
      useShallow((state) => ({
        selectedItemId: state.selectedItemId,
        selectedItemType: state.selectedItemType,
        getConversationById: state.getConversationById,
        // Removed updateCurrentConversationToolSettings
      })),
    );
  // Get global default from settings store
  const globalDefaultMaxSteps = useSettingsStore((state) => state.toolMaxSteps);

  // Local state for the override value *within the hook*
  // This state is ONLY used while the popover is potentially open.
  const [localMaxStepsOverride, setLocalMaxStepsOverride] = useState<
    number | null
  >(null);
  // Ref to store the *actual* override value to be used by getMetadata
  // This avoids getMetadata depending on the frequently changing state
  const maxStepsOverrideRef = useRef<number | null>(null);

  // Effect to initialize/reset the local override state when the popover opens/closes
  // or when the global default changes
  useEffect(() => {
    if (isPanelOpen) {
      // When opening, initialize local state to the current global default
      // The ref is set to null initially, meaning no override active yet.
      setLocalMaxStepsOverride(globalDefaultMaxSteps);
      maxStepsOverrideRef.current = null; // Reset override ref
    } else {
      // When closing, reset local state and ref
      setLocalMaxStepsOverride(null);
      maxStepsOverrideRef.current = null;
    }
  }, [isPanelOpen, globalDefaultMaxSteps]);

  // Callback to update the local state for the input component's visual feedback
  // This also updates the ref which getMetadata will read.
  const handleLocalMaxStepsChange = useCallback(
    (steps: number | null) => {
      // Allow null temporarily if input is empty, handle clamping below
      setLocalMaxStepsOverride(steps);

      // Update the ref immediately after clamping/validation
      if (steps === null || isNaN(steps)) {
        maxStepsOverrideRef.current = null; // Treat empty/invalid as no override
      } else {
        const clampedSteps = Math.max(1, Math.min(20, steps));
        maxStepsOverrideRef.current = clampedSteps;
      }
    },
    [], // No dependencies needed as it only sets local state/ref
  );

  // No store update on blur needed anymore
  // const handleMaxStepsBlur = useCallback(() => { ... }, []);

  useEffect(() => {
    const unregister = registerPromptControl({
      id: CONTROL_ID,
      order: 30, // Adjust order as needed
      show: () => true, // Always show the trigger
      triggerRenderer: () => {
        // Read enabledTools count directly from the current conversation state
        const conversation =
          selectedItemType === "conversation" && selectedItemId
            ? getConversationById(selectedItemId)
            : null;
        const enabledCount = conversation?.metadata?.enabledTools?.length ?? 0;
        const isConversationSelected =
          selectedItemType === "conversation" && !!selectedItemId;

        return (
          <Popover
            open={isPanelOpen && isConversationSelected}
            onOpenChange={(open) => {
              if (isConversationSelected) {
                togglePanel(CONTROL_ID, open);
              }
              // No blur logic needed here anymore
            }}
          >
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2 text-xs"
                disabled={!isConversationSelected} // Disable if no conversation selected
                aria-label="Select Tools"
              >
                <WrenchIcon className="h-3.5 w-3.5 mr-1" />
                Tools {enabledCount > 0 ? `(${enabledCount})` : ""}
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-auto p-0"
              side="top"
              align="start"
              onOpenAutoFocus={(e) => e.preventDefault()} // Prevent focus stealing
              // No need for onInteractOutside anymore
            >
              {/* Pass local state management */}
              <ToolSelectorControlComponent
                // Pass the potentially null value for display handling
                localMaxSteps={localMaxStepsOverride || 5}
                setLocalMaxSteps={handleLocalMaxStepsChange}
                // onMaxStepsBlur is removed
              />
            </PopoverContent>
          </Popover>
        );
      },
      // getMetadata reads enabledTools from conversation, override from ref
      getMetadata: () => {
        const conversationState = useConversationStore.getState();
        const settingsState = useSettingsStore.getState();
        const metadata: Record<string, any> = {};

        // Get enabled tools from conversation metadata
        if (
          conversationState.selectedItemType === "conversation" &&
          conversationState.selectedItemId
        ) {
          const conversation = conversationState.getConversationById(
            conversationState.selectedItemId,
          );
          if (conversation?.metadata?.enabledTools?.length) {
            metadata.enabledTools = [...conversation.metadata.enabledTools];
          }
        }

        // Get maxSteps override from the ref, include only if set and different from global
        const overrideValue = maxStepsOverrideRef.current;
        if (
          overrideValue !== null &&
          overrideValue !== settingsState.toolMaxSteps
        ) {
          metadata.maxSteps = overrideValue;
        }

        return metadata;
      },
      // Clear the ref when the prompt is submitted
      clearOnSubmit: () => {
        maxStepsOverrideRef.current = null;
        // Reset visual state if popover might remain open (optional)
        // setLocalMaxStepsOverride(globalDefaultMaxSteps);
      },
    });

    return unregister;
  }, [
    registerPromptControl,
    isPanelOpen,
    togglePanel,
    selectedItemId,
    selectedItemType,
    getConversationById,
    localMaxStepsOverride, // Need this to re-render the component with correct value
    handleLocalMaxStepsChange,
    globalDefaultMaxSteps, // Need this for comparison in getMetadata
  ]);
}
