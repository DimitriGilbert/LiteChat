// src/context/chat-provider-inner.tsx
import React, { useEffect, useRef, useState } from "react"; // Added useState
import { toast } from "sonner";

// Store Imports
import { useCoreChatStore } from "@/store/core-chat.store";
import { useProviderStore } from "@/store/provider.store";
import { useSettingsStore } from "@/store/settings.store";
import { useSidebarStore } from "@/store/sidebar.store";
import { useVfsStore } from "@/store/vfs.store";
import { useModStore } from "@/store/mod.store";
import { useChatStorage } from "@/hooks/use-chat-storage"; // Import useChatStorage

// Type Imports (Keep only necessary types)
import type {
  LiteChatConfig, // Assuming LiteChatConfig type is defined elsewhere or in types.ts
} from "@/lib/types";

interface ChatProviderInnerProps {
  children: React.ReactNode;
  // Pass config down to initialize stores
  config: LiteChatConfig;
}

const ChatProviderInner: React.FC<ChatProviderInnerProps> = ({
  children,
  config,
}) => {
  const [isInitialized, setIsInitialized] = useState(false); // State to track initialization
  const initStarted = useRef(false); // Prevent multiple initializations
  // Use useChatStorage to ensure DB data is loaded reactively for initial selection logic
  const storage = useChatStorage();

  // --- Initial Data Loading and Store Initialization Effect ---
  useEffect(() => {
    // Prevent running multiple times
    if (initStarted.current) return;
    initStarted.current = true;

    console.log("[ChatProviderInner] Initializing stores...");

    // 1. Initialize Feature Flags and Configurable Settings from config prop
    // (Run these synchronously before async initialization)
    useProviderStore
      .getState()
      .setEnableApiKeyManagement(config.enableApiKeyManagement ?? true);
    useSettingsStore
      .getState()
      .setEnableAdvancedSettings(config.enableAdvancedSettings ?? true);
    useSidebarStore.getState().setEnableSidebar(config.enableSidebar ?? true);
    useVfsStore.getState()._setEnableVfs(config.enableVfs ?? true); // Use internal setter
    // Set refresh rate from config if provided, otherwise store default is used
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
        // Call initialization actions concurrently for stores that have them
        await Promise.all([
          // SidebarStore no longer has initializeFromDb for projects/convos
          useProviderStore.getState().initializeFromDb(),
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
        // Set error state in core store
        useCoreChatStore
          .getState()
          .setError("Failed to load initial application data.");
      }

      // Proceed with selection logic even if store init had minor errors,
      // but rely on useChatStorage for potentially available data.
      try {
        // 3. Set Initial Selection (if provided in config) AFTER stores are initialized
        const {
          initialSelectedItemId,
          initialSelectedItemType,
          initialProviderId,
          initialModelId,
        } = config;

        // Ensure provider configs are loaded before setting initial provider/model
        // Use data directly from storage hook which uses live queries
        const providerConfigs = storage.providerConfigs || [];

        if (initialProviderId) {
          console.log(
            `[ChatProviderInner] Setting initial provider: ${initialProviderId}`,
          );
          useProviderStore.getState().setSelectedProviderId(initialProviderId);
          if (initialModelId) {
            console.log(
              `[ChatProviderInner] Setting initial model: ${initialModelId}`,
            );
            useProviderStore.getState().setSelectedModelId(initialModelId);
          }
        } else {
          const firstProviderId = providerConfigs[0]?.id;
          if (firstProviderId) {
            console.log(
              `[ChatProviderInner] Setting initial provider to first available: ${firstProviderId}`,
            );
            useProviderStore.getState().setSelectedProviderId(firstProviderId);
          } else {
            console.log(
              "[ChatProviderInner] No initial provider specified and no providers configured.",
            );
          }
        }

        // Set initial sidebar selection AFTER stores are initialized
        if (initialSelectedItemId && initialSelectedItemType) {
          console.log(
            `[ChatProviderInner] Setting initial selection: ${initialSelectedItemType} - ${initialSelectedItemId}`,
          );
          await useSidebarStore
            .getState()
            .selectItem(initialSelectedItemId, initialSelectedItemType);
        } else {
          console.log(
            "[ChatProviderInner] No initial item selection provided. Selecting first item if available.",
          );
          // Get first item based on live data from storage hook
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
              `[ChatProviderInner] Selecting first item: ${firstItem.type} - ${firstItem.id}`,
            );
            await useSidebarStore
              .getState()
              .selectItem(firstItem.id, firstItem.type);
          } else {
            console.log("[ChatProviderInner] No items found to select.");
            await useSidebarStore.getState().selectItem(null, null);
          }
        }

        // 4. Initialize Mods (Example - refine as needed)
        const dbMods = useModStore.getState().dbMods;
        if (dbMods.length > 0) {
          console.log(
            `[ChatProviderInner] Initializing ${dbMods.length} mods...`,
          );
          // Placeholder for actual mod loading logic
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
        // Update error state if not already set
        if (!initializationError) {
          useCoreChatStore
            .getState()
            .setError("Failed to set initial selection.");
        }
      } finally {
        // --- SET INITIALIZED STATE ---
        // Set initialized regardless of minor errors during selection,
        // as long as the main store init didn't completely fail.
        setIsInitialized(true);
        console.log(
          `[ChatProviderInner] Initialization sequence finished. isInitialized: true.`,
        );
      }
    };

    initializeStores();

    // Cleanup function if needed
    // return () => { ... };
  }, [
    config,
    storage.providerConfigs, // Add dependency for initial provider selection
    storage.projects, // Add dependency for initial item selection
    storage.conversations, // Add dependency for initial item selection
  ]); // Rerun only if config or initial data changes

  // Conditionally render children or a loading indicator/error
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

  // Render children only after initialization is complete
  return <>{children}</>;
};

export default ChatProviderInner;
