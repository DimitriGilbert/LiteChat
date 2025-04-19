// src/components/lite-chat/prompt-settings-advanced.tsx
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useSettingsContext } from "@/context/settings-context";
import { useSidebarContext } from "@/context/sidebar-context";
import { useVfsContext } from "@/context/vfs-context";
import { useProviderManagementContext } from "@/context/provider-management-context";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiKeySelector } from "@/components/lite-chat/api-key-selector";
import { FileManager } from "@/components/lite-chat/file-manager"; // Changed import
import { cn } from "@/lib/utils";
import { SaveIcon, InfoIcon } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";

interface PromptSettingsAdvancedProps {
  className?: string;
  initialTab?: string;
}

export const PromptSettingsAdvanced: React.FC<PromptSettingsAdvancedProps> = ({
  className,
  initialTab = "parameters",
}) => {
  const settings = useSettingsContext();
  const sidebar = useSidebarContext();
  const vfs = useVfsContext();
  const providerMgmt = useProviderManagementContext();

  const conversationId = useMemo(() => {
    return sidebar.selectedItemType === "conversation"
      ? sidebar.selectedItemId
      : null;
  }, [sidebar.selectedItemId, sidebar.selectedItemType]);

  const [localConvoSystemPrompt, setLocalConvoSystemPrompt] = useState<
    string | null
  >(null);
  const [isConvoPromptDirty, setIsConvoPromptDirty] = useState(false);

  useEffect(() => {
    if (
      settings.enableAdvancedSettings &&
      conversationId &&
      sidebar.selectedItemId
    ) {
      const convoData = sidebar.activeConversationData;
      setLocalConvoSystemPrompt(convoData?.systemPrompt ?? null);
      setIsConvoPromptDirty(false);
    } else {
      setLocalConvoSystemPrompt(null);
      setIsConvoPromptDirty(false);
    }
  }, [
    conversationId,
    sidebar.selectedItemId,
    sidebar.activeConversationData,
    settings.enableAdvancedSettings,
  ]);

  const handleConvoSystemPromptChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>,
  ) => {
    setLocalConvoSystemPrompt(e.target.value);
    setIsConvoPromptDirty(true);
  };

  const saveConvoSystemPrompt = () => {
    if (
      settings.enableAdvancedSettings &&
      conversationId &&
      isConvoPromptDirty
    ) {
      const promptToSave =
        localConvoSystemPrompt?.trim() === "" ? null : localConvoSystemPrompt;
      sidebar
        .updateConversationSystemPrompt(conversationId, promptToSave)
        .then(() => {
          setIsConvoPromptDirty(false);
          toast.success("Conversation system prompt saved.");
        })
        .catch((err) => {
          console.error("Failed to save system prompt", err);
          toast.error("Failed to save system prompt.");
        });
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

  const selectedDbProviderConfig = useMemo(() => {
    return providerMgmt.dbProviderConfigs.find(
      (p) => p.id === providerMgmt.selectedProviderId,
    );
  }, [providerMgmt.dbProviderConfigs, providerMgmt.selectedProviderId]);

  const handleApiKeySelectionChange = useCallback(
    (keyId: string | null) => {
      if (selectedDbProviderConfig) {
        providerMgmt
          .updateDbProviderConfig(selectedDbProviderConfig.id, {
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
    [selectedDbProviderConfig, providerMgmt.updateDbProviderConfig],
  );

  const isConversationSelected = !!conversationId;
  const isConversationPromptSet =
    localConvoSystemPrompt !== null && localConvoSystemPrompt.trim() !== "";
  const isUsingGlobalOrDefault =
    settings.activeSystemPrompt === settings.globalSystemPrompt ||
    !isConversationPromptSet;

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
          {providerMgmt.enableApiKeyManagement && (
            <TabsTrigger value="api_keys" className="text-xs px-2 h-7">
              API Keys
            </TabsTrigger>
          )}
          <TabsTrigger
            value="files"
            className="text-xs px-2 h-7"
            disabled={!vfs.isVfsEnabledForItem}
          >
            Files
          </TabsTrigger>
        </TabsList>

        {/* Parameters Tab */}
        <TabsContent value="parameters" className="space-y-4 mt-0">
          <div className="grid grid-cols-2 gap-4 items-end">
            <div className="space-y-1.5">
              <Label htmlFor="temperature" className="text-xs">
                Temperature ({settings.temperature.toFixed(2)})
              </Label>
              <Slider
                id="temperature"
                min={0}
                max={1}
                step={0.01}
                value={[settings.temperature]}
                onValueChange={(value) => settings.setTemperature(value[0])}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="top-p" className="text-xs">
                Top P ({(settings.topP ?? 1.0).toFixed(2)})
              </Label>
              <Slider
                id="top-p"
                min={0}
                max={1}
                step={0.01}
                value={[settings.topP ?? 1.0]}
                onValueChange={(value) =>
                  handleSliderChange(settings.setTopP, value)
                }
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
                value={settings.maxTokens ?? ""}
                onChange={(e) =>
                  handleNumberInputChange(settings.setMaxTokens, e)
                }
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
                value={settings.topK ?? ""}
                onChange={(e) => handleNumberInputChange(settings.setTopK, e)}
                min="1"
                className="h-8 text-xs"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 items-end">
            <div className="space-y-1.5">
              <Label htmlFor="presence-penalty" className="text-xs">
                Presence Penalty ({(settings.presencePenalty ?? 0.0).toFixed(2)}
                )
              </Label>
              <Slider
                id="presence-penalty"
                min={-2}
                max={2}
                step={0.01}
                value={[settings.presencePenalty ?? 0.0]}
                onValueChange={(value) =>
                  handleSliderChange(settings.setPresencePenalty, value)
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="frequency-penalty" className="text-xs">
                Frequency Penalty (
                {(settings.frequencyPenalty ?? 0.0).toFixed(2)})
              </Label>
              <Slider
                id="frequency-penalty"
                min={-2}
                max={2}
                step={0.01}
                value={[settings.frequencyPenalty ?? 0.0]}
                onValueChange={(value) =>
                  handleSliderChange(settings.setFrequencyPenalty, value)
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
              value={
                isConversationSelected
                  ? (localConvoSystemPrompt ?? "")
                  : (settings.activeSystemPrompt ?? "")
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
              value={settings.globalSystemPrompt ?? "Not set or disabled"}
              className="text-xs min-h-[60px] max-h-[100px] bg-gray-800/50 border-gray-700/50"
              rows={3}
            />
            <p className="text-xs text-gray-500">
              Managed in main Settings dialog. Used when conversation prompt is
              blank.
            </p>
          </div>
        </TabsContent>

        {/* API Keys Tab */}
        {providerMgmt.enableApiKeyManagement && (
          <TabsContent value="api_keys" className="mt-0">
            {selectedDbProviderConfig ? (
              <ApiKeySelector
                selectedKeyId={selectedDbProviderConfig.apiKeyId ?? null}
                onKeySelected={handleApiKeySelectionChange}
                apiKeys={providerMgmt.apiKeys}
                disabled={!selectedDbProviderConfig}
              />
            ) : (
              <p className="text-xs text-gray-500">Select a provider first.</p>
            )}
            <p className="text-xs text-gray-400 mt-2">
              Select the API key to use for the current provider configuration.
              Manage all keys in the main Settings dialog (Providers tab).
            </p>
          </TabsContent>
        )}

        {/* Files Tab */}
        <TabsContent value="files" className="mt-0">
          {vfs.isVfsEnabledForItem && vfs.vfs.isReady ? (
            // Use FileManager directly, pass key for potential re-renders
            <FileManager key={sidebar.selectedItemId} />
          ) : (
            <div className="text-center text-sm text-gray-500 py-8">
              {vfs.isVfsEnabledForItem && vfs.vfs.isLoading
                ? "Initializing filesystem..."
                : vfs.isVfsEnabledForItem && vfs.vfs.error
                  ? `Error: ${vfs.vfs.error}`
                  : "Virtual Filesystem is not enabled for the selected item."}
              <br />
              {!vfs.isVfsEnabledForItem && (
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
