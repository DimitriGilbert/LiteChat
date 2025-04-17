// src/components/lite-chat/prompt-settings.tsx
import React, { useState, useEffect } from "react"; // Added useEffect
import { ProviderSelector } from "./provider-selector";
import { ModelSelector } from "./model-selector";
import { PromptSettingsAdvanced } from "./prompt-settings-advanced"; // Ensure this is imported
// Import specific context hooks
import { useProviderManagementContext } from "@/context/provider-management-context";
import { useSidebarContext } from "@/context/sidebar-context";
import { useVfsContext } from "@/context/vfs-context";
import { useSettingsContext } from "@/context/settings-context";
// Import the main context hook
import { useChatContext } from "@/hooks/use-chat-context";
import {
  KeyIcon,
  AlertTriangleIcon,
  Settings2Icon,
  FolderSyncIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { DbProviderType } from "@/lib/types";

interface PromptSettingsProps {
  className?: string;
}

// Helper function
const requiresApiKey = (type: DbProviderType | null | undefined): boolean => {
  if (!type) return false;
  return type === "openai" || type === "openrouter" || type === "google";
};

export const PromptSettings: React.FC<PromptSettingsProps> = ({
  className,
}) => {
  // Use specific context hooks
  const providerMgmt = useProviderManagementContext();
  const sidebar = useSidebarContext();
  const vfs = useVfsContext();
  const settings = useSettingsContext();
  // Use the main context to get the toggle function
  const { toggleVfsEnabled } = useChatContext();

  // State to manage the initial tab for the advanced panel/modal
  const [advancedInitialTab, setAdvancedInitialTab] =
    useState<string>("parameters");

  // Determine API Key status
  const selectedDbProviderConfig = providerMgmt.dbProviderConfigs.find(
    (p) => p.id === providerMgmt.selectedProviderId,
  );
  const needsKey = requiresApiKey(selectedDbProviderConfig?.type);
  const keyIsLinked = !!selectedDbProviderConfig?.apiKeyId;
  const keyIsAvailable =
    keyIsLinked &&
    !!providerMgmt.getApiKeyForProvider(providerMgmt.selectedProviderId!);

  const showKeyRequiredWarning = needsKey && (!keyIsLinked || !keyIsAvailable);
  const showKeyProvidedIndicator = needsKey && keyIsLinked && keyIsAvailable;

  // Get necessary state from other contexts
  const isItemSelected = !!sidebar.selectedItemId;
  const isVfsEnabledForItem = vfs.isVfsEnabledForItem;

  // Function to open the settings (modal/panel) and set the initial tab
  const openSettings = (tabId: string = "parameters") => {
    setAdvancedInitialTab(tabId); // Set the desired tab
    settings.onSettingsModalOpenChange(true); // Open the modal/panel
  };

  // Toggle button handler
  const handleToggleAdvancedClick = () => {
    if (settings.isSettingsModalOpen) {
      settings.onSettingsModalOpenChange(false); // Close if open
    } else {
      openSettings("parameters"); // Open to default tab if closed
    }
  };

  // API Key icon handler
  const handleApiKeyIconClick = () => {
    if (providerMgmt.enableApiKeyManagement) {
      openSettings("api_keys"); // Open to API keys tab
    } else {
      openSettings("parameters"); // Fallback to default tab
    }
  };

  // VFS container click handler (excluding switch)
  const handleVfsContainerClick = (
    e: React.MouseEvent<HTMLDivElement, MouseEvent>,
  ) => {
    if ((e.target as HTMLElement).closest('[role="switch"]')) {
      return; // Ignore clicks on the switch itself
    }
    if (
      isVfsEnabledForItem &&
      settings.enableAdvancedSettings &&
      vfs.enableVfs
    ) {
      openSettings("files"); // Open to files tab
    }
  };

  // VFS switch change handler
  const handleVfsSwitchChange = () => {
    toggleVfsEnabled(); // Call the toggle function from the main context
  };

  // Effect to reset the initial tab when the modal closes
  useEffect(() => {
    if (!settings.isSettingsModalOpen) {
      // Optional: Reset to default when closed, or keep last state?
      // setAdvancedInitialTab("parameters");
    }
  }, [settings.isSettingsModalOpen]);

  return (
    // Apply background and text color to the outer div
    <div className={cn("bg-gray-800 text-gray-300", className)}>
      {/* Top bar with controls */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 p-3">
        {/* Group 1: Selectors */}
        <div className="flex items-center gap-x-2 flex-shrink min-w-0 flex-grow sm:flex-grow-0">
          <ProviderSelector className="flex-shrink-0" />
          <div className="flex-grow min-w-[150px]">
            <ModelSelector />
          </div>
        </div>

        {/* Spacer */}
        <div className="flex-grow hidden sm:block" />

        {/* Group 2: Action Icons */}
        <div className="flex items-center gap-x-1 flex-shrink-0">
          {/* API Key Indicator */}
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={handleApiKeyIconClick}
                  className={cn(
                    "flex items-center justify-center h-9 w-9 rounded focus:outline-none focus:ring-1 focus:ring-blue-500",
                    needsKey ? "cursor-pointer" : "cursor-default",
                  )}
                  disabled={!needsKey || !providerMgmt.enableApiKeyManagement}
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
                {!providerMgmt.enableApiKeyManagement && needsKey ? (
                  <p>API Key required, management disabled.</p>
                ) : needsKey && !keyIsLinked ? (
                  <p>API Key required, none linked. Click to manage keys.</p>
                ) : needsKey && keyIsLinked && !keyIsAvailable ? (
                  <p>API Key linked, but missing/invalid. Click to manage.</p>
                ) : showKeyProvidedIndicator ? (
                  <p>API Key linked and available. Click to manage keys.</p>
                ) : (
                  <p>API Key not required for this provider.</p>
                )}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* VFS Toggle and Navigation Trigger */}
          {vfs.enableVfs && (
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    onClick={handleVfsContainerClick}
                    className={cn(
                      "flex items-center space-x-1 h-9 px-2 rounded",
                      isItemSelected && isVfsEnabledForItem
                        ? "cursor-pointer hover:bg-gray-700"
                        : "cursor-default",
                      !isItemSelected && "opacity-50 cursor-not-allowed",
                    )}
                    role="button"
                    aria-label={
                      !isItemSelected
                        ? "Select a chat or project to manage VFS"
                        : isVfsEnabledForItem
                          ? "Virtual Filesystem enabled. Click to manage files."
                          : "Virtual Filesystem disabled. Toggle to enable."
                    }
                    tabIndex={isItemSelected && isVfsEnabledForItem ? 0 : -1}
                    onKeyDown={(e) => {
                      if (
                        (e.key === "Enter" || e.key === " ") &&
                        isVfsEnabledForItem &&
                        settings.enableAdvancedSettings
                      ) {
                        openSettings("files"); // Use openSettings here too
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
                      onCheckedChange={handleVfsSwitchChange}
                      disabled={!isItemSelected}
                      aria-label="Toggle Virtual Filesystem"
                      onClick={(e) => e.stopPropagation()}
                      className="data-[state=checked]:bg-blue-600 data-[state=unchecked]:bg-gray-600 scale-75"
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
          )}

          {/* Advanced Settings Toggle Button */}
          {settings.enableAdvancedSettings && (
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={handleToggleAdvancedClick} // Use the correct handler
                    className={cn(
                      "h-8 w-8 text-gray-400 hover:text-gray-200",
                      settings.isSettingsModalOpen &&
                        "bg-gray-700 text-gray-200",
                    )}
                    aria-label="Toggle advanced settings"
                  >
                    <Settings2Icon className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>
                    {settings.isSettingsModalOpen ? "Close" : "Show"} Settings
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>

      {/* Advanced Settings Panel - RESTORED */}
      {/* Render this panel when the modal/settings state is open */}
      {settings.enableAdvancedSettings && settings.isSettingsModalOpen && (
        <PromptSettingsAdvanced
          className="border-t border-gray-700" // Add border for separation
          initialTab={advancedInitialTab} // Pass the managed initial tab state
        />
      )}
    </div>
  );
};
