// src/components/lite-chat/chat/chat-wrapper.tsx
import React from "react";
import { ChatContent } from "./chat-content";
import { PromptWrapper } from "@/components/lite-chat/prompt/prompt-wrapper";
import { ChatHeader } from "./chat-header";
import { cn } from "@/lib/utils";
import type { ChatWrapperDirectProps, ChatWrapperBundledProps } from "../chat";

type ChatWrapperProps = ChatWrapperDirectProps & {
  bundledProps: ChatWrapperBundledProps;
};

const ChatWrapperComponent: React.FC<ChatWrapperProps> = ({
  className,
  promptInputValue,
  setPromptInputValue,
  messages,
  isStreaming,
  isLoadingMessages,
  error,
  addAttachedFile,
  removeAttachedFile,
  clearPromptInput,
  bundledProps,
}) => {
  const {
    selectedItemId,
    selectedItemType,
    sidebarItems,
    attachedFiles,
    selectedVfsPaths,
    isVfsEnabledForItem,
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
        messages={messages}
        isLoadingMessages={isLoadingMessages}
        isStreaming={isStreaming}
        regenerateMessage={regenerateMessage}
        getContextSnapshotForMod={getContextSnapshotForMod}
        modMessageActions={modMessageActions}
      />
      <PromptWrapper
        error={error}
        isStreaming={isStreaming}
        promptInputValue={promptInputValue}
        setPromptInputValue={setPromptInputValue}
        addAttachedFile={addAttachedFile}
        removeAttachedFile={removeAttachedFile}
        clearPromptInput={clearPromptInput}
        attachedFiles={attachedFiles}
        selectedVfsPaths={selectedVfsPaths}
        isVfsEnabledForItem={isVfsEnabledForItem}
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
        getContextSnapshot={getContextSnapshotForMod}
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
