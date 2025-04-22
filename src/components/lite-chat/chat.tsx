// src/components/lite-chat/chat.tsx
import React, { useState, useMemo, useCallback } from "react";
import ChatProviderInner from "@/context/chat-provider-inner";
import { ChatSide } from "./chat/chat-side";
import { ChatWrapper } from "./chat/chat-wrapper";
import { useLiteChatLogic } from "@/hooks/use-lite-chat-logic";
import { useInputStore } from "@/store/input.store";
import { useCoreChatStore } from "@/store/core-chat.store";
import { useChatStorage } from "@/hooks/use-chat-storage";
import { useShallow } from "zustand/react/shallow";
import { useVfsStore } from "@/store/vfs.store"; // Import VFS store

import type {
  SidebarItemType,
  LiteChatConfig,
  SidebarItem,
  DbProject,
  DbConversation,
  Message,
  DbProviderConfig,
  DbApiKey,
  CustomSettingTab,
  AiModelConfig,
  CustomPromptAction,
  CustomMessageAction,
  DbMod,
  ModInstance,
  ReadonlyChatContextSnapshot,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { MenuIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ComponentType } from "react";

export interface SettingsModalTabProps {
  theme: "light" | "dark" | "system";
  setTheme: (theme: "light" | "dark" | "system") => void;
  dbProviderConfigs: DbProviderConfig[];
  apiKeys: DbApiKey[];
  addDbProviderConfig: (
    config: Omit<DbProviderConfig, "id" | "createdAt" | "updatedAt">,
  ) => Promise<string>;
  updateDbProviderConfig: (
    id: string,
    changes: Partial<DbProviderConfig>,
  ) => Promise<void>;
  deleteDbProviderConfig: (id: string) => Promise<void>;
  fetchModels: (providerConfigId: string) => Promise<void>;
  providerFetchStatus: Record<string, FetchStatus>;
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
  dbMods: DbMod[];
  loadedMods: ModInstance[];
  addDbMod: (modData: Omit<DbMod, "id" | "createdAt">) => Promise<string>;
  updateDbMod: (id: string, changes: Partial<DbMod>) => Promise<void>;
  deleteDbMod: (id: string) => Promise<void>;
  enableAdvancedSettings: boolean;
  enableApiKeyManagement: boolean;
  customSettingsTabs: CustomSettingTab[];
  streamingRefreshRateMs: number;
  setStreamingRefreshRateMs: (rate: number) => void;
}

type FetchStatus = "idle" | "fetching" | "error" | "success";

export interface ChatSideProps {
  className?: string;
  dbProjects: DbProject[];
  dbConversations: DbConversation[];
  editingItemId: string | null;
  selectedItemId: string | null;
  selectedItemType: SidebarItemType | null;
  onEditComplete: (id: string) => void;
  setEditingItemId: (id: string | null) => void;
  selectItem: (
    id: string | null,
    type: SidebarItemType | null,
  ) => Promise<void>;
  deleteItem: (id: string, type: SidebarItemType) => Promise<void>;
  renameItem: (
    id: string,
    newName: string,
    type: SidebarItemType,
  ) => Promise<void>;
  exportConversation: (conversationId: string | null) => Promise<void>;
  createConversation: (
    parentId: string | null,
    title?: string,
  ) => Promise<string>;
  createProject: (
    parentId: string | null,
    name?: string,
  ) => Promise<{ id: string; name: string }>;
  importConversation: (file: File, parentId: string | null) => Promise<void>;
  isSettingsModalOpen: boolean;
  setIsSettingsModalOpen: (isOpen: boolean) => void;
  settingsProps: SettingsModalTabProps;
}

// --- MODIFICATION START: Define ChatWrapperDirectProps explicitly ---
export interface ChatWrapperDirectProps {
  className?: string;
  // Volatile state passed directly
  promptInputValue: string;
  messages: Message[];
  isStreaming: boolean;
  isLoadingMessages: boolean;
  error: string | null;
  isVfsReady: boolean; // Add VFS state here
  isVfsEnabledForItem: boolean; // Add VFS state here
  // Input actions passed directly
  setPromptInputValue: (value: string) => void;
  addAttachedFile: (file: File) => void;
  removeAttachedFile: (fileName: string) => void;
  clearPromptInput: () => void;
}
// --- MODIFICATION END ---

// --- MODIFICATION START: Adjust ChatWrapperBundledProps ---
// Remove props that are now passed directly in ChatWrapperDirectProps
export interface ChatWrapperBundledProps {
  selectedItemId: string | null;
  selectedItemType: SidebarItemType | null;
  sidebarItems: SidebarItem[];
  attachedFiles: File[];
  selectedVfsPaths: string[];
  // isVfsEnabledForItem: boolean; // REMOVED - Passed directly
  regenerateMessage: (messageId: string) => Promise<void>;
  handleSubmitCore: (
    prompt: string,
    files: File[],
    vfsPaths: string[],
    context: any,
  ) => Promise<void>;
  handleImageGenerationCore: (
    currentConversationId: string,
    prompt: string,
  ) => Promise<void>;
  clearSelectedVfsPaths: () => void;
  selectedProviderId: string | null;
  selectedModelId: string | null;
  dbProviderConfigs: DbProviderConfig[];
  apiKeys: DbApiKey[];
  enableApiKeyManagement: boolean;
  dbConversations: DbConversation[];
  createConversation: (
    parentId: string | null,
    title?: string,
  ) => Promise<string>;
  selectItem: (
    id: string | null,
    type: SidebarItemType | null,
  ) => Promise<void>;
  deleteItem: (id: string, type: SidebarItemType) => Promise<void>;
  updateDbProviderConfig: (
    id: string,
    changes: Partial<DbProviderConfig>,
  ) => Promise<void>;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  exportConversation: (conversationId: string | null) => Promise<void>;
  temperature: number;
  setTemperature: (temp: number) => void;
  topP: number | null;
  setTopP: (topP: number | null) => void;
  maxTokens: number | null;
  setMaxTokens: (tokens: number | null) => void;
  topK: number | null;
  setTopK: (topK: number | null) => void;
  frequencyPenalty: number | null;
  setFrequencyPenalty: (penalty: number | null) => void;
  presencePenalty: number | null;
  setPresencePenalty: (penalty: number | null) => void;
  globalSystemPrompt: string | null;
  activeConversationData: DbConversation | null;
  updateConversationSystemPrompt: (
    id: string,
    systemPrompt: string | null,
  ) => Promise<void>;
  // isVfsReady: boolean; // REMOVED - Passed directly
  isVfsLoading: boolean;
  vfsError: string | null;
  vfsKey: string | null;
  enableAdvancedSettings: boolean;
  setSelectedProviderId: (id: string | null) => void;
  setSelectedModelId: (id: string | null) => void;
  toggleVfsEnabledAction: (id: string, type: SidebarItemType) => Promise<void>;
  stopStreaming: () => void;
  customPromptActions: CustomPromptAction[];
  getContextSnapshotForMod: () => ReadonlyChatContextSnapshot;
  selectedModel: AiModelConfig | undefined;
  setError: (error: string | null) => void;
  removeSelectedVfsPath: (path: string) => void;
  modMessageActions: CustomMessageAction[];
}
// --- MODIFICATION END ---

// --- MODIFICATION START: Update ChatWrapperProps type ---
export type ChatWrapperProps = ChatWrapperDirectProps & {
  bundledProps: ChatWrapperBundledProps;
};
// --- MODIFICATION END ---

interface LiteChatProps {
  config?: LiteChatConfig;
  className?: string;
  SideComponent?: ComponentType<ChatSideProps>;
  WrapperComponent?: ComponentType<ChatWrapperProps>; // Use updated type
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
  SideComponent: ComponentType<ChatSideProps>;
  WrapperComponent: ComponentType<ChatWrapperProps>; // Use updated type
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
  // Use live data hook
  const { projects: dbProjects, conversations: dbConversations } =
    useChatStorage();

  // Use logic hook, passing live data
  const {
    sidebarActions,
    coreChatActions,
    vfsActions,
    providerActions,
    settingsActions,
    modActions,
    selectedItemId,
    selectedItemType,
    enableSidebar: enableSidebarFromHook,
    vfsState, // Keep vfsState for bundled props
    providerState,
    settingsState,
    modState,
    clearAllData,
    getAllAvailableModelDefs,
    handleFormSubmit,
    handleImageGenerationWrapper,
    stopStreaming,
    regenerateMessage,
    getContextSnapshotForMod,
    activeConversationData,
    selectedModel,
  } = useLiteChatLogic({
    editingItemId,
    setEditingItemId,
    onEditComplete,
    dbConversations, // Pass live data here
  });

  // --- MODIFICATION START: Select volatile state directly ---
  const {
    promptInputValue,
    attachedFiles,
    setPromptInputValue,
    addAttachedFile,
    removeAttachedFile,
    clearPromptInput,
  } = useInputStore(
    useShallow((state) => ({
      promptInputValue: state.promptInputValue,
      attachedFiles: state.attachedFiles,
      setPromptInputValue: state.setPromptInputValue,
      addAttachedFile: state.addAttachedFile,
      removeAttachedFile: state.removeAttachedFile,
      clearPromptInput: state.clearPromptInput,
    })),
  );

  const { messages, isLoadingMessages, isStreaming, error } = useCoreChatStore(
    useShallow((state) => ({
      messages: state.messages,
      isLoadingMessages: state.isLoadingMessages,
      isStreaming: state.isStreaming,
      error: state.error,
    })),
  );

  // Select VFS state needed directly by ChatWrapper
  const { isVfsReady, isVfsEnabledForItem } = useVfsStore(
    useShallow((state) => ({
      isVfsReady: state.isVfsReady,
      isVfsEnabledForItem: state.isVfsEnabledForItem,
    })),
  );
  // --- MODIFICATION END ---

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

  // Settings props bundle (remains mostly the same)
  const settingsProps: SettingsModalTabProps = useMemo(
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

  // --- MODIFICATION START: Update wrapperBundledProps ---
  // Remove props that are now passed directly
  const wrapperBundledProps: ChatWrapperBundledProps = useMemo(
    () => ({
      selectedItemId: selectedItemId,
      selectedItemType: selectedItemType,
      sidebarItems,
      attachedFiles: attachedFiles, // Keep attachedFiles here as it's less volatile than promptInputValue
      selectedVfsPaths: vfsState.selectedVfsPaths,
      // isVfsEnabledForItem: vfsState.isVfsEnabledForItem, // REMOVED
      regenerateMessage,
      handleSubmitCore: handleFormSubmit,
      handleImageGenerationCore: handleImageGenerationWrapper,
      clearSelectedVfsPaths: vfsActions.clearSelectedVfsPaths,
      selectedProviderId: providerState.selectedProviderId,
      selectedModelId: providerState.selectedModelId,
      dbProviderConfigs: providerState.dbProviderConfigs,
      apiKeys: providerState.apiKeys,
      enableApiKeyManagement: providerState.enableApiKeyManagement,
      dbConversations: dbConversations, // Pass live data
      createConversation: sidebarActions.createConversation,
      selectItem: sidebarActions.selectItem,
      deleteItem: sidebarActions.deleteItem,
      updateDbProviderConfig: providerActions.updateDbProviderConfig,
      searchTerm: settingsState.searchTerm,
      setSearchTerm: settingsActions.setSearchTerm,
      exportConversation: sidebarActions.exportConversation,
      temperature: settingsState.temperature,
      setTemperature: settingsActions.setTemperature,
      topP: settingsState.topP,
      setTopP: settingsActions.setTopP,
      maxTokens: settingsState.maxTokens,
      setMaxTokens: settingsActions.setMaxTokens,
      topK: settingsState.topK,
      setTopK: settingsActions.setTopK,
      presencePenalty: settingsState.presencePenalty,
      setPresencePenalty: settingsActions.setPresencePenalty,
      frequencyPenalty: settingsState.frequencyPenalty,
      setFrequencyPenalty: settingsActions.setFrequencyPenalty,
      globalSystemPrompt: settingsState.globalSystemPrompt,
      activeConversationData,
      updateConversationSystemPrompt:
        sidebarActions.updateConversationSystemPrompt,
      // isVfsReady: vfsState.isVfsReady, // REMOVED
      isVfsLoading: vfsState.isVfsLoading,
      vfsError: vfsState.vfsError,
      vfsKey: vfsState.vfsKey,
      enableAdvancedSettings: settingsState.enableAdvancedSettings,
      setSelectedProviderId: providerActions.setSelectedProviderId,
      setSelectedModelId: providerActions.setSelectedModelId,
      toggleVfsEnabledAction: sidebarActions.toggleVfsEnabled,
      stopStreaming,
      customPromptActions: modState.modPromptActions,
      getContextSnapshotForMod,
      selectedModel,
      setError: coreChatActions.setError,
      removeSelectedVfsPath: vfsActions.removeSelectedVfsPath,
      modMessageActions: modState.modMessageActions,
    }),
    [
      selectedItemId,
      selectedItemType,
      sidebarItems,
      attachedFiles,
      vfsState.selectedVfsPaths,
      // vfsState.isVfsEnabledForItem, // REMOVED
      regenerateMessage,
      handleFormSubmit,
      handleImageGenerationWrapper,
      vfsActions.clearSelectedVfsPaths,
      providerState.selectedProviderId,
      providerState.selectedModelId,
      providerState.dbProviderConfigs,
      providerState.apiKeys,
      providerState.enableApiKeyManagement,
      dbConversations, // Depend on live data
      sidebarActions.createConversation,
      sidebarActions.selectItem,
      sidebarActions.deleteItem,
      providerActions.updateDbProviderConfig,
      settingsState.searchTerm,
      settingsActions.setSearchTerm,
      sidebarActions.exportConversation,
      settingsState.temperature,
      settingsActions.setTemperature,
      settingsState.topP,
      settingsActions.setTopP,
      settingsState.maxTokens,
      settingsActions.setMaxTokens,
      settingsState.topK,
      settingsActions.setTopK,
      settingsState.presencePenalty,
      settingsActions.setPresencePenalty,
      settingsState.frequencyPenalty,
      settingsActions.setFrequencyPenalty,
      settingsState.globalSystemPrompt,
      activeConversationData,
      sidebarActions.updateConversationSystemPrompt,
      // vfsState.isVfsReady, // REMOVED
      vfsState.isVfsLoading,
      vfsState.vfsError,
      vfsState.vfsKey,
      settingsState.enableAdvancedSettings,
      providerActions.setSelectedProviderId,
      providerActions.setSelectedModelId,
      sidebarActions.toggleVfsEnabled,
      stopStreaming,
      modState.modPromptActions,
      getContextSnapshotForMod,
      selectedModel,
      coreChatActions.setError,
      vfsActions.removeSelectedVfsPath,
      modState.modMessageActions,
    ],
  );
  // --- MODIFICATION END ---

  // Side props bundle (remains the same)
  const sideProps: ChatSideProps = useMemo(
    () => ({
      className: cn("w-72 flex-shrink-0", "hidden md:flex"),
      dbProjects: dbProjects, // Pass live data
      dbConversations: dbConversations, // Pass live data
      editingItemId,
      selectedItemId: selectedItemId,
      selectedItemType: selectedItemType,
      isSettingsModalOpen: settingsState.isSettingsModalOpen,
      setIsSettingsModalOpen: settingsActions.setIsSettingsModalOpen,
      settingsProps,
      onEditComplete,
      setEditingItemId,
      selectItem: sidebarActions.selectItem,
      deleteItem: sidebarActions.deleteItem,
      renameItem: sidebarActions.renameItem,
      exportConversation: sidebarActions.exportConversation,
      createConversation: sidebarActions.createConversation,
      createProject: sidebarActions.createProject,
      importConversation: sidebarActions.importConversation,
    }),
    [
      dbProjects, // Depend on live data
      dbConversations, // Depend on live data
      editingItemId,
      selectedItemId,
      selectedItemType,
      settingsState.isSettingsModalOpen,
      settingsActions.setIsSettingsModalOpen,
      settingsProps,
      onEditComplete,
      setEditingItemId,
      sidebarActions.selectItem,
      sidebarActions.deleteItem,
      sidebarActions.renameItem,
      sidebarActions.exportConversation,
      sidebarActions.createConversation,
      sidebarActions.createProject,
      sidebarActions.importConversation,
    ],
  );

  return (
    <div
      className={cn(
        "flex h-full w-full overflow-hidden bg-background border border-border rounded-lg shadow-sm",
        className,
      )}
    >
      {enableSidebar && sidebarOpen && <SideComponent {...sideProps} />}

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
        {/* --- MODIFICATION START: Pass direct props --- */}
        <WrapperComponent
          className="h-full"
          // Pass direct props explicitly
          promptInputValue={promptInputValue}
          setPromptInputValue={setPromptInputValue}
          addAttachedFile={addAttachedFile}
          removeAttachedFile={removeAttachedFile}
          clearPromptInput={clearPromptInput}
          messages={messages}
          isStreaming={isStreaming}
          isLoadingMessages={isLoadingMessages}
          error={error}
          isVfsReady={isVfsReady}
          isVfsEnabledForItem={isVfsEnabledForItem}
          // Pass the bundled props object
          bundledProps={wrapperBundledProps}
        />
        {/* --- MODIFICATION END --- */}
      </div>
    </div>
  );
};
