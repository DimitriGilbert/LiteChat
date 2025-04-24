// src/components/lite-chat/prompt/advanced-settings-tabs/system-prompt-tab.tsx
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { SaveIcon, InfoIcon } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/store/settings.store";
import { useSidebarStore } from "@/store/sidebar.store";
import { useChatStorage } from "@/hooks/use-chat-storage";
import { useShallow } from "zustand/react/shallow";

export const SystemPromptTab: React.FC = () => {
  const { globalSystemPrompt } = useSettingsStore(
    useShallow((state) => ({
      globalSystemPrompt: state.globalSystemPrompt,
    })),
  );

  const { selectedItemId, selectedItemType, updateConversationSystemPrompt } =
    useSidebarStore(
      useShallow((state) => ({
        selectedItemId: state.selectedItemId,
        selectedItemType: state.selectedItemType,
        updateConversationSystemPrompt: state.updateConversationSystemPrompt,
      })),
    );

  const { conversations } = useChatStorage();

  const activeConversationData = useMemo(() => {
    if (selectedItemType === "conversation" && selectedItemId) {
      return (conversations || []).find((c) => c.id === selectedItemId);
    }
    return null;
  }, [selectedItemId, selectedItemType, conversations]);

  const [localConvoSystemPrompt, setLocalConvoSystemPrompt] = useState<
    string | null
  >(null);
  const [isConvoPromptDirty, setIsConvoPromptDirty] = useState(false);

  const conversationId = useMemo(() => {
    return selectedItemType === "conversation" ? selectedItemId : null;
  }, [selectedItemId, selectedItemType]);

  useEffect(() => {
    if (conversationId) {
      const promptFromProp = activeConversationData?.systemPrompt ?? null;
      setLocalConvoSystemPrompt((prev) =>
        prev === promptFromProp ? prev : promptFromProp,
      );
      setIsConvoPromptDirty(false);
    } else {
      setLocalConvoSystemPrompt(null);
      setIsConvoPromptDirty(false);
    }
  }, [conversationId, activeConversationData]);

  const handleConvoSystemPromptChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>,
  ) => {
    setLocalConvoSystemPrompt(e.target.value);
    setIsConvoPromptDirty(true);
  };

  const saveConvoSystemPrompt = useCallback(() => {
    if (conversationId && isConvoPromptDirty) {
      const promptToSave =
        localConvoSystemPrompt?.trim() === "" ? null : localConvoSystemPrompt;
      updateConversationSystemPrompt(conversationId, promptToSave)
        .then(() => {
          setIsConvoPromptDirty(false);
          toast.success("Conversation system prompt saved.");
        })
        .catch((err) => {
          console.error("Failed to save system prompt", err);
          toast.error("Failed to save system prompt.");
        });
    }
  }, [
    conversationId,
    isConvoPromptDirty,
    localConvoSystemPrompt,
    updateConversationSystemPrompt,
  ]);

  const isConversationSelected = !!conversationId;
  const isConversationPromptSet =
    localConvoSystemPrompt !== null && localConvoSystemPrompt.trim() !== "";
  const isUsingGlobalOrDefault =
    !isConversationPromptSet ||
    (activeConversationData?.systemPrompt === globalSystemPrompt &&
      globalSystemPrompt !== null);

  return (
    <div className="space-y-3 mt-0">
      <div className="space-y-1.5">
        <div className="flex justify-between items-center">
          <Label
            htmlFor="convo-system-prompt"
            className={cn(
              "text-xs",
              !isConversationSelected && "text-gray-500",
            )}
          >
            Current Conversation Prompt
          </Label>
          {isConversationSelected && (
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={saveConvoSystemPrompt}
                    disabled={!isConvoPromptDirty}
                  >
                    <SaveIcon
                      className={cn(
                        "h-3.5 w-3.5",
                        isConvoPromptDirty ? "text-blue-500" : "text-gray-500",
                      )}
                    />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>
                    {isConvoPromptDirty
                      ? "Save conversation prompt"
                      : "No changes to save"}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <Textarea
          id="convo-system-prompt"
          placeholder={
            isConversationSelected
              ? "Override global prompt for this chat (leave blank to use global)"
              : "Select a conversation to set its specific system prompt"
          }
          value={localConvoSystemPrompt ?? ""}
          onChange={handleConvoSystemPromptChange}
          className="text-xs min-h-[80px] max-h-[150px]"
          rows={4}
          disabled={!isConversationSelected}
        />
        {isConversationSelected && isUsingGlobalOrDefault && (
          <p className="text-xs text-gray-400 flex items-center gap-1">
            <InfoIcon className="h-3 w-3" />
            Currently using the global system prompt (or default).
          </p>
        )}
        {isConversationSelected && !isUsingGlobalOrDefault && (
          <p className="text-xs text-green-400 flex items-center gap-1">
            <InfoIcon className="h-3 w-3" />
            Using this conversation-specific prompt.
          </p>
        )}
      </div>
      <div className="space-y-1.5 pt-2 border-t border-gray-700/50">
        <Label htmlFor="global-system-prompt-ref" className="text-xs">
          Global System Prompt (Reference)
        </Label>
        <Textarea
          id="global-system-prompt-ref"
          readOnly
          value={globalSystemPrompt ?? "Not set or disabled"}
          className="text-xs min-h-[60px] max-h-[100px] bg-gray-800/50 border-gray-700/50"
          rows={3}
        />
        <p className="text-xs text-gray-500">
          Managed in main Settings dialog. Used when conversation prompt is
          blank.
        </p>
      </div>
    </div>
  );
};
