// src/context/sidebar-context.tsx
import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  useCallback,
  useEffect,
} from "react";
import type {
  SidebarItem,
  SidebarItemType,
  DbConversation,
  DbProject,
  ProjectSidebarItem,
  ConversationSidebarItem,
  // DbMessage, // REMOVED - Unused
} from "@/lib/types";
import { useChatStorage } from "@/hooks/use-chat-storage";
// Removed useSidebarManagement import
import { toast } from "sonner";
import { z } from "zod"; // Keep for import validation
import { nanoid } from "nanoid"; // Keep for import message IDs
import { modEvents, ModEvent } from "@/mods/events"; // Keep for event emission

const EMPTY_SIDEBAR_ITEMS: SidebarItem[] = [];

// Schemas for import validation (copied from useSidebarManagement)
const messageImportSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(), // Assuming simple string content for import for now
  createdAt: z
    .string()
    .datetime()
    .transform((date) => new Date(date)),
});
const conversationImportSchema = z.array(messageImportSchema);

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
    currentVfsState: boolean, // Pass current state for toggle logic
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

  // --- Manage Selection State Locally ---
  const [selectedItemId, setSelectedItemId] = useState<string | null>(
    initialSelectedItemId,
  );
  const [selectedItemType, setSelectedItemType] =
    useState<SidebarItemType | null>(initialSelectedItemType);

  // --- Derive Sidebar Items from Storage ---
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
    // Sort by updatedAt descending (most recent first)
    combinedItems.sort(
      (a, b) => (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0),
    );
    return combinedItems;
  }, [storage.projects, storage.conversations]);

  // --- Define Actions Locally ---

  const selectItem = useCallback(
    async (id: string | null, type: SidebarItemType | null) => {
      setSelectedItemId(id);
      setSelectedItemType(type);
      onSelectItem(id, type); // Notify parent (ChatProviderInner)
      // Event emission moved to ChatProviderInner's handleSelectItem or equivalent effect
    },
    [onSelectItem],
  );

  // Effect to handle initial selection notification
  useEffect(() => {
    if (initialSelectedItemId && initialSelectedItemType) {
      onSelectItem(initialSelectedItemId, initialSelectedItemType);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSelectedItemId, initialSelectedItemType]); // Run only on mount

  const createConversation = useCallback(
    async (
      parentId: string | null,
      title?: string,
      initialSystemPrompt?: string | null,
    ): Promise<string> => {
      if (!enableSidebar) {
        console.warn("Sidebar is disabled.");
        throw new Error("Sidebar is disabled.");
      }
      const newId = await storage.createConversation(
        parentId,
        title,
        initialSystemPrompt,
      );
      await selectItem(newId, "conversation"); // Select the new item
      // Event emission moved to ChatProviderInner or equivalent effect
      return newId;
    },
    [enableSidebar, storage, selectItem],
  );

  const createProject = useCallback(
    async (
      parentId: string | null,
      name: string = "New Project",
    ): Promise<{ id: string; name: string }> => {
      if (!enableSidebar) {
        console.warn("Sidebar is disabled.");
        throw new Error("Sidebar is disabled.");
      }
      const newProject = await storage.createProject(name, parentId);
      // Event emission moved to ChatProviderInner or equivalent effect
      modEvents.emit(ModEvent.CHAT_CREATED, {
        id: newProject.id,
        type: "project",
        parentId,
      });
      return { id: newProject.id, name: newProject.name };
    },
    [enableSidebar, storage],
  );

  const deleteItem = useCallback(
    async (id: string, type: SidebarItemType): Promise<void> => {
      if (!enableSidebar) {
        console.warn("Sidebar is disabled.");
        return;
      }
      const currentSelectedId = selectedItemId; // Capture before potential change

      if (type === "project") {
        try {
          const childProjects = await storage.countChildProjects(id);
          const childConvos = await storage.countChildConversations(id);
          if (childProjects > 0 || childConvos > 0) {
            toast.error("Cannot delete project with items inside.");
            return;
          }
        } catch (countErr) {
          console.error("Failed to check for child items:", countErr);
          toast.error(
            "Could not verify if project is empty. Deletion aborted.",
          );
          return;
        }
      }

      try {
        if (type === "conversation") {
          await storage.deleteConversation(id);
        } else if (type === "project") {
          await storage.deleteProject(id);
        }

        toast.success(`${type === "project" ? "Project" : "Chat"} deleted.`);
        modEvents.emit(ModEvent.CHAT_DELETED, { id, type });

        // If the deleted item was selected, select the next most recent item
        if (currentSelectedId === id) {
          // sidebarItems is derived and up-to-date due to useMemo and storage dependency
          const remainingItems = sidebarItems.filter((item) => item.id !== id);
          // Already sorted by updatedAt descending
          const nextItem = remainingItems[0];
          await selectItem(nextItem?.id ?? null, nextItem?.type ?? null);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error(`Failed to delete ${type}:`, err);
        toast.error(`Failed to delete ${type}: ${message}`);
      }
    },
    [
      enableSidebar,
      storage,
      selectedItemId,
      selectItem,
      sidebarItems, // Need current items for finding next selection
    ],
  );

  const renameItem = useCallback(
    async (
      id: string,
      newName: string,
      type: SidebarItemType,
    ): Promise<void> => {
      if (!enableSidebar) {
        console.warn("Sidebar is disabled.");
        throw new Error("Sidebar is disabled.");
      }
      const trimmedName = newName.trim();
      if (!trimmedName) {
        toast.error("Name cannot be empty.");
        throw new Error("Name cannot be empty.");
      }
      try {
        if (type === "conversation") {
          await storage.renameConversation(id, trimmedName);
        } else if (type === "project") {
          await storage.renameProject(id, trimmedName);
        }
        // Event emission moved
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error(`Failed to rename ${type}:`, err);
        toast.error(`Failed to rename ${type}: ${message}`);
        throw err;
      }
    },
    [enableSidebar, storage],
  );

  const updateConversationSystemPrompt = useCallback(
    async (id: string, systemPrompt: string | null): Promise<void> => {
      if (!enableSidebar) {
        console.warn("Sidebar is disabled.");
        throw new Error("Sidebar is disabled.");
      }
      await storage.updateConversationSystemPrompt(id, systemPrompt);
      // Event emission moved
    },
    [enableSidebar, storage],
  );

  const exportConversation = useCallback(
    async (conversationId: string | null) => {
      if (!enableSidebar) {
        console.warn("Sidebar is disabled.");
        return;
      }
      if (!conversationId) {
        toast.error("No conversation selected to export.");
        return;
      }
      try {
        const conversation = await storage.getConversation(conversationId);
        const messagesToExport =
          await storage.getMessagesForConversation(conversationId);

        if (!conversation) {
          toast.warning("Cannot export non-existent conversation.");
          return;
        }
        const exportData = messagesToExport.map((msg) => ({
          role: msg.role,
          content:
            typeof msg.content === "string"
              ? msg.content
              : JSON.stringify(msg.content), // Handle complex content
          createdAt: msg.createdAt.toISOString(),
        }));
        const jsonString = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonString], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        const filename = `${conversation.title.replace(/[^a-z0-9]/gi, "_").toLowerCase() || "chat"}_${conversationId.substring(0, 6)}.json`;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success(`Conversation "${conversation.title}" exported.`);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error("Export failed:", err);
        toast.error(`Export failed: ${message}`);
      }
    },
    [enableSidebar, storage],
  );

  const importConversation = useCallback(
    async (file: File, parentId: string | null) => {
      if (!enableSidebar) {
        console.warn("Sidebar is disabled.");
        return;
      }
      if (!file || file.type !== "application/json") {
        toast.error("Please select a valid JSON file.");
        return;
      }
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const jsonString = event.target?.result as string;
          const parsedData = JSON.parse(jsonString);

          const validationResult =
            conversationImportSchema.safeParse(parsedData);
          if (!validationResult.success) {
            console.error("Import validation error:", validationResult.error);
            toast.error(
              `Import failed: Invalid file format. ${validationResult.error.errors[0]?.message || ""}`,
            );
            return;
          }
          const importedMessages = validationResult.data;

          const newConversationTitle = `Imported: ${file.name.replace(/\.json$/i, "").substring(0, 50)}`;
          const newConversationId = await storage.createConversation(
            parentId,
            newConversationTitle,
          );
          // Event emission moved

          if (importedMessages.length > 0) {
            await storage.bulkAddMessages(
              importedMessages.map((msg) => ({
                id: nanoid(),
                role: msg.role,
                content: msg.content, // Store imported content directly
                createdAt: msg.createdAt,
                conversationId: newConversationId,
              })),
            );
            const lastMessageTime =
              importedMessages[importedMessages.length - 1].createdAt;
            await storage.updateConversationTimestamp(
              newConversationId,
              lastMessageTime,
            );
          }

          await selectItem(newConversationId, "conversation");
          toast.success(
            `Conversation imported successfully as "${newConversationTitle}"!`,
          );
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : "Unknown error";
          console.error("Import failed:", err);
          toast.error(`Import failed: ${message}`);
        }
      };
      reader.onerror = () => {
        toast.error("Failed to read the file.");
      };
      reader.readAsText(file);
    },
    [enableSidebar, storage, selectItem],
  );

  const exportAllConversations = useCallback(async () => {
    if (!enableSidebar) {
      console.warn("Sidebar is disabled.");
      return;
    }
    toast.info("Exporting all conversations...");
    try {
      // Assuming storage provides a way to get all conversations
      const allConversations = storage.conversations || []; // Use live query result
      if (allConversations.length === 0) {
        toast.info("No conversations found to export.");
        return;
      }

      const exportPackage: any[] = [];
      for (const conversation of allConversations) {
        const messages = await storage.getMessagesForConversation(
          conversation.id,
        );
        exportPackage.push({
          // ... conversation details ...
          id: conversation.id,
          title: conversation.title,
          parentId: conversation.parentId,
          systemPrompt: conversation.systemPrompt,
          createdAt: conversation.createdAt.toISOString(),
          updatedAt: conversation.updatedAt.toISOString(),
          vfsEnabled: conversation.vfsEnabled,
          messages: messages.map((msg) => ({
            role: msg.role,
            content:
              typeof msg.content === "string"
                ? msg.content
                : JSON.stringify(msg.content), // Handle complex content
            createdAt: msg.createdAt.toISOString(),
          })),
        });
      }

      const jsonString = JSON.stringify(exportPackage, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      link.download = `litechat_all_export_${timestamp}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success(
        `Successfully exported ${allConversations.length} conversations.`,
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("Export All failed:", err);
      toast.error(`Export All failed: ${message}`);
    }
  }, [enableSidebar, storage]);

  const toggleVfsEnabled = useCallback(
    async (
      id: string,
      type: SidebarItemType,
      currentVfsState: boolean, // Receive current state
    ): Promise<void> => {
      if (!enableSidebar) {
        console.warn("Sidebar is disabled.");
        return;
      }
      if (!id || !type) {
        toast.warning("No item selected to toggle VFS.");
        return;
      }
      try {
        await storage.toggleVfsEnabled(id, type);
        const isNowEnabled = !currentVfsState;
        toast.success(
          `Virtual Filesystem ${isNowEnabled ? "enabled" : "disabled"} for ${type}.`,
        );
        // Event emission moved
      } catch (err) {
        console.error("Failed to toggle VFS:", err);
        toast.error("Failed to update VFS setting.");
      }
    },
    [enableSidebar, storage],
  );

  // --- Derive active item data ---
  const activeItemData = useMemo(() => {
    if (!selectedItemId || !selectedItemType) return null;
    // Find in the derived sidebarItems list
    const item = sidebarItems.find((i) => i.id === selectedItemId);
    // Ensure the found item's type matches the selected type
    if (item && item.type === selectedItemType) {
      return item;
    }
    return null;
  }, [selectedItemId, selectedItemType, sidebarItems]);

  const activeConversationData = useMemo(() => {
    return selectedItemType === "conversation"
      ? (activeItemData as DbConversation | null)
      : null;
  }, [selectedItemType, activeItemData]);

  // --- Create dummy actions if sidebar is disabled ---
  const dummyAction = async (...args: any[]): Promise<any> => {
    console.warn("Sidebar is disabled.");
    if (args.length > 0 && typeof args[args.length - 1] === "function") {
      // Avoid calling potential callbacks if disabled
    } else {
      // Throw error for actions that expect a return value or have side effects
      // Adjust based on specific action needs
      // throw new Error("Sidebar is disabled.");
    }
  };
  const dummyActionReturnsString = async (): Promise<string> => {
    console.warn("Sidebar is disabled.");
    throw new Error("Sidebar is disabled.");
  };
  const dummyActionReturnsObject = async (): Promise<{
    id: string;
    name: string;
  }> => {
    console.warn("Sidebar is disabled.");
    throw new Error("Sidebar is disabled.");
  };

  // --- Context Value ---
  const value = useMemo(
    () => ({
      enableSidebar: enableSidebar ?? true,
      sidebarItems: sidebarItems || EMPTY_SIDEBAR_ITEMS,
      selectedItemId,
      selectedItemType,
      selectItem: enableSidebar ? selectItem : dummyAction,
      createConversation: enableSidebar
        ? createConversation
        : dummyActionReturnsString,
      createProject: enableSidebar ? createProject : dummyActionReturnsObject,
      deleteItem: enableSidebar ? deleteItem : dummyAction,
      renameItem: enableSidebar ? renameItem : dummyAction,
      updateConversationSystemPrompt: enableSidebar
        ? updateConversationSystemPrompt
        : dummyAction,
      exportConversation: enableSidebar ? exportConversation : dummyAction,
      importConversation: enableSidebar ? importConversation : dummyAction,
      exportAllConversations: enableSidebar
        ? exportAllConversations
        : dummyAction,
      toggleVfsEnabled: enableSidebar ? toggleVfsEnabled : dummyAction,
      activeItemData,
      activeConversationData,
    }),
    [
      enableSidebar,
      sidebarItems,
      selectedItemId,
      selectedItemType,
      selectItem,
      createConversation,
      createProject,
      deleteItem,
      renameItem,
      updateConversationSystemPrompt,
      exportConversation,
      importConversation,
      exportAllConversations,
      toggleVfsEnabled,
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
