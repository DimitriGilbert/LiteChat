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
  // SidebarItem, // Removed unused import
} from "@/lib/types";

// Define the props expected by ChatWrapper based on LiteChatInner
export interface ChatWrapperProps {
  className?: string;
  // Volatile State (High Frequency)
  messages: Message[];
  isStreaming: boolean;
  isLoadingMessages: boolean;
  error: string | null;
  // Input State/Actions (High Frequency)
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
  // Core Actions (High Frequency)
  regenerateMessage: (messageId: string) => Promise<void>;
  stopStreaming: (parentMessageId?: string | null) => void;
  // Form Submission Wrapper (High Frequency)
  handleFormSubmit: (
    prompt: string,
    files: File[],
    vfsPaths: string[],
    context: any,
  ) => Promise<void>;
  // Selection State (Passed Down)
  selectedItemId: string | null;
  selectedItemType: SidebarItemType | null;
  // Derived State (Passed Down)
  activeConversationData: DbConversation | null;
  selectedProvider: AiProviderConfigType | undefined;
  selectedModel: AiModelConfig | undefined;
  getApiKeyForProvider: (providerId: string) => string | undefined;
  // VFS State (Passed Down)
  isVfsReady: boolean;
  isVfsEnabledForItem: boolean;
  isVfsLoading: boolean;
  vfsError: string | null;
  vfsKey: string | null;
  // Mod/Extensibility Props (Passed Down)
  customPromptActions: CustomPromptAction[];
  customMessageActions: CustomMessageAction[];
  getContextSnapshotForMod: () => ReadonlyChatContextSnapshot;
  // Settings State (Passed Down)
  enableAdvancedSettings: boolean;
  enableApiKeyManagement: boolean;
  globalSystemPrompt: string | null;
  temperature: number;
  topP: number | null;
  maxTokens: number | null;
  topK: number | null;
  presencePenalty: number | null;
  frequencyPenalty: number | null;
  enableStreamingMarkdown: boolean;
  // streamingPortalId?: string; // Added
  // Actions needed by children (Passed Down)
  // sidebarItems: SidebarItem[]; // Removed - Header fetches its own
  searchTerm: string; // For Header
  setSearchTerm: (term: string) => void; // For Header
  exportConversation: (conversationId: string | null) => Promise<void>; // For Header
  createConversation: (
    parentId: string | null,
    title?: string,
  ) => Promise<string>; // For PromptForm
  updateDbProviderConfig: (
    id: string,
    changes: Partial<DbProviderConfig>,
  ) => Promise<void>; // For PromptForm/Settings
  setSelectedProviderId: (id: string | null) => void; // For PromptForm/Settings
  setSelectedModelId: (id: string | null) => void; // For PromptForm/Settings
  toggleVfsEnabledAction: (id: string, type: SidebarItemType) => Promise<void>; // For PromptForm/Settings
  setTemperature: (temp: number) => void; // For PromptForm/Settings
  setTopP: (topP: number | null) => void; // For PromptForm/Settings
  setMaxTokens: (tokens: number | null) => void; // For PromptForm/Settings
  setTopK: (topK: number | null) => void; // For PromptForm/Settings
  setPresencePenalty: (penalty: number | null) => void; // For PromptForm/Settings
  setFrequencyPenalty: (penalty: number | null) => void; // For PromptForm/Settings
  updateConversationSystemPrompt: (
    id: string,
    systemPrompt: string | null,
  ) => Promise<void>; // For PromptForm/Settings
  setError: (error: string | null) => void; // For PromptForm
  // Provider/API Key Data (Passed Down)
  dbProviderConfigs: DbProviderConfig[];
  apiKeys: DbApiKey[];
}

const ChatWrapperComponent: React.FC<ChatWrapperProps> = ({
  className,
  // Destructure all props defined in the interface
  messages,
  isStreaming,
  isLoadingMessages,
  error,
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
  regenerateMessage,
  stopStreaming,
  handleFormSubmit,
  selectedItemId,
  selectedItemType,
  activeConversationData,
  selectedProvider,
  selectedModel,
  getApiKeyForProvider,
  isVfsReady,
  isVfsEnabledForItem,
  isVfsLoading,
  vfsError,
  vfsKey,
  customPromptActions,
  customMessageActions,
  getContextSnapshotForMod,
  enableAdvancedSettings,
  enableApiKeyManagement,
  globalSystemPrompt,
  temperature,
  topP,
  maxTokens,
  topK,
  presencePenalty,
  frequencyPenalty,
  enableStreamingMarkdown,
  // streamingPortalId, // Added
  // sidebarItems, // Removed
  searchTerm,
  setSearchTerm,
  exportConversation,
  createConversation,
  updateDbProviderConfig,
  setSelectedProviderId,
  setSelectedModelId,
  toggleVfsEnabledAction,
  setTemperature,
  setTopP,
  setMaxTokens,
  setTopK,
  setPresencePenalty,
  setFrequencyPenalty,
  updateConversationSystemPrompt,
  setError,
  dbProviderConfigs,
  apiKeys,
}) => {
  return (
    <main
      className={cn(
        "flex flex-grow flex-col bg-background overflow-hidden",
        className,
      )}
    >
      <ChatHeader
        className={cn(
          "flex-shrink-0", // Add flex-shrink-0 if needed
        )}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        exportConversation={exportConversation}
      />
      <ChatContent
        className="flex-grow h-0"
        // Pass necessary display props + regenerate callback
        messages={messages}
        isLoadingMessages={isLoadingMessages}
        isStreaming={isStreaming}
        regenerateMessage={regenerateMessage}
        getContextSnapshotForMod={getContextSnapshotForMod}
        modMessageActions={customMessageActions}
        enableStreamingMarkdown={enableStreamingMarkdown}
        // streamingPortalId={streamingPortalId} // Added
      />
      <PromptWrapper
        // Pass all remaining props down to PromptWrapper/PromptForm
        error={error}
        isStreaming={isStreaming}
        isVfsReady={isVfsReady}
        isVfsEnabledForItem={isVfsEnabledForItem}
        promptInputValue={promptInputValue}
        setPromptInputValue={setPromptInputValue}
        addAttachedFile={addAttachedFile}
        removeAttachedFile={removeAttachedFile}
        clearAttachedFiles={clearAttachedFiles}
        clearPromptInput={clearPromptInput}
        onFormSubmit={handleFormSubmit}
        attachedFiles={attachedFiles}
        selectedVfsPaths={selectedVfsPaths}
        clearSelectedVfsPaths={clearSelectedVfsPaths}
        selectedProviderId={selectedProvider?.id ?? null} // Pass ID derived from provider object
        selectedModelId={selectedModel?.id ?? null} // Pass ID derived from model object
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
