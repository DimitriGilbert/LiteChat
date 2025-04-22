// src/components/lite-chat/chat/chat-wrapper.tsx
import React from "react";
import { ChatContent } from "./chat-content";
import { PromptWrapper } from "@/components/lite-chat/prompt/prompt-wrapper";
import { ChatHeader } from "./chat-header";
import { cn } from "@/lib/utils";
// Import the updated prop types from chat.tsx
import type { ChatWrapperDirectProps, ChatWrapperBundledProps } from "../chat";

// Use the updated ChatWrapperProps type
type ChatWrapperProps = ChatWrapperDirectProps & {
  bundledProps: ChatWrapperBundledProps;
};

const ChatWrapperComponent: React.FC<ChatWrapperProps> = ({
  className,
  // Destructure direct props
  promptInputValue,
  setPromptInputValue,
  messages,
  isStreaming,
  isLoadingMessages,
  error,
  isVfsReady, // Destructure direct prop
  isVfsEnabledForItem, // Destructure direct prop
  addAttachedFile,
  removeAttachedFile,
  clearPromptInput,
  // Destructure bundled props
  bundledProps,
}) => {
  // Destructure bundled props needed here or passed down further
  const {
    selectedItemId,
    selectedItemType,
    sidebarItems,
    attachedFiles,
    selectedVfsPaths,
    // isVfsEnabledForItem, // REMOVED from bundle
    regenerateMessage,
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
    // isVfsReady, // REMOVED from bundle
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
    modMessageActions,
  } = bundledProps;

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
        sidebarItems={sidebarItems}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        exportConversation={exportConversation}
      />
      <ChatContent
        className="flex-grow h-0"
        messages={messages} // Pass direct prop
        isLoadingMessages={isLoadingMessages} // Pass direct prop
        isStreaming={isStreaming} // Pass direct prop
        regenerateMessage={regenerateMessage}
        getContextSnapshotForMod={getContextSnapshotForMod}
        modMessageActions={modMessageActions}
      />
      {/* Pass direct props down to PromptWrapper */}
      <PromptWrapper
        error={error} // Pass direct prop
        isStreaming={isStreaming} // Pass direct prop
        promptInputValue={promptInputValue} // Pass direct prop
        setPromptInputValue={setPromptInputValue} // Pass direct prop
        addAttachedFile={addAttachedFile} // Pass direct prop
        removeAttachedFile={removeAttachedFile} // Pass direct prop
        clearPromptInput={clearPromptInput} // Pass direct prop
        isVfsReady={isVfsReady} // Pass direct prop
        isVfsEnabledForItem={isVfsEnabledForItem} // Pass direct prop
        // Pass bundled props down
        attachedFiles={attachedFiles}
        selectedVfsPaths={selectedVfsPaths}
        handleSubmitCore={handleSubmitCore}
        handleImageGenerationCore={handleImageGenerationCore}
        clearSelectedVfsPaths={clearSelectedVfsPaths}
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
      />
    </main>
  );
};

export const ChatWrapper = React.memo(ChatWrapperComponent);
