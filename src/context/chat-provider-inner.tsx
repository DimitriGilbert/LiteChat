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
  const [isStorageReady, setIsStorageReady] = useState(false);
  const storage = useChatStorage(); // Get storage hook instance

  // Effect 1: Watch storage results to set isStorageReady flag ONCE
  useEffect(() => {
    if (isStorageReady) return; // Already set, do nothing

    // Check if all required storage data arrays are no longer undefined
    const providerConfigsLoaded = storage.providerConfigs !== undefined;
    const projectsLoaded = storage.projects !== undefined;
    const conversationsLoaded = storage.conversations !== undefined;
    const apiKeysLoaded = storage.apiKeys !== undefined; // Add checks for all relevant stores
    const modsLoaded = storage.mods !== undefined;

    if (
      providerConfigsLoaded &&
      projectsLoaded &&
      conversationsLoaded &&
      apiKeysLoaded &&
      modsLoaded
    ) {
      console.log(
        "[ChatProviderInner Effect 1] All required storage ready. Setting flag.",
      );
      setIsStorageReady(true); // Set the flag
    }
    // This effect depends on the storage values changing from undefined to defined
  }, [
    storage.providerConfigs,
    storage.projects,
    storage.conversations,
    storage.apiKeys,
    storage.mods,
    isStorageReady, // Include to prevent re-running after set to true
  ]);

  // Effect 2: Main initialization logic, runs ONCE when storage is ready
  useEffect(() => {
    // Guard: Only run if storage is ready AND initialization hasn't completed
    if (!isStorageReady || isInitialized) {
      return;
    }

    // Ensure providerConfigs has loaded (it might be [] initially from useLiveQuery)
    // We rely on isStorageReady which checks for !== undefined, which is sufficient here.
    const currentProviderConfigs = storage.providerConfigs || [];
    if (currentProviderConfigs === undefined) {
      console.log(
        "[ChatProviderInner Effect 2] Waiting for providerConfigs to load...",
      );
      return; // Wait if configs are still undefined (shouldn't happen if isStorageReady is true)
    }

    console.log(
      "[ChatProviderInner Effect 2] Running initialization logic with loaded providerConfigs:",
      currentProviderConfigs,
    );

    // --- Initialization Logic ---
    const initializeApp = async () => {
      let initializationError: Error | null = null;
      try {
        // Access storage data directly - it's ready now
        // Use the variable captured at the start of the effect
        const currentProjects = storage.projects || [];
        const currentConversations = storage.conversations || [];

        // 1. Initialize Feature Flags and Configurable Settings
        console.log("[ChatProviderInner Init] Setting feature flags...");
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

        // 2. Trigger store initialization actions (Provider Selection)
        console.log(
          "[ChatProviderInner Init] Triggering provider selection initialization...",
        );
        // Pass the *currently loaded* provider configs
        await useProviderStore
          .getState()
          .loadInitialSelection(currentProviderConfigs);
        console.log("[ChatProviderInner Init] Provider selection initialized.");

        // 3. Apply Config Overrides and Set Initial Sidebar Selection
        console.log("[ChatProviderInner Init] Applying config overrides...");
        const {
          initialSelectedItemId,
          initialSelectedItemType,
          initialProviderId,
          initialModelId,
        } = config;

        // Get state *after* loadInitialSelection has run
        const currentSelectedProviderId =
          useProviderStore.getState().selectedProviderId;
        const currentSelectedModelId =
          useProviderStore.getState().selectedModelId;

        let finalProviderId = currentSelectedProviderId;
        let finalModelId = currentSelectedModelId;

        // Apply provider override from config, if different from loaded state
        if (
          initialProviderId &&
          initialProviderId !== currentSelectedProviderId
        ) {
          const isValidOverride = currentProviderConfigs.some(
            (p) => p.id === initialProviderId && p.isEnabled,
          );
          if (isValidOverride) {
            console.log(
              `[ChatProviderInner Init] Config overriding initial provider: ${initialProviderId}`,
            );
            // Call setSelectedProviderId which handles setting the default model
            useProviderStore
              .getState()
              .setSelectedProviderId(initialProviderId, currentProviderConfigs);
            // Update local vars with the state set by the action
            finalProviderId = useProviderStore.getState().selectedProviderId;
            finalModelId = useProviderStore.getState().selectedModelId;
          } else {
            console.warn(
              `[ChatProviderInner Init] Config initialProviderId ${initialProviderId} invalid/disabled. Ignoring override.`,
            );
          }
        }

        // Apply model override from config, if provider matches and model is different
        if (
          finalProviderId && // Ensure a provider is selected
          initialModelId && // Ensure a model override is specified
          initialModelId !== finalModelId // Ensure it's different from current/default
        ) {
          const providerConfig = currentProviderConfigs.find(
            (p) => p.id === finalProviderId,
          );
          const availableModels =
            providerConfig?.fetchedModels ??
            (providerConfig ? DEFAULT_MODELS[providerConfig.type] || [] : []);
          if (
            availableModels.some(
              (m: { id: string; name: string }) => m.id === initialModelId,
            )
          ) {
            console.log(
              `[ChatProviderInner Init] Config setting initial model: ${initialModelId} for provider ${finalProviderId}`,
            );
            useProviderStore.getState().setSelectedModelId(initialModelId);
            finalModelId = initialModelId; // Update local var
          } else {
            console.warn(
              `[ChatProviderInner Init] Config initialModelId ${initialModelId} invalid for provider ${finalProviderId}. Using default/current ${finalModelId}.`,
            );
          }
        }

        // Set initial sidebar selection
        console.log("[ChatProviderInner Init] Setting sidebar selection...");
        const currentSidebarItemId = useSidebarStore.getState().selectedItemId;
        if (initialSelectedItemId && initialSelectedItemType) {
          console.log(
            `[ChatProviderInner Init] Attempting selection from config: ${initialSelectedItemType} - ${initialSelectedItemId}`,
          );
          let itemExists = false;
          if (initialSelectedItemType === "conversation") {
            itemExists = currentConversations.some(
              (c) => c.id === initialSelectedItemId,
            );
          } else {
            itemExists = currentProjects.some(
              (p) => p.id === initialSelectedItemId,
            );
          }

          if (itemExists) {
            await useSidebarStore
              .getState()
              .selectItem(initialSelectedItemId, initialSelectedItemType);
          } else {
            console.warn(
              `[ChatProviderInner Init] Config initialSelectedItemId ${initialSelectedItemId} (${initialSelectedItemType}) not found. Selecting fallback.`,
            );
            const fallbackItem = getFirstAvailableItem(
              currentProjects,
              currentConversations,
            );
            await useSidebarStore
              .getState()
              .selectItem(fallbackItem?.id ?? null, fallbackItem?.type ?? null);
          }
        } else if (!currentSidebarItemId) {
          console.log(
            "[ChatProviderInner Init] No initial item selection. Selecting first available.",
          );
          const firstItem = getFirstAvailableItem(
            currentProjects,
            currentConversations,
          );
          if (firstItem) {
            console.log(
              `[ChatProviderInner Init] Selecting first available item: ${firstItem.type} - ${firstItem.id}`,
            );
            await useSidebarStore
              .getState()
              .selectItem(firstItem.id, firstItem.type);
          } else {
            console.log("[ChatProviderInner Init] No items found to select.");
            await useSidebarStore.getState().selectItem(null, null);
          }
        } else {
          console.log(
            "[ChatProviderInner Init] Sidebar selection already present:",
            currentSidebarItemId,
          );
          const currentSidebarItemType =
            useSidebarStore.getState().selectedItemType;
          // Re-select to ensure message/VFS loading triggers correctly
          await useSidebarStore
            .getState()
            .selectItem(currentSidebarItemId, currentSidebarItemType);
        }

        console.log(
          "[ChatProviderInner Init] Post-initialization setup complete.",
        );
      } catch (error) {
        initializationError =
          error instanceof Error ? error : new Error(String(error));
        console.error(
          "[ChatProviderInner Init] Error during initialization:",
          initializationError,
        );
        toast.error(
          `Failed to initialize application: ${initializationError.message}`,
        );
        useCoreChatStore
          .getState()
          .setError("Failed to load initial application data.");
      } finally {
        // Set initialized to true *only after* the first attempt (success or fail)
        setIsInitialized(true);
        console.log(
          `[ChatProviderInner Init] Initialization sequence finished. isInitialized: true.`,
        );
      }
    };

    initializeApp();
    // Add storage.providerConfigs to dependencies to ensure the effect runs
    // *after* the configs are loaded by useLiveQuery.
    // The isInitialized flag prevents it from running again after the first successful execution.
  }, [isStorageReady, isInitialized, config, storage.providerConfigs]); // Added storage.providerConfigs

  // Helper function (remains the same)
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

  // Render loading state until *both* storage is ready *and* initialization is complete
  if (!isStorageReady || !isInitialized) {
    const initError = useCoreChatStore.getState().error;
    const loadingMessage = !isStorageReady
      ? "Loading data..."
      : "Initializing LiteChat...";
    return (
      <div className="flex items-center justify-center h-full w-full bg-gray-900 text-gray-400">
        {initError ? (
          <span className="text-red-400">Error: {initError}</span>
        ) : (
          loadingMessage
        )}
      </div>
    );
  }

  return <>{children}</>;
};

export default ChatProviderInner;
