// src/components/lite-chat/chat.tsx
import React, {
  useState,
  useMemo,
  useCallback,
  // Removed useRef, useEffect
} from "react";
import ChatProviderInner from "@/context/chat-provider-inner";
import { ChatSide } from "./chat/chat-side";
import { ChatWrapper } from "./chat/chat-wrapper";
// Import the main logic hook
import { useLiteChatLogic } from "@/hooks/use-lite-chat-logic";
// Import Input Store hook directly
import { useInputStore } from "@/store/input.store";
// Import Core Chat Store hook directly for volatile state
import { useCoreChatStore } from "@/store/core-chat.store";
// Import useChatStorage hook directly for live data
import { useChatStorage } from "@/hooks/use-chat-storage";
import { useShallow } from "zustand/react/shallow"; // Keep for input/core stores

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

// --- Prop Types for Children ---

// Define props for SettingsModal's tabs (passed down through ChatSide)
export interface SettingsModalTabProps {
  // General
  theme: "light" | "dark" | "system";
  setTheme: (theme: "light" | "dark" | "system") => void;
  // Providers
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
  // Assistant
  globalSystemPrompt: string | null;
  setGlobalSystemPrompt: (prompt: string | null) => void;
  // API Keys
  addApiKey: (
    name: string,
    providerId: string,
    value: string,
  ) => Promise<string>;
  deleteApiKey: (id: string) => Promise<void>;
  // Data Management
  importConversation: (file: File, parentId: string | null) => Promise<void>;
  exportAllConversations: () => Promise<void>;
  clearAllData: () => Promise<void>;
  // Mods
  dbMods: DbMod[];
  loadedMods: ModInstance[];
  addDbMod: (modData: Omit<DbMod, "id" | "createdAt">) => Promise<string>;
  updateDbMod: (id: string, changes: Partial<DbMod>) => Promise<void>;
  deleteDbMod: (id: string) => Promise<void>;
  // Flags
  enableAdvancedSettings: boolean;
  enableApiKeyManagement: boolean;
  // Custom Tabs
  customSettingsTabs: CustomSettingTab[];
}

// Renamed FetchStatus locally
type FetchStatus = "idle" | "fetching" | "error" | "success";

// ChatSideProps: Pass raw data
export interface ChatSideProps {
  className?: string;
  dbProjects: DbProject[]; // Pass raw data (stable ref)
  dbConversations: DbConversation[]; // Pass raw data (stable ref)
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
  isSettingsModalOpen: boolean; // Prop for the main modal visibility
  setIsSettingsModalOpen: (isOpen: boolean) => void; // Prop for the main modal setter
  settingsProps: SettingsModalTabProps; // Pass the bundled props object (stable)
}

