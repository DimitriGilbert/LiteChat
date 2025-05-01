// src/hooks/litechat/registerSystemPromptControl.tsx
// Entire file content provided
import React, { useState, useCallback, useEffect } from "react";
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
import { useShallow } from "zustand/react/shallow";
import { useProjectStore } from "@/store/project.store";
import { useConversationStore } from "@/store/conversation.store";
import { useSettingsStore } from "@/store/settings.store";

// --- Local State Management within Registration Scope ---
let turnSystemPromptValue = "";
// Callback to allow the component to update the scoped variable
let updateScopedPrompt: (prompt: string) => void = () => {};
// --- End Local State Management ---

export function registerSystemPromptControl() {
  const registerPromptControl =
    useControlRegistryStore.getState().registerPromptControl;

  // Reset local state when registering
  turnSystemPromptValue = "";

  const SystemPromptControlTrigger: React.FC = () => {
    // Local state *within the component* for the textarea and popover
    const [localPrompt, setLocalPrompt] = useState(turnSystemPromptValue);
    const [popoverOpen, setPopoverOpen] = useState(false);
    // Local state to track if the scoped variable has changed, forcing re-render
    const [scopedValueChanged, setScopedValueChanged] = useState(0);

    const isStreaming = useInteractionStore(
      useShallow((state) => state.status === "streaming"),
    );

    // Get effective prompt for placeholder (remains the same)
    const { selectedItemId, selectedItemType } = useConversationStore(
      useShallow((state) => ({
        selectedItemId: state.selectedItemId,
        selectedItemType: state.selectedItemType,
        getConversationById: state.getConversationById,
      })),
    );
    const { getEffectiveProjectSettings } = useProjectStore(
      useShallow((state) => ({
        getEffectiveProjectSettings: state.getEffectiveProjectSettings,
      })),
    );
    const globalSystemPrompt = useSettingsStore(
      (state) => state.globalSystemPrompt,
    );

    const currentProjectId =
      selectedItemType === "project"
        ? selectedItemId
        : selectedItemType === "conversation"
          ? (useConversationStore.getState().getConversationById(selectedItemId)
              ?.projectId ?? null)
          : null;
    const effectiveSystemPrompt =
      getEffectiveProjectSettings(currentProjectId).systemPrompt ??
      globalSystemPrompt;

    // Provide a way for this component instance to update the scoped variable
    useEffect(() => {
      updateScopedPrompt = (prompt: string) => {
        turnSystemPromptValue = prompt;
        // Update local component state to trigger re-render if needed
        setLocalPrompt(prompt);
        setScopedValueChanged((v) => v + 1); // Force re-render
      };
      // Initial sync
      setLocalPrompt(turnSystemPromptValue);
      // Cleanup
      return () => {
        updateScopedPrompt = () => {};
      };
    }, []); // Empty dependency array

    // Sync local state if scoped variable changes (e.g., via clearOnSubmit)
    useEffect(() => {
      setLocalPrompt(turnSystemPromptValue);
    }, [scopedValueChanged]); // Depend on the counter

    const handleSave = useCallback(() => {
      // Update the scoped variable via the callback
      updateScopedPrompt(localPrompt.trim());
      setPopoverOpen(false);
    }, [localPrompt]);

    const handleClear = useCallback(() => {
      // Update the scoped variable via the callback
      updateScopedPrompt("");
      setPopoverOpen(false);
    }, []);

    const handleOpenChange = (open: boolean) => {
      if (open) {
        // Reset local state to current scoped value when opening
        setLocalPrompt(turnSystemPromptValue);
      }
      setPopoverOpen(open);
    };

    // Read directly from the scoped variable for button state
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
            value={localPrompt} // Use local state for input value
            onChange={(e) => setLocalPrompt(e.target.value)} // Update local state
            rows={5}
            className="text-sm"
          />
          <div className="flex justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={handleClear}
              disabled={!localPrompt.trim()} // Disable based on local input
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

  registerPromptControl({
    id: "core-system-prompt",
    order: 15,
    status: () => "ready",
    triggerRenderer: () => React.createElement(SystemPromptControlTrigger),
    getMetadata: () => {
      // Read directly from the scoped variable
      const prompt = turnSystemPromptValue.trim();
      return prompt ? { turnSystemPrompt: prompt } : undefined;
    },
    clearOnSubmit: () => {
      // Reset the scoped variable
      turnSystemPromptValue = "";
      // Trigger update in component instance if mounted
      updateScopedPrompt("");
    },
    show: () => true,
  });

  console.log("[Function] Registered Core System Prompt Control");
}
