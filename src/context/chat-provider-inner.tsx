// src/context/chat-provider-inner.tsx
import React, { useEffect, useState, useRef } from "react";
import { toast } from "sonner";

import { useCoreChatStore } from "@/store/core-chat.store";
import { useProviderStore } from "@/store/provider.store";
import { useSettingsStore } from "@/store/settings.store";
import { useSidebarStore } from "@/store/sidebar.store";
import { useVfsStore } from "@/store/vfs.store";
import { useChatStorage } from "@/hooks/use-chat-storage";

// Import necessary types
import type {
  LiteChatConfig,
  DbConversation,
  DbProject,
  DbProviderConfig,
} from "@/lib/types";
import { DEFAULT_MODELS } from "@/lib/litechat";
import { getDefaultModelIdForProvider } from "@/utils/chat-utils";

const getFirstEnabledProviderAndModel = (
  providerConfigs: DbProviderConfig[],
): { providerId: string | null; modelId: string | null } => {
  const safeProviderConfigs = Array.isArray(providerConfigs)
    ? providerConfigs
    : [];
  const enabledConfigs = safeProviderConfigs.filter(
    (c: DbProviderConfig) => c.isEnabled,
  );
  enabledConfigs.sort(
    (a: DbProviderConfig, b: DbProviderConfig) =>
      a.createdAt.getTime() - b.createdAt.getTime(),
  );
  const firstEnabledProvider = enabledConfigs[0];

  if (!firstEnabledProvider) {
    return { providerId: null, modelId: null };
  }
  const defaultModelId = getDefaultModelIdForProvider(firstEnabledProvider);
  return {
    providerId: firstEnabledProvider.id,
    modelId: defaultModelId,
  };
};

interface ChatProviderInnerProps {
  children: React.ReactNode;
  config: LiteChatConfig;
}

