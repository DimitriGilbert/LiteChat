// src/components/lite-chat/prompt/prompt-settings-advanced.tsx
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiKeySelector } from "@/components/lite-chat/api-key-selector";
import { FileManager } from "@/components/lite-chat/file-manager";
import { cn } from "@/lib/utils";
import { SaveIcon, InfoIcon, Loader2Icon } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import type {
  DbConversation,
  SidebarItemType,
  DbProviderConfig,
  DbApiKey,
} from "@/lib/types";
import { useVfsStore } from "@/store/vfs.store";

interface PromptSettingsAdvancedProps {
  className?: string;
  initialTab?: string;
  // Feature Flags
  enableAdvancedSettings: boolean;
  enableApiKeyManagement: boolean;
  // AI Parameters State/Setters
  temperature: number;
  setTemperature: (temp: number) => void;
  topP: number | null;
  setTopP: (topP: number | null) => void;
  maxTokens: number | null;
  setMaxTokens: (tokens: number | null) => void;
  topK: number | null;
  setTopK: (topK: number | null) => void;
  presencePenalty: number | null;
  setPresencePenalty: (penalty: number | null) => void;
  frequencyPenalty: number | null;
  setFrequencyPenalty: (penalty: number | null) => void;
  // System Prompt State/Actions
  globalSystemPrompt: string | null;
  selectedItemId: string | null;
  selectedItemType: SidebarItemType | null;
  activeConversationData: DbConversation | null;
  updateConversationSystemPrompt: (
    id: string,
    systemPrompt: string | null,
  ) => Promise<void>;
  // VFS State (Passed directly)
  isVfsEnabledForItem: boolean;
  isVfsReady: boolean;
  // VFS State (Bundled)
  isVfsLoading: boolean;
  vfsError: string | null;
  vfsKey: string | null;
  // API Key Management State/Actions
  selectedProviderId: string | null;
  dbProviderConfigs: DbProviderConfig[];
  apiKeys: DbApiKey[];
  updateDbProviderConfig: (
    id: string,
    changes: Partial<DbProviderConfig>,
  ) => Promise<void>;
  stopStreaming: () => void;
}

const PromptSettingsAdvancedComponent: React.FC<
  PromptSettingsAdvancedProps
