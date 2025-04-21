// src/components/lite-chat/chat/chat-wrapper.tsx
import React from "react";
import { ChatContent } from "./chat-content";
import { PromptWrapper } from "@/components/lite-chat/prompt/prompt-wrapper";
import { ChatHeader } from "./chat-header";
import { cn } from "@/lib/utils";
// Import prop types from parent
import type { ChatWrapperProps } from "../chat";
import type {
  Message,
  SidebarItemType,
  SidebarItem,
  MessageContent,
  DbProviderConfig,
  DbApiKey,
  DbConversation,
  CustomPromptAction,
  AiModelConfig,
} from "@/lib/types";
import type { ReadonlyChatContextSnapshot } from "@/mods/api";

// Wrap component logic in a named function for React.memo
const ChatWrapperComponent: React.FC<ChatWrapperProps> = ({
  className,
  // Destructure input state separately
  promptInputValue,
  setPromptInputValue,
  // Destructure all other props passed from LiteChatInner
  selectedItemId,
  selectedItemType,
  sidebarItems,
  messages,
  isLoadingMessages,
  isStreaming,
  error,
  attachedFiles,
  selectedVfsPaths,
  isVfsEnabledForItem,
  regenerateMessage,
  addAttachedFile,
  removeAttachedFile,
  clearPromptInput,
  handleSubmitCore,
  handleImageGenerationCore,
  clearSelectedVfsPaths,
  selectedProviderId,
  selectedModelId,
  dbProviderConfigs,
  apiKeys,
  enableApiKeyManagement,
  dbConversations,
  createConversation,
  selectItem,
  deleteItem,
  updateDbProviderConfig,
  searchTerm,
  setSearchTerm,
  exportConversation,
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
  activeConversationData,
  updateConversationSystemPrompt,
  isVfsReady,
  isVfsLoading,
  vfsError,
  vfsKey,
  enableAdvancedSettings,
  setSelectedProviderId,
  setSelectedModelId,
  toggleVfsEnabledAction,
  stopStreaming,
  customPromptActions,
  getContextSnapshotForMod,
  selectedModel,
  setError,
  removeSelectedVfsPath,
}) => {
  return (
    <main
      className={cn(
        "flex flex-grow flex-col bg-background overflow-hidden",
        className,
      )}
    >
      {/* Pass necessary props down to ChatHeader */}
      <ChatHeader
        selectedItemId={selectedItemId}
        selectedItemType={selectedItemType}
        sidebarItems={sidebarItems}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        exportConversation={exportConversation}
      />
      {/* Pass necessary props down to ChatContent */}
      <ChatContent
        className="flex-grow h-0"
        messages={messages}
        isLoadingMessages={isLoadingMessages}
        isStreaming={isStreaming}
        regenerateMessage={regenerateMessage}
        getContextSnapshotForMod={getContextSnapshotForMod}
      />
      {/* Pass necessary props down to PromptWrapper */}
      <PromptWrapper
        error={error}
        // State/Actions for PromptForm
        promptInputValue={promptInputValue} // Pass down
        setPromptInputValue={setPromptInputValue} // Pass down
        attachedFiles={attachedFiles}
        selectedVfsPaths={selectedVfsPaths}
        isVfsEnabledForItem={isVfsEnabledForItem}
        isStreaming={isStreaming}
        addAttachedFile={addAttachedFile}
        removeAttachedFile={removeAttachedFile}
        clearPromptInput={clearPromptInput}
        handleSubmitCore={handleSubmitCore}
        handleImageGenerationCore={handleImageGenerationCore}
        clearSelectedVfsPaths={clearSelectedVfsPaths}
        // State/Actions for PromptSettings
        selectedProviderId={selectedProviderId}
        selectedModelId={selectedModelId}
        dbProviderConfigs={dbProviderConfigs}
        apiKeys={apiKeys}
        enableApiKeyManagement={enableApiKeyManagement}
        dbConversations={dbConversations}
        createConversation={createConversation}
        selectItem={selectItem}
        deleteItem={deleteItem}
        updateDbProviderConfig={updateDbProviderConfig}
        // Pass down props needed by PromptForm/PromptSettings/PromptActions
        selectedItemId={selectedItemId}
        selectedItemType={selectedItemType}
        setError={setError}
        removeSelectedVfsPath={removeSelectedVfsPath}
        isVfsReady={isVfsReady}
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
        getContextSnapshotForMod={getContextSnapshotForMod} // Pass down
        selectedModel={selectedModel}
        stopStreaming={stopStreaming}
        // Pass down VFS state needed by PromptSettingsAdvanced
        isVfsLoading={isVfsLoading}
        vfsError={vfsError}
        vfsKey={vfsKey}
      />
    </main>
  );
};

// Export the memoized component
export const ChatWrapper = React.memo(ChatWrapperComponent);