// ChatWrapperProps: Define props passed directly vs bundled
export interface ChatWrapperDirectProps {
  className?: string;
  // Frequently changing state passed directly
  promptInputValue: string;
  messages: Message[]; // Volatile state now direct
  isStreaming: boolean; // Volatile state now direct
  isLoadingMessages: boolean; // Volatile state now direct
  error: string | null; // Volatile state now direct
  // Stable input actions passed directly
  setPromptInputValue: (value: string) => void;
  addAttachedFile: (file: File) => void; // Add file actions here
  removeAttachedFile: (fileName: string) => void;
  clearPromptInput: () => void;
}
// ChatWrapperBundledProps: Contains only less frequently changing state and stable actions
export interface ChatWrapperBundledProps {
  // Less frequently changing state and stable actions/callbacks
  selectedItemId: string | null;
  selectedItemType: SidebarItemType | null;
  sidebarItems: SidebarItem[]; // Stable ref from useMemo
  attachedFiles: File[]; // Keep here for PromptFiles display if needed, but actions are direct
  selectedVfsPaths: string[];
  isVfsEnabledForItem: boolean;
  regenerateMessage: (messageId: string) => Promise<void>; // Stable callback from hook
  handleSubmitCore: (
    prompt: string,
    files: File[],
    vfsPaths: string[],
    context: any,
  ) => Promise<void>; // Stable callback from hook
  handleImageGenerationCore: (
    currentConversationId: string,
    prompt: string,
  ) => Promise<void>; // Stable callback from hook
  clearSelectedVfsPaths: () => void; // Stable action from hook
  selectedProviderId: string | null;
  selectedModelId: string | null;
  dbProviderConfigs: DbProviderConfig[];
  apiKeys: DbApiKey[];
  enableApiKeyManagement: boolean;
  dbConversations: DbConversation[]; // Pass live conversations (stable ref from hook)
  createConversation: (
    parentId: string | null,
    title?: string,
  ) => Promise<string>; // Stable action from hook
  selectItem: (
    id: string | null,
    type: SidebarItemType | null,
  ) => Promise<void>; // Stable action from hook
  deleteItem: (id: string, type: SidebarItemType) => Promise<void>; // Stable action from hook
  updateDbProviderConfig: (
    id: string,
    changes: Partial<DbProviderConfig>,
  ) => Promise<void>; // Stable action from hook
  searchTerm: string;
  setSearchTerm: (term: string) => void; // Stable action from hook
  exportConversation: (conversationId: string | null) => Promise<void>; // Stable action from hook
  temperature: number;
  setTemperature: (temp: number) => void; // Stable action from hook
  topP: number | null;
  setTopP: (topP: number | null) => void; // Stable action from hook
  maxTokens: number | null;
  setMaxTokens: (tokens: number | null) => void; // Stable action from hook
  topK: number | null;
  setTopK: (topK: number | null) => void; // Stable action from hook
  frequencyPenalty: number | null;
  setFrequencyPenalty: (penalty: number | null) => void; // Stable action from hook
  presencePenalty: number | null;
  setPresencePenalty: (penalty: number | null) => void; // Stable action from hook
  globalSystemPrompt: string | null;
  activeConversationData: DbConversation | null; // Derived from live data (stable ref from hook)
  updateConversationSystemPrompt: (
    id: string,
    systemPrompt: string | null,
  ) => Promise<void>; // Stable action from hook
  isVfsReady: boolean;
  isVfsLoading: boolean;
  vfsError: string | null;
  vfsKey: string | null;
  enableAdvancedSettings: boolean;
  setSelectedProviderId: (id: string | null) => void; // Stable action from hook
  setSelectedModelId: (id: string | null) => void; // Stable action from hook
  toggleVfsEnabledAction: (id: string, type: SidebarItemType) => Promise<void>; // Stable action from hook
  stopStreaming: () => void; // Stable callback from hook
  customPromptActions: CustomPromptAction[];
  getContextSnapshotForMod: () => ReadonlyChatContextSnapshot; // Stable callback from hook
  selectedModel: AiModelConfig | undefined; // Derived state (stable ref from hook)
  setError: (error: string | null) => void; // Stable action from hook
  removeSelectedVfsPath: (path: string) => void; // Stable action from hook
  modMessageActions: CustomMessageAction[];
}
// Combine direct and bundled props for the component's signature
export type ChatWrapperProps = ChatWrapperDirectProps & {
  bundledProps: ChatWrapperBundledProps;
};

// --- LiteChat (Top Level) ---
interface LiteChatProps {
  config?: LiteChatConfig;
  className?: string;
  SideComponent?: ComponentType<ChatSideProps>;
  WrapperComponent?: ComponentType<ChatWrapperProps>;
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

// --- LiteChatInner (Central State Access & Prop Drilling) ---
interface LiteChatInnerProps {
  className?: string;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  enableSidebarConfig: boolean;
  SideComponent: ComponentType<ChatSideProps>;
  WrapperComponent: ComponentType<ChatWrapperProps>;
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
  // --- Get Live Data DIRECTLY from useChatStorage ---
  // These refs should be stable from useLiveQuery unless data changes
  const { projects: dbProjects, conversations: dbConversations } =
    useChatStorage();

