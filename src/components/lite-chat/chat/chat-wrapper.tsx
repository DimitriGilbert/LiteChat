// src/components/lite-chat/chat/chat-wrapper.tsx
import React from "react";
import { ChatContent } from "./chat-content";
import { PromptWrapper } from "@/components/lite-chat/prompt/prompt-wrapper";
import { ChatHeader } from "./chat-header";
import { cn } from "@/lib/utils";
import type {
  Message,
  SidebarItemType,
  DbConversation,
  AiModelConfig,
  CustomPromptAction,
  CustomMessageAction,
  ReadonlyChatContextSnapshot,
  DbProviderConfig,
  DbApiKey,
  AiProviderConfig as AiProviderConfigType,
  SidebarItem,
} from "@/lib/types";
// Removed CoreChatActions import as specific core actions are no longer passed down

// Define the props expected by ChatWrapper based on LiteChatInner
export interface ChatWrapperProps {
  className?: string;
  // Volatile State
  messages: Message[];
  isStreaming: boolean;
  isLoadingMessages: boolean;
  error: string | null;
  isVfsReady: boolean;
  isVfsEnabledForItem: boolean;
  // Input State/Actions
  promptInputValue: string;
  setPromptInputValue: (value: string) => void;
  addAttachedFile: (file: File) => void;
  removeAttachedFile: (fileName: string) => void;
  clearAttachedFiles: () => void;
  clearPromptInput: () => void;
  attachedFiles: File[];
  selectedVfsPaths: string[];
  removeSelectedVfsPath: (path: string) => void;
  clearSelectedVfsPaths: () => void;
  // Selection State
  selectedItemId: string | null;
  selectedItemType: SidebarItemType | null;
  // Core Actions (passed down to children if needed)
  regenerateMessage: (messageId: string) => Promise<void>;
  stopStreaming: (parentMessageId?: string | null) => void;
  setError: (error: string | null) => void;
  // Form Submission Wrapper (from logic hook)
  handleFormSubmit: (
    prompt: string,
    files: File[],
    vfsPaths: string[],
    context: any, // Context built within PromptForm's internal handler
  ) => Promise<void>;
  // Provider/Model State & Actions
  selectedProviderId: string | null;
  selectedModelId: string | null;
  selectedModel: AiModelConfig | undefined;
  selectedProvider: AiProviderConfigType | undefined;
  dbProviderConfigs: DbProviderConfig[];
  apiKeys: DbApiKey[];
  setSelectedProviderId: (id: string | null) => void;
  setSelectedModelId: (id: string | null) => void;
  updateDbProviderConfig: (
    id: string,
    changes: Partial<DbProviderConfig>,
  ) => Promise<void>;
  getApiKeyForProvider: (providerId: string) => string | undefined;
  // Settings State & Actions
  temperature: number;
  setTemperature: (temp: number) => void;
  topP: number | null;
  setTopP: (topP: number | null) => void;
  maxTokens: number | null;
  setMaxTokens: (tokens: number | null) => void;
  topK: number | null;
  setTopK: (topK: number | null) => void;
  presencePenalty: number | null;
  setPresencePenalty: (penalty: number | null) => void;
  frequencyPenalty: number | null;
  setFrequencyPenalty: (penalty: number | null) => void;
  globalSystemPrompt: string | null;
  enableAdvancedSettings: boolean;
  enableApiKeyManagement: boolean;
  // VFS State & Actions
  isVfsLoading: boolean;
  vfsError: string | null;
  vfsKey: string | null;
  toggleVfsEnabledAction: (id: string, type: SidebarItemType) => Promise<void>;
  // Conversation/Item State & Actions
  activeConversationData: DbConversation | null;
  updateConversationSystemPrompt: (
    id: string,
    systemPrompt: string | null,
  ) => Promise<void>;
  createConversation: (
    parentId: string | null,
    title?: string,
  ) => Promise<string>;
  // Mod/Extensibility Props
  customPromptActions: CustomPromptAction[];
  customMessageActions: CustomMessageAction[];
  getContextSnapshotForMod: () => ReadonlyChatContextSnapshot;
  // Props needed by ChatHeader
  sidebarItems: SidebarItem[];
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  exportConversation: (conversationId: string | null) => Promise<void>;
}

