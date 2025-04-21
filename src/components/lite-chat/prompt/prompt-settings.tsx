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
import type {
  DbProviderConfig,
  DbApiKey,
  SidebarItemType,
  DbConversation,
} from "@/lib/types";
import { toast } from "sonner";
import { requiresApiKey } from "@/lib/litechat";

interface PromptSettingsProps {
  className?: string;
  // Provider/Model related
  selectedProviderId: string | null;
  selectedModelId: string | null;
  dbProviderConfigs: DbProviderConfig[];
  apiKeys: DbApiKey[];
  enableApiKeyManagement: boolean;
  // VFS related
  enableVfs: boolean;
  isVfsEnabledForItem: boolean;
  selectedItemId: string | null;
  selectedItemType: SidebarItemType | null;
  toggleVfsEnabledAction: (id: string, type: SidebarItemType) => Promise<void>;
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
  activeConversationData: DbConversation | null;
  updateConversationSystemPrompt: (
    id: string,
    systemPrompt: string | null,
  ) => Promise<void>;
  updateDbProviderConfig: (
    id: string,
    changes: Partial<DbProviderConfig>,
  ) => Promise<void>;
  // Provider/Model setters
  setSelectedProviderId: (id: string | null) => void;
  setSelectedModelId: (id: string | null) => void;
  // VFS State for PromptSettingsAdvanced
  isVfsReady: boolean;
  isVfsLoading: boolean;
  vfsError: string | null;
  vfsKey: string | null;
  // Add stopStreaming prop
  stopStreaming: () => void;
}

const PromptSettingsComponent: React.FC<PromptSettingsProps> = ({
  className,
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
  enableAdvancedSettings,
  setSelectedProviderId,
  setSelectedModelId,
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
}) => {
  const [isAdvancedPanelOpen, setIsAdvancedPanelOpen] = useState(false);
  const [advancedInitialTab, setAdvancedInitialTab] =
    useState<string>("parameters");

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

  const needsKey = requiresApiKey(selectedDbProviderConfig?.type ?? null);
  const keyIsLinked = !!selectedDbProviderConfig?.apiKeyId;
  const keyIsAvailable =
    keyIsLinked && !!getApiKeyForProvider(selectedProviderId!);

  const showKeyRequiredWarning = needsKey && (!keyIsLinked || !keyIsAvailable);
  const showKeyProvidedIndicator = needsKey && keyIsLinked && keyIsAvailable;

  const isItemSelected = !!selectedItemId;

  const openAdvancedPanel = useCallback((tabId: string = "parameters") => {
    console.log(
      `[PromptSettings] openAdvancedPanel called with tabId: ${tabId}. Setting isAdvancedPanelOpen(true).`,
    );
    setAdvancedInitialTab(tabId);
    setIsAdvancedPanelOpen(true);
  }, []);

  const handleToggleAdvancedClick = useCallback(() => {
    console.log(
      `[PromptSettings] handleToggleAdvancedClick called. Current panel state: ${isAdvancedPanelOpen}`,
    );
    setIsAdvancedPanelOpen((prev) => !prev);
    if (!isAdvancedPanelOpen) {
      setAdvancedInitialTab("parameters");
    }
  }, [isAdvancedPanelOpen]);

  const handleApiKeyIconClick = useCallback(() => {
    console.log("[PromptSettings] handleApiKeyIconClick called.");
    if (enableApiKeyManagement) {
      openAdvancedPanel("api_keys");
    } else {
      toast.info("API Key management is disabled.");
    }
  }, [enableApiKeyManagement, openAdvancedPanel]);

  const handleVfsContainerClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
      console.log("[PromptSettings] handleVfsContainerClick called.");
      if ((e.target as HTMLElement).closest('[role="switch"]')) {
        console.log(
          "[PromptSettings] Click was on switch, ignoring container click.",
        );
        return;
      }
      if (isVfsEnabledForItem && enableAdvancedSettings && enableVfs) {
        console.log("[PromptSettings] VFS enabled, opening files tab.");
        openAdvancedPanel("files");
      } else if (!isVfsEnabledForItem && enableVfs && isItemSelected) {
        console.log("[PromptSettings] VFS disabled, showing info toast.");
        toast.info("Toggle the switch to enable the filesystem.");
      } else {
        console.log(
          `[PromptSettings] VFS container clicked but conditions not met (isVfsEnabledForItem: ${isVfsEnabledForItem}, enableAdvancedSettings: ${enableAdvancedSettings}, enableVfs: ${enableVfs}, isItemSelected: ${isItemSelected})`,
        );
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
    console.log(
      `[PromptSettings] handleVfsSwitchChange called for item ${selectedItemId} (${selectedItemType})`,
    );
    if (selectedItemId && selectedItemType) {
      toggleVfsEnabledAction(selectedItemId, selectedItemType);
    } else {
      console.error(
        "[PromptSettings] Cannot toggle VFS: selectedItemId/Type is null",
      );
      toast.error("No item selected to toggle VFS.");
    }
  }, [selectedItemId, selectedItemType, toggleVfsEnabledAction]);

  return (
    <div className={cn("bg-card text-card-foreground", className)}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 p-3">
        {/* Group 1: Selectors */}
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
                      onClick={(e) => e.stopPropagation()}
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
        <PromptSettingsAdvanced
          className="border-t border-border animate-slideInFromTop"
          initialTab={advancedInitialTab}
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
          isVfsReady={isVfsReady}
          isVfsLoading={isVfsLoading}
          vfsError={vfsError}
          vfsKey={vfsKey}
          enableApiKeyManagement={enableApiKeyManagement}
          selectedProviderId={selectedProviderId}
          dbProviderConfigs={dbProviderConfigs}
          apiKeys={apiKeys}
          updateDbProviderConfig={updateDbProviderConfig}
        />
      )}
    </div>
  );
};

export const PromptSettings = React.memo(PromptSettingsComponent);
