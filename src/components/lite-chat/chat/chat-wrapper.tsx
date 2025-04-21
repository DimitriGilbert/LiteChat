// src/components/lite-chat/chat/chat-wrapper.tsx
import React from "react";
import { ChatContent } from "./chat-content";
import { PromptWrapper } from "@/components/lite-chat/prompt/prompt-wrapper";
import { ChatHeader } from "./chat-header";
import { cn } from "@/lib/utils";
// Import the updated prop types
import type { ChatWrapperDirectProps, ChatWrapperBundledProps } from "../chat";

// Combine direct and bundled props for the component's signature
type ChatWrapperProps = ChatWrapperDirectProps & {
  bundledProps: ChatWrapperBundledProps;
};

// Wrap component logic in a named function for React.memo
const ChatWrapperComponent: React.FC<ChatWrapperProps> = ({
  className,
  // Destructure direct props (including volatile state)
  promptInputValue,
  setPromptInputValue,
  messages,
  isStreaming,
  isLoadingMessages,
  error,
  addAttachedFile,
  removeAttachedFile,
  clearPromptInput,
  // Destructure the bundled props object (now stable)
  bundledProps,
}) => {
  // Destructure necessary values from bundledProps (stable props)
  const {
    selectedItemId,
    selectedItemType,
    sidebarItems,
    attachedFiles, // Keep for PromptFiles display
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
      {/* Pass necessary props down to ChatHeader (from stable bundle) */}
      <ChatHeader
        selectedItemId={selectedItemId}
        selectedItemType={selectedItemType}
        sidebarItems={sidebarItems}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        exportConversation={exportConversation}
      />
      {/* Pass volatile props directly to ChatContent */}
      <ChatContent
        className="flex-grow h-0"
        messages={messages} // Direct prop
        isLoadingMessages={isLoadingMessages} // Direct prop
        isStreaming={isStreaming} // Direct prop
        regenerateMessage={regenerateMessage} // From stable bundle
        getContextSnapshotForMod={getContextSnapshotForMod} // From stable bundle
        modMessageActions={modMessageActions} // From stable bundle
      />
      {/* Pass volatile and stable props down to PromptWrapper */}
      <PromptWrapper
        // Direct volatile props
        error={error}
        isStreaming={isStreaming}
        // Direct input state/actions
        promptInputValue={promptInputValue}
        setPromptInputValue={setPromptInputValue}
        addAttachedFile={addAttachedFile}
        removeAttachedFile={removeAttachedFile}
        clearPromptInput={clearPromptInput}
        // Bundled stable props (pass the rest)
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

// Export the memoized component
// React.memo should now be effective as bundledProps is stable
export const ChatWrapper = React.memo(ChatWrapperComponent);
