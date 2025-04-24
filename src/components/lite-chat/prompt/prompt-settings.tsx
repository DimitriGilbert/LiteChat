// src/components/lite-chat/prompt/prompt-settings.tsx
import React, { useState, useCallback, useMemo } from "react";
import { ProviderSelector } from "@/components/lite-chat/provider-selector";
import { ModelSelector } from "@/components/lite-chat/model-selector";
import { PromptSettingsAdvanced } from "./prompt-settings-advanced";
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
import type { DbProviderConfig } from "@/lib/types";
import { toast } from "sonner";
import { requiresApiKey } from "@/lib/litechat";
import { useShallow } from "zustand/react/shallow";
import { useProviderStore } from "@/store/provider.store";
import { useSettingsStore } from "@/store/settings.store";
import { useVfsStore } from "@/store/vfs.store";
import { useSidebarStore } from "@/store/sidebar.store";
import { useChatStorage } from "@/hooks/use-chat-storage";

const PromptSettingsComponent: React.FC<{ className?: string }> = ({
  className,
}) => {
  // Fetch state/actions from stores
  const { selectedProviderId, enableApiKeyManagement } = useProviderStore(
    useShallow((state) => ({
      selectedProviderId: state.selectedProviderId,
      enableApiKeyManagement: state.enableApiKeyManagement,
    })),
  );
  const { providerConfigs: dbProviderConfigs, apiKeys } = useChatStorage();

  const { enableAdvancedSettings } = useSettingsStore(
    useShallow((state) => ({
      enableAdvancedSettings: state.enableAdvancedSettings,
    })),
  );

  const {
    enableVfs,
    isVfsEnabledForItem,
  } = useVfsStore(
    useShallow((state) => ({
      enableVfs: state.enableVfs,
      isVfsEnabledForItem: state.isVfsEnabledForItem,
      isVfsReady: state.isVfsReady,
    })),
  );

  const { selectedItemId, selectedItemType, toggleVfsEnabled } =
    useSidebarStore(
      useShallow((state) => ({
        selectedItemId: state.selectedItemId,
        selectedItemType: state.selectedItemType,
        toggleVfsEnabled: state.toggleVfsEnabled,
      })),
    );
  const [isAdvancedPanelOpen, setIsAdvancedPanelOpen] = useState(false);
  const [advancedInitialTab, setAdvancedInitialTab] =
    useState<string>("parameters");
  const selectedDbProviderConfig = useMemo(
    () =>
      (dbProviderConfigs || []).find(
        (p: DbProviderConfig) => p.id === selectedProviderId,
      ),
    [dbProviderConfigs, selectedProviderId],
  );

  const needsKey = requiresApiKey(selectedDbProviderConfig?.type ?? null);
  const keyIsLinked = !!selectedDbProviderConfig?.apiKeyId;
  const keyIsAvailable =
    keyIsLinked &&
    !!(apiKeys || []).find((k) => k.id === selectedDbProviderConfig.apiKeyId);

  const showKeyRequiredWarning = needsKey && (!keyIsLinked || !keyIsAvailable);
  const showKeyProvidedIndicator = needsKey && keyIsLinked && keyIsAvailable;

  const isItemSelected = !!selectedItemId;
  const openAdvancedPanel = useCallback((tabId: string = "parameters") => {
    setAdvancedInitialTab(tabId);
    setIsAdvancedPanelOpen(true);
  }, []);

  const handleToggleAdvancedClick = useCallback(() => {
    setIsAdvancedPanelOpen((prev) => !prev);
    if (!isAdvancedPanelOpen) {
      setAdvancedInitialTab("parameters");
    }
  }, [isAdvancedPanelOpen]);

  const handleApiKeyIconClick = useCallback(() => {
    if (enableApiKeyManagement) {
      openAdvancedPanel("api_keys");
    } else {
      toast.info("API Key management is disabled.");
    }
  }, [enableApiKeyManagement, openAdvancedPanel]);

  const handleVfsContainerClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
      // Prevent click from triggering when clicking the switch itself
      if ((e.target as HTMLElement).closest('[role="switch"]')) {
        return;
      }
      if (isVfsEnabledForItem && enableAdvancedSettings && enableVfs) {
        openAdvancedPanel("files");
      } else if (!isVfsEnabledForItem && enableVfs && isItemSelected) {
        toast.info("Toggle the switch to enable the filesystem.");
      }
    },
    [
      isVfsEnabledForItem,
      enableAdvancedSettings,
      enableVfs,
      isItemSelected,
      openAdvancedPanel,
    ],
  );

  const handleVfsSwitchChange = useCallback(() => {
    if (selectedItemId && selectedItemType) {
      // Call store action
      toggleVfsEnabled(selectedItemId, selectedItemType);
    } else {
      console.error(
        "[PromptSettings] Cannot toggle VFS: selectedItemId/Type is null",
      );
      toast.error("No item selected to toggle VFS.");
    }
  }, [selectedItemId, selectedItemType, toggleVfsEnabled]);

  return (
    <div className={cn("bg-card text-card-foreground", className)}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 p-3">
        {/* Provider/Model Selectors (fetch their own data) */}
        <div className="flex items-center gap-x-2 flex-shrink min-w-0 flex-grow sm:flex-grow-0">
          <ProviderSelector className="flex-shrink-0" />
          <div className="flex-grow min-w-[150px]">
            <ModelSelector />
          </div>
        </div>

        <div className="flex-grow hidden sm:block" />

        {/* Indicators/Toggles */}
        <div className="flex items-center gap-x-1 flex-shrink-0">
          {/* API Key Indicator */}
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={handleApiKeyIconClick}
                  className={cn(
                    "flex items-center justify-center h-9 w-9 rounded focus:outline-none focus:ring-1 focus:ring-primary transition-colors",
                    needsKey ? "cursor-pointer" : "cursor-default",
                  )}
                  disabled={!needsKey}
                  aria-label="Open API Key settings"
                >
                  {showKeyRequiredWarning && (
                    <AlertTriangleIcon className="h-4 w-4 text-amber-500" />
                  )}
                  {showKeyProvidedIndicator && (
                    <KeyIcon className="h-4 w-4 text-primary" />
                  )}
                  {!needsKey && <div className="w-4 h-4" />}
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">
                {!enableApiKeyManagement && needsKey ? (
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

          {/* VFS Toggle */}
          {enableVfs && (
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    onClick={handleVfsContainerClick}
                    className={cn(
                      "flex items-center space-x-1 h-9 px-2 rounded transition-colors",
                      isItemSelected && isVfsEnabledForItem
                        ? "cursor-pointer hover:bg-muted"
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
                        enableAdvancedSettings
                      ) {
                        openAdvancedPanel("files");
                      }
                    }}
                  >
                    <FolderSyncIcon
                      className={cn(
                        "h-4 w-4 transition-colors",
                        isItemSelected && isVfsEnabledForItem
                          ? "text-primary"
                          : "text-muted-foreground",
                      )}
                    />
                    <Switch
                      id="vfs-toggle-combined"
                      checked={isVfsEnabledForItem}
                      onCheckedChange={handleVfsSwitchChange}
                      disabled={!isItemSelected}
                      aria-label="Toggle Virtual Filesystem"
                      onClick={(e) => e.stopPropagation()} // Prevent container click
                      className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted-foreground scale-75"
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

          {/* Advanced Settings Toggle */}
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
                      "h-8 w-8 text-muted-foreground hover:text-foreground transition-colors",
                      isAdvancedPanelOpen && "bg-muted text-foreground",
                    )}
                    aria-label="Toggle advanced settings"
                  >
                    <Settings2Icon className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>
                    {isAdvancedPanelOpen ? "Hide" : "Show"} Advanced Settings
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>

      {/* Advanced Settings Panel */}
      {enableAdvancedSettings && isAdvancedPanelOpen && (
        // PromptSettingsAdvanced fetches its own data
        <PromptSettingsAdvanced
          className="border-t border-border animate-slideInFromTop"
          initialTab={advancedInitialTab}
        />
      )}
    </div>
  );
};

export const PromptSettings = React.memo(PromptSettingsComponent);