> = ({
  className,
  initialTab = "parameters",
  // Destructure all props
  enableAdvancedSettings,
  enableApiKeyManagement,
  temperature,
  setTemperature,
  topP,
  setTopP,
  maxTokens,
  setMaxTokens,
  topK,
  setTopK,
  presencePenalty,
  setPresencePenalty,
  frequencyPenalty,
  setFrequencyPenalty,
  globalSystemPrompt,
  selectedItemId,
  selectedItemType,
  activeConversationData,
  updateConversationSystemPrompt,
  isVfsEnabledForItem,
  isVfsReady,
  isVfsLoading,
  vfsError,
  vfsKey,
  selectedProviderId,
  dbProviderConfigs,
  apiKeys,
  updateDbProviderConfig,
  stopStreaming,
}) => {
  const [localConvoSystemPrompt, setLocalConvoSystemPrompt] = useState<
    string | null
  >(null);
  const [isConvoPromptDirty, setIsConvoPromptDirty] = useState(false);

  const conversationId = useMemo(() => {
    return selectedItemType === "conversation" ? selectedItemId : null;
  }, [selectedItemId, selectedItemType]);

  const activeSystemPrompt = useMemo(() => {
    if (!enableAdvancedSettings) {
      return null;
    }
    if (
      activeConversationData?.systemPrompt &&
      activeConversationData.systemPrompt.trim() !== ""
    ) {
      return activeConversationData.systemPrompt;
    }
    if (globalSystemPrompt && globalSystemPrompt.trim() !== "") {
      return globalSystemPrompt;
    }
    return null;
  }, [enableAdvancedSettings, activeConversationData, globalSystemPrompt]);

  useEffect(() => {
    // If VFS is enabled but not ready, try to initialize it
    if (isVfsEnabledForItem && !isVfsReady && !isVfsLoading && vfsKey) {
      console.log(
        "[PromptSettingsAdvanced] VFS enabled but not ready, triggering initialization",
      );
      const vfsStore = useVfsStore.getState();
      vfsStore.initializeVfs();
    }
    // Only run when these specific dependencies change
  }, [isVfsEnabledForItem, isVfsReady, isVfsLoading, vfsKey]);

  useEffect(() => {
    if (enableAdvancedSettings && conversationId) {
      const promptFromProp = activeConversationData?.systemPrompt ?? null;
      setLocalConvoSystemPrompt((prev) =>
        prev === promptFromProp ? prev : promptFromProp,
      );
      setIsConvoPromptDirty(false);
    } else {
      setLocalConvoSystemPrompt(null);
      setIsConvoPromptDirty(false);
    }
  }, [conversationId, enableAdvancedSettings, activeConversationData]);

  const handleConvoSystemPromptChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>,
  ) => {
    setLocalConvoSystemPrompt(e.target.value);
    setIsConvoPromptDirty(true);
  };

  const saveConvoSystemPrompt = useCallback(() => {
    if (enableAdvancedSettings && conversationId && isConvoPromptDirty) {
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
    enableAdvancedSettings,
    conversationId,
    isConvoPromptDirty,
    localConvoSystemPrompt,
    updateConversationSystemPrompt,
  ]);

  const handleNumberInputChange = useCallback(
    (
      setter: (value: number | null) => void,
      e: React.ChangeEvent<HTMLInputElement>,
    ) => {
      const value = e.target.value;
      setter(value === "" ? null : parseInt(value, 10) || null);
    },
    [],
  );

  const handleSliderChange = useCallback(
    (setter: (value: number | null) => void, value: number[]) => {
      setter(value[0]);
    },
    [],
  );

  const selectedDbProviderConfig = useMemo(() => {
    return dbProviderConfigs.find((p) => p.id === selectedProviderId);
  }, [dbProviderConfigs, selectedProviderId]);

  const handleApiKeySelectionChange = useCallback(
    (keyId: string | null) => {
      if (selectedDbProviderConfig) {
        updateDbProviderConfig(selectedDbProviderConfig.id, {
          apiKeyId: keyId,
        })
          .then(() => {
            toast.success(
              `API Key ${keyId ? "linked" : "unlinked"} for ${selectedDbProviderConfig.name}.`,
            );
          })
          .catch((err) => {
            console.error("Failed to update API key link", err);
            toast.error("Failed to update API key link.");
          });
      }
    },
    [selectedDbProviderConfig, updateDbProviderConfig],
  );

  const isConversationSelected = !!conversationId;
  const isConversationPromptSet =
    localConvoSystemPrompt !== null && localConvoSystemPrompt.trim() !== "";
  const isUsingGlobalOrDefault =
    activeSystemPrompt === globalSystemPrompt || !isConversationPromptSet;

  const showFileManager = isVfsEnabledForItem && isVfsReady;

  return (
    <div className={cn("p-3", className)}>
      <Tabs defaultValue={initialTab} key={initialTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 h-9 mb-3">
          <TabsTrigger value="parameters" className="text-xs px-2 h-7">
            Parameters
          </TabsTrigger>
          <TabsTrigger value="system_prompt" className="text-xs px-2 h-7">
            System Prompt
          </TabsTrigger>
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

        {enableApiKeyManagement && (
          <TabsContent value="api_keys" className="mt-0">
            {selectedDbProviderConfig ? (
              <ApiKeySelector
                selectedKeyId={selectedDbProviderConfig.apiKeyId ?? null}
                onKeySelected={handleApiKeySelectionChange}
                apiKeys={apiKeys}
                disabled={!selectedDbProviderConfig}
              />
            ) : (
              <p className="text-xs text-gray-500">Select a provider first.</p>
            )}
            <p className="text-xs text-gray-400 mt-2">
              Select the API key to use for the current provider configuration.
              Manage all keys in the main Settings dialog (API Keys tab).
            </p>
          </TabsContent>
        )}

        <TabsContent value="files" className="mt-0">
          {showFileManager ? (
            <FileManager key={vfsKey} />
          ) : (
            <div className="text-center text-sm text-gray-500 py-8">
              {isVfsEnabledForItem && isVfsLoading ? (
                <>
                  <Loader2Icon className="h-4 w-4 mr-2 inline animate-spin" />
                  <span>Initializing filesystem...</span>
                </>
              ) : isVfsEnabledForItem && vfsError ? (
                `Error: ${vfsError}`
              ) : !isVfsEnabledForItem ? (
                <>
                  Virtual Filesystem is not enabled for the selected item.
                  <br />
                  Enable it using the toggle in the basic prompt settings area.
                </>
              ) : (
                "Virtual Filesystem is initializing or in an unknown state."
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export const PromptSettingsAdvanced = React.memo(
  PromptSettingsAdvancedComponent,
);
