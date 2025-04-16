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
import { Switch } from "@/components/ui/switch"; // Keep Switch import
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
    selectedApiKeyId,
    selectedItemId,
    isVfsEnabledForItem,
    toggleVfsEnabled,
    enableAdvancedSettings,
    enableApiKeyManagement,
  } = useChatContext();

  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [advancedInitialTab, setAdvancedInitialTab] =
    useState<string>("parameters");

  const providerConfig = providers.find((p) => p.id === selectedProviderId);
  const needsKey =
    providerConfig?.requiresApiKey ?? selectedProviderId !== "mock";
  const keyIsSelected = !!(
    selectedProviderId && selectedApiKeyId[selectedProviderId]
  );

  const showKeyRequiredWarning = needsKey && !keyIsSelected;
  const showKeyProvidedIndicator = needsKey && keyIsSelected;

  const isItemSelected = !!selectedItemId;

  const openAdvancedSettings = (tabId: string = "parameters") => {
    setAdvancedInitialTab(tabId);
    setIsAdvancedOpen(true);
  };

  const handleToggleAdvancedClick = () => {
    if (isAdvancedOpen) {
      setIsAdvancedOpen(false);
    } else {
      openAdvancedSettings("parameters");
    }
  };

  const handleApiKeyIconClick = () => {
    if (enableApiKeyManagement) {
      openAdvancedSettings("api_keys");
    } else {
      openAdvancedSettings("parameters");
    }
  };

  // Handler for clicking the VFS switch container
  const handleVfsContainerClick = (
    e: React.MouseEvent<HTMLDivElement, MouseEvent>,
  ) => {
    // Prevent click from propagating if clicking directly on the switch thumb/track
    if ((e.target as HTMLElement).closest('[role="switch"]')) {
      return;
    }
    // Only navigate if VFS is currently enabled and advanced settings are available
    if (isVfsEnabledForItem && enableAdvancedSettings) {
      openAdvancedSettings("files");
    }
  };

  // Handler for the Switch's checked change event
  const handleVfsSwitchChange = () => {
    // We still need to call the toggle function regardless of click location
    toggleVfsEnabled();
  };

  return (
    <div className={cn("bg-gray-800 text-gray-300", className)}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 p-3">
        <ProviderSelector />
        <ModelSelector />

        {/* API Key Indicator */}
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={handleApiKeyIconClick}
                className={cn(
                  "flex items-center h-9 px-1 rounded focus:outline-none focus:ring-1 focus:ring-blue-500",
                  needsKey ? "cursor-pointer" : "cursor-default",
                )}
                disabled={!needsKey}
                aria-label="Open API Key settings"
              >
                {showKeyRequiredWarning && (
                  <AlertTriangleIcon className="h-4 w-4 text-amber-500" />
                )}
                {showKeyProvidedIndicator && (
                  <KeyIcon className="h-4 w-4 text-green-500" />
                )}
                {!needsKey && <div className="w-4 h-4" />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">
              {showKeyRequiredWarning && (
                <p>API Key required, none selected. Click to manage keys.</p>
              )}
              {showKeyProvidedIndicator && (
                <p>API Key selected. Click to manage keys.</p>
              )}
              {!needsKey && <p>API Key not required for this provider.</p>}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* VFS Toggle and Navigation Trigger */}
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              {/* Clickable container */}
              <div
                onClick={handleVfsContainerClick}
                className={cn(
                  "flex items-center space-x-2 h-9 px-2 rounded",
                  isItemSelected && isVfsEnabledForItem
                    ? "cursor-pointer hover:bg-gray-700" // Clickable style when enabled
                    : "cursor-default", // Default style when disabled or no item
                  !isItemSelected && "opacity-50", // Dim if no item selected
                )}
                role="button" // Indicate it's clickable
                aria-label={
                  isVfsEnabledForItem
                    ? "Virtual Filesystem enabled. Click to manage files."
                    : "Virtual Filesystem disabled."
                }
                tabIndex={isItemSelected && isVfsEnabledForItem ? 0 : -1} // Make focusable only when clickable
                onKeyDown={(e) => {
                  if (
                    (e.key === "Enter" || e.key === " ") &&
                    isVfsEnabledForItem &&
                    enableAdvancedSettings
                  ) {
                    openAdvancedSettings("files");
                  }
                }}
              >
                <FolderSyncIcon
                  className={cn(
                    "h-4 w-4 transition-colors",
                    isItemSelected && isVfsEnabledForItem
                      ? "text-blue-400"
                      : "text-gray-500",
                  )}
                />
                <Switch
                  id="vfs-toggle-combined"
                  checked={isVfsEnabledForItem}
                  onCheckedChange={handleVfsSwitchChange} // Use separate handler for state change
                  disabled={!isItemSelected}
                  aria-label="Toggle Virtual Filesystem"
                  // Prevent the container click when clicking the switch itself
                  onClick={(e) => e.stopPropagation()}
                  className="data-[state=checked]:bg-blue-600 data-[state=unchecked]:bg-gray-600"
                />
              </div>
            </TooltipTrigger>
            <TooltipContent side="top">
              {!isItemSelected ? (
                <p>Select a chat or project first</p>
              ) : isVfsEnabledForItem ? (
                <p>Filesystem Enabled. Click to manage files.</p>
              ) : (
                <p>Filesystem Disabled. Toggle to enable.</p>
              )}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <div className="flex-grow" />

        {/* Advanced Settings Toggle Button */}
        {enableAdvancedSettings && (
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handleToggleAdvancedClick}
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

      {/* Advanced Settings Panel */}
      {enableAdvancedSettings && isAdvancedOpen && (
        <PromptSettingsAdvanced
          className="border-t border-gray-700"
          initialTab={advancedInitialTab}
        />
      )}
    </div>
  );
};
