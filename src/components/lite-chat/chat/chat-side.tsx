// src/components/lite-chat/chat/chat-side.tsx
import React, {
  useRef,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import { ChatHistory } from "./chat-history";
import { SettingsModal } from "@/components/lite-chat/settings/settings-modal";
import { Button } from "@/components/ui/button";
import {
  SettingsIcon,
  PlusIcon,
  FolderPlusIcon,
  ImportIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type {
  DbConversation,
  SidebarItem,
  DbProject,
  ProjectSidebarItem,
  ConversationSidebarItem,
  SidebarItemType,
  DbProviderConfig,
  DbApiKey,
  CustomSettingTab,
  DbMod,
  ModInstance,
} from "@/lib/types";

export interface ChatSideProps {
  className?: string;
  dbProjects: DbProject[];
  dbConversations: DbConversation[];
  editingItemId: string | null;
  selectedItemId: string | null;
  selectedItemType: SidebarItemType | null;
  isSettingsModalOpen: boolean;
  setIsSettingsModalOpen: (isOpen: boolean) => void;
  theme: "light" | "dark" | "system";
  setTheme: (theme: "light" | "dark" | "system") => void;
  streamingRefreshRateMs: number;
  setStreamingRefreshRateMs: (rate: number) => void;
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
  dbMods: DbMod[];
  loadedMods: ModInstance[];
  addDbMod: (modData: Omit<DbMod, "id" | "createdAt">) => Promise<string>;
  updateDbMod: (id: string, changes: Partial<DbMod>) => Promise<void>;
  deleteDbMod: (id: string) => Promise<void>;
  enableAdvancedSettings: boolean;
  enableApiKeyManagement: boolean;
  customSettingsTabs: CustomSettingTab[];
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
}

const ChatSideComponent: React.FC<ChatSideProps> = ({
  className,
  dbProjects,
  dbConversations,
  editingItemId,
  selectedItemId,
  selectedItemType,
  onEditComplete,
  setEditingItemId,
  selectItem,
  deleteItem,
  renameItem,
  exportConversation,
  createConversation,
  createProject,
  importConversation,
  isSettingsModalOpen,
  setIsSettingsModalOpen,
  theme,
  setTheme,
  streamingRefreshRateMs,
  setStreamingRefreshRateMs,
  dbProviderConfigs,
  apiKeys,
  addDbProviderConfig,
  updateDbProviderConfig,
  deleteDbProviderConfig,
  fetchModels,
  providerFetchStatus,
  getAllAvailableModelDefs,
  globalSystemPrompt,
  setGlobalSystemPrompt,
  addApiKey,
  deleteApiKey,
  exportAllConversations,
  clearAllData,
  dbMods,
  loadedMods,
  addDbMod,
  updateDbMod,
  deleteDbMod,
  enableAdvancedSettings,
  enableApiKeyManagement,
  customSettingsTabs,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parentIdForNewItem, setParentIdForNewItem] = useState<string | null>(
    null,
  );
  // Removed unused renameValue state

  const sidebarItems = useMemo<SidebarItem[]>(() => {
    const allProjects: DbProject[] = dbProjects || [];
    const allConversations: DbConversation[] = dbConversations || [];
    const combinedItems: SidebarItem[] = [
      ...allProjects.map(
        (p): ProjectSidebarItem => ({ ...p, type: "project" }),
      ),
      ...allConversations.map(
        (c): ConversationSidebarItem => ({ ...c, type: "conversation" }),
      ),
    ];
    combinedItems.sort(
      (a, b) => (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0),
    );
    return combinedItems;
  }, [dbProjects, dbConversations]);

  useEffect(() => {
    let determinedParentId: string | null = null;
    if (selectedItemType === "project") {
      determinedParentId = selectedItemId;
    } else if (selectedItemType === "conversation" && selectedItemId) {
      const convo = dbConversations.find((item) => item.id === selectedItemId);
      determinedParentId = convo?.parentId ?? null;
    } else {
      determinedParentId = null;
    }
    setParentIdForNewItem((prev) => {
      if (prev !== determinedParentId) {
        return determinedParentId;
      }
      return prev;
    });
  }, [selectedItemId, selectedItemType, dbConversations]);

  const handleCreateChat = useCallback(async () => {
    await createConversation(parentIdForNewItem);
  }, [createConversation, parentIdForNewItem]);

  const handleCreateProject = useCallback(async () => {
    try {
      const { id: newProjectId } = await createProject(parentIdForNewItem);
      setEditingItemId(newProjectId);
    } catch (error) {
      console.error("Failed to create project:", error);
      toast.error("Failed to create project.");
    }
  }, [createProject, parentIdForNewItem, setEditingItemId]);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      importConversation(file, null);
    }
    if (event.target) {
      event.target.value = "";
    }
  };

  const handleOpenSettingsModal = useCallback(() => {
    setIsSettingsModalOpen(true);
  }, [setIsSettingsModalOpen]);

  // Removed unused handleCancelRename function

  const startRename = (id: string) => {
    setEditingItemId(id);
    // Removed setting renameValue as it's unused
  };

  return (
    <aside
      className={cn(
        "h-full flex flex-col bg-card border-r border-border",
        className,
      )}
    >
      <div className="p-3 border-b border-border flex gap-2">
        <Button
          variant="outline"
          className="flex-1 justify-center gap-2 border-border text-card-foreground hover:bg-muted hover:text-foreground h-9 transition-colors"
          onClick={handleCreateChat}
          title="New Chat"
        >
          <PlusIcon className="h-4 w-4" />
          <span>Chat</span>
        </Button>
        <Button
          variant="outline"
          className="flex-1 justify-center gap-2 border-border text-card-foreground hover:bg-muted hover:text-foreground h-9 transition-colors"
          onClick={handleCreateProject}
          title="New Project"
        >
          <FolderPlusIcon className="h-4 w-4" />
          <span>Project</span>
        </Button>
      </div>

      <div className="flex-grow overflow-hidden flex flex-col">
        <ChatHistory
          className="flex-grow"
          sidebarItems={sidebarItems}
          editingItemId={editingItemId}
          selectedItemId={selectedItemId}
          onEditComplete={onEditComplete}
          selectItem={selectItem}
          deleteItem={deleteItem}
          renameItem={renameItem}
          exportConversation={exportConversation}
          startRename={startRename}
        />
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".json"
        style={{ display: "none" }}
      />

      <div className="border-t border-border p-3 space-y-2 bg-card">
        <Button
          variant="outline"
          className="w-full justify-start gap-2 text-sm h-9 border-border text-card-foreground hover:bg-muted hover:text-foreground transition-colors"
          onClick={handleImportClick}
        >
          <ImportIcon className="h-4 w-4" />
          Import Chat (.json)
        </Button>

        <Button
          variant="outline"
          className="w-full justify-start gap-2 text-sm h-9 border-border text-card-foreground hover:bg-muted hover:text-foreground transition-colors"
          onClick={handleOpenSettingsModal}
        >
          <SettingsIcon className="h-4 w-4" />
          Settings
        </Button>
      </div>

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        theme={theme}
        setTheme={setTheme}
        streamingRefreshRateMs={streamingRefreshRateMs}
        setStreamingRefreshRateMs={setStreamingRefreshRateMs}
        dbProviderConfigs={dbProviderConfigs}
        apiKeys={apiKeys}
        addDbProviderConfig={addDbProviderConfig}
        updateDbProviderConfig={updateDbProviderConfig}
        deleteDbProviderConfig={deleteDbProviderConfig}
        fetchModels={fetchModels}
        providerFetchStatus={providerFetchStatus}
        getAllAvailableModelDefs={getAllAvailableModelDefs}
        globalSystemPrompt={globalSystemPrompt}
        setGlobalSystemPrompt={setGlobalSystemPrompt}
        addApiKey={addApiKey}
        deleteApiKey={deleteApiKey}
        importConversation={importConversation}
        exportAllConversations={exportAllConversations}
        clearAllData={clearAllData}
        dbMods={dbMods}
        loadedMods={loadedMods}
        addDbMod={addDbMod}
        updateDbMod={updateDbMod}
        deleteDbMod={deleteDbMod}
        enableAdvancedSettings={enableAdvancedSettings}
        enableApiKeyManagement={enableApiKeyManagement}
        customSettingsTabs={customSettingsTabs}
      />
    </aside>
  );
};

export const ChatSide = React.memo(ChatSideComponent);