const ChatProviderInner: React.FC<ChatProviderInnerProps> = ({
  children,
  config,
}) => {
  const initializationCompleteRef = useRef(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isStorageReady, setIsStorageReady] = useState(false);
  const storage = useChatStorage();

  // Effect 1: Watch storage results to set isStorageReady flag ONCE
  useEffect(() => {
    if (isStorageReady) return;

    const allLoaded =
      storage.providerConfigs !== undefined &&
      storage.projects !== undefined &&
      storage.conversations !== undefined &&
      storage.apiKeys !== undefined &&
      storage.mods !== undefined;

    if (allLoaded) {
      console.log(
        "[ChatProviderInner Effect 1] All required storage ready. Setting flag.",
      );
      setIsStorageReady(true);
    }
  }, [
    storage.providerConfigs,
    storage.projects,
    storage.conversations,
    storage.apiKeys,
    storage.mods,
    isStorageReady,
  ]);

  // Effect 3: Main initialization logic
  useEffect(() => {
    // --- STRICT GUARD ---
    if (!isStorageReady || initializationCompleteRef.current) {
      return;
    }
    // Check providerConfigs *after* storage is ready
    const currentProviderConfigs = storage.providerConfigs;
    if (currentProviderConfigs === undefined) {
      console.log(
        "[ChatProviderInner Effect 3] Waiting: providerConfigs not yet defined.",
      );
      return;
    }
    // --- END GUARD ---

    console.log(
      `[ChatProviderInner Effect 3] Starting initialization logic... Configs count: ${currentProviderConfigs.length}`,
    );

    const initializeApp = async () => {
      initializationCompleteRef.current = true; // Prevent re-entry
      console.log(
        `[ChatProviderInner Init] Setting initialization ref to true at start.`,
      );

      let initializationError: Error | null = null;
      try {
        const currentProjects = storage.projects || [];
        const currentConversations = storage.conversations || [];

        // --- 1. Load Persisted Settings ---
        console.log("[ChatProviderInner Init] Loading persisted settings...");
        await useSettingsStore.getState().loadInitialSettings();
        await useProviderStore.getState().loadInitialProviderSettings();
        console.log("[ChatProviderInner Init] Persisted settings loaded.");

        // --- 2. Apply Config Feature Flags/Settings ---
        console.log("[ChatProviderInner Init] Setting feature flags...");
        if (config.enableApiKeyManagement !== undefined) {
          useProviderStore
            .getState()
            .setEnableApiKeyManagement(config.enableApiKeyManagement);
        }
        if (config.enableAdvancedSettings !== undefined) {
          useSettingsStore
            .getState()
            .setEnableAdvancedSettings(config.enableAdvancedSettings);
        }
        if (config.enableSidebar !== undefined) {
          useSidebarStore.getState().setEnableSidebar(config.enableSidebar);
        }
        if (config.enableVfs !== undefined) {
          useVfsStore.getState()._setEnableVfs(config.enableVfs);
        }
        if (config.streamingRefreshRateMs !== undefined) {
          useSettingsStore
            .getState()
            .setStreamingRefreshRateMs(config.streamingRefreshRateMs);
        }

        // --- 3. Determine Initial Provider/Model Selection ---
        console.log(
          "[ChatProviderInner Init] Determining initial provider/model selection...",
        );
        // Call loadInitialSelection WITHOUT passing configs
        const loadedSelection = await useProviderStore
          .getState()
          .loadInitialSelection();

        let providerToSet: string | null = loadedSelection.providerId;
        let modelToSet: string | null = loadedSelection.modelId;

        // Fallback logic still uses currentProviderConfigs fetched earlier in this effect
        if (!providerToSet && currentProviderConfigs.some((c) => c.isEnabled)) {
          console.log(
            "[ChatProviderInner Init] No valid saved selection found, finding first enabled provider...",
          );
          const fallback = getFirstEnabledProviderAndModel(
            currentProviderConfigs,
          );
          providerToSet = fallback.providerId;
          modelToSet = fallback.modelId;
          console.log(
            `[ChatProviderInner Init] Fallback selection: Provider=${providerToSet}, Model=${modelToSet}`,
          );
        } else if (!providerToSet) {
          console.log(
            "[ChatProviderInner Init] No valid saved selection and no enabled providers found.",
          );
        } else {
          console.log(
            `[ChatProviderInner Init] Using loaded selection: Provider=${providerToSet}, Model=${modelToSet}`,
          );
        }

        // --- 4. Apply Config Overrides for Provider/Model ---
        const { initialProviderId, initialModelId } = config;
        console.log(
          `[ChatProviderInner Init] Applying config overrides. Initial Config: P=${initialProviderId}, M=${initialModelId}. Current Determined: P=${providerToSet}, M=${modelToSet}`,
        );

        let finalProviderId = providerToSet;
        let finalModelId = modelToSet;

        if (initialProviderId && initialProviderId !== finalProviderId) {
          const isValidOverride = currentProviderConfigs.some(
            (p: DbProviderConfig) => p.id === initialProviderId && p.isEnabled,
          );
          if (isValidOverride) {
            console.log(
              `[ChatProviderInner Init] Config overriding provider: ${initialProviderId}`,
            );
            finalProviderId = initialProviderId;
            const overriddenProviderConfig = currentProviderConfigs.find(
              (p: DbProviderConfig) => p.id === initialProviderId,
            );
            finalModelId = getDefaultModelIdForProvider(
              overriddenProviderConfig,
            );
            console.log(
              `[ChatProviderInner Init] Model set to default for overridden provider: ${finalModelId}`,
            );
          } else {
            console.warn(
              `[ChatProviderInner Init] Config initialProviderId ${initialProviderId} invalid/disabled. Ignoring override.`,
            );
          }
        }

        if (
          finalProviderId &&
          initialModelId &&
          initialModelId !== finalModelId
        ) {
          const finalProviderConfig = currentProviderConfigs.find(
            (p: DbProviderConfig) => p.id === finalProviderId,
          );
          const providerTypeKey =
            finalProviderConfig?.type as keyof typeof DEFAULT_MODELS;
          const availableModels =
            finalProviderConfig?.fetchedModels ??
            (finalProviderConfig ? DEFAULT_MODELS[providerTypeKey] || [] : []);
          const enabledModelIds = finalProviderConfig?.enabledModels ?? [];
          const modelsToConsider =
            enabledModelIds.length > 0
              ? availableModels.filter((m: { id: string }) =>
                  enabledModelIds.includes(m.id),
                )
              : availableModels;

          if (
            modelsToConsider.some(
              (m: { id: string }) => m.id === initialModelId,
            )
          ) {
            console.log(
              `[ChatProviderInner Init] Config overriding model to: ${initialModelId} for provider ${finalProviderId}`,
            );
            finalModelId = initialModelId;
          } else {
            console.warn(
              `[ChatProviderInner Init] Config initialModelId ${initialModelId} invalid/disabled for provider ${finalProviderId}. Using determined model: ${finalModelId}.`,
            );
          }
        }

        // --- 5. Set Final Provider/Model State in Store ---
        console.log(
          `[ChatProviderInner Init] Setting final selection state: Provider=${finalProviderId}, Model=${finalModelId}`,
        );
        // Pass currentProviderConfigs here for default model logic within setSelectedProviderId
        useProviderStore
          .getState()
          .setSelectedProviderId(finalProviderId, currentProviderConfigs);
        if (useProviderStore.getState().selectedModelId !== finalModelId) {
          useProviderStore.getState().setSelectedModelId(finalModelId);
        }

        // --- 6. Set Initial Sidebar Selection ---
        console.log("[ChatProviderInner Init] Setting sidebar selection...");
        const { initialSelectedItemId, initialSelectedItemType } = config;
        const currentSidebarItemId = useSidebarStore.getState().selectedItemId;
        let targetItemId = currentSidebarItemId;
        let targetItemType = useSidebarStore.getState().selectedItemType;

        if (initialSelectedItemId && initialSelectedItemType) {
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
            targetItemId = initialSelectedItemId;
            targetItemType = initialSelectedItemType;
          } else {
            console.warn(
              `[ChatProviderInner Init] Config initialSelectedItemId ${initialSelectedItemId} not found. Falling back.`,
            );
            const fallbackItem = getFirstAvailableItem(
              currentProjects,
              currentConversations,
            );
            targetItemId = fallbackItem?.id ?? null;
            targetItemType = fallbackItem?.type ?? null;
          }
        } else if (!currentSidebarItemId) {
          const firstItem = getFirstAvailableItem(
            currentProjects,
            currentConversations,
          );
          targetItemId = firstItem?.id ?? null;
          targetItemType = firstItem?.type ?? null;
        }

        await useSidebarStore
          .getState()
          .selectItem(targetItemId, targetItemType);

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
        // --- Trigger re-render by setting state ---
        setIsInitialized(true);
        console.log(
          `[ChatProviderInner Init] Initialization sequence finished. State set to true.`,
        );
      }
    };

    initializeApp();
    // Dependencies: Only isStorageReady and config. The check for providerConfigs happens inside.
  }, [isStorageReady, config, storage.providerConfigs]); // Keep storage.providerConfigs dependency

  // Helper function
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

  // Render loading state based on the isInitialized STATE variable
  if (!isInitialized) {
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
