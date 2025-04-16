// src/context/sidebar-context.tsx
import React, { createContext, useContext, useMemo } from "react";
import type {
  SidebarItem,
  SidebarItemType,
  DbConversation,
  DbProject,
  ProjectSidebarItem,
  ConversationSidebarItem,
} from "@/lib/types";
import { useChatStorage } from "@/hooks/use-chat-storage";
import { useSidebarManagement } from "@/hooks/use-sidebar-management";

const EMPTY_SIDEBAR_ITEMS: SidebarItem[] = [];

interface SidebarContextProps {
  enableSidebar: boolean;
  sidebarItems: SidebarItem[];
  selectedItemId: string | null;
  selectedItemType: SidebarItemType | null;
  selectItem: (
    id: string | null,
    type: SidebarItemType | null,
  ) => Promise<void>;
  createConversation: (
    parentId: string | null,
    title?: string,
  ) => Promise<string>;
  createProject: (
    parentId: string | null,
    name?: string,
  ) => Promise<{ id: string; name: string }>;
  deleteItem: (id: string, type: SidebarItemType) => Promise<void>;
  renameItem: (
    id: string,
    newName: string,
    type: SidebarItemType,
  ) => Promise<void>;
  updateConversationSystemPrompt: (
    id: string,
    systemPrompt: string | null,
  ) => Promise<void>;
  exportConversation: (conversationId: string | null) => Promise<void>;
  importConversation: (file: File, parentId: string | null) => Promise<void>;
  exportAllConversations: () => Promise<void>;
  toggleVfsEnabled: (
    id: string,
    type: SidebarItemType,
    currentVfsState: boolean,
  ) => Promise<void>;
  activeItemData: DbConversation | DbProject | null; // Provide derived active item data
  activeConversationData: DbConversation | null; // Provide derived active conversation data
}

const SidebarContext = createContext<SidebarContextProps | undefined>(
  undefined,
);

interface SidebarProviderProps {
  children: React.ReactNode;
  initialSelectedItemId?: string | null;
  initialSelectedItemType?: SidebarItemType | null;
  enableSidebar?: boolean;
  onSelectItem: (id: string | null, type: SidebarItemType | null) => void; // Callback for parent
}

export const SidebarProvider: React.FC<SidebarProviderProps> = ({
  children,
  initialSelectedItemId = null,
  initialSelectedItemType = null,
  enableSidebar = true,
  onSelectItem,
}) => {
  const storage = useChatStorage();

  const sidebarItems = useMemo<SidebarItem[]>(() => {
    const allProjects = storage.projects || [];
    const allConversations = storage.conversations || [];
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
  }, [storage.projects, storage.conversations]);

  const realSidebarMgmt = useSidebarManagement({
    initialSelectedItemId,
    initialSelectedItemType,
    onSelectItem, // Use the callback passed from parent (ChatProvider)
    dbCreateConversation: storage.createConversation,
    dbCreateProject: storage.createProject,
    dbDeleteConversation: storage.deleteConversation,
    dbDeleteProject: storage.deleteProject,
    dbRenameConversation: storage.renameConversation,
    dbRenameProject: storage.renameProject,
    dbUpdateConversationSystemPrompt: storage.updateConversationSystemPrompt,
    dbGetConversation: storage.getConversation,
    dbGetMessagesForConversation: storage.getMessagesForConversation,
    dbBulkAddMessages: storage.bulkAddMessages,
    dbUpdateConversationTimestamp: storage.updateConversationTimestamp,
    dbCountChildProjects: storage.countChildProjects,
    dbCountChildConversations: storage.countChildConversations,
    dbToggleVfsEnabled: storage.toggleVfsEnabled,
    sidebarItems: sidebarItems,
  });

  const dummySidebarMgmt = useMemo(
    () => ({
      selectedItemId: null,
      selectedItemType: null,
      selectItem: async () => {
        console.warn("Sidebar is disabled.");
      },
      createConversation: async () => {
        console.warn("Sidebar is disabled.");
        throw new Error("Sidebar is disabled.");
      },
      createProject: async () => {
        console.warn("Sidebar is disabled.");
        throw new Error("Sidebar is disabled.");
      },
      deleteItem: async () => {
        console.warn("Sidebar is disabled.");
      },
      renameItem: async () => {
        console.warn("Sidebar is disabled.");
      },
      updateConversationSystemPrompt: async () => {
        console.warn("Sidebar is disabled.");
      },
      exportConversation: async () => {
        console.warn("Sidebar is disabled.");
      },
      importConversation: async () => {
        console.warn("Sidebar is disabled.");
      },
      exportAllConversations: async () => {
        console.warn("Sidebar is disabled.");
      },
      toggleVfsEnabled: async () => {
        console.warn("Sidebar is disabled.");
      },
    }),
    [],
  );

  const sidebarMgmt = useMemo(() => {
    return enableSidebar ? realSidebarMgmt : dummySidebarMgmt;
  }, [enableSidebar, realSidebarMgmt, dummySidebarMgmt]);

  // Derive active item data based on selection state managed by the hook
  const activeItemData = useMemo(() => {
    if (!sidebarMgmt.selectedItemId || !sidebarMgmt.selectedItemType)
      return null;
    const item = sidebarItems.find((i) => i.id === sidebarMgmt.selectedItemId);
    if (item && item.type === sidebarMgmt.selectedItemType) {
      return item;
    }
    return null;
  }, [sidebarMgmt.selectedItemId, sidebarMgmt.selectedItemType, sidebarItems]);

  const activeConversationData = useMemo(() => {
    return sidebarMgmt.selectedItemType === "conversation"
      ? (activeItemData as DbConversation | null)
      : null;
  }, [sidebarMgmt.selectedItemType, activeItemData]);

  const value = useMemo(
    () => ({
      enableSidebar: enableSidebar ?? true,
      sidebarItems: sidebarItems || EMPTY_SIDEBAR_ITEMS,
      selectedItemId: sidebarMgmt.selectedItemId,
      selectedItemType: sidebarMgmt.selectedItemType,
      selectItem: sidebarMgmt.selectItem,
      createConversation: sidebarMgmt.createConversation,
      createProject: sidebarMgmt.createProject,
      deleteItem: sidebarMgmt.deleteItem,
      renameItem: sidebarMgmt.renameItem,
      updateConversationSystemPrompt:
        sidebarMgmt.updateConversationSystemPrompt,
      exportConversation: sidebarMgmt.exportConversation,
      importConversation: sidebarMgmt.importConversation,
      exportAllConversations: sidebarMgmt.exportAllConversations,
      toggleVfsEnabled: sidebarMgmt.toggleVfsEnabled,
      activeItemData,
      activeConversationData,
    }),
    [
      enableSidebar,
      sidebarItems,
      sidebarMgmt.selectedItemId,
      sidebarMgmt.selectedItemType,
      sidebarMgmt.selectItem,
      sidebarMgmt.createConversation,
      sidebarMgmt.createProject,
      sidebarMgmt.deleteItem,
      sidebarMgmt.renameItem,
      sidebarMgmt.updateConversationSystemPrompt,
      sidebarMgmt.exportConversation,
      sidebarMgmt.importConversation,
      sidebarMgmt.exportAllConversations,
      sidebarMgmt.toggleVfsEnabled,
      activeItemData,
      activeConversationData,
    ],
  );

  return (
    <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>
  );
};

export const useSidebarContext = (): SidebarContextProps => {
  const context = useContext(SidebarContext);
  if (context === undefined) {
    throw new Error("useSidebarContext must be used within a SidebarProvider");
  }
  return context;
};
