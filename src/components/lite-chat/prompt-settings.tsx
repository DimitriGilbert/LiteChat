// src/components/lite-chat/prompt-settings.tsx
import React, { useState } from "react";
import { ProviderSelector } from "./provider-selector";
import { ModelSelector } from "./model-selector";
import { PromptSettingsAdvanced } from "./prompt-settings-advanced";
// Import specific context hooks
import { useProviderManagementContext } from "@/context/provider-management-context";
import { useSidebarContext } from "@/context/sidebar-context";
import { useVfsContext } from "@/context/vfs-context";
import { useSettingsContext } from "@/context/settings-context";
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

// Helper function (can be moved to utils if used elsewhere)
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

  const [isAdvancedOpen] = useState(false);
  const [advancedInitialTab, setAdvancedInitialTab] =
    useState<string>("parameters");

  // Determine API Key status using ProviderManagementContext
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

  const openAdvancedSettings = (tabId: string = "parameters") => {
    setAdvancedInitialTab(tabId);
    // Use the setter from SettingsContext to open the modal
    settings.onSettingsModalOpenChange(true);
    // We might need a way to tell SettingsModal which tab to open initially.
    // For now, just opening the modal. Tab selection logic might need adjustment
    // within SettingsModal or via another state mechanism if direct tab control is needed here.
    // setIsAdvancedOpen(true); // This state might become redundant if SettingsModal handles its own open state
  };

  const handleToggleAdvancedClick = () => {
    // Toggle the main settings modal instead
    settings.onSettingsModalOpenChange(!settings.isSettingsModalOpen);
    // if (isAdvancedOpen) {
    //   setIsAdvancedOpen(false);
    // } else {
    //   openAdvancedSettings("parameters");
    // }
  };

  const handleApiKeyIconClick = () => {
    if (providerMgmt.enableApiKeyManagement) {
      openAdvancedSettings("api_keys"); // Request API keys tab
    } else {
      openAdvancedSettings("parameters"); // Fallback or desired behavior?
    }
  };

  const handleVfsContainerClick = (
    e: React.MouseEvent<HTMLDivElement, MouseEvent>,
  ) => {
    if ((e.target as HTMLElement).closest('[role="switch"]')) {
      return;
    }
    if (isVfsEnabledForItem && settings.enableAdvancedSettings) {
      openAdvancedSettings("files"); // Request files tab
    }
  };

  const handleVfsSwitchChange = () => {
    // Call the toggle function from the main context handler
    // This function needs to be passed down or accessed differently now.
    // Assuming a toggle function exists in the aggregated context or VFS context.
    // We need to call the `handleToggleVfs` from the main ChatProvider.
    // This component shouldn't call the DB directly.
    // Let's assume `vfs.toggleVfsEnabled` exists (needs adding to VfsContextProps if not)
    // or rely on the aggregated context's `toggleVfsEnabled`.
    // For now, we'll comment this out as the logic needs to live higher up.
    // toggleVfsEnabled(); // This needs to be called via context
    console.warn(
      "VFS Toggle initiated from PromptSettings - ensure context handler is called.",
    );
    // The actual toggle logic should be handled by the `toggleVfsEnabled` function
    // exposed by the main `useChatContext` or potentially `useVfsContext` if refactored.
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
              {needsKey && !keyIsLinked && (
                <p>API Key required, none linked. Click to manage keys.</p>
              )}
              {needsKey && keyIsLinked && !keyIsAvailable && (
                <p>API Key linked, but missing/invalid. Click to manage.</p>
              )}
              {showKeyProvidedIndicator && (
                <p>API Key linked and available. Click to manage keys.</p>
              )}
              {!needsKey && <p>API Key not required for this provider.</p>}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* VFS Toggle and Navigation Trigger */}
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                onClick={handleVfsContainerClick}
                className={cn(
                  "flex items-center space-x-2 h-9 px-2 rounded",
                  isItemSelected && isVfsEnabledForItem && vfs.enableVfs
                    ? "cursor-pointer hover:bg-gray-700"
                    : "cursor-default",
                  !isItemSelected && "opacity-50",
                  !vfs.enableVfs && "opacity-50 cursor-not-allowed", // Style if VFS globally disabled
                )}
                role="button"
                aria-label={
                  !vfs.enableVfs
                    ? "Virtual Filesystem disabled in configuration"
                    : isVfsEnabledForItem
                      ? "Virtual Filesystem enabled. Click to manage files."
                      : "Virtual Filesystem disabled."
                }
                tabIndex={
                  isItemSelected && isVfsEnabledForItem && vfs.enableVfs
                    ? 0
                    : -1
                }
                onKeyDown={(e) => {
                  if (
                    (e.key === "Enter" || e.key === " ") &&
                    isVfsEnabledForItem &&
                    settings.enableAdvancedSettings &&
                    vfs.enableVfs
                  ) {
                    openAdvancedSettings("files");
                  }
                }}
              >
                <FolderSyncIcon
                  className={cn(
                    "h-4 w-4 transition-colors",
                    isItemSelected && isVfsEnabledForItem && vfs.enableVfs
                      ? "text-blue-400"
                      : "text-gray-500",
                  )}
                />
                <Switch
                  id="vfs-toggle-combined"
                  checked={isVfsEnabledForItem}
                  onCheckedChange={handleVfsSwitchChange}
                  disabled={!isItemSelected || !vfs.enableVfs} // Disable if no item or VFS globally disabled
                  aria-label="Toggle Virtual Filesystem"
                  onClick={(e) => e.stopPropagation()}
                  className="data-[state=checked]:bg-blue-600 data-[state=unchecked]:bg-gray-600"
                />
              </div>
            </TooltipTrigger>
            <TooltipContent side="top">
              {!vfs.enableVfs ? (
                <p>Virtual Filesystem disabled in configuration</p>
              ) : !isItemSelected ? (
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
        {settings.enableAdvancedSettings && (
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
                    settings.isSettingsModalOpen && "bg-gray-700 text-gray-200", // Reflect modal state
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

      {/* Advanced Settings Panel */}
      {settings.enableAdvancedSettings && isAdvancedOpen && (
        <PromptSettingsAdvanced
          className="border-t border-gray-700"
          initialTab={advancedInitialTab}
        />
      )}
    </div>
  );
};
