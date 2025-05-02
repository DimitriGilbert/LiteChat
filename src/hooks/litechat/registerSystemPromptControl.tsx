// src/hooks/litechat/registerSystemPromptControl.tsx
import React, { useState, useCallback, useEffect, useMemo } from "react";
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

let turnSystemPromptValue = "";
let updateScopedPrompt: (prompt: string) => void = () => {};

export function registerSystemPromptControl() {
  const registerPromptControl =
    useControlRegistryStore.getState().registerPromptControl;

  turnSystemPromptValue = "";

  const SystemPromptControlTrigger: React.FC = () => {
    const [localPrompt, setLocalPrompt] = useState(turnSystemPromptValue);
    const [popoverOpen, setPopoverOpen] = useState(false);
    const [scopedValueChanged, setScopedValueChanged] = useState(0);

    const isStreaming = useInteractionStore(
      useShallow((state) => state.status === "streaming"),
    );

    const { selectedItemId, selectedItemType } = useConversationStore(
      useShallow((state) => ({
        selectedItemId: state.selectedItemId,
        selectedItemType: state.selectedItemType,
      })),
    );
    const { getConversationById } = useConversationStore.getState();
    const { getEffectiveProjectSettings } = useProjectStore.getState();
    const globalSystemPrompt = useSettingsStore(
      (state) => state.globalSystemPrompt,
    );

    const effectiveSystemPrompt = useMemo(() => {
      const currentProjectId =
        selectedItemType === "project"
          ? selectedItemId
          : selectedItemType === "conversation"
            ? (getConversationById(selectedItemId)?.projectId ?? null)
            : null;
      return (
        getEffectiveProjectSettings(currentProjectId).systemPrompt ??
        globalSystemPrompt
      );
    }, [
      selectedItemId,
      selectedItemType,
      getConversationById,
      getEffectiveProjectSettings,
      globalSystemPrompt,
    ]);

    useEffect(() => {
      updateScopedPrompt = (prompt: string) => {
        turnSystemPromptValue = prompt;
        setLocalPrompt(prompt);
        setScopedValueChanged((v) => v + 1);
      };
      setLocalPrompt(turnSystemPromptValue);
      return () => {
        updateScopedPrompt = () => {};
      };
    }, []);

    useEffect(() => {
      setLocalPrompt(turnSystemPromptValue);
    }, [scopedValueChanged]);

    const handleSave = useCallback(() => {
      updateScopedPrompt(localPrompt.trim());
      setPopoverOpen(false);
    }, [localPrompt]);

    const handleClear = useCallback(() => {
      updateScopedPrompt("");
      setPopoverOpen(false);
    }, []);

    const handleOpenChange = (open: boolean) => {
      if (open) {
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

  registerPromptControl({
    id: "core-system-prompt",
    // order removed
    status: () => "ready",
    triggerRenderer: () => React.createElement(SystemPromptControlTrigger),
    getMetadata: () => {
      const prompt = turnSystemPromptValue.trim();
      return prompt ? { turnSystemPrompt: prompt } : undefined;
    },
    clearOnSubmit: () => {
      turnSystemPromptValue = "";
      updateScopedPrompt("");
    },
    show: () => true,
  });

  console.log("[Function] Registered Core System Prompt Control");
}
