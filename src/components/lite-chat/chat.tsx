// src/components/lite-chat/chat.tsx

import React, { useState, useMemo, useCallback, useEffect } from "react";
import ChatProviderInner from "@/context/chat-provider-inner";
import { ChatSide } from "./chat/chat-side";
import { ChatWrapper } from "./chat/chat-wrapper";
import { useShallow } from "zustand/react/shallow";
import { useSidebarStore } from "@/store/sidebar.store";
import { useSettingsStore } from "@/store/settings.store";
import { useModStore } from "@/store/mod.store";
import { useCoreChatStore } from "@/store/core-chat.store";
import { useAiInteraction } from "@/hooks/ai-interaction";
import { useProviderStore } from "@/store/provider.store";
import { useDerivedChatState } from "@/hooks/use-derived-chat-state";
import { useChatStorage } from "@/hooks/use-chat-storage";
import { useInputStore } from "@/store/input.store";
// Import useVfsStore
import { useVfsStore } from "@/store/vfs.store";

import type { LiteChatConfig, ReadonlyChatContextSnapshot } from "@/lib/types"; // Added ReadonlyChatContextSnapshot
import { cn } from "@/lib/utils";
import { MenuIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ComponentType } from "react";

interface LiteChatProps {
  config?: LiteChatConfig;
  className?: string;
  SideComponent?: ComponentType<any>;
  WrapperComponent?: ComponentType<any>;
}

export const LiteChat: React.FC<LiteChatProps> = ({
  config = {},
  className,
  SideComponent = ChatSide,
  WrapperComponent = ChatWrapper,
}) => {
  const { defaultSidebarOpen = true } = config;
  const [sidebarOpen, setSidebarOpen] = useState(defaultSidebarOpen);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  const handleEditComplete = useCallback((id: string) => {
    setEditingItemId((currentEditingId) => {
      if (currentEditingId === id) {
        return null;
      }
      return currentEditingId;
    });
  }, []);

  const handleSetEditingItemId = useCallback((id: string | null) => {
    setEditingItemId(id);
  }, []);

  const theme = useSettingsStore((state) => state.theme);
  useEffect(() => {
    if (typeof window === "undefined" || !window.document?.documentElement) {
      return;
    }

    const root = window.document.documentElement;
    root.classList.remove("light", "dark");

    let effectiveTheme = theme;
    if (theme === "system") {
      effectiveTheme =
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
    }

    root.classList.add(effectiveTheme);
  }, [theme]);

  return (
    <ChatProviderInner config={config}>
      <LiteChatInner
        className={className}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        enableSidebarConfig={config.enableSidebar ?? true}
        SideComponent={SideComponent}
        WrapperComponent={WrapperComponent}
        editingItemId={editingItemId}
        setEditingItemId={handleSetEditingItemId}
        onEditComplete={handleEditComplete}
        customPromptActions={config.customPromptActions}
        customMessageActions={config.customMessageActions}
        customSettingsTabs={config.customSettingsTabs}
      />
    </ChatProviderInner>
  );
};

interface LiteChatInnerProps {
  className?: string;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  enableSidebarConfig: boolean;
  SideComponent: ComponentType<any>;
  WrapperComponent: ComponentType<any>;
  editingItemId: string | null;
  setEditingItemId: (id: string | null) => void;
  onEditComplete: (id: string) => void;
  customPromptActions?: LiteChatConfig["customPromptActions"];
  customMessageActions?: LiteChatConfig["customMessageActions"];
  customSettingsTabs?: LiteChatConfig["customSettingsTabs"];
}

