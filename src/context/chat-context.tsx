// src/context/chat-context.tsx
import React, { useState, useRef, useMemo, useCallback } from "react";
import type {
  CoreChatContextProps,
  SidebarItemType,
  Message,
  DbConversation,
  DbProject,
  CustomPromptAction,
  CustomMessageAction,
  CustomSettingTab,
  SidebarItem,
  ProjectSidebarItem,
  ConversationSidebarItem,
} from "@/lib/types";
import { modEvents, ModEvent } from "@/mods/events";
import { CoreChatContext } from "@/context/core-chat-context";
import { useChatStorage } from "@/hooks/use-chat-storage";
import { ProviderManagementProvider } from "./provider-management-context";
import { SidebarProvider } from "./sidebar-context";
import { SettingsProvider } from "./settings-context";
import { VfsProvider } from "./vfs-context";
import { ModProvider } from "./mod-context";
import ChatProviderInner from "./chat-provider-inner";
import {
  EMPTY_CUSTOM_SETTINGS_TABS,
  EMPTY_CUSTOM_PROMPT_ACTIONS,
  EMPTY_CUSTOM_MESSAGE_ACTIONS,
} from "@/utils/chat-utils";

interface ChatProviderProps {
  children: React.ReactNode;
  initialProviderId?: string | null;
  initialModelId?: string | null;
  initialSelectedItemId?: string | null;
  initialSelectedItemType?: SidebarItemType | null;
  streamingThrottleRate?: number;
  enableApiKeyManagement?: boolean;
  enableSidebar?: boolean;
  enableVfs?: boolean;
  enableAdvancedSettings?: boolean;
  customPromptActions?: CustomPromptAction[];
  customMessageActions?: CustomMessageAction[];
  customSettingsTabs?: CustomSettingTab[];
}