const ChatWrapperComponent: React.FC<ChatWrapperProps> = ({
  className,
  // Destructure all props defined in the interface
  messages,
  isStreaming,
  isLoadingMessages,
  error,
  isVfsReady,
  isVfsEnabledForItem,
  promptInputValue,
  setPromptInputValue,
  addAttachedFile,
  removeAttachedFile,
  clearAttachedFiles,
  clearPromptInput,
  attachedFiles,
  selectedVfsPaths,
  removeSelectedVfsPath,
  clearSelectedVfsPaths,
  selectedItemId,
  selectedItemType,
  regenerateMessage,
  stopStreaming,
  setError,
  handleFormSubmit, // Use the wrapper from logic hook
  // handleImageGenerationWrapper, // This wrapper is now part of handleFormSubmit
  selectedProviderId,
  selectedModelId,
  selectedModel,
  selectedProvider,
  dbProviderConfigs,
  apiKeys,
  setSelectedProviderId,
  setSelectedModelId,
  updateDbProviderConfig,
  getApiKeyForProvider,
  temperature,
  setTemperature,
  topP,
  setTopP,
  maxTokens,
  setMaxTokens,
  topK,
  setTopK,
  presencePenalty,
  setPresencePenalty,
  frequencyPenalty,
  setFrequencyPenalty,
  globalSystemPrompt,
  enableAdvancedSettings,
  enableApiKeyManagement,
  isVfsLoading,
  vfsError,
  vfsKey,
  toggleVfsEnabledAction,
  activeConversationData,
  updateConversationSystemPrompt,
  createConversation,
  customPromptActions,
  customMessageActions,
  getContextSnapshotForMod,
  // Destructure props for ChatHeader
  sidebarItems,
  searchTerm,
  setSearchTerm,
  exportConversation,
  // Core actions are no longer passed directly here
}) => {
  return (
    <main
      className={cn(
        "flex flex-grow flex-col bg-background overflow-hidden",
        className,
      )}
    >
      <ChatHeader
        selectedItemId={selectedItemId}
        selectedItemType={selectedItemType}
        activeConversationData={activeConversationData}
        sidebarItems={sidebarItems}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        exportConversation={exportConversation}
      />
      <ChatContent
        className="flex-grow h-0"
        messages={messages}
        isLoadingMessages={isLoadingMessages}
        isStreaming={isStreaming}
        regenerateMessage={regenerateMessage}
        getContextSnapshotForMod={getContextSnapshotForMod}
        modMessageActions={customMessageActions}
      />
      <PromptWrapper
        // Pass volatile state
        error={error}
        isStreaming={isStreaming}
        isVfsReady={isVfsReady}
        isVfsEnabledForItem={isVfsEnabledForItem}
        // Pass input state/actions
        promptInputValue={promptInputValue}
        setPromptInputValue={setPromptInputValue}
        addAttachedFile={addAttachedFile}
        removeAttachedFile={removeAttachedFile}
        clearAttachedFiles={clearAttachedFiles}
        clearPromptInput={clearPromptInput}
        // Pass the form submit wrapper
        onFormSubmit={handleFormSubmit} // Pass the wrapper function
        // Pass other necessary props down
        attachedFiles={attachedFiles}
        selectedVfsPaths={selectedVfsPaths}
        clearSelectedVfsPaths={clearSelectedVfsPaths}
        selectedProviderId={selectedProviderId}
        selectedModelId={selectedModelId}
        dbProviderConfigs={dbProviderConfigs}
        apiKeys={apiKeys}
        enableApiKeyManagement={enableApiKeyManagement}
        createConversation={createConversation}
        updateDbProviderConfig={updateDbProviderConfig}
        selectedItemId={selectedItemId}
        selectedItemType={selectedItemType}
        setError={setError}
        removeSelectedVfsPath={removeSelectedVfsPath}
        toggleVfsEnabledAction={toggleVfsEnabledAction}
        enableAdvancedSettings={enableAdvancedSettings}
        temperature={temperature}
        setTemperature={setTemperature}
        topP={topP}
        setTopP={setTopP}
        maxTokens={maxTokens}
        setMaxTokens={setMaxTokens}
        topK={topK}
        setTopK={setTopK}
        presencePenalty={presencePenalty}
        setPresencePenalty={setPresencePenalty}
        frequencyPenalty={frequencyPenalty}
        setFrequencyPenalty={setFrequencyPenalty}
        globalSystemPrompt={globalSystemPrompt}
        activeConversationData={activeConversationData}
        updateConversationSystemPrompt={updateConversationSystemPrompt}
        setSelectedProviderId={setSelectedProviderId}
        setSelectedModelId={setSelectedModelId}
        customPromptActions={customPromptActions}
        getContextSnapshotForMod={getContextSnapshotForMod}
        selectedModel={selectedModel}
        stopStreaming={stopStreaming}
        isVfsLoading={isVfsLoading}
        vfsError={vfsError}
        vfsKey={vfsKey}
        getApiKeyForProvider={getApiKeyForProvider}
        selectedProvider={selectedProvider}
      />
    </main>
  );
};

export const ChatWrapper = React.memo(ChatWrapperComponent);