  // --- Use the custom hook to get non-volatile logic and state ---
  // Pass live conversations needed for derivations within the hook
  const {
    // State & Actions (excluding input and volatile core state)
    sidebarActions,
    coreChatActions, // Keep actions
    vfsActions,
    providerActions,
    settingsActions,
    modActions,
    // Selection State
    selectedItemId,
    selectedItemType,
    enableSidebar: enableSidebarFromHook,
    // Other store states (excluding volatile core state)
    vfsState,
    providerState,
    settingsState,
    modState,
    // Callbacks
    clearAllData,
    getAllAvailableModelDefs,
    handleFormSubmit,
    handleImageGenerationWrapper,
    stopStreaming,
    regenerateMessage,
    getContextSnapshotForMod,
    // Derived State
    activeConversationData,
    selectedModel,
    getApiKeyForProvider,
  } = useLiteChatLogic({
    editingItemId,
    setEditingItemId,
    onEditComplete,
    dbConversations, // Pass live data to the hook
  });

  // --- Get Input State/Actions DIRECTLY from Input Store ---
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

  // --- Get Volatile Core Chat State DIRECTLY from Core Chat Store ---
  const { messages, isLoadingMessages, isStreaming, error } = useCoreChatStore(
    useShallow((state) => ({
      messages: state.messages,
      isLoadingMessages: state.isLoadingMessages,
      isStreaming: state.isStreaming,
      error: state.error,
    })),
  );