const LiteChatInner: React.FC<LiteChatInnerProps> = ({
  className,
  sidebarOpen,
  setSidebarOpen,
  enableSidebarConfig,
  SideComponent,
  WrapperComponent,
  editingItemId,
  setEditingItemId,
  onEditComplete,
  customPromptActions = [],
  customMessageActions = [],
  customSettingsTabs = [],
}) => {
  // --- Fetch state/actions directly from stores ---
  const { enableSidebar: enableSidebarStore } = useSidebarStore(
    useShallow((state) => ({ enableSidebar: state.enableSidebar })),
  );
  const { modPromptActions, modMessageActions, modSettingsTabs } = useModStore(
    useShallow((state) => ({
      modPromptActions: state.modPromptActions,
      modMessageActions: state.modMessageActions,
      modSettingsTabs: state.modSettingsTabs,
    })),
  );
  const {
    messages: coreMessages, // Rename to avoid conflict
    isStreaming: coreIsStreaming, // Rename to avoid conflict
    addMessage,
    updateMessage,
    setIsStreaming,
    setError,
    addDbMessage,
    bulkAddMessages,
    handleSubmitCore,
    handleImageGenerationCore,
    stopStreamingCore,
    regenerateMessageCore,
    startWorkflowCore,
  } = useCoreChatStore(
    useShallow((state) => ({
      messages: state.messages,
      isStreaming: state.isStreaming,
      addMessage: state.addMessage,
      updateMessage: state.updateMessage,
      setIsStreaming: state.setIsStreaming,
      setError: state.setError,
      addDbMessage: state.addDbMessage,
      bulkAddMessages: state.bulkAddMessages,
      handleSubmitCore: state.handleSubmitCore,
      handleImageGenerationCore: state.handleImageGenerationCore,
      stopStreamingCore: state.stopStreamingCore,
      regenerateMessageCore: state.regenerateMessageCore,
      startWorkflowCore: state.startWorkflowCore,
    })),
  );
  const { temperature, maxTokens, theme, streamingRefreshRateMs } =
    useSettingsStore(
      useShallow((state) => ({
        temperature: state.temperature,
        maxTokens: state.maxTokens,
        theme: state.theme, // Needed for snapshot
        streamingRefreshRateMs: state.streamingRefreshRateMs,
      })),
    );
  const { selectedProviderId, selectedModelId, getApiKeyForProvider } =
    useProviderStore(
      useShallow((state) => ({
        selectedProviderId: state.selectedProviderId,
        selectedModelId: state.selectedModelId,
        getApiKeyForProvider: state.getApiKeyForProvider,
      })),
    );
  const { selectedItemId, selectedItemType, exportConversation } =
    useSidebarStore(
      useShallow((state) => ({
        selectedItemId: state.selectedItemId,
        selectedItemType: state.selectedItemType,
        exportConversation: state.exportConversation,
      })),
    );
  const { clearAllInput } = useInputStore(
    useShallow((state) => ({ clearAllInput: state.clearAllInput })),
  );
  // Fetch VFS state needed for snapshot
  const { isVfsEnabledForItem } = useVfsStore(
    useShallow((state) => ({
      isVfsEnabledForItem: state.isVfsEnabledForItem,
    })),
  );

  // --- Fetch live data for derived state and API key getter ---
  const storage = useChatStorage();
  const dbConversations = storage.conversations || [];
  const dbProjects = storage.projects || [];
  const dbProviderConfigs = storage.providerConfigs || [];
  const apiKeys = storage.apiKeys || [];

  // --- Use Derived State Hook ---
  const { activeConversationData, selectedProvider, selectedModel } =
    useDerivedChatState({
      selectedItemId,
      selectedItemType,
      dbConversations,
      dbProjects,
      dbProviderConfigs,
      apiKeys,
      selectedProviderId,
      selectedModelId,
    });

  // --- Create Context Snapshot Function ---
  const getContextSnapshotForMod =
    useCallback((): ReadonlyChatContextSnapshot => {
      // Use state fetched directly above
      const getApiKeyFunc = (providerId: string) =>
        getApiKeyForProvider(
          providerId,
          apiKeys, // Use live data
          dbProviderConfigs, // Use live data
        );

      // Derive activeSystemPrompt based on current state
      let activeSystemPrompt: string | null = null;
      const settingsState = useSettingsStore.getState(); // Get latest settings state
      if (settingsState.enableAdvancedSettings) {
        if (selectedItemType === "conversation") {
          const convo = dbConversations.find((c) => c.id === selectedItemId);
          if (convo?.systemPrompt && convo.systemPrompt.trim() !== "") {
            activeSystemPrompt = convo.systemPrompt;
          }
        }
        if (
          !activeSystemPrompt &&
          settingsState.globalSystemPrompt &&
          settingsState.globalSystemPrompt.trim() !== ""
        ) {
          activeSystemPrompt = settingsState.globalSystemPrompt;
        }
      }

      return Object.freeze({
        selectedItemId: selectedItemId,
        selectedItemType: selectedItemType,
        messages: coreMessages, // Use renamed state variable
        isStreaming: coreIsStreaming, // Use renamed state variable
        selectedProviderId: selectedProviderId,
        selectedModelId: selectedModelId,
        activeSystemPrompt: activeSystemPrompt, // Use derived value
        temperature: temperature,
        maxTokens: maxTokens,
        theme: theme,
        isVfsEnabledForItem: isVfsEnabledForItem, // Use state from useVfsStore
        getApiKeyForProvider: getApiKeyFunc,
      });
      // Update dependencies
    }, [
      selectedItemId,
      selectedItemType,
      coreMessages,
      coreIsStreaming,
      selectedProviderId,
      selectedModelId,
      temperature,
      maxTokens,
      theme,
      isVfsEnabledForItem, // Add VFS state dependency
      getApiKeyForProvider,
      apiKeys,
      dbProviderConfigs,
      dbConversations, // Add dependency for deriving system prompt
    ]);

  // --- API Key Getter for AI Interaction ---
  const getApiKeyForInteraction = useCallback(
    (providerId: string): string | undefined => {
      return getApiKeyForProvider(providerId, apiKeys, dbProviderConfigs);
    },
    [apiKeys, dbProviderConfigs, getApiKeyForProvider],
  );

  // --- Initialize AI Interaction Hook ---
  const { handleFormSubmit, stopStreaming, regenerateMessage } =
    useAiInteraction({
      selectedModel,
      selectedProvider,
      getApiKeyForProvider: getApiKeyForInteraction,
      streamingRefreshRateMs,
      addMessage,
      updateMessage,
      setIsAiStreaming: setIsStreaming,
      setError,
      addDbMessage,
      getContextSnapshotForMod,
      bulkAddMessages,
      selectedItemId,
      selectedItemType,
      dbProviderConfigs,
      dbConversations,
      dbProjects,
      inputActions: { clearAllInput },
      handleSubmitCore,
      handleImageGenerationCore,
      stopStreamingCore,
      regenerateMessageCore,
      startWorkflowCore,
    });

  // --- Combine User and Mod Actions/Tabs ---
  const combinedPromptActions = useMemo(
    () => [...customPromptActions, ...modPromptActions],
    [customPromptActions, modPromptActions],
  );
  const combinedMessageActions = useMemo(
    () => [...customMessageActions, ...modMessageActions],
    [customMessageActions, modMessageActions],
  );
  const combinedSettingsTabs = useMemo(
    () => [...customSettingsTabs, ...modSettingsTabs],
    [customSettingsTabs, modSettingsTabs],
  );

  const showSidebar = enableSidebarConfig && enableSidebarStore;

  return (
    <div
      className={cn(
        "flex h-full w-full overflow-hidden bg-background border border-border rounded-lg shadow-sm",
        className,
      )}
    >
      {showSidebar && sidebarOpen && (
        <SideComponent
          className={cn("w-72 flex-shrink-0", "hidden md:flex")}
          editingItemId={editingItemId}
          onEditComplete={onEditComplete}
          setEditingItemId={setEditingItemId}
        />
      )}

      <div className="flex-grow flex flex-col relative w-full min-w-0">
        {showSidebar && (
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "absolute top-3 left-3 z-10 text-muted-foreground hover:text-foreground hover:bg-muted md:hidden transition-colors",
            )}
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
          >
            {sidebarOpen ? (
              <XIcon className="h-5 w-5" />
            ) : (
              <MenuIcon className="h-5 w-5" />
            )}
          </Button>
        )}
        <WrapperComponent
          className="h-full"
          customPromptActions={combinedPromptActions}
          customMessageActions={combinedMessageActions}
          customSettingsTabs={combinedSettingsTabs}
          handleFormSubmit={handleFormSubmit}
          stopStreaming={stopStreaming}
          regenerateMessage={regenerateMessage}
          exportConversation={exportConversation}
          getContextSnapshotForMod={getContextSnapshotForMod}
        />
      </div>
    </div>
  );
};