export const ChatProvider: React.FC<ChatProviderProps> = ({
  children,
  initialProviderId = null,
  initialModelId = null,
  initialSelectedItemId = null,
  initialSelectedItemType = null,
  streamingThrottleRate = 42,
  enableApiKeyManagement = true,
  enableSidebar = true,
  enableVfs = true,
  enableAdvancedSettings = true,
  customPromptActions = EMPTY_CUSTOM_PROMPT_ACTIONS,
  customMessageActions = EMPTY_CUSTOM_MESSAGE_ACTIONS,
  customSettingsTabs = EMPTY_CUSTOM_SETTINGS_TABS,
}) => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [error, setErrorState] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  const setError = useCallback((newError: string | null) => {
    setErrorState(newError);
    if (newError) {
      console.error("Chat Error Context:", newError);
      modEvents.emit(ModEvent.APP_ERROR, { message: newError });
    }
  }, []);

  const coreContextValue: CoreChatContextProps = useMemo(
    () => ({
      messages,
      setMessages,
      isLoadingMessages,
      setIsLoadingMessages,
      isStreaming,
      setIsStreaming,
      error,
      setError,
      handleSubmitCore: async () => {
        console.warn("handleSubmitCore called on CoreChatContext");
        return Promise.resolve();
      },
      // Add placeholder for image generation core function
      handleImageGenerationCore: async () => {
        console.warn("handleImageGenerationCore called on CoreChatContext");
        return Promise.resolve();
      },
      stopStreamingCore: () => {
        console.warn("stopStreamingCore called on CoreChatContext");
      },
      regenerateMessageCore: async () => {
        console.warn("regenerateMessageCore called on CoreChatContext");
        return Promise.resolve();
      },
      abortControllerRef,
    }),
    [messages, isLoadingMessages, isStreaming, error, setError],
  );

  const [activeItemId, setActiveItemId] = useState<string | null>(
    initialSelectedItemId,
  );
  const [activeItemType, setActiveItemType] = useState<SidebarItemType | null>(
    initialSelectedItemType,
  );

  const handleSelectItem = useCallback(
    async (id: string | null, type: SidebarItemType | null) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      setIsStreaming(false);
      setMessages([]);
      setErrorState(null);
      setActiveItemId(id);
      setActiveItemType(type);
      setIsLoadingMessages(!!id);
      modEvents.emit(ModEvent.CHAT_SELECTED, { id, type });
    },
    [],
  );

  const handleSettingsModalOpenChange = useCallback((open: boolean) => {
    setIsSettingsModalOpen(open);
    if (open) {
      modEvents.emit(ModEvent.SETTINGS_OPENED);
    } else {
      modEvents.emit(ModEvent.SETTINGS_CLOSED);
    }
  }, []);

  const storage = useChatStorage();
  const sidebarItems = useMemo<SidebarItem[]>(() => {
    const allProjects = storage.projects || [];
    const allConversations = storage.conversations || [];
    const combinedItems: SidebarItem[] = [
      ...allProjects.map(
        (p): ProjectSidebarItem => ({ ...p, type: "project" }),
      ),
      ...allConversations.map(
        (c): ConversationSidebarItem => ({ ...c, type: "conversation" }),
      ),
    ];
    combinedItems.sort(
      (a, b) => (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0),
    );
    return combinedItems;
  }, [storage.projects, storage.conversations]);

  const activeItemData = useMemo(() => {
    if (!activeItemId || !activeItemType) return null;
    const item = sidebarItems.find((i) => i.id === activeItemId);
    if (item && item.type === activeItemType) {
      return item;
    }
    return null;
  }, [activeItemId, activeItemType, sidebarItems]);

  const activeConversationData = useMemo(() => {
    return activeItemType === "conversation"
      ? (activeItemData as DbConversation | null)
      : null;
  }, [activeItemType, activeItemData]);

  const activeProjectData = useMemo(() => {
    return activeItemType === "project"
      ? (activeItemData as DbProject | null)
      : null;
  }, [activeItemType, activeItemData]);

  const isVfsEnabledForItem = useMemo(
    () => (enableVfs ? (activeItemData?.vfsEnabled ?? false) : false),
    [enableVfs, activeItemData],
  );

  const vfsKey = useMemo(() => {
    if (!enableVfs) return null;
    if (activeItemType === "project" && activeItemId) {
      return activeItemId;
    }
    if (activeItemType === "conversation" && activeConversationData) {
      return activeConversationData.parentId || "orphan";
    }
    return null;
  }, [enableVfs, activeItemType, activeItemId, activeConversationData]);

  return (
    <CoreChatContext.Provider value={coreContextValue}>
      <ProviderManagementProvider
        initialProviderId={initialProviderId}
        initialModelId={initialModelId}
        enableApiKeyManagement={enableApiKeyManagement}
      >
        <SidebarProvider
          initialSelectedItemId={initialSelectedItemId}
          initialSelectedItemType={initialSelectedItemType}
          enableSidebar={enableSidebar}
          onSelectItem={handleSelectItem}
        >
          <SettingsProvider
            enableAdvancedSettings={enableAdvancedSettings}
            activeConversationData={activeConversationData}
            activeProjectData={activeProjectData}
            isSettingsModalOpen={isSettingsModalOpen}
            onSettingsModalOpenChange={handleSettingsModalOpenChange}
          >
            <VfsProvider
              enableVfs={enableVfs}
              selectedItemId={activeItemId}
              selectedItemType={activeItemType}
              isVfsEnabledForItem={isVfsEnabledForItem}
              vfsKey={vfsKey}
            >
              <ModProvider>
                <ChatProviderInner
                  streamingThrottleRate={streamingThrottleRate}
                  userCustomPromptActions={customPromptActions}
                  userCustomMessageActions={customMessageActions}
                  userCustomSettingsTabs={customSettingsTabs}
                >
                  {children}
                </ChatProviderInner>
              </ModProvider>
            </VfsProvider>
          </SettingsProvider>
        </SidebarProvider>
      </ProviderManagementProvider>
    </CoreChatContext.Provider>
  );
};
