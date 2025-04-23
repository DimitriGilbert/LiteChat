
import React, { useState, useMemo, useCallback, useEffect } from "react"; // Ensure useEffect is imported
import ChatProviderInner from "@/context/chat-provider-inner";
import { ChatSide } from "./chat/chat-side";
import { ChatWrapper } from "./chat/chat-wrapper";
import { useLiteChatLogic } from "@/hooks/use-lite-chat-logic";
import { useCoreChatStore } from "@/store/core-chat.store";
import { useChatStorage } from "@/hooks/use-chat-storage";
import { useShallow } from "zustand/react/shallow";
import { useVfsStore } from "@/store/vfs.store";

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
        // Pass portal ID from config
        // streamingPortalId={config.streamingPortalId}
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
  // streamingPortalId?: string; // Added prop
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
  // streamingPortalId, // Added prop
}) => {
  const { projects: dbProjects, conversations: dbConversations } =
    useChatStorage();

  const logic = useLiteChatLogic({
    editingItemId,
    setEditingItemId,
    onEditComplete,
    dbConversations: dbConversations || [], // Pass empty array if null/undefined
    dbProjects: dbProjects || [], // Pass empty array if null/undefined
  });

  // Destructure only what's needed directly or for high-frequency prop drilling
  const {
    // Input State/Actions (High Frequency - Pass to Wrapper)
    promptInputValue,
    setPromptInputValue,
    attachedFiles,
    addAttachedFile,
    removeAttachedFile,
    clearAttachedFiles,
    selectedVfsPaths,
    removeSelectedVfsPath,
    clearSelectedVfsPaths,
    clearAllInput,
    // Core Actions (High Frequency - Pass to Wrapper)
    stopStreaming,
    regenerateMessage,
    // Interaction Handlers (High Frequency - Pass to Wrapper)
    handleFormSubmit,
    // Selection State (Needed for Wrapper/Header)
    selectedItemId,
    selectedItemType,
    // Sidebar Actions (Needed for Side)
    sidebarActions,
    // Settings State (Needed for Wrapper/Header)
    settingsState,
    // Mod State (Needed for Wrapper/Side)
    modState,
    // Derived State (Needed for Wrapper)
    activeConversationData,
    selectedProvider,
    selectedModel,
    getApiKeyForProvider,
    // Utility Callbacks (Needed for Side)
    // clearAllData,
    // getAllAvailableModelDefs,
    getContextSnapshotForMod,
    // Provider State/Actions (Needed for Side)
    providerState,
    providerActions,
  } = logic;

  // --- Apply theme effect using state from logic hook ---
  useThemeEffect(settingsState.theme);
  // --- End theme effect application ---

  // Core chat volatile state (High Frequency - Pass to Wrapper)
  const { messages, isLoadingMessages, isStreaming, error } = useCoreChatStore(
    useShallow((state) => ({
      messages: state.messages,
      isLoadingMessages: state.isLoadingMessages,
      isStreaming: state.isStreaming,
      error: state.error,
    })),
  );

  // VFS volatile state (Needed for Wrapper)
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

  // Derive sidebar items (Needed for Wrapper/Header)
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

  const enableSidebar = enableSidebarConfig; // Use config prop directly

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
          // Pass only essential callbacks/local state
          editingItemId={editingItemId}
          onEditComplete={onEditComplete}
          setEditingItemId={setEditingItemId}
          // Side component will fetch most data from stores
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
          // Pass High-Frequency State/Actions
          messages={messages}
          isStreaming={isStreaming}
          isLoadingMessages={isLoadingMessages}
          error={error}
          promptInputValue={promptInputValue}
          setPromptInputValue={setPromptInputValue}
          attachedFiles={attachedFiles}
          addAttachedFile={addAttachedFile}
          removeAttachedFile={removeAttachedFile}
          clearAttachedFiles={clearAttachedFiles}
          selectedVfsPaths={selectedVfsPaths}
          removeSelectedVfsPath={removeSelectedVfsPath}
          clearSelectedVfsPaths={clearSelectedVfsPaths}
          clearPromptInput={clearAllInput}
          regenerateMessage={regenerateMessage}
          stopStreaming={stopStreaming}
          handleFormSubmit={handleFormSubmit}
          // Pass Selection State
          selectedItemId={selectedItemId}
          selectedItemType={selectedItemType}
          // Pass Derived State needed by Wrapper/Children
          activeConversationData={activeConversationData}
          selectedProvider={selectedProvider}
          selectedModel={selectedModel}
          getApiKeyForProvider={getApiKeyForProvider}
          // Pass VFS State needed by Wrapper/Children
          isVfsReady={isVfsReady}
          isVfsEnabledForItem={isVfsEnabledForItem}
          isVfsLoading={isVfsLoading}
          vfsError={vfsError}
          vfsKey={vfsKey}
          // Pass Mod State/Actions needed by Wrapper/Children
          customPromptActions={modState.modPromptActions}
          customMessageActions={modState.modMessageActions}
          getContextSnapshotForMod={getContextSnapshotForMod}
          // Pass Settings State needed by Wrapper/Children

          enableAdvancedSettings={settingsState.enableAdvancedSettings}
          enableApiKeyManagement={providerState.enableApiKeyManagement}
          globalSystemPrompt={settingsState.globalSystemPrompt}
          temperature={settingsState.temperature}
          topP={settingsState.topP}
          maxTokens={settingsState.maxTokens}
          topK={settingsState.topK}
          presencePenalty={settingsState.presencePenalty}
          frequencyPenalty={settingsState.frequencyPenalty}
          enableStreamingMarkdown={settingsState.enableStreamingMarkdown}
          // Pass other necessary actions/data
          sidebarItems={sidebarItems} // Needed for ChatHeader
          searchTerm={settingsState.searchTerm} // Needed for ChatHeader
          setSearchTerm={logic.settingsActions.setSearchTerm} // Use logic.settingsActions
          exportConversation={sidebarActions.exportConversation} // Needed for ChatHeader
          // Pass actions needed by PromptWrapper/PromptForm
          createConversation={sidebarActions.createConversation}
          updateDbProviderConfig={providerActions.updateDbProviderConfig}
          setSelectedProviderId={providerActions.setSelectedProviderId}
          setSelectedModelId={providerActions.setSelectedModelId}
          toggleVfsEnabledAction={sidebarActions.toggleVfsEnabled}
          setTemperature={logic.settingsActions.setTemperature} // Use logic.settingsActions
          setTopP={logic.settingsActions.setTopP} // Use logic.settingsActions
          setMaxTokens={logic.settingsActions.setMaxTokens} // Use logic.settingsActions
          setTopK={logic.settingsActions.setTopK} // Use logic.settingsActions
          setPresencePenalty={logic.settingsActions.setPresencePenalty} // Use logic.settingsActions
          setFrequencyPenalty={logic.settingsActions.setFrequencyPenalty} // Use logic.settingsActions
          updateConversationSystemPrompt={
            sidebarActions.updateConversationSystemPrompt
          }
          setError={logic.coreChatActions.setError} // Use logic.coreChatActions
          // Pass down necessary provider/api key data for PromptForm/Settings
          dbProviderConfigs={providerState.dbProviderConfigs}
          apiKeys={providerState.apiKeys}
          // Pass portal ID down
          // streamingPortalId={streamingPortalId}
        />
      </div>
    </div>
  );
};
