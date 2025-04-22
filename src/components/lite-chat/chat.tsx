// src/components/lite-chat/chat.tsx
import React, { useState, useMemo, useCallback } from "react";
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
  // DbProviderConfig, // Removed unused import
  // DbApiKey, // Removed unused import
  // CustomSettingTab, // Removed unused import
  // DbMod, // Removed unused import
  // ModInstance, // Removed unused import
  DbProviderConfig as ProviderConfigType, // Keep for SettingsModalTabProps
  DbApiKey as ApiKeyType, // Keep for SettingsModalTabProps
  CustomSettingTab as SettingTabType, // Keep for SettingsModalTabProps
  DbMod as ModType, // Keep for SettingsModalTabProps
  ModInstance as ModInstanceType, // Keep for SettingsModalTabProps
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { MenuIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ComponentType } from "react";

// Define the bundled props type here
export interface SettingsModalTabProps {
  theme: "light" | "dark" | "system";
  setTheme: (theme: "light" | "dark" | "system") => void;
  dbProviderConfigs: ProviderConfigType[];
  apiKeys: ApiKeyType[];
  addDbProviderConfig: (
    config: Omit<ProviderConfigType, "id" | "createdAt" | "updatedAt">,
  ) => Promise<string>;
  updateDbProviderConfig: (
    id: string,
    changes: Partial<ProviderConfigType>,
  ) => Promise<void>;
  deleteDbProviderConfig: (id: string) => Promise<void>;
  fetchModels: (providerConfigId: string) => Promise<void>;
  providerFetchStatus: Record<
    string,
    "idle" | "fetching" | "error" | "success"
  >;
  getAllAvailableModelDefs: (
    providerConfigId: string,
  ) => { id: string; name: string }[];
  globalSystemPrompt: string | null;
  setGlobalSystemPrompt: (prompt: string | null) => void;
  addApiKey: (
    name: string,
    providerId: string,
    value: string,
  ) => Promise<string>;
  deleteApiKey: (id: string) => Promise<void>;
  importConversation: (file: File, parentId: string | null) => Promise<void>;
  exportAllConversations: () => Promise<void>;
  clearAllData: () => Promise<void>;
  dbMods: ModType[];
  loadedMods: ModInstanceType[];
  addDbMod: (modData: Omit<ModType, "id" | "createdAt">) => Promise<string>;
  updateDbMod: (id: string, changes: Partial<ModType>) => Promise<void>;
  deleteDbMod: (id: string) => Promise<void>;
  enableAdvancedSettings: boolean;
  enableApiKeyManagement: boolean;
  customSettingsTabs: SettingTabType[];
  streamingRefreshRateMs: number;
  setStreamingRefreshRateMs: (rate: number) => void;
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
  });

  // Destructure all necessary parts from the logic hook return value
  const {
    // Input State/Actions
    promptInputValue,
    setPromptInputValue,
    attachedFiles,
    addAttachedFile,
    removeAttachedFile,
    clearAttachedFiles,
    selectedVfsPaths,
    // addSelectedVfsPath, // Not directly used here
    removeSelectedVfsPath,
    clearSelectedVfsPaths,
    clearAllInput, // Destructure the correct function name
    // Store State/Actions
    sidebarActions,
    coreChatActions,
    // vfsActions, // Not directly used here
    providerActions,
    settingsActions,
    modActions,
    // Selection State
    selectedItemId,
    selectedItemType,
    enableSidebar: enableSidebarFromHook,
    // Other Store States
    // vfsState, // Pass specific parts below
    providerState,
    settingsState,
    modState,
    // Callbacks & Derived Data
    clearAllData,
    getAllAvailableModelDefs,
    handleFormSubmit,
    // handleImageGenerationWrapper, // Removed unused variable
    stopStreaming,
    regenerateMessage,
    getContextSnapshotForMod,
    activeConversationData,
    selectedModel,
    selectedProvider,
    getApiKeyForProvider,
  } = logic;

  // Select volatile state directly from stores
  const { messages, isLoadingMessages, isStreaming, error } = useCoreChatStore(
    useShallow((state) => ({
      messages: state.messages,
      isLoadingMessages: state.isLoadingMessages,
      isStreaming: state.isStreaming,
      error: state.error,
    })),
  );

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

  // Derive sidebarItems using live data
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

  // Prepare props for Settings Modal
  const settingsModalProps: SettingsModalTabProps = useMemo(
    () => ({
      theme: settingsState.theme,
      setTheme: settingsActions.setTheme,
      dbProviderConfigs: providerState.dbProviderConfigs,
      apiKeys: providerState.apiKeys,
      addDbProviderConfig: providerActions.addDbProviderConfig,
      updateDbProviderConfig: providerActions.updateDbProviderConfig,
      deleteDbProviderConfig: providerActions.deleteDbProviderConfig,
      fetchModels: providerActions.fetchModels,
      providerFetchStatus: providerState.providerFetchStatus,
      getAllAvailableModelDefs,
      globalSystemPrompt: settingsState.globalSystemPrompt,
      setGlobalSystemPrompt: settingsActions.setGlobalSystemPrompt,
      addApiKey: providerActions.addApiKey,
      deleteApiKey: providerActions.deleteApiKey,
      importConversation: sidebarActions.importConversation,
      exportAllConversations: sidebarActions.exportAllConversations,
      clearAllData,
      dbMods: modState.dbMods,
      loadedMods: modState.loadedMods,
      addDbMod: modActions.addDbMod,
      updateDbMod: modActions.updateDbMod,
      deleteDbMod: modActions.deleteDbMod,
      enableAdvancedSettings: settingsState.enableAdvancedSettings,
      enableApiKeyManagement: providerState.enableApiKeyManagement,
      customSettingsTabs: modState.modSettingsTabs,
      streamingRefreshRateMs: settingsState.streamingRefreshRateMs,
      setStreamingRefreshRateMs: settingsActions.setStreamingRefreshRateMs,
    }),
    [
      settingsState.theme,
      settingsActions.setTheme,
      providerState.dbProviderConfigs,
      providerState.apiKeys,
      providerActions.addDbProviderConfig,
      providerActions.updateDbProviderConfig,
      providerActions.deleteDbProviderConfig,
      providerActions.fetchModels,
      providerState.providerFetchStatus,
      getAllAvailableModelDefs,
      settingsState.globalSystemPrompt,
      settingsActions.setGlobalSystemPrompt,
      providerActions.addApiKey,
      providerActions.deleteApiKey,
      sidebarActions.importConversation,
      sidebarActions.exportAllConversations,
      clearAllData,
      modState.dbMods,
      modState.loadedMods,
      modActions.addDbMod,
      modActions.updateDbMod,
      modActions.deleteDbMod,
      settingsState.enableAdvancedSettings,
      providerState.enableApiKeyManagement,
      modState.modSettingsTabs,
      settingsState.streamingRefreshRateMs,
      settingsActions.setStreamingRefreshRateMs,
    ],
  );

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
          settingsProps={settingsModalProps}
          onEditComplete={onEditComplete}
          setEditingItemId={setEditingItemId}
          selectItem={sidebarActions.selectItem}
          deleteItem={sidebarActions.deleteItem}
          renameItem={sidebarActions.renameItem}
          exportConversation={sidebarActions.exportConversation}
          createConversation={sidebarActions.createConversation}
          createProject={sidebarActions.createProject}
          importConversation={sidebarActions.importConversation}
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
          // Pass all necessary props explicitly
          // Volatile State
          messages={messages}
          isStreaming={isStreaming}
          isLoadingMessages={isLoadingMessages}
          error={error}
          isVfsReady={isVfsReady}
          isVfsEnabledForItem={isVfsEnabledForItem}
          // Input State/Actions (from InputStore via logic hook)
          promptInputValue={promptInputValue}
          setPromptInputValue={setPromptInputValue}
          addAttachedFile={addAttachedFile}
          removeAttachedFile={removeAttachedFile}
          clearAttachedFiles={clearAttachedFiles}
          clearPromptInput={clearAllInput} // Pass the correct function
          attachedFiles={attachedFiles}
          selectedVfsPaths={selectedVfsPaths}
          removeSelectedVfsPath={removeSelectedVfsPath}
          clearSelectedVfsPaths={clearSelectedVfsPaths}
          // Selection State
          selectedItemId={selectedItemId}
          selectedItemType={selectedItemType}
          // Core Actions
          regenerateMessage={regenerateMessage}
          stopStreaming={stopStreaming}
          setError={coreChatActions.setError}
          // Form Submission Wrapper (from logic hook)
          handleFormSubmit={handleFormSubmit}
          // handleImageGenerationWrapper={handleImageGenerationWrapper} // Removed
          // Provider/Model State & Actions
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
          // Settings State & Actions
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
          // VFS State & Actions
          isVfsLoading={isVfsLoading}
          vfsError={vfsError}
          vfsKey={vfsKey}
          toggleVfsEnabledAction={sidebarActions.toggleVfsEnabled}
          // Conversation/Item State & Actions
          activeConversationData={activeConversationData}
          updateConversationSystemPrompt={
            sidebarActions.updateConversationSystemPrompt
          }
          createConversation={sidebarActions.createConversation}
          // Mod/Extensibility Props
          customPromptActions={modState.modPromptActions}
          customMessageActions={modState.modMessageActions}
          getContextSnapshotForMod={getContextSnapshotForMod}
          // Pass core actions needed by PromptForm (via PromptWrapper)
          // handleSubmitCore={coreChatActions.handleSubmitCore} // Removed
          // handleImageGenerationCore={coreChatActions.handleImageGenerationCore} // Removed
          // startWorkflowCore={coreChatActions.startWorkflowCore} // Removed
          // Pass props needed by ChatHeader
          sidebarItems={sidebarItems}
          searchTerm={settingsState.searchTerm}
          setSearchTerm={settingsActions.setSearchTerm}
          exportConversation={sidebarActions.exportConversation}
        />
      </div>
    </div>
  );
};
