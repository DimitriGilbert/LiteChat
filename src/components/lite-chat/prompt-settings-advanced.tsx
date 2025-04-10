// src/components/lite-chat/prompt-settings-advanced.tsx
import React, { useState, useEffect, useMemo } from "react";
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
    activeSystemPrompt,
    selectedItemId,
    selectedItemType,
    updateConversationSystemPrompt,
    isVfsEnabledForItem,
    vfs,
    getConversation,
    enableApiKeyManagement, // <-- Get flag
  } = useChatContext();

  // ... (state and effects for localConvoSystemPrompt remain the same) ...
  const conversationId = useMemo(() => {
    return selectedItemType === "conversation" ? selectedItemId : null;
  }, [selectedItemId, selectedItemType]);

  const [localConvoSystemPrompt, setLocalConvoSystemPrompt] = useState<
    string | null
  >(null);
  const [isConvoPromptDirty, setIsConvoPromptDirty] = useState(false);

  useEffect(() => {
    if (conversationId && getConversation) {
      getConversation(conversationId)
        .then((convo) => {
          setLocalConvoSystemPrompt(convo?.systemPrompt ?? null);
          setIsConvoPromptDirty(false);
        })
        .catch(() => setLocalConvoSystemPrompt(null));
    } else {
      setLocalConvoSystemPrompt(null);
      setIsConvoPromptDirty(false);
    }
  }, [conversationId, getConversation]);

  const handleConvoSystemPromptChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>,
  ) => {
    // ... (logic remains the same)
    setLocalConvoSystemPrompt(e.target.value);
    setIsConvoPromptDirty(true);
  };

  const saveConvoSystemPrompt = () => {
    // ... (logic remains the same)
    if (conversationId && isConvoPromptDirty) {
      const promptToSave =
        localConvoSystemPrompt?.trim() === "" ? null : localConvoSystemPrompt;
      updateConversationSystemPrompt(conversationId, promptToSave)
        .then(() => setIsConvoPromptDirty(false))
        .catch((err) => console.error("Failed to save system prompt", err));
    }
  };

  const handleNumberInputChange = (
    setter: (value: number | null) => void,
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    // ... (logic remains the same)
    const value = e.target.value;
    setter(value === "" ? null : parseInt(value, 10) || null);
  };

  const handleSliderChange = (
    setter: (value: number | null) => void,
    value: number[],
  ) => {
    // ... (logic remains the same)
    setter(value[0]);
  };

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
          {/* Conditionally render API Keys tab */}
          {enableApiKeyManagement && (
            <TabsTrigger value="api_keys" className="text-xs px-2 h-7">
              API Keys
            </TabsTrigger>
          )}
          <TabsTrigger
            value="files"
            className="text-xs px-2 h-7"
            disabled={!isVfsEnabledForItem}
          >
            Files
          </TabsTrigger>
        </TabsList>

        {/* Parameters Tab */}
        <TabsContent value="parameters" className="space-y-4 mt-0">
          {/* ... (Parameter sliders/inputs remain the same) ... */}
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

        {/* System Prompt Tab */}
        <TabsContent value="system_prompt" className="space-y-3 mt-0">
          {/* ... (System prompt textarea and logic remain the same) ... */}
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
              disabled={!isConversationSelected}
            />
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

        {/* API Keys Tab - Conditionally render content */}
        {enableApiKeyManagement && (
          <TabsContent value="api_keys" className="mt-0">
            <ApiKeySelector />
            {/* You might add a link/button here to go to the full API Key settings */}
            <p className="text-xs text-gray-400 mt-2">
              Select the API key to use for the current provider. Manage all
              keys in the main Settings dialog.
            </p>
          </TabsContent>
        )}

        {/* Files Tab */}
        <TabsContent value="files" className="mt-0">
          {/* ... (File manager rendering logic remains the same) ... */}
          {isVfsEnabledForItem && vfs.isReady ? (
            <FileManager key={selectedItemId} />
          ) : (
            <div className="text-center text-sm text-gray-500 py-8">
              {isVfsEnabledForItem && vfs.isLoading
                ? "Initializing filesystem..."
                : isVfsEnabledForItem && vfs.error
                  ? `Error: ${vfs.error}`
                  : "Virtual Filesystem is not enabled for the selected item."}
              <br />
              {!isVfsEnabledForItem && (
                <span>
                  Enable it using the toggle in the basic prompt settings area.
                </span>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
