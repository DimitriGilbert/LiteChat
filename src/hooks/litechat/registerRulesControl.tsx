// src/hooks/litechat/registerRulesControl.tsx
// FULL FILE
import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { TagsIcon } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useControlRegistryStore } from "@/store/control.store";
import { useInteractionStore } from "@/store/interaction.store";
import { RulesControlDialogContent } from "@/components/LiteChat/prompt/control/rules/RulesControlDialogContent";
import { useRulesStore } from "@/store/rules.store";
import { emitter } from "@/lib/litechat/event-emitter";
import { ModEvent } from "@/types/litechat/modding";

// --- Local State Management within Registration Scope ---
let transientActiveTagIds = new Set<string>();
let transientActiveRuleIds = new Set<string>();
let updateScopedState: (
  updater: (prev: {
    activeTagIds: Set<string>;
    activeRuleIds: Set<string>;
  }) => { activeTagIds: Set<string>; activeRuleIds: Set<string> },
) => void = () => {};
// --- End Local State Management ---

// --- Trigger Component ---
const RulesControlTrigger: React.FC = () => {
  // Local state for UI elements, updated by scoped state changes
  const [localState, setLocalState] = useState({
    activeTagIds: transientActiveTagIds,
    activeRuleIds: transientActiveRuleIds,
  });
  const [popoverOpen, setPopoverOpen] = useState(false);

  // Local state managed by events
  const [isStreaming, setIsStreaming] = useState(
    () => useInteractionStore.getState().status === "streaming",
  );
  // Check if rules or tags exist
  const hasRulesOrTags = useRulesStore(
    (state) => state.rules.length > 0 || state.tags.length > 0,
  );

  // Effect to manage the scoped state update function
  useEffect(() => {
    updateScopedState = (updater) => {
      const newState = updater({
        activeTagIds: transientActiveTagIds,
        activeRuleIds: transientActiveRuleIds,
      });
      transientActiveTagIds = newState.activeTagIds;
      transientActiveRuleIds = newState.activeRuleIds;
      setLocalState(newState);
    };
    // Sync initial local state
    setLocalState({
      activeTagIds: transientActiveTagIds,
      activeRuleIds: transientActiveRuleIds,
    });
    return () => {
      updateScopedState = () => {};
    };
  }, []);

  // Subscribe to interaction status changes
  useEffect(() => {
    const handleStatusChange = (payload: {
      status: "idle" | "loading" | "streaming" | "error";
    }) => {
      setIsStreaming(payload.status === "streaming");
    };
    // Subscribe using emitter
    emitter.on(ModEvent.INTERACTION_STATUS_CHANGED, handleStatusChange);
    // Cleanup subscription in the return function
    return () => {
      emitter.off(ModEvent.INTERACTION_STATUS_CHANGED, handleStatusChange);
    };
  }, []);

  // --- Event Handlers ---
  const handleToggleTag = useCallback((tagId: string, isActive: boolean) => {
    updateScopedState((prev) => {
      const nextTags = new Set(prev.activeTagIds);
      if (isActive) nextTags.add(tagId);
      else nextTags.delete(tagId);
      return { ...prev, activeTagIds: nextTags };
    });
  }, []);

  const handleToggleRule = useCallback((ruleId: string, isActive: boolean) => {
    updateScopedState((prev) => {
      const nextRules = new Set(prev.activeRuleIds);
      if (isActive) nextRules.add(ruleId);
      else nextRules.delete(ruleId);
      return { ...prev, activeRuleIds: nextRules };
    });
  }, []);

  // --- Derived State for Rendering ---
  const hasActiveSettings =
    localState.activeTagIds.size > 0 || localState.activeRuleIds.size > 0;
  const isDisabled = isStreaming || !hasRulesOrTags;

  if (!hasRulesOrTags) {
    return null;
  }

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                variant={hasActiveSettings ? "secondary" : "ghost"}
                size="icon"
                className="h-8 w-8"
                disabled={isDisabled}
                aria-label="Configure Rules & Tags for Next Turn"
              >
                <TagsIcon className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="top">
            {hasActiveSettings
              ? `Rules/Tags Active (${localState.activeTagIds.size} tags, ${localState.activeRuleIds.size} rules)`
              : "Activate Rules/Tags (Next Turn)"}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <PopoverContent className="w-auto p-0" align="start">
        <RulesControlDialogContent
          activeTagIds={localState.activeTagIds}
          activeRuleIds={localState.activeRuleIds}
          onToggleTag={handleToggleTag}
          onToggleRule={handleToggleRule}
        />
      </PopoverContent>
    </Popover>
  );
};

// --- Registration Function ---
export function registerRulesControl() {
  const registerPromptControl =
    useControlRegistryStore.getState().registerPromptControl;

  // Reset transient state on registration
  transientActiveTagIds = new Set<string>();
  transientActiveRuleIds = new Set<string>();

  registerPromptControl({
    id: "core-rules-tags",
    // order removed
    status: () => (useRulesStore.getState().isLoading ? "loading" : "ready"),
    triggerRenderer: () => React.createElement(RulesControlTrigger),
    // getMetadata reads directly from the transient scoped state
    getMetadata: () => {
      const tags = Array.from(transientActiveTagIds);
      const rules = Array.from(transientActiveRuleIds);
      if (tags.length > 0 || rules.length > 0) {
        return {
          activeTagIds: tags,
          activeRuleIds: rules,
        };
      }
      return undefined;
    },
    // clearOnSubmit resets the transient scoped state
    clearOnSubmit: () => {
      transientActiveTagIds = new Set<string>();
      transientActiveRuleIds = new Set<string>();
      // Trigger a state update in any mounted trigger component
      updateScopedState(() => ({
        activeTagIds: new Set<string>(),
        activeRuleIds: new Set<string>(),
      }));
    },
    // Show only if rules or tags exist
    show: () => {
      const state = useRulesStore.getState();
      return state.rules.length > 0 || state.tags.length > 0;
    },
  });

  console.log("[Function] Registered Core Rules & Tags Control");
}
