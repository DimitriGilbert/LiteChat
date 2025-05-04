// src/components/LiteChat/canvas/empty-states/EmptyStateSetup.tsx
// FULL FILE
import React, { useState, useCallback, useMemo, useEffect } from "react";
import {
  AlertCircleIcon,
  SettingsIcon,
  MessageSquarePlusIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProviderStore } from "@/store/provider.store";
import { useUIStateStore } from "@/store/ui.store";
import { useConversationStore } from "@/store/conversation.store";
import { useShallow } from "zustand/react/shallow";
import { ApiKeyForm } from "@/components/LiteChat/common/ApiKeysForm";
import { AddProviderForm } from "@/components/LiteChat/settings/AddProviderForm";
import type {
  DbProviderConfig,
  DbProviderType,
} from "@/types/litechat/provider";
import { SetupStep } from "./SetupStep";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ModelEnablementList } from "@/components/LiteChat/settings/ModelEnablementList";
import { Lnk } from "@/components/ui/lnk"; // Import the new Lnk component

export const EmptyStateSetup: React.FC = () => {
  const {
    apiKeys,
    addApiKey,
    providers,
    addProviderConfig,
    updateProviderConfig,
    getAllAvailableModelDefsForProvider,
    isLoading: isProviderLoading,
    enableApiKeyManagement,
  } = useProviderStore(
    useShallow((state) => ({
      apiKeys: state.dbApiKeys,
      addApiKey: state.addApiKey,
      providers: state.dbProviderConfigs,
      addProviderConfig: state.addProviderConfig,
      updateProviderConfig: state.updateProviderConfig,
      getAllAvailableModelDefsForProvider:
        state.getAllAvailableModelDefsForProvider,
      isLoading: state.isLoading,
      enableApiKeyManagement: state.enableApiKeyManagement,
    })),
  );
  const { toggleChatControlPanel, setInitialSettingsTabs } = useUIStateStore(
    useShallow((state) => ({
      toggleChatControlPanel: state.toggleChatControlPanel,
      setInitialSettingsTabs: state.setInitialSettingsTabs,
    })),
  );
  const { addConversation, selectItem } = useConversationStore(
    useShallow((state) => ({
      addConversation: state.addConversation,
      selectItem: state.selectItem,
    })),
  );

  const [isSavingKey, setIsSavingKey] = useState(false);
  const [isSavingProvider, setIsSavingProvider] = useState(false);
  const [isStartingChat, setIsStartingChat] = useState(false);
  const setFocusInputFlag = useUIStateStore((state) => state.setFocusInputFlag);
  const [isUpdatingModels, setIsUpdatingModels] = useState(false);
  // State to hold the provider type of the last added key
  const [lastAddedKeyProviderType, setLastAddedKeyProviderType] =
    useState<DbProviderType | null>(null);

  // --- Step Completion Logic ---
  const isApiKeyStepComplete = useMemo(
    () => !enableApiKeyManagement || apiKeys.length > 0,
    [enableApiKeyManagement, apiKeys],
  );

  const isProviderStepComplete = useMemo(
    () => providers.length > 0,
    [providers],
  );

  const isEnableModelsStepComplete = useMemo(() => {
    return providers.some(
      (p) => p.isEnabled && p.enabledModels && p.enabledModels.length > 0,
    );
  }, [providers]);
  // --- End Step Completion Logic ---

  // --- Get data for the first provider (if it exists) ---
  const firstProvider = useMemo(() => {
    return providers.length > 0 ? providers[0] : null;
  }, [providers]);

  const firstProviderModels = useMemo(() => {
    if (!firstProvider) return [];
    return getAllAvailableModelDefsForProvider(firstProvider.id).map((m) => ({
      id: m.id,
      name: m.name,
    }));
  }, [firstProvider, getAllAvailableModelDefsForProvider]);

  const firstProviderEnabledModels = useMemo(() => {
    return new Set(firstProvider?.enabledModels ?? []);
  }, [firstProvider]);
  // --- End first provider data ---

  const handleSaveKey = useCallback(
    async (name: string, providerId: string, value: string) => {
      setIsSavingKey(true);
      try {
        await addApiKey(name, providerId, value);
        // Store the provider type of the added key
        setLastAddedKeyProviderType(providerId as DbProviderType);
      } finally {
        setIsSavingKey(false);
      }
    },
    [addApiKey],
  );

  const handleSaveProvider = useCallback(
    async (
      config: Omit<DbProviderConfig, "id" | "createdAt" | "updatedAt">,
    ): Promise<string> => {
      setIsSavingProvider(true);
      try {
        const newId = await addProviderConfig(config);
        // Reset the last added key type after provider is added
        setLastAddedKeyProviderType(null);
        return newId;
      } finally {
        setIsSavingProvider(false);
      }
    },
    [addProviderConfig],
  );

  const handleModelToggle = useCallback(
    async (modelId: string, checked: boolean) => {
      if (!firstProvider) return;
      setIsUpdatingModels(true);
      const currentEnabledSet = new Set(firstProvider.enabledModels ?? []);
      if (checked) {
        currentEnabledSet.add(modelId);
      } else {
        currentEnabledSet.delete(modelId);
      }
      const newEnabledModels = Array.from(currentEnabledSet);
      try {
        await updateProviderConfig(firstProvider.id, {
          enabledModels: newEnabledModels,
        });
      } catch (error) {
        toast.error("Failed to update model status.");
        console.error("Failed to save model toggle:", error);
      } finally {
        setIsUpdatingModels(false);
      }
    },
    [firstProvider, updateProviderConfig],
  );

  const handleStartFirstChat = useCallback(async () => {
    setIsStartingChat(true);
    try {
      const newId = await addConversation({ title: "New Chat" });
      await selectItem(newId, "conversation");
      // Focus flag is set correctly, ensure selection update doesn't interfere
      setTimeout(() => setFocusInputFlag(true), 0);
    } catch (error) {
      toast.error("Failed to start your first chat.");
      console.error("Failed to start first chat:", error);
    } finally {
      // Only set loading false if it didn't succeed (otherwise component unmounts)
      setIsStartingChat(false);
    }
  }, [addConversation, selectItem, setFocusInputFlag]);

  const openSettings = (tab: string, subTab?: string) => {
    setInitialSettingsTabs(tab, subTab);
    toggleChatControlPanel("settingsModal", true);
  };

  // Define steps
  const steps = [
    // Step 1: API Keys (Conditional)
    ...(enableApiKeyManagement
      ? [
          {
            id: "api-key",
            title: "Add API Key",
            description: (
              <div>
                <p>
                  To use providers like{" "}
                  <Lnk href="https://platform.openai.com/api-keys">OpenAI</Lnk>,{" "}
                  <Lnk href="https://aistudio.google.com/app/apikey">
                    Google
                  </Lnk>
                  ,{" "}
                  <Lnk href="https://console.anthropic.com/settings/keys">
                    Anthropic (Claude)
                  </Lnk>
                  , or <Lnk href="https://openrouter.ai/keys">OpenRouter</Lnk>{" "}
                  or any OpenAi API compatible provider , add an API key. Keys
                  are stored securely in your browser.
                </p>
                <p className="py-2">
                  If you want truly local AI, "no internet required", you can
                  setup <Lnk href="https://www.ollama.com/">Ollama</Lnk> or,{" "}
                  <Lnk href="https://lmstudio.ai/">LMStudio</Lnk> (or any other
                  local LLM solution with an OpenAI compatible API). These
                  typically don't require API keys.
                </p>
              </div>
            ),
            isComplete: isApiKeyStepComplete,
            content: (
              <ApiKeyForm
                onSave={handleSaveKey}
                onCancel={() => {}}
                isSaving={isSavingKey}
                className="border-none shadow-none p-0"
              />
            ),
          },
        ]
      : []),
    // Step 2: Add Provider
    {
      id: "add-provider",
      title: "Add AI Provider",
      description:
        "Connect to an AI provider like OpenAI, Ollama, or others to start chatting.",
      isComplete: isProviderStepComplete,
      content: (
        <AddProviderForm
          apiKeys={apiKeys}
          onAddProvider={
            handleSaveProvider as (
              config: Omit<DbProviderConfig, "id" | "createdAt" | "updatedAt">,
            ) => Promise<string>
          }
          onCancel={() => {}}
          // Pass the last added key's provider type as initial type
          initialType={lastAddedKeyProviderType ?? undefined}
        />
      ),
    },
    // Step 3: Enable Models
    {
      id: "enable-models",
      title: "Enable Models",
      description: (
        <>
          Enable models for the provider you just added (
          {firstProvider?.name || ""}). Enabling specific models improves the UI
          by reducing clutter and choice paralysis. You can enable more later in
          Settings.
        </>
      ),
      isComplete: isEnableModelsStepComplete,
      content: firstProvider ? (
        <ModelEnablementList
          providerId={firstProvider.id}
          allAvailableModels={firstProviderModels}
          enabledModelIds={firstProviderEnabledModels}
          onToggleModel={handleModelToggle}
          isLoading={isProviderLoading || isUpdatingModels}
          listHeightClass="h-48"
        />
      ) : (
        <p className="text-sm text-muted-foreground italic">
          Add a provider in Step {enableApiKeyManagement ? "2" : "1"} first.
        </p>
      ),
    },
    // Step 4: Start Chatting
    {
      id: "start-chat",
      title: "Start Chatting",
      description: "You're all set! Click below to start your first chat.",
      isComplete: false,
      content: (
        <Button
          onClick={handleStartFirstChat}
          disabled={isStartingChat}
          size="sm"
        >
          <MessageSquarePlusIcon className="mr-2 h-4 w-4" />
          {isStartingChat ? "Starting..." : "Start First Chat"}
        </Button>
      ),
      // Remove specific content class for this step
      contentClassName: "",
    },
  ];

  // Determine the first incomplete step
  const activeStepIndex = steps.findIndex((step) => !step.isComplete);

  if (isProviderLoading) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-4 space-y-4 max-w-2xl mx-auto w-full">
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col items-center justify-center p-4">
      <div className="w-full max-w-4xl space-y-6">
        <div className="text-center mb-6">
          <SettingsIcon className="h-12 w-12 text-primary mx-auto mb-3" />
          <h2 className="text-2xl font-semibold mb-1">LiteChat Setup</h2>
          <p className="text-muted-foreground">
            Follow these steps to configure LiteChat.
          </p>
        </div>

        <div className="space-y-4">
          {steps.map((step, index) => {
            const isActive = index === activeStepIndex;

            return (
              <SetupStep
                key={step.id}
                stepNumber={index + 1}
                title={step.title}
                description={step.description}
                isComplete={step.id !== "start-chat" && step.isComplete}
                isActive={isActive}
                contentClassName={
                  step.id === "add-provider" || step.id === "api-key"
                    ? "p-0 border-none shadow-none bg-transparent"
                    : step.id === "enable-models"
                      ? "p-0"
                      : step.contentClassName // Use specific class if provided, else default
                }
              >
                {step.content}
              </SetupStep>
            );
          })}
        </div>

        {/* Fallback Error Message */}
        {!isProviderLoading &&
          !enableApiKeyManagement &&
          !isProviderStepComplete &&
          activeStepIndex === -1 && (
            <div className="text-center text-muted-foreground mt-6">
              <AlertCircleIcon className="h-8 w-8 text-destructive mx-auto mb-2" />
              <p className="text-sm">
                Configuration issue detected. Please review provider settings.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => openSettings("providers")}
                className="mt-2"
              >
                Go to Settings
              </Button>
            </div>
          )}
      </div>
    </div>
  );
};
