// src/context/chat-provider-inner.tsx
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

import { useCoreChatStore } from "@/store/core-chat.store";
import { useProviderStore } from "@/store/provider.store";
import { useSettingsStore } from "@/store/settings.store";
import { useSidebarStore } from "@/store/sidebar.store";
import { useVfsStore } from "@/store/vfs.store";
import { useChatStorage } from "@/hooks/use-chat-storage";

import type { LiteChatConfig } from "@/lib/types";

interface ChatProviderInnerProps {
  children: React.ReactNode;
  config: LiteChatConfig;
}

const ChatProviderInner: React.FC<ChatProviderInnerProps> = ({
  children,
  config,
}) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const storage = useChatStorage();

  useEffect(() => {
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
          providerConfigs: storage.providerConfigs,
          projects: storage.projects,
          conversations: storage.conversations,
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
        console.log(
          "[ChatProviderInner] Triggering store initialization actions...",
        );
        // Use the resolved values (which might be null/[])
        const currentProviderConfigs = storage.providerConfigs || [];
        await useProviderStore
          .getState()
          .loadInitialSelection(currentProviderConfigs);

        console.log(
          "[ChatProviderInner] Store initialization actions complete.",
        );

        // 3. Set Initial Selection (using live data and initialized store state)
        const {
          initialSelectedItemId,
          initialSelectedItemType,
          initialProviderId,
          initialModelId,
        } = config;
        const currentSelectedProviderId =
          useProviderStore.getState().selectedProviderId;
        const currentSelectedModelId =
          useProviderStore.getState().selectedModelId;

        if (
          initialProviderId &&
          initialProviderId !== currentSelectedProviderId
        ) {
          console.log(
            `[ChatProviderInner] Config overriding initial provider: ${initialProviderId}`,
          );
          useProviderStore.getState().setSelectedProviderId(
            initialProviderId,
            storage.providerConfigs || [], // Use resolved value
          );
          if (initialModelId) {
            console.log(
              `[ChatProviderInner] Config setting initial model: ${initialModelId}`,
            );
            useProviderStore.getState().setSelectedModelId(initialModelId);
          }
        } else if (
          initialProviderId &&
          initialModelId &&
          initialModelId !== currentSelectedModelId
        ) {
          console.log(
            `[ChatProviderInner] Config setting initial model for existing provider: ${initialModelId}`,
          );
          useProviderStore.getState().setSelectedModelId(initialModelId);
        }

        // Set initial sidebar selection
        if (initialSelectedItemId && initialSelectedItemType) {
          console.log(
            `[ChatProviderInner] Setting initial selection from config: ${initialSelectedItemType} - ${initialSelectedItemId}`,
          );
          await useSidebarStore
            .getState()
            .selectItem(initialSelectedItemId, initialSelectedItemType);
        } else if (!useSidebarStore.getState().selectedItemId) {
          console.log(
            "[ChatProviderInner] No initial item selection provided or loaded. Selecting first item if available.",
          );
          // Use resolved values
          const allProjects = storage.projects || [];
          const allConversations = storage.conversations || [];
          const combinedItems = [
            ...allProjects.map((p) => ({ ...p, type: "project" as const })),
            ...allConversations.map((c) => ({
              ...c,
              type: "conversation" as const,
            })),
          ];
          combinedItems.sort(
            (a, b) =>
              (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0),
          );
          const firstItem = combinedItems[0];

          if (firstItem) {
            console.log(
              `[ChatProviderInner] Selecting first available item: ${firstItem.type} - ${firstItem.id}`,
            );
            await useSidebarStore
              .getState()
              .selectItem(firstItem.id, firstItem.type);
          } else {
            console.log("[ChatProviderInner] No items found to select.");
            await useSidebarStore.getState().selectItem(null, null);
          }
        } else {
          console.log(
            "[ChatProviderInner] Initial selection already loaded from DB or set by config.",
          );
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
  }, [
    config,
    storage.providerConfigs, // Keep dependencies on the storage values
    storage.projects,
    storage.conversations,
    isInitialized,
  ]);

  if (!isInitialized) {
    const initError = useCoreChatStore.getState().error;
    return (
      <div className="flex items-center justify-center h-full w-full bg-gray-900 text-gray-400">
        {initError ? (
          <span className="text-red-400">Error: {initError}</span>
        ) : (
          "Initializing LiteChat..." // Show generic loading message
        )}
      </div>
    );
  }

  return <>{children}</>;
};

export default ChatProviderInner;
