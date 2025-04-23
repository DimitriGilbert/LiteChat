// src/components/lite-chat/chat.tsx
import React, { useState, useMemo, useCallback, useEffect } from "react"; // Ensure useEffect is imported
import ChatProviderInner from "@/context/chat-provider-inner";
import { ChatSide } from "./chat/chat-side";
import { ChatWrapper } from "./chat/chat-wrapper";
import { useLiteChatLogic } from "@/hooks/use-lite-chat-logic";
import { useCoreChatStore } from "@/store/core-chat.store";
import { useChatStorage } from "@/hooks/use-chat-storage";
import { useShallow } from "zustand/react/shallow";
import { useVfsStore } from "@/store/vfs.store";
// No need to import useSettingsStore here for the effect
import type {
  LiteChatConfig,
  SidebarItem,
  DbProject,
  DbConversation,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { MenuIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ComponentType } from "react";

// --- Add useThemeEffect Hook Definition ---
// This hook applies the theme class to the document root.
function useThemeEffect(theme: "light" | "dark" | "system") {
  useEffect(() => {
    if (typeof window === "undefined" || !window.document?.documentElement) {
      return;
    }
    if (import.meta.env.VITEST) {
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
}
// --- End useThemeEffect Hook Definition ---

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
}) => {
  const { projects: dbProjects, conversations: dbConversations } =
    useChatStorage();

  const logic = useLiteChatLogic({
    editingItemId,
    setEditingItemId,
    onEditComplete,
    dbConversations,
    dbProjects,
  });

  // Destructure state and actions from the logic hook
  const {
    promptInputValue,
    setPromptInputValue,
    attachedFiles,
    addAttachedFile,
    removeAttachedFile,
    clearAttachedFiles,
    selectedVfsPaths,
    // addSelectedVfsPath,
    removeSelectedVfsPath,
    clearSelectedVfsPaths,
    clearAllInput,
    sidebarActions,
    coreChatActions,
    providerActions,
    settingsActions,
    modActions,
    selectedItemId,
    selectedItemType,
    enableSidebar: enableSidebarFromHook,
    // vfsState,
    providerState,
    settingsState,
    modState,
    clearAllData,
    getAllAvailableModelDefs,
    handleFormSubmit,
    // handleImageGenerationWrapper,
    stopStreaming,
    regenerateMessage,
    getContextSnapshotForMod,
    activeConversationData,
    selectedProvider,
    selectedModel,
    getApiKeyForProvider,
  } = logic;

  // --- Apply theme effect using state from logic hook ---
  useThemeEffect(settingsState.theme);
  // --- End theme effect application ---

  // Core chat volatile state
  const { messages, isLoadingMessages, isStreaming, error } = useCoreChatStore(
    useShallow((state) => ({
      messages: state.messages,
      isLoadingMessages: state.isLoadingMessages,
      isStreaming: state.isStreaming,
      error: state.error,
    })),
  );

  // VFS volatile state
  const { isVfsReady, isVfsEnabledForItem, isVfsLoading, vfsError, vfsKey } =
    useVfsStore(
      useShallow((state) => ({
        isVfsReady: state.isVfsReady,
        isVfsEnabledForItem: state.isVfsEnabledForItem,
        isVfsLoading: state.isVfsLoading,
        vfsError: state.vfsError,
        vfsKey: state.vfsKey,
      })),
    );

  // Derive sidebar items
  const sidebarItems = useMemo(() => {
    const allProjects: DbProject[] = dbProjects || [];
    const allConversations: DbConversation[] = dbConversations || [];
    const combinedItems: SidebarItem[] = [
      ...allProjects.map((p: DbProject) => ({
        ...p,
        type: "project" as const,
      })),
      ...allConversations.map((c: DbConversation) => ({
        ...c,
        type: "conversation" as const,
      })),
    ];
    combinedItems.sort(
      (a, b) => (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0),
    );
    return combinedItems;
  }, [dbProjects, dbConversations]);

  const enableSidebar = enableSidebarFromHook ?? enableSidebarConfig;

  return (
    <div
      className={cn(
        "flex h-full w-full overflow-hidden bg-background border border-border rounded-lg shadow-sm",
        className,
      )}
    >
      {enableSidebar && sidebarOpen && (
        <SideComponent
          className={cn("w-72 flex-shrink-0", "hidden md:flex")}
          dbProjects={dbProjects}
          dbConversations={dbConversations}
          editingItemId={editingItemId}
          selectedItemId={selectedItemId}
          selectedItemType={selectedItemType}
          isSettingsModalOpen={settingsState.isSettingsModalOpen}
          setIsSettingsModalOpen={settingsActions.setIsSettingsModalOpen}
          theme={settingsState.theme}
          setTheme={settingsActions.setTheme}
          streamingRefreshRateMs={settingsState.streamingRefreshRateMs}
          setStreamingRefreshRateMs={settingsActions.setStreamingRefreshRateMs}
          dbProviderConfigs={providerState.dbProviderConfigs}
          apiKeys={providerState.apiKeys}
          addDbProviderConfig={providerActions.addDbProviderConfig}
          updateDbProviderConfig={providerActions.updateDbProviderConfig}
          deleteDbProviderConfig={providerActions.deleteDbProviderConfig}
          fetchModels={providerActions.fetchModels}
          providerFetchStatus={providerState.providerFetchStatus}
          getAllAvailableModelDefs={getAllAvailableModelDefs}
          globalSystemPrompt={settingsState.globalSystemPrompt}
          setGlobalSystemPrompt={settingsActions.setGlobalSystemPrompt}
          addApiKey={providerActions.addApiKey}
          deleteApiKey={providerActions.deleteApiKey}
          importConversation={sidebarActions.importConversation}
          exportAllConversations={sidebarActions.exportAllConversations}
          clearAllData={clearAllData}
          dbMods={modState.dbMods}
          loadedMods={modState.loadedMods}
          addDbMod={modActions.addDbMod}
          updateDbMod={modActions.updateDbMod}
          deleteDbMod={modActions.deleteDbMod}
          enableAdvancedSettings={settingsState.enableAdvancedSettings}
          enableApiKeyManagement={providerState.enableApiKeyManagement}
          customSettingsTabs={modState.modSettingsTabs}
          onEditComplete={onEditComplete}
          setEditingItemId={setEditingItemId}
          selectItem={sidebarActions.selectItem}
          deleteItem={sidebarActions.deleteItem}
          renameItem={sidebarActions.renameItem}
          exportConversation={sidebarActions.exportConversation}
          createConversation={sidebarActions.createConversation}
          createProject={sidebarActions.createProject}
        />
      )}

      <div className="flex-grow flex flex-col relative w-full min-w-0">
        {enableSidebar && (
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
          messages={messages}
          isStreaming={isStreaming}
          isLoadingMessages={isLoadingMessages}
          error={error}
          isVfsReady={isVfsReady}
          isVfsEnabledForItem={isVfsEnabledForItem}
          promptInputValue={promptInputValue}
          setPromptInputValue={setPromptInputValue}
          addAttachedFile={addAttachedFile}
          removeAttachedFile={removeAttachedFile}
          clearAttachedFiles={clearAttachedFiles}
          clearPromptInput={clearAllInput}
          attachedFiles={attachedFiles}
          selectedVfsPaths={selectedVfsPaths}
          removeSelectedVfsPath={removeSelectedVfsPath}
          clearSelectedVfsPaths={clearSelectedVfsPaths}
          selectedItemId={selectedItemId}
          selectedItemType={selectedItemType}
          regenerateMessage={regenerateMessage}
          stopStreaming={stopStreaming}
          setError={coreChatActions.setError}
          handleFormSubmit={handleFormSubmit}
          selectedProviderId={providerState.selectedProviderId}
          selectedModelId={providerState.selectedModelId}
          selectedModel={selectedModel}
          selectedProvider={selectedProvider}
          dbProviderConfigs={providerState.dbProviderConfigs}
          apiKeys={providerState.apiKeys}
          setSelectedProviderId={providerActions.setSelectedProviderId}
          setSelectedModelId={providerActions.setSelectedModelId}
          updateDbProviderConfig={providerActions.updateDbProviderConfig}
          getApiKeyForProvider={getApiKeyForProvider}
          temperature={settingsState.temperature}
          setTemperature={settingsActions.setTemperature}
          topP={settingsState.topP}
          setTopP={settingsActions.setTopP}
          maxTokens={settingsState.maxTokens}
          setMaxTokens={settingsActions.setMaxTokens}
          topK={settingsState.topK}
          setTopK={settingsActions.setTopK}
          presencePenalty={settingsState.presencePenalty}
          setPresencePenalty={settingsActions.setPresencePenalty}
          frequencyPenalty={settingsState.frequencyPenalty}
          setFrequencyPenalty={settingsActions.setFrequencyPenalty}
          globalSystemPrompt={settingsState.globalSystemPrompt}
          enableAdvancedSettings={settingsState.enableAdvancedSettings}
          enableApiKeyManagement={providerState.enableApiKeyManagement}
          isVfsLoading={isVfsLoading}
          vfsError={vfsError}
          vfsKey={vfsKey}
          toggleVfsEnabledAction={sidebarActions.toggleVfsEnabled}
          activeConversationData={activeConversationData}
          updateConversationSystemPrompt={
            sidebarActions.updateConversationSystemPrompt
          }
          createConversation={sidebarActions.createConversation}
          customPromptActions={modState.modPromptActions}
          customMessageActions={modState.modMessageActions}
          getContextSnapshotForMod={getContextSnapshotForMod}
          sidebarItems={sidebarItems}
          searchTerm={settingsState.searchTerm}
          setSearchTerm={settingsActions.setSearchTerm}
          exportConversation={sidebarActions.exportConversation}
        />
      </div>
    </div>
  );
};
