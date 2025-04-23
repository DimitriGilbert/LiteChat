// src/components/lite-chat/chat/chat-wrapper.tsx
import React from "react";
import { ChatContent } from "./chat-content";
import { PromptWrapper } from "@/components/lite-chat/prompt/prompt-wrapper";
import { ChatHeader } from "./chat-header";
import { cn } from "@/lib/utils";
import type {
  CustomPromptAction,
  CustomMessageAction,
  ReadonlyChatContextSnapshot,
  CustomSettingTab,
} from "@/lib/types";
import { useCoreChatStore } from "@/store/core-chat.store";
import { useSettingsStore } from "@/store/settings.store";
import { useSidebarStore } from "@/store/sidebar.store";
import { useProviderStore } from "@/store/provider.store";
import { useDerivedChatState } from "@/hooks/use-derived-chat-state";
import { useChatStorage } from "@/hooks/use-chat-storage";
import { useShallow } from "zustand/react/shallow";

// Props interface simplified - most data fetched from stores
export interface ChatWrapperProps {
  className?: string;
  // Props passed down from LiteChat (interaction handlers, custom actions/tabs)
  handleFormSubmit: (
    prompt: string,
    files: File[],
    vfsPaths: string[],
    context: any,
  ) => Promise<void>;
  stopStreaming: (parentMessageId?: string | null) => void;
  regenerateMessage: (messageId: string) => Promise<void>;
  exportConversation: (conversationId: string | null) => Promise<void>;
  customPromptActions: CustomPromptAction[];
  customMessageActions: CustomMessageAction[];
  customSettingsTabs: CustomSettingTab[];
  getContextSnapshotForMod: () => ReadonlyChatContextSnapshot;
}

const ChatWrapperComponent: React.FC<ChatWrapperProps> = ({
  className,
  // Destructure interaction handlers and custom items
  handleFormSubmit,
  stopStreaming,
  regenerateMessage,
  exportConversation,
  customPromptActions,
  customMessageActions,
  customSettingsTabs,
  getContextSnapshotForMod,
}) => {
  // --- Fetch state directly from stores ---
  const { messages, isStreaming, isLoadingMessages } = useCoreChatStore(
    useShallow((state) => ({
      messages: state.messages,
      isStreaming: state.isStreaming,
      isLoadingMessages: state.isLoadingMessages,
    })),
  );

  const { searchTerm, setSearchTerm, enableStreamingMarkdown } =
    useSettingsStore(
      useShallow((state) => ({
        searchTerm: state.searchTerm,
        setSearchTerm: state.setSearchTerm,
        enableStreamingMarkdown: state.enableStreamingMarkdown,
      })),
    );

  const { selectedItemId, selectedItemType } = useSidebarStore(
    useShallow((state) => ({
      selectedItemId: state.selectedItemId,
      selectedItemType: state.selectedItemType,
    })),
  );

  const { selectedProviderId, selectedModelId, dbProviderConfigs, apiKeys } =
    useProviderStore(
      useShallow((state) => ({
        selectedProviderId: state.selectedProviderId,
        selectedModelId: state.selectedModelId,
        dbProviderConfigs: state.dbProviderConfigs,
        apiKeys: state.apiKeys,
      })),
    );

  // Fetch DB data needed for derived state
  const { conversations: dbConversations, projects: dbProjects } =
    useChatStorage();

  // --- Use derived state hook ---
  const { activeConversationData, selectedProvider, selectedModel } =
    useDerivedChatState({
      selectedItemId,
      selectedItemType,
      dbConversations: dbConversations || [],
      dbProjects: dbProjects || [],
      dbProviderConfigs,
      apiKeys,
      selectedProviderId,
      selectedModelId,
    });

  return (
    <main
      className={cn(
        "flex flex-grow flex-col bg-background overflow-hidden",
        className,
      )}
    >
      {/* ChatHeader fetches its own data */}
      <ChatHeader
        className={cn("flex-shrink-0")}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        exportConversation={exportConversation}
      />
      {/* ChatContent uses fetched state */}
      <ChatContent
        className="flex-grow h-0"
        messages={messages}
        isLoadingMessages={isLoadingMessages}
        isStreaming={isStreaming}
        regenerateMessage={regenerateMessage}
        getContextSnapshotForMod={getContextSnapshotForMod}
        modMessageActions={customMessageActions}
        enableStreamingMarkdown={enableStreamingMarkdown}
      />
      {/* PromptWrapper uses fetched state and passed props */}
      <PromptWrapper
        onFormSubmit={handleFormSubmit}
        activeConversationData={activeConversationData}
        stopStreaming={stopStreaming}
        customPromptActions={customPromptActions}
        getContextSnapshot={getContextSnapshotForMod}
        selectedModel={selectedModel}
        selectedProvider={selectedProvider}
        customSettingsTabs={customSettingsTabs}
      />
    </main>
  );
};

export const ChatWrapper = React.memo(ChatWrapperComponent);
