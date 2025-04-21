// src/components/lite-chat/prompt/prompt-settings.tsx
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { ProviderSelector } from "@/components/lite-chat/provider-selector";
import { ModelSelector } from "@/components/lite-chat/model-selector";
import { PromptSettingsAdvanced } from "./prompt-settings-advanced";
// REMOVED store imports
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
import type {
  DbProviderConfig,
  DbApiKey,
  SidebarItemType, // Added
  DbConversation, // Added
} from "@/lib/types";
import { toast } from "sonner";
import { requiresApiKey } from "@/lib/litechat"; // Use helper

// Define props based on what PromptForm passes down
interface PromptSettingsProps {
  className?: string;
  // Provider/Model related
  selectedProviderId: string | null;
  selectedModelId: string | null;
  dbProviderConfigs: DbProviderConfig[];
  apiKeys: DbApiKey[];
  enableApiKeyManagement: boolean;
  // VFS related
  enableVfs: boolean; // Global flag
  isVfsEnabledForItem: boolean;
  selectedItemId: string | null; // Needed for VFS toggle
  selectedItemType: SidebarItemType | null; // Needed for VFS toggle
  toggleVfsEnabledAction: (id: string, type: SidebarItemType) => Promise<void>; // Action from sidebar store
  // Settings Modal related
  isSettingsModalOpen: boolean;
  setIsSettingsModalOpen: (isOpen: boolean) => void;
  // Advanced Settings related
  enableAdvancedSettings: boolean;
  // Props needed for PromptSettingsAdvanced
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
  globalSystemPrompt: string | null;
  activeConversationData: DbConversation | null; // Pass derived data
  updateConversationSystemPrompt: (
    id: string,
    systemPrompt: string | null,
  ) => Promise<void>; // Action from sidebar store
  updateDbProviderConfig: (
    id: string,
    changes: Partial<DbProviderConfig>,
  ) => Promise<void>; // Action from provider store
  // Provider/Model setters (needed by selectors)
  setSelectedProviderId: (id: string | null) => void;
  setSelectedModelId: (id: string | null) => void;
  // VFS State for PromptSettingsAdvanced
  isVfsReady: boolean;
  isVfsLoading: boolean;
  vfsError: string | null;
  vfsKey: string | null;
  // Stop streaming action (REMOVED - not needed by PromptSettingsAdvanced)
  // stopStreaming: () => void;
}

