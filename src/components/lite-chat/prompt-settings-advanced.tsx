// src/components/lite-chat/prompt-settings-advanced.tsx
import React, { useState, useEffect, useMemo } from "react"; // Added useMemo
import { useChatContext } from "@/hooks/use-chat-context";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiKeySelector } from "./api-key-selector";
import { FileManager } from "./file-manager";
import { cn } from "@/lib/utils";
import { db } from "@/lib/db";
import { SaveIcon, InfoIcon } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PromptSettingsAdvancedProps {
  className?: string;
}

export const PromptSettingsAdvanced: React.FC<PromptSettingsAdvancedProps> = ({
  className,
}) => {
  const {
    // Parameters
    temperature,
    setTemperature,
    maxTokens,
    setMaxTokens,
    topP,
    setTopP,
    topK,
    setTopK,
    presencePenalty,
    setPresencePenalty,
    frequencyPenalty,
    setFrequencyPenalty,
    // System Prompt related
    activeSystemPrompt,
    // selectedConversationId, // REMOVED - Use selectedItemId and selectedItemType instead
    selectedItemId, // Use generic selectedItemId
    selectedItemType, // Use selectedItemType to check if it's a conversation
    updateConversationSystemPrompt,
    // VFS related
    vfsEnabled,
  } = useChatContext();

  // Derive conversationId only if the selected item is a conversation
  const conversationId = useMemo(() => {
    return selectedItemType === "conversation" ? selectedItemId : null;
  }, [selectedItemId, selectedItemType]);

  // Local state for conversation-specific system prompt editing
  const [localConvoSystemPrompt, setLocalConvoSystemPrompt] = useState<
    string | null
  >(null);
  const [isConvoPromptDirty, setIsConvoPromptDirty] = useState(false);

  // Effect to load conversation system prompt when the derived conversationId changes
  useEffect(() => {
    // Only load if conversationId is not null (i.e., a conversation is selected)
    if (conversationId) {
      db.conversations
        .get(conversationId)
        .then((convo) => {
          setLocalConvoSystemPrompt(convo?.systemPrompt ?? null);
          setIsConvoPromptDirty(false);
        })
        .catch(() => setLocalConvoSystemPrompt(null));
    } else {
      // Clear local prompt state if no conversation is selected
      setLocalConvoSystemPrompt(null);
      setIsConvoPromptDirty(false);
    }
  }, [conversationId]); // Depend on the derived conversationId

  // Handle changes to the local system prompt textarea
  const handleConvoSystemPromptChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>,
  ) => {
    setLocalConvoSystemPrompt(e.target.value);
    setIsConvoPromptDirty(true);
  };

  // Save the conversation-specific system prompt
  const saveConvoSystemPrompt = () => {
    // Use the derived conversationId
    if (conversationId && isConvoPromptDirty) {
      const promptToSave =
        localConvoSystemPrompt?.trim() === "" ? null : localConvoSystemPrompt;
      updateConversationSystemPrompt(conversationId, promptToSave)
        .then(() => setIsConvoPromptDirty(false))
        .catch((err) => console.error("Failed to save system prompt", err));
    }
  };

  // Helper for number input changes
  const handleNumberInputChange = (
    setter: (value: number | null) => void,
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const value = e.target.value;
    setter(value === "" ? null : parseInt(value, 10) || null);
  };

  // Helper for slider changes
  const handleSliderChange = (
    setter: (value: number | null) => void,
    value: number[],
  ) => {
    setter(value[0]);
  };

  // Use the derived conversationId for conditional rendering/logic
  const isConversationSelected = !!conversationId;
  const isConversationPromptSet =
    localConvoSystemPrompt !== null && localConvoSystemPrompt.trim() !== "";

  return (
    <div className={cn("p-3", className)}>
      <Tabs defaultValue="parameters" className="w-full">
        <TabsList className="grid w-full grid-cols-4 h-9 mb-3">
          <TabsTrigger value="parameters" className="text-xs px-2 h-7">
            Parameters
          </TabsTrigger>
          <TabsTrigger value="system_prompt" className="text-xs px-2 h-7">
            System Prompt
          </TabsTrigger>
          <TabsTrigger value="api_keys" className="text-xs px-2 h-7">
            API Keys
          </TabsTrigger>
          <TabsTrigger
            value="files"
            className="text-xs px-2 h-7"
            disabled={!vfsEnabled}
          >
            Files
          </TabsTrigger>
        </TabsList>

        {/* Parameters Tab Content */}
        <TabsContent value="parameters" className="space-y-4 mt-0">
          <div className="grid grid-cols-2 gap-4 items-end">
            <div className="space-y-1.5">
              <Label htmlFor="temperature" className="text-xs">
                Temperature ({temperature.toFixed(2)})
              </Label>
              <Slider
                id="temperature"
                min={0}
                max={1}
                step={0.01}
                value={[temperature]}
                onValueChange={(value) => setTemperature(value[0])}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="top-p" className="text-xs">
                Top P ({(topP ?? 1.0).toFixed(2)})
              </Label>
              <Slider
                id="top-p"
                min={0}
                max={1}
                step={0.01}
                value={[topP ?? 1.0]}
                onValueChange={(value) => handleSliderChange(setTopP, value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 items-end">
            <div className="space-y-1.5">
              <Label htmlFor="max-tokens" className="text-xs">
                Max Tokens
              </Label>
              <Input
                id="max-tokens"
                type="number"
                placeholder="Default"
                value={maxTokens ?? ""}
                onChange={(e) => handleNumberInputChange(setMaxTokens, e)}
                min="1"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="top-k" className="text-xs">
                Top K
              </Label>
              <Input
                id="top-k"
                type="number"
                placeholder="Default"
                value={topK ?? ""}
                onChange={(e) => handleNumberInputChange(setTopK, e)}
                min="1"
                className="h-8 text-xs"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 items-end">
            <div className="space-y-1.5">
              <Label htmlFor="presence-penalty" className="text-xs">
                Presence Penalty ({(presencePenalty ?? 0.0).toFixed(2)})
              </Label>
              <Slider
                id="presence-penalty"
                min={-2}
                max={2}
                step={0.01}
                value={[presencePenalty ?? 0.0]}
                onValueChange={(value) =>
                  handleSliderChange(setPresencePenalty, value)
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="frequency-penalty" className="text-xs">
                Frequency Penalty ({(frequencyPenalty ?? 0.0).toFixed(2)})
              </Label>
              <Slider
                id="frequency-penalty"
                min={-2}
                max={2}
                step={0.01}
                value={[frequencyPenalty ?? 0.0]}
                onValueChange={(value) =>
                  handleSliderChange(setFrequencyPenalty, value)
                }
              />
            </div>
          </div>
        </TabsContent>

        {/* System Prompt Tab Content */}
        <TabsContent value="system_prompt" className="space-y-3 mt-0">
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
              {/* Use isConversationSelected for conditional rendering */}
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
                            isConvoPromptDirty
                              ? "text-blue-500"
                              : "text-gray-500",
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
              value={localConvoSystemPrompt ?? activeSystemPrompt ?? ""}
              onChange={handleConvoSystemPromptChange}
              className="text-xs min-h-[80px] max-h-[150px]"
              rows={4}
              disabled={!isConversationSelected} // Use derived boolean
            />
            {/* Use isConversationSelected for conditional rendering */}
            {isConversationSelected && !isConversationPromptSet && (
              <p className="text-xs text-gray-400 flex items-center gap-1">
                <InfoIcon className="h-3 w-3" />
                Currently using the global system prompt.
              </p>
            )}
            {isConversationSelected && isConversationPromptSet && (
              <p className="text-xs text-green-400 flex items-center gap-1">
                <InfoIcon className="h-3 w-3" />
                Using this conversation-specific prompt.
              </p>
            )}
          </div>
        </TabsContent>

        {/* API Keys Tab Content */}
        <TabsContent value="api_keys" className="mt-0">
          <ApiKeySelector />
        </TabsContent>

        {/* Files Tab Content */}
        <TabsContent value="files" className="mt-0">
          {vfsEnabled && selectedItemId ? (
            <FileManager key={selectedItemId} />
          ) : (
            <div className="text-center text-sm text-gray-500 py-8">
              Virtual Filesystem is not enabled for the selected item.
              <br />
              Enable it using the toggle in the basic prompt settings area.
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
