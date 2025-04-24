// src/context/chat-provider-inner.tsx
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

import { useCoreChatStore } from "@/store/core-chat.store";
import { useProviderStore } from "@/store/provider.store";
import { useSettingsStore } from "@/store/settings.store";
import { useSidebarStore } from "@/store/sidebar.store";
import { useVfsStore } from "@/store/vfs.store";
import { useChatStorage } from "@/hooks/use-chat-storage";

import type { LiteChatConfig, DbConversation, DbProject } from "@/lib/types";
// Import DEFAULT_MODELS
import { DEFAULT_MODELS } from "@/lib/litechat";

interface ChatProviderInnerProps {
  children: React.ReactNode;
  config: LiteChatConfig;
}

const ChatProviderInner: React.FC<ChatProviderInnerProps> = ({
  children,
  config,
}) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const storage = useChatStorage(); // Use the hook to get live data

  useEffect(() => {
    // Prevent re-initialization
    if (isInitialized) return;

    // Check if the live queries are still loading (value is undefined)
    const isLoading =
      storage.providerConfigs === undefined ||
      storage.projects === undefined ||
      storage.conversations === undefined;

    if (isLoading) {
      console.log(
        "[ChatProviderInner] Waiting for initial storage queries...",
        {
          providerConfigs: storage.providerConfigs?.length,
          projects: storage.projects?.length,
          conversations: storage.conversations?.length,
        },
      );
      return; // Wait until queries resolve (even if to null/[])
    }

    console.log(
      "[ChatProviderInner] Initial queries resolved. Proceeding with initialization...",
    );

    // --- Initialization Logic ---
    const initializeApp = async () => {
      let initializationError: Error | null = null;
      try {
        // 1. Initialize Feature Flags and Configurable Settings (Synchronous)
        // These are set based on the initial config prop
        useProviderStore
          .getState()
          .setEnableApiKeyManagement(config.enableApiKeyManagement ?? true);
        useSettingsStore
          .getState()
          .setEnableAdvancedSettings(config.enableAdvancedSettings ?? true);
        useSidebarStore
          .getState()
          .setEnableSidebar(config.enableSidebar ?? true);
        useVfsStore.getState()._setEnableVfs(config.enableVfs ?? true);
        if (config.streamingRefreshRateMs !== undefined) {
          useSettingsStore
            .getState()
            .setStreamingRefreshRateMs(config.streamingRefreshRateMs);
        }

        // 2. Trigger store initialization actions (async)
        // Pass the resolved storage data to the initialization actions
        console.log(
          "[ChatProviderInner] Triggering store initialization actions...",
        );
        const currentProviderConfigs = storage.providerConfigs || [];
        // Load initial provider/model selection based on DB state or defaults
        await useProviderStore
          .getState()
          .loadInitialSelection(currentProviderConfigs);
        console.log("[ChatProviderInner] Provider selection initialized.");

        // 3. Apply Config Overrides and Set Initial Sidebar Selection
        const {
          initialSelectedItemId,
          initialSelectedItemType,
          initialProviderId,
          initialModelId,
        } = config;

        // Apply provider/model overrides from config *after* initial load
        const currentSelectedProviderId =
          useProviderStore.getState().selectedProviderId;
        const currentSelectedModelId =
          useProviderStore.getState().selectedModelId;

        let finalProviderId = currentSelectedProviderId;
        let finalModelId = currentSelectedModelId;

        if (
          initialProviderId &&
          initialProviderId !== currentSelectedProviderId
        ) {
          // Check if the config provider ID is valid among current configs
          const isValidOverride = currentProviderConfigs.some(
            (p) => p.id === initialProviderId && p.isEnabled,
          );
          if (isValidOverride) {
            console.log(
              `[ChatProviderInner] Config overriding initial provider: ${initialProviderId}`,
            );
            // Use the store action to set provider and default model
            useProviderStore
              .getState()
              .setSelectedProviderId(initialProviderId, currentProviderConfigs);
            finalProviderId = initialProviderId;
            // Re-fetch the model ID as setSelectedProviderId sets the default
            finalModelId = useProviderStore.getState().selectedModelId;

            // Apply model override if specified *and valid for the new provider*
            if (initialModelId) {
              const providerConfig = currentProviderConfigs.find(
                (p) => p.id === initialProviderId,
              );
              const availableModels =
                providerConfig?.fetchedModels ??
                (providerConfig
                  ? DEFAULT_MODELS[providerConfig.type] || []
                  : []);
              // Add type annotation for 'm'
              if (
                availableModels.some(
                  (m: { id: string; name: string }) => m.id === initialModelId,
                )
              ) {
                console.log(
                  `[ChatProviderInner] Config setting initial model: ${initialModelId}`,
                );
                useProviderStore.getState().setSelectedModelId(initialModelId);
                finalModelId = initialModelId;
              } else {
                console.warn(
                  `[ChatProviderInner] Config initialModelId ${initialModelId} is invalid for provider ${initialProviderId}. Using default model ${finalModelId}.`,
                );
              }
            }
          } else {
            console.warn(
              `[ChatProviderInner] Config initialProviderId ${initialProviderId} is invalid or disabled. Ignoring override.`,
            );
          }
        } else if (
          finalProviderId && // Ensure a provider is actually selected
          initialModelId &&
          initialModelId !== currentSelectedModelId
        ) {
          // Apply model override if provider wasn't overridden but model is specified
          const providerConfig = currentProviderConfigs.find(
            (p) => p.id === finalProviderId,
          );
          const availableModels =
            providerConfig?.fetchedModels ??
            (providerConfig ? DEFAULT_MODELS[providerConfig.type] || [] : []);
          // Add type annotation for 'm'
          if (
            availableModels.some(
              (m: { id: string; name: string }) => m.id === initialModelId,
            )
          ) {
            console.log(
              `[ChatProviderInner] Config setting initial model for existing provider: ${initialModelId}`,
            );
            useProviderStore.getState().setSelectedModelId(initialModelId);
            finalModelId = initialModelId;
          } else {
            console.warn(
              `[ChatProviderInner] Config initialModelId ${initialModelId} is invalid for provider ${finalProviderId}. Ignoring override.`,
            );
          }
        }

        // Set initial sidebar selection
        const currentSidebarItemId = useSidebarStore.getState().selectedItemId;
        if (initialSelectedItemId && initialSelectedItemType) {
          console.log(
            `[ChatProviderInner] Setting initial selection from config: ${initialSelectedItemType} - ${initialSelectedItemId}`,
          );
          // Validate the item exists before selecting
          let itemExists = false;
          if (initialSelectedItemType === "conversation") {
            itemExists = (storage.conversations || []).some(
              (c) => c.id === initialSelectedItemId,
            );
          } else {
            itemExists = (storage.projects || []).some(
              (p) => p.id === initialSelectedItemId,
            );
          }

          if (itemExists) {
            await useSidebarStore
              .getState()
              .selectItem(initialSelectedItemId, initialSelectedItemType);
          } else {
            console.warn(
              `[ChatProviderInner] Config initialSelectedItemId ${initialSelectedItemId} (${initialSelectedItemType}) not found. Selecting fallback.`,
            );
            // Fallback logic if config item doesn't exist
            const fallbackItem = getFirstAvailableItem(
              storage.projects || [],
              storage.conversations || [],
            );
            await useSidebarStore
              .getState()
              .selectItem(fallbackItem?.id ?? null, fallbackItem?.type ?? null);
          }
        } else if (!currentSidebarItemId) {
          console.log(
            "[ChatProviderInner] No initial item selection provided or loaded. Selecting first item if available.",
          );
          const firstItem = getFirstAvailableItem(
            storage.projects || [],
            storage.conversations || [],
          );
          if (firstItem) {
            console.log(
              `[ChatProviderInner] Selecting first available item: ${firstItem.type} - ${firstItem.id}`,
            );
            await useSidebarStore
              .getState()
              .selectItem(firstItem.id, firstItem.type);
          } else {
            console.log("[ChatProviderInner] No items found to select.");
            await useSidebarStore.getState().selectItem(null, null); // Explicitly select null
          }
        } else {
          console.log(
            "[ChatProviderInner] Initial sidebar selection already present:",
            currentSidebarItemId,
          );
          // Ensure the VFS state is correctly initialized for the existing selection
          const currentSidebarItemType =
            useSidebarStore.getState().selectedItemType;
          await useSidebarStore
            .getState()
            .selectItem(currentSidebarItemId, currentSidebarItemType);
        }

        console.log("[ChatProviderInner] Post-initialization setup complete.");
      } catch (error) {
        initializationError =
          error instanceof Error ? error : new Error(String(error));
        console.error(
          "[ChatProviderInner] Error during initialization:",
          initializationError,
        );
        toast.error(
          `Failed to initialize application: ${initializationError.message}`,
        );
        useCoreChatStore
          .getState()
          .setError("Failed to load initial application data.");
      } finally {
        setIsInitialized(true);
        console.log(
          `[ChatProviderInner] Initialization sequence finished. isInitialized: true.`,
        );
      }
    };

    initializeApp();
    // Dependencies: config object and the resolved storage data.
    // isInitialized prevents re-running.
  }, [
    config,
    storage.providerConfigs,
    storage.projects,
    storage.conversations,
    isInitialized,
  ]);

  // Helper function to get the first available item
  const getFirstAvailableItem = (
    projects: DbProject[],
    conversations: DbConversation[],
  ) => {
    const combinedItems = [
      ...projects.map((p) => ({ ...p, type: "project" as const })),
      ...conversations.map((c) => ({ ...c, type: "conversation" as const })),
    ];
    combinedItems.sort(
      (a, b) => (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0),
    );
    return combinedItems[0];
  };

  if (!isInitialized) {
    const initError = useCoreChatStore.getState().error;
    return (
      <div className="flex items-center justify-center h-full w-full bg-gray-900 text-gray-400">
        {initError ? (
          <span className="text-red-400">Error: {initError}</span>
        ) : (
          "Initializing LiteChat..."
        )}
      </div>
    );
  }

  return <>{children}</>;
};

export default ChatProviderInner;