// Wrap component logic in a named function for React.memo
const PromptSettingsComponent: React.FC<PromptSettingsProps> = ({
  className,
  // Destructure all props
  selectedProviderId,
  selectedModelId,
  dbProviderConfigs,
  apiKeys,
  enableApiKeyManagement,
  enableVfs,
  isVfsEnabledForItem,
  selectedItemId,
  selectedItemType,
  toggleVfsEnabledAction,
  isSettingsModalOpen,
  setIsSettingsModalOpen,
  enableAdvancedSettings,
  setSelectedProviderId,
  setSelectedModelId,
  // Props for PromptSettingsAdvanced
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
  activeConversationData,
  updateConversationSystemPrompt,
  updateDbProviderConfig,
  isVfsReady,
  isVfsLoading,
  vfsError,
  vfsKey,
  // stopStreaming, // REMOVED
}) => {
  // REMOVED store access

  const [advancedInitialTab, setAdvancedInitialTab] =
    useState<string>("parameters");

  // --- Derivations and Callbacks using props ---
  const getApiKeyForProvider = useCallback(
    (providerId: string): string | undefined => {
      const config = dbProviderConfigs.find((p) => p.id === providerId);
      if (!config || !config.apiKeyId) return undefined;
      return apiKeys.find((k) => k.id === config.apiKeyId)?.value;
    },
    [dbProviderConfigs, apiKeys],
  );

  const selectedDbProviderConfig = useMemo(
    () => dbProviderConfigs.find((p) => p.id === selectedProviderId),
    [dbProviderConfigs, selectedProviderId],
  );

  const needsKey = requiresApiKey(selectedDbProviderConfig?.type ?? null); // Handle undefined type
  const keyIsLinked = !!selectedDbProviderConfig?.apiKeyId;
  const keyIsAvailable =
    keyIsLinked && !!getApiKeyForProvider(selectedProviderId!);

  const showKeyRequiredWarning = needsKey && (!keyIsLinked || !keyIsAvailable);
  const showKeyProvidedIndicator = needsKey && keyIsLinked && keyIsAvailable;

  const isItemSelected = !!selectedItemId;

  const openSettings = (tabId: string = "parameters") => {
    setAdvancedInitialTab(tabId);
    setIsSettingsModalOpen(true); // Use prop action
  };

  const handleToggleAdvancedClick = () => {
    if (isSettingsModalOpen) {
      setIsSettingsModalOpen(false); // Use prop action
    } else {
      openSettings("parameters");
    }
  };

  const handleApiKeyIconClick = () => {
    if (enableApiKeyManagement) {
      openSettings("api_keys");
    } else {
      toast.info("API Key management is disabled.");
    }
  };

  const handleVfsContainerClick = (
    e: React.MouseEvent<HTMLDivElement, MouseEvent>,
  ) => {
    if ((e.target as HTMLElement).closest('[role="switch"]')) {
      return;
    }
    if (isVfsEnabledForItem && enableAdvancedSettings && enableVfs) {
      openSettings("files");
    } else if (!isVfsEnabledForItem && enableVfs && isItemSelected) {
      toast.info("Toggle the switch to enable the filesystem.");
    }
  };

  const handleVfsSwitchChange = () => {
    if (selectedItemId && selectedItemType) {
      toggleVfsEnabledAction(selectedItemId, selectedItemType); // Use prop action
    } else {
      console.error("Cannot toggle VFS: selectedItemId/Type is null");
      toast.error("No item selected to toggle VFS.");
    }
  };

  useEffect(() => {
    if (!isSettingsModalOpen) {
      // Optional: Reset tab on close
      // setAdvancedInitialTab("parameters");
    }
  }, [isSettingsModalOpen]);

  return (
    <div className={cn("bg-gray-800 text-gray-300", className)}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 p-3">
        {/* Group 1: Selectors - Pass props down */}
        <div className="flex items-center gap-x-2 flex-shrink min-w-0 flex-grow sm:flex-grow-0">
          <ProviderSelector
            className="flex-shrink-0"
            selectedProviderId={selectedProviderId}
            setSelectedProviderId={setSelectedProviderId}
            setSelectedModelId={setSelectedModelId}
            dbProviderConfigs={dbProviderConfigs}
          />
          <div className="flex-grow min-w-[150px]">
            <ModelSelector
              selectedProviderId={selectedProviderId}
              selectedModelId={selectedModelId}
              setSelectedModelId={setSelectedModelId}
              dbProviderConfigs={dbProviderConfigs}
            />
          </div>
        </div>

        <div className="flex-grow hidden sm:block" />

        {/* Group 2: Action Icons - Use props */}
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
                        enableAdvancedSettings
                      ) {
                        openSettings("files");
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
                      checked={isVfsEnabledForItem} // Use prop
                      onCheckedChange={handleVfsSwitchChange} // Use prop action
                      disabled={!isItemSelected} // Use prop
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
                      isSettingsModalOpen && "bg-gray-700 text-gray-200", // Use prop
                    )}
                    aria-label="Toggle advanced settings"
                  >
                    <Settings2Icon className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>{isSettingsModalOpen ? "Close" : "Show"} Settings</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>

      {/* Advanced Settings Panel - Pass props down */}
      {enableAdvancedSettings && isSettingsModalOpen && (
        <PromptSettingsAdvanced
          className="border-t border-gray-700"
          initialTab={advancedInitialTab}
          // Pass all necessary props down
          enableAdvancedSettings={enableAdvancedSettings}
          temperature={temperature}
          setTemperature={setTemperature}
          topP={topP}
          setTopP={setTopP}
          maxTokens={maxTokens}
          setMaxTokens={setMaxTokens}
          topK={topK}
          setTopK={setTopK}
          presencePenalty={presencePenalty}
          setPresencePenalty={setPresencePenalty}
          frequencyPenalty={frequencyPenalty}
          setFrequencyPenalty={setFrequencyPenalty}
          globalSystemPrompt={globalSystemPrompt}
          selectedItemId={selectedItemId}
          selectedItemType={selectedItemType}
          updateConversationSystemPrompt={updateConversationSystemPrompt}
          activeConversationData={activeConversationData}
          isVfsEnabledForItem={isVfsEnabledForItem}
          // VFS state needed by FileManager inside Advanced
          isVfsReady={isVfsReady}
          isVfsLoading={isVfsLoading}
          vfsError={vfsError}
          vfsKey={vfsKey}
          // API Key Management related
          enableApiKeyManagement={enableApiKeyManagement}
          selectedProviderId={selectedProviderId}
          dbProviderConfigs={dbProviderConfigs}
          apiKeys={apiKeys}
          updateDbProviderConfig={updateDbProviderConfig}
          // REMOVED: stopStreaming={stopStreaming}
        />
      )}
    </div>
  );
};

// Export the memoized component
export const PromptSettings = React.memo(PromptSettingsComponent);
