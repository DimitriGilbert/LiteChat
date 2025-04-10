// src/components/lite-chat/prompt-settings.tsx
import React, { useState } from "react";
import { ProviderSelector } from "./provider-selector";
import { ModelSelector } from "./model-selector";
import { PromptSettingsAdvanced } from "./prompt-settings-advanced";
import { useChatContext } from "@/hooks/use-chat-context";
import {
  KeyIcon,
  AlertTriangleIcon,
  Settings2Icon,
  FolderSyncIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface PromptSettingsProps {
  className?: string;
}

export const PromptSettings: React.FC<PromptSettingsProps> = ({
  className,
}) => {
  const {
    selectedProviderId,
    providers,
    getApiKeyForProvider,
    selectedApiKeyId,
    selectedItemId,
    isVfsEnabledForItem,
    toggleVfsEnabled,
    enableAdvancedSettings, // <-- Get the flag from context
  } = useChatContext();
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  const providerConfig = providers.find((p) => p.id === selectedProviderId);
  const needsKey =
    providerConfig?.requiresApiKey ?? selectedProviderId !== "mock";
  const keyIsSelected = !!(
    selectedProviderId && selectedApiKeyId[selectedProviderId]
  );
  const keyHasValue = !!(
    selectedProviderId && getApiKeyForProvider(selectedProviderId)
  );
  const showKeyRequiredWarning = needsKey && (!keyIsSelected || !keyHasValue);
  const showKeyProvidedIndicator = needsKey && keyIsSelected && keyHasValue;

  const isItemSelected = !!selectedItemId;

  return (
    <div className={cn("bg-gray-800 text-gray-300", className)}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 p-3">
        <ProviderSelector />
        <ModelSelector />

        {/* API Key Indicator */}
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center h-9">
                {showKeyRequiredWarning && (
                  <AlertTriangleIcon
                    className="h-4 w-4 text-amber-500"
                    aria-label="API Key Required"
                  />
                )}
                {showKeyProvidedIndicator && (
                  <KeyIcon
                    className="h-4 w-4 text-green-500"
                    aria-label="API Key Provided"
                  />
                )}
                {!needsKey && <div className="w-4 h-4" />}
              </div>
            </TooltipTrigger>
            <TooltipContent side="top">
              {showKeyRequiredWarning && (
                <p>
                  API Key required for this provider is missing or not selected.
                </p>
              )}
              {showKeyProvidedIndicator && (
                <p>API Key is selected and available for this provider.</p>
              )}
              {!needsKey && <p>API Key not required for this provider.</p>}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* VFS Toggle */}
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center space-x-2 h-9">
                <Switch
                  id="vfs-toggle"
                  checked={isVfsEnabledForItem}
                  onCheckedChange={toggleVfsEnabled}
                  disabled={!isItemSelected}
                  aria-label="Toggle Virtual Filesystem"
                />
                <Label
                  htmlFor="vfs-toggle"
                  className={cn(
                    "text-xs cursor-pointer flex items-center gap-1 transition-colors",
                    !isItemSelected && "text-gray-500 cursor-not-allowed",
                    isItemSelected && isVfsEnabledForItem && "text-blue-400",
                    isItemSelected && !isVfsEnabledForItem && "text-gray-400",
                  )}
                >
                  <FolderSyncIcon className="h-3.5 w-3.5" />
                  <span>Files</span>
                </Label>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top">
              {isItemSelected ? (
                <p>
                  {isVfsEnabledForItem ? "Disable" : "Enable"} Virtual
                  Filesystem for this item
                </p>
              ) : (
                <p>Select a chat or project to manage its filesystem</p>
              )}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <div className="flex-grow" />

        {/* Advanced Settings Toggle Button - Conditionally render */}
        {enableAdvancedSettings && (
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
                  className={cn(
                    "h-8 w-8 text-gray-400 hover:text-gray-200",
                    isAdvancedOpen && "bg-gray-700 text-gray-200",
                  )}
                  aria-label="Toggle advanced settings"
                >
                  <Settings2Icon className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>{isAdvancedOpen ? "Hide" : "Show"} Advanced Settings</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      {/* Advanced Settings Panel - Conditionally render */}
      {enableAdvancedSettings && isAdvancedOpen && (
        <PromptSettingsAdvanced className="border-t border-gray-700" />
      )}
    </div>
  );
};
