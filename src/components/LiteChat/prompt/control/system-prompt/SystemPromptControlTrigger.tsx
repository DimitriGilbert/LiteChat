// src/components/LiteChat/prompt/control/system-prompt/SystemPromptControlTrigger.tsx

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
import { useInteractionStore } from "@/store/interaction.store";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useProjectStore } from "@/store/project.store";
import { useConversationStore } from "@/store/conversation.store";
import { useSettingsStore } from "@/store/settings.store";
import { emitter } from "@/lib/litechat/event-emitter";
import { ModEvent } from "@/types/litechat/modding";
import type { SidebarItemType } from "@/types/litechat/chat";
import type { Project } from "@/types/litechat/project";

interface SystemPromptControlTriggerProps {
  initialPromptValue: string;
  onPromptChange: (prompt: string) => void;
}

export const SystemPromptControlTrigger: React.FC<
  SystemPromptControlTriggerProps
> = ({ initialPromptValue, onPromptChange }) => {
  const [localPrompt, setLocalPrompt] = useState(initialPromptValue);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [effectiveSystemPrompt, setEffectiveSystemPrompt] = useState<
    string | null | undefined
  >(null);
  const [isStreaming, setIsStreaming] = useState(
    () => useInteractionStore.getState().status === "streaming",
  );

  // Sync local state if initial prop changes (e.g., on clear)
  useEffect(() => {
    setLocalPrompt(initialPromptValue);
  }, [initialPromptValue]);

  // Subscribe to events for effective prompt and streaming status
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

    const handleProjectUpdate = (payload: {
      projectId: string;
      updates: Partial<Project>;
    }) => {
      const state = useConversationStore.getState();
      const currentProjectId =
        state.selectedItemType === "project"
          ? state.selectedItemId
          : state.selectedItemType === "conversation"
            ? (state.getConversationById(state.selectedItemId)?.projectId ??
              null)
            : null;
      if (currentProjectId === payload.projectId) {
        updateEffectivePrompt(state.selectedItemId, state.selectedItemType);
      }
    };

    const handleSettingsChange = (payload: { key: string; value: any }) => {
      if (payload.key === "globalSystemPrompt") {
        const state = useConversationStore.getState();
        updateEffectivePrompt(state.selectedItemId, state.selectedItemType);
      }
    };

    const initialState = useConversationStore.getState();
    updateEffectivePrompt(
      initialState.selectedItemId,
      initialState.selectedItemType,
    );

    emitter.on(ModEvent.INTERACTION_STATUS_CHANGED, handleStatusChange);
    emitter.on(ModEvent.CONTEXT_CHANGED, handleContextChange);
    emitter.on(ModEvent.PROJECT_UPDATED, handleProjectUpdate);
    emitter.on(ModEvent.SETTINGS_CHANGED, handleSettingsChange);

    return () => {
      emitter.off(ModEvent.INTERACTION_STATUS_CHANGED, handleStatusChange);
      emitter.off(ModEvent.CONTEXT_CHANGED, handleContextChange);
      emitter.off(ModEvent.PROJECT_UPDATED, handleProjectUpdate);
      emitter.off(ModEvent.SETTINGS_CHANGED, handleSettingsChange);
    };
  }, []);

  const handleSave = useCallback(() => {
    onPromptChange(localPrompt.trim());
    setPopoverOpen(false);
  }, [localPrompt, onPromptChange]);

  const handleClear = useCallback(() => {
    setLocalPrompt("");
    onPromptChange("");
    setPopoverOpen(false);
  }, [onPromptChange]);

  const handleOpenChange = (open: boolean) => {
    if (open) {
      // Sync localPrompt with prop state when opening
      setLocalPrompt(initialPromptValue);
    }
    setPopoverOpen(open);
  };

  const hasTurnPrompt = initialPromptValue.trim().length > 0;

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