  // --- Derive Sidebar Items HERE using DIRECT live data ---
  // This useMemo depends on the potentially more stable refs from useChatStorage
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
  }, [dbProjects, dbConversations]); // Depend only on direct live data refs

  // --- Derived State (from hook values) ---
  const enableSidebar = enableSidebarFromHook ?? enableSidebarConfig;

  // --- Bundle props for SettingsModal ---
  // This bundle should be stable as its dependencies are stable actions or less volatile state
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
    ],
  );

  // --- Bundle props for WrapperComponent ---
  // This bundle should be stable as volatile state is removed
  // It now depends on the memoized sidebarItems
  const wrapperBundledProps: ChatWrapperBundledProps = useMemo(
    () => ({
      selectedItemId: selectedItemId,
      selectedItemType: selectedItemType,
      sidebarItems, // Use the memoized sidebarItems
      attachedFiles: attachedFiles, // Pass attachedFiles from input store state (stable ref)
      selectedVfsPaths: vfsState.selectedVfsPaths,
      isVfsEnabledForItem: vfsState.isVfsEnabledForItem,
      regenerateMessage, // Stable callback from hook
      handleSubmitCore: handleFormSubmit, // Stable callback from hook
      handleImageGenerationCore: handleImageGenerationWrapper, // Stable callback from hook
      clearSelectedVfsPaths: vfsActions.clearSelectedVfsPaths, // Stable action from hook
      selectedProviderId: providerState.selectedProviderId,
      selectedModelId: providerState.selectedModelId,
      dbProviderConfigs: providerState.dbProviderConfigs,
      apiKeys: providerState.apiKeys,
      enableApiKeyManagement: providerState.enableApiKeyManagement,
      dbConversations: dbConversations, // Pass live conversations (stable ref from storage)
      createConversation: sidebarActions.createConversation, // Stable action from hook
      selectItem: sidebarActions.selectItem, // Stable action from hook
      deleteItem: sidebarActions.deleteItem, // Stable action from hook
      updateDbProviderConfig: providerActions.updateDbProviderConfig, // Stable action from hook
      searchTerm: settingsState.searchTerm,
      setSearchTerm: settingsActions.setSearchTerm, // Stable action from hook
      exportConversation: sidebarActions.exportConversation, // Stable action from hook
      temperature: settingsState.temperature,
      setTemperature: settingsActions.setTemperature, // Stable action from hook
      topP: settingsState.topP,
      setTopP: settingsActions.setTopP, // Stable action from hook
      maxTokens: settingsState.maxTokens,
      setMaxTokens: settingsActions.setMaxTokens, // Stable action from hook
      topK: settingsState.topK,
      setTopK: settingsActions.setTopK, // Stable action from hook
      presencePenalty: settingsState.presencePenalty,
      setPresencePenalty: settingsActions.setPresencePenalty, // Stable action from hook
      frequencyPenalty: settingsState.frequencyPenalty,
      setFrequencyPenalty: settingsActions.setFrequencyPenalty, // Stable action from hook
      globalSystemPrompt: settingsState.globalSystemPrompt,
      activeConversationData, // Derived state (stable ref from hook)
      updateConversationSystemPrompt:
        sidebarActions.updateConversationSystemPrompt, // Stable action from hook
      isVfsReady: vfsState.isVfsReady,
      isVfsLoading: vfsState.isVfsLoading,
      vfsError: vfsState.vfsError,
      vfsKey: vfsState.vfsKey,
      enableAdvancedSettings: settingsState.enableAdvancedSettings,
      setSelectedProviderId: providerActions.setSelectedProviderId, // Stable action from hook
      setSelectedModelId: providerActions.setSelectedModelId, // Stable action from hook
      toggleVfsEnabledAction: sidebarActions.toggleVfsEnabled, // Stable action from hook
      stopStreaming, // Stable callback from hook
      customPromptActions: modState.modPromptActions,
      getContextSnapshotForMod, // Stable callback from hook
      selectedModel, // Derived state (stable ref from hook)
      setError: coreChatActions.setError, // Stable action from hook
      removeSelectedVfsPath: vfsActions.removeSelectedVfsPath, // Stable action from hook
      modMessageActions: modState.modMessageActions,
    }),
    [
      // Dependencies are now stable refs or less volatile state
      selectedItemId,
      selectedItemType,
      sidebarItems, // Depend on memoized items
      attachedFiles,
      vfsState.selectedVfsPaths,
      vfsState.isVfsEnabledForItem,
      regenerateMessage,
      handleFormSubmit,
      handleImageGenerationWrapper,
      vfsActions.clearSelectedVfsPaths,
      providerState.selectedProviderId,
      providerState.selectedModelId,
      providerState.dbProviderConfigs,
      providerState.apiKeys,
      providerState.enableApiKeyManagement,
      dbConversations, // Depend on direct live data ref
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
      vfsState.isVfsReady,
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

  // --- Bundle props for SideComponent ---
  // This bundle should be stable as its dependencies are stable actions or less volatile state/data
  const sideProps: ChatSideProps = useMemo(
    () => ({
      className: cn("w-72 flex-shrink-0", "hidden md:flex"),
      // Pass direct live data refs to ChatSide
      dbProjects: dbProjects,
      dbConversations: dbConversations,
      editingItemId,
      selectedItemId: selectedItemId,
      selectedItemType: selectedItemType,
      isSettingsModalOpen: settingsState.isSettingsModalOpen,
      setIsSettingsModalOpen: settingsActions.setIsSettingsModalOpen, // Stable action
      settingsProps, // Memoized bundle (stable)
      onEditComplete, // Stable callback from parent
      setEditingItemId, // Stable callback from parent
      selectItem: sidebarActions.selectItem, // Stable action
      deleteItem: sidebarActions.deleteItem, // Stable action
      renameItem: sidebarActions.renameItem, // Stable action
      exportConversation: sidebarActions.exportConversation, // Stable action
      createConversation: sidebarActions.createConversation, // Stable action
      createProject: sidebarActions.createProject, // Stable action
      importConversation: sidebarActions.importConversation, // Stable action
    }),
    [
      // Depend on direct live data refs and stable state/actions
      dbProjects,
      dbConversations,
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
        "flex h-full w-full overflow-hidden bg-gray-900 border border-gray-700 rounded-lg shadow-sm",
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
              "absolute top-3 left-3 z-10 text-gray-400 hover:text-white hover:bg-gray-700 md:hidden",
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
        {/* Pass frequently changing props directly, others bundled */}
        <WrapperComponent
          className="h-full" // Pass className directly if needed
          // Direct Input State/Actions
          promptInputValue={promptInputValue}
          setPromptInputValue={setPromptInputValue}
          addAttachedFile={addAttachedFile}
          removeAttachedFile={removeAttachedFile}
          clearPromptInput={clearPromptInput}
          // Direct Core Chat State (Volatile)
          messages={messages}
          isStreaming={isStreaming}
          isLoadingMessages={isLoadingMessages}
          error={error}
          // Bundled Props (Stable)
          bundledProps={wrapperBundledProps} // Pass the memoized bundle
        />
      </div>
    </div>
  );
};
