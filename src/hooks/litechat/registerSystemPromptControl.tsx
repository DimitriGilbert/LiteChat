// src/hooks/litechat/registerSystemPromptControl.tsx
// FULL FILE
import React, { useState, useCallback, useEffect } from "react"; // useMemo removed
import { Button } from "@/components/ui/button";
import { TextIcon } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useControlRegistryStore } from "@/store/control.store";
import { useInteractionStore } from "@/store/interaction.store";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
// useShallow removed
import { useProjectStore } from "@/store/project.store";
import { useConversationStore } from "@/store/conversation.store";
import { useSettingsStore } from "@/store/settings.store";
import { emitter } from "@/lib/litechat/event-emitter";
import { ModEvent } from "@/types/litechat/modding";
import type { SidebarItemType } from "@/types/litechat/chat";
import type { Project } from "@/types/litechat/project"; // Import Project type

// --- Local State Management within Registration Scope ---
let turnSystemPromptValue = "";
let updateScopedPrompt: (prompt: string) => void = () => {};
// --- End Local State Management ---

// --- Trigger Component ---
const SystemPromptControlTrigger: React.FC = () => {
  // Local state for UI elements
  const [localPrompt, setLocalPrompt] = useState(turnSystemPromptValue);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [effectiveSystemPrompt, setEffectiveSystemPrompt] = useState<
    string | null | undefined
  >(null);

  // Local state managed by events
  const [isStreaming, setIsStreaming] = useState(
    () => useInteractionStore.getState().status === "streaming",
  );

  // Effect to manage the scoped state update function
  useEffect(() => {
    updateScopedPrompt = (prompt: string) => {
      turnSystemPromptValue = prompt;
      setLocalPrompt(prompt); // Update component state
    };
    // Sync initial local state
    setLocalPrompt(turnSystemPromptValue);
    return () => {
      updateScopedPrompt = () => {}; // Cleanup on unmount
    };
  }, []);

  // Subscribe to events
  useEffect(() => {
    const handleStatusChange = (payload: {
      status: "idle" | "loading" | "streaming" | "error";
    }) => {
      setIsStreaming(payload.status === "streaming");
    };

    const updateEffectivePrompt = (
      selectedItemId: string | null,
      selectedItemType: SidebarItemType | null,
    ) => {
      const { getConversationById } = useConversationStore.getState();
      const { getEffectiveProjectSettings } = useProjectStore.getState();
      const globalSystemPrompt = useSettingsStore.getState().globalSystemPrompt;

      const currentProjectId =
        selectedItemType === "project"
          ? selectedItemId
          : selectedItemType === "conversation"
            ? (getConversationById(selectedItemId)?.projectId ?? null)
            : null;
      setEffectiveSystemPrompt(
        getEffectiveProjectSettings(currentProjectId).systemPrompt ??
          globalSystemPrompt,
      );
    };

    const handleContextChange = (payload: {
      selectedItemId: string | null;
      selectedItemType: SidebarItemType | null;
    }) => {
      updateEffectivePrompt(payload.selectedItemId, payload.selectedItemType);
    };

    // Handler for project updates
    const handleProjectUpdate = (payload: {
      projectId: string;
      updates: Partial<Project>;
    }) => {
      // Re-calculate effective prompt if the updated project might affect the current context
      const state = useConversationStore.getState();
      const currentProjectId =
        state.selectedItemType === "project"
          ? state.selectedItemId
          : state.selectedItemType === "conversation"
            ? (state.getConversationById(state.selectedItemId)?.projectId ??
              null)
            : null;
      // Check if the updated project is the current one or an ancestor (more complex check needed for full ancestry)
      // For simplicity, let's just re-check if *any* project update happens that *could* affect it.
      // A more precise check would involve traversing the project tree.

      if (currentProjectId === payload.projectId) {
        // Simplified check: always update on any project change
        updateEffectivePrompt(state.selectedItemId, state.selectedItemType);
      }
    };

    // Handler for settings changes
    const handleSettingsChange = (payload: { key: string; value: any }) => {
      if (payload.key === "globalSystemPrompt") {
        const state = useConversationStore.getState();
        updateEffectivePrompt(state.selectedItemId, state.selectedItemType);
      }
    };

    // Initial check
    const initialState = useConversationStore.getState();
    updateEffectivePrompt(
      initialState.selectedItemId,
      initialState.selectedItemType,
    );

    // Subscriptions
    emitter.on(ModEvent.INTERACTION_STATUS_CHANGED, handleStatusChange);
    emitter.on(ModEvent.CONTEXT_CHANGED, handleContextChange);
    // Correctly subscribe to PROJECT_UPDATED
    emitter.on(ModEvent.PROJECT_UPDATED, handleProjectUpdate);
    // Correctly subscribe to SETTINGS_CHANGED
    emitter.on(ModEvent.SETTINGS_CHANGED, handleSettingsChange);

    // Cleanup
    return () => {
      emitter.off(ModEvent.INTERACTION_STATUS_CHANGED, handleStatusChange);
      emitter.off(ModEvent.CONTEXT_CHANGED, handleContextChange);
      emitter.off(ModEvent.PROJECT_UPDATED, handleProjectUpdate);
      emitter.off(ModEvent.SETTINGS_CHANGED, handleSettingsChange);
    };
  }, []); // Empty dependency array

  // --- Event Handlers ---
  const handleSave = useCallback(() => {
    updateScopedPrompt(localPrompt.trim()); // Update scoped state
    setPopoverOpen(false);
  }, [localPrompt]);

  const handleClear = useCallback(() => {
    updateScopedPrompt(""); // Update scoped state
    setPopoverOpen(false);
  }, []);

  const handleOpenChange = (open: boolean) => {
    if (open) {
      // Sync localPrompt with scoped state when opening
      setLocalPrompt(turnSystemPromptValue);
    }
    setPopoverOpen(open);
  };

  const hasTurnPrompt = turnSystemPromptValue.trim().length > 0;

  return (
    <Popover open={popoverOpen} onOpenChange={handleOpenChange}>
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                variant={hasTurnPrompt ? "secondary" : "ghost"}
                size="icon"
                className="h-8 w-8"
                disabled={isStreaming}
                aria-label="Set System Prompt for Next Turn"
              >
                <TextIcon className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="top">
            {hasTurnPrompt
              ? "System Prompt Override Active"
              : "Set System Prompt (Next Turn)"}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <PopoverContent className="w-80 p-4 space-y-3" align="start">
        <Label htmlFor="turn-system-prompt">
          System Prompt (Overrides Project/Global for Next Turn)
        </Label>
        <Textarea
          id="turn-system-prompt"
          placeholder={`Inherited: ${effectiveSystemPrompt?.substring(0, 50) || "Default"}${effectiveSystemPrompt && effectiveSystemPrompt.length > 50 ? "..." : ""}`}
          value={localPrompt}
          onChange={(e) => setLocalPrompt(e.target.value)}
          rows={5}
          className="text-sm"
        />
        <div className="flex justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={handleClear}
            disabled={!localPrompt.trim()}
          >
            Clear Override
          </Button>
          <Button size="sm" onClick={handleSave}>
            Set for Next Turn
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

// --- Registration Function ---
export function registerSystemPromptControl() {
  const registerPromptControl =
    useControlRegistryStore.getState().registerPromptControl;

  // Reset transient state on registration
  turnSystemPromptValue = "";

  registerPromptControl({
    id: "core-system-prompt",
    // order removed
    status: () => "ready",
    triggerRenderer: () => React.createElement(SystemPromptControlTrigger),
    // getMetadata reads directly from the transient scoped state
    getMetadata: () => {
      const prompt = turnSystemPromptValue.trim();
      return prompt ? { turnSystemPrompt: prompt } : undefined;
    },
    // clearOnSubmit resets the transient scoped state
    clearOnSubmit: () => {
      turnSystemPromptValue = "";
      // Trigger a state update in any mounted trigger component
      updateScopedPrompt("");
    },
    // show function removed - component always renders trigger
    // show: () => true,
  });

  console.log("[Function] Registered Core System Prompt Control");
}
