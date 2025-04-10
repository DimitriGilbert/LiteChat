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
    activeSystemPrompt, // This will be null if advanced settings are globally disabled
    globalSystemPrompt, // This will be null if advanced settings are globally disabled
    setGlobalSystemPrompt, // This will be a dummy function if disabled
    selectedItemId,
    selectedItemType,
    updateConversationSystemPrompt,
    isVfsEnabledForItem,
    vfs,
    getConversation,
    enableApiKeyManagement,
    enableAdvancedSettings, // <-- Get flag (though not used for rendering logic here)
  } = useChatContext();

  const conversationId = useMemo(() => {
    return selectedItemType === "conversation" ? selectedItemId : null;
  }, [selectedItemId, selectedItemType]);

  const [localConvoSystemPrompt, setLocalConvoSystemPrompt] = useState<
    string | null
  >(null);
  const [isConvoPromptDirty, setIsConvoPromptDirty] = useState(false);

  // Effect to load conversation-specific prompt
  useEffect(() => {
    // Only try to load if advanced settings are enabled and a convo is selected
    if (enableAdvancedSettings && conversationId && getConversation) {
      getConversation(conversationId)
        .then((convo) => {
          setLocalConvoSystemPrompt(convo?.systemPrompt ?? null);
          setIsConvoPromptDirty(false);
        })
        .catch(() => {
          setLocalConvoSystemPrompt(null);
          setIsConvoPromptDirty(false);
        });
    } else {
      // Reset if advanced settings disabled or no convo selected
      setLocalConvoSystemPrompt(null);
      setIsConvoPromptDirty(false);
    }
  }, [conversationId, getConversation, enableAdvancedSettings]); // Add enableAdvancedSettings dependency

  const handleConvoSystemPromptChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>,
  ) => {
    setLocalConvoSystemPrompt(e.target.value);
    setIsConvoPromptDirty(true);
  };

  const saveConvoSystemPrompt = () => {
    if (
      enableAdvancedSettings && // Check flag before saving
      conversationId &&
      isConvoPromptDirty
    ) {
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
    const value = e.target.value;
    setter(value === "" ? null : parseInt(value, 10) || null);
  };

  const handleSliderChange = (
    setter: (value: number | null) => void,
    value: number[],
  ) => {
    setter(value[0]);
  };

  const isConversationSelected = !!conversationId;
  // Check local state for whether a convo prompt is *set* (not just active)
  const isConversationPromptSet =
    localConvoSystemPrompt !== null && localConvoSystemPrompt.trim() !== "";
  // Check if the *active* prompt is the global one (or if no convo prompt is set)
  const isUsingGlobalOrDefault =
    activeSystemPrompt === globalSystemPrompt || !isConversationPromptSet;

  // This component should only render if enableAdvancedSettings is true,
  // so we don't need to hide elements based on the flag *within* this component.
  // The setters passed down from context will be dummy functions if disabled,
  // preventing state updates, but the UI elements will still render if this component is mounted.

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
          {/* Conditionally render API Keys tab based on its own flag */}
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
          {/* Parameter sliders/inputs */}
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
              // Display local state if convo selected, otherwise show the active prompt (which might be global or null)
              value={
                isConversationSelected
                  ? (localConvoSystemPrompt ?? "")
                  : (activeSystemPrompt ?? "")
              }
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
          {/* Optionally show Global System Prompt for reference */}
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
        </TabsContent>

        {/* API Keys Tab - Conditionally render content */}
        {enableApiKeyManagement && (
          <TabsContent value="api_keys" className="mt-0">
            <ApiKeySelector />
            <p className="text-xs text-gray-400 mt-2">
              Select the API key to use for the current provider. Manage all
              keys in the main Settings dialog.
            </p>
          </TabsContent>
        )}

        {/* Files Tab */}
        <TabsContent value="files" className="mt-0">
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
