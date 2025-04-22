// src/context/chat-provider-inner.tsx
import React, { useEffect, useState } from "react"; // Removed useRef
import { toast } from "sonner";

// Store Imports
import { useCoreChatStore } from "@/store/core-chat.store";
import { useProviderStore } from "@/store/provider.store";
import { useSettingsStore } from "@/store/settings.store";
import { useSidebarStore } from "@/store/sidebar.store";
import { useVfsStore } from "@/store/vfs.store";
import { useModStore } from "@/store/mod.store";
import { useChatStorage } from "@/hooks/use-chat-storage";

// Type Imports
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
  // Removed initStarted ref
  const storage = useChatStorage();

  useEffect(() => {
    // Exit early if already initialized
    if (isInitialized) return;

    // Check if essential storage data is ready (providerConfigs is a good indicator)
    // Ensure it's not just defined, but potentially populated if expected.
    const providerConfigsReady =
      storage.providerConfigs && storage.providerConfigs.length > 0;
    // Add checks for other essential data if needed (e.g., projects/conversations for initial selection)
    const sidebarDataReady = storage.projects && storage.conversations;

    // Only proceed if essential data is loaded and we haven't initialized yet
    if (!providerConfigsReady || !sidebarDataReady) {
      console.log("[ChatProviderInner] Waiting for essential storage data...", {
        providerConfigsReady,
        sidebarDataReady,
      });
      return; // Wait for data to load
    }

    console.log("[ChatProviderInner] Essential data ready. Initializing...");

    // --- Start Initialization Logic ---
    // This block now runs only once when data is ready and not initialized

    // 1. Initialize Feature Flags and Configurable Settings (Synchronous)
    useProviderStore
      .getState()
      .setEnableApiKeyManagement(config.enableApiKeyManagement ?? true);
    useSettingsStore
      .getState()
      .setEnableAdvancedSettings(config.enableAdvancedSettings ?? true);
    useSidebarStore.getState().setEnableSidebar(config.enableSidebar ?? true);
    useVfsStore.getState()._setEnableVfs(config.enableVfs ?? true);
    if (config.streamingRefreshRateMs !== undefined) {
      useSettingsStore
        .getState()
        .setStreamingRefreshRateMs(config.streamingRefreshRateMs);
    }

    // 2. Trigger store initialization actions (async)
    const initializeStores = async () => {
      let initializationError: Error | null = null;
      try {
        console.log(
          "[ChatProviderInner] Triggering store initialization actions...",
        );

        // Get live provider configs from storage hook
        const currentProviderConfigs = storage.providerConfigs || []; // Already checked above

        await Promise.all([
          // Pass live configs to provider store initialization
          useProviderStore.getState().initializeFromDb(currentProviderConfigs),
          useModStore.getState().initializeFromDb(),
          // Add other stores if they need initialization
        ]);

        console.log(
          "[ChatProviderInner] Store initialization actions complete.",
        );
      } catch (error) {
        initializationError =
          error instanceof Error ? error : new Error(String(error));
        console.error(
          "[ChatProviderInner] Error during store initialization actions:",
          initializationError,
        );
        toast.error(
          `Failed to initialize application stores: ${initializationError.message}`,
        );
        useCoreChatStore
          .getState()
          .setError("Failed to load initial application data.");
      }

      // 3. Set Initial Selection (using live data and initialized store state)
      try {
        const {
          initialSelectedItemId,
          initialSelectedItemType,
          initialProviderId,
          initialModelId,
        } = config;

        // Get potentially updated selection state after initialization
        const currentSelectedProviderId =
          useProviderStore.getState().selectedProviderId;
        const currentSelectedModelId =
          useProviderStore.getState().selectedModelId;

        // Apply config provider/model selection *only if* different from loaded state
        if (
          initialProviderId &&
          initialProviderId !== currentSelectedProviderId
        ) {
          console.log(
            `[ChatProviderInner] Config overriding initial provider: ${initialProviderId}`,
          );
          useProviderStore
            .getState()
            .setSelectedProviderId(
              initialProviderId,
              storage.providerConfigs || [],
            );
          if (initialModelId) {
            console.log(
              `[ChatProviderInner] Config setting initial model: ${initialModelId}`,
            );
            useProviderStore.getState().setSelectedModelId(initialModelId);
          }
        } else if (
          initialProviderId && // Provider matches loaded state
          initialModelId && // Model specified in config
          initialModelId !== currentSelectedModelId // Model differs from loaded state
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
          // Only select first item if nothing is selected (respect loaded state)
          console.log(
            "[ChatProviderInner] No initial item selection provided or loaded. Selecting first item if available.",
          );
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

        // 4. Initialize Mods (Placeholder)
        const dbMods = useModStore.getState().dbMods;
        if (dbMods.length > 0) {
          console.log(
            `[ChatProviderInner] Initializing ${dbMods.length} mods...`,
          );
          // Add actual mod loading logic here if needed
        }

        console.log("[ChatProviderInner] Post-initialization setup complete.");
      } catch (error) {
        const selectionError =
          error instanceof Error ? error : new Error(String(error));
        console.error(
          "[ChatProviderInner] Error during initial selection:",
          selectionError,
        );
        toast.error(
          `Failed to set initial selection: ${selectionError.message}`,
        );
        if (!initializationError) {
          useCoreChatStore
            .getState()
            .setError("Failed to set initial selection.");
        }
      } finally {
        // Mark initialization as complete *only after* everything succeeds or handles errors
        setIsInitialized(true);
        console.log(
          `[ChatProviderInner] Initialization sequence finished. isInitialized: true.`,
        );
      }
    };

    initializeStores();
    // --- End Initialization Logic ---
  }, [
    config,
    storage.providerConfigs, // Re-run when live data is available/changes
    storage.projects,
    storage.conversations,
    isInitialized, // Prevent re-running if already initialized
  ]);

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
