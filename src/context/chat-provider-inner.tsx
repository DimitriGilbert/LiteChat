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

// Type Imports (Keep only necessary types)
import type {
  // CustomPromptAction, // REMOVED
  // CustomMessageAction, // REMOVED
  // CustomSettingTab, // REMOVED
  LiteChatConfig, // Assuming LiteChatConfig type is defined elsewhere or in types.ts
} from "@/lib/types";

// Removed storage hook import
// Removed mod loader imports

interface ChatProviderInnerProps {
  children: React.ReactNode;
  // Pass config down to initialize stores
  config: LiteChatConfig;
  // REMOVED: userCustomPromptActions: CustomPromptAction[];
  // REMOVED: userCustomMessageActions: CustomMessageAction[];
  // REMOVED: userCustomSettingsTabs: CustomSettingTab[];
}

const ChatProviderInner: React.FC<ChatProviderInnerProps> = ({
  children,
  config,
  // REMOVED: userCustomPromptActions,
  // REMOVED: userCustomMessageActions,
  // REMOVED: userCustomSettingsTabs,
}) => {
  const [isInitialized, setIsInitialized] = useState(false); // State to track initialization
  const initStarted = useRef(false); // Prevent multiple initializations

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
    useSettingsStore
      .getState()
      .setStreamingThrottleRate(config.streamingThrottleRate ?? 50);

    // 2. Trigger store initialization actions (async)
    const initializeStores = async () => {
      try {
        console.log(
          "[ChatProviderInner] Triggering store initialization actions...",
        );
        // Call initialization actions concurrently
        await Promise.all([
          useSidebarStore.getState().initializeFromDb(),
          useProviderStore.getState().initializeFromDb(),
          useModStore.getState().initializeFromDb(),
          // Add other stores if they need initialization
        ]);

        console.log(
          "[ChatProviderInner] Store initialization actions complete.",
        );

        // 3. Set Initial Selection (if provided in config) AFTER stores are initialized
        const {
          initialSelectedItemId,
          initialSelectedItemType,
          initialProviderId,
          initialModelId,
        } = config;

        // Ensure provider configs are loaded before setting initial provider/model
        const providerConfigs = useProviderStore.getState().dbProviderConfigs;

        if (initialProviderId) {
          console.log(
            `[ChatProviderInner] Setting initial provider: ${initialProviderId}`,
          );
          // This action handles selecting the default model for the provider
          useProviderStore.getState().setSelectedProviderId(initialProviderId);
          // Override model if specifically provided
          if (initialModelId) {
            console.log(
              `[ChatProviderInner] Setting initial model: ${initialModelId}`,
            );
            useProviderStore.getState().setSelectedModelId(initialModelId);
          }
        } else {
          // Optional: Select the first available provider if none specified
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
          // Use the selectItem action which handles side effects (loading messages, VFS state)
          await useSidebarStore
            .getState()
            .selectItem(initialSelectedItemId, initialSelectedItemType);
        } else {
          // Optional: Select the most recent item if no initial selection is provided
          console.log(
            "[ChatProviderInner] No initial item selection provided. Selecting first item if available.",
          );
          const firstItem = useSidebarStore.getState().getFirstItem(); // Assuming getFirstItem exists
          if (firstItem) {
            console.log(
              `[ChatProviderInner] Selecting first item: ${firstItem.type} - ${firstItem.id}`,
            );
            await useSidebarStore
              .getState()
              .selectItem(firstItem.id, firstItem.type);
          } else {
            console.log("[ChatProviderInner] No items found to select.");
            // Ensure selection state is null if no items exist
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
        // --- SET INITIALIZED STATE ---
        setIsInitialized(true);
        console.log(
          "[ChatProviderInner] Initialization complete. Rendering UI.",
        );
      } catch (error) {
        console.error(
          "[ChatProviderInner] Error during store initialization:",
          error,
        );
        toast.error(
          `Failed to initialize application data: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
        // Set error state in core store?
        useCoreChatStore
          .getState()
          .setError("Failed to load initial application data.");
        // Still set initialized to true to show error state in UI, or handle differently
        setIsInitialized(true);
      }
    };

    initializeStores();

    // Note: Custom actions/tabs from props are not handled here.
    // They should ideally be registered via a mod or a different API.

    // Cleanup function if needed (e.g., abort fetches)
    // return () => { ... };
  }, [
    config,
    // Removed dependencies on custom actions/tabs as they aren't used here
  ]); // Rerun only if config changes (or just once on mount)

  // Conditionally render children or a loading indicator
  if (!isInitialized) {
    // Optional: Add a more sophisticated loading spinner/indicator
    return (
      <div className="flex items-center justify-center h-full w-full bg-gray-900 text-gray-400">
        Initializing LiteChat...
      </div>
    );
  }

  // Render children only after initialization is complete
  return <>{children}</>;
};

export default ChatProviderInner;
