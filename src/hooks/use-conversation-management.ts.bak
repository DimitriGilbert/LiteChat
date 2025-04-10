// src/hooks/use-conversation-management.ts
import { useState, useCallback, useEffect } from "react";
import { useChatStorage } from "./use-chat-storage";
import type {
  DbConversation,
  DbProject,
  SidebarItem,
  SidebarItemType,
  ProjectSidebarItem,
  ConversationSidebarItem,
  DbMessage,
} from "@/lib/types";
import { toast } from "sonner";
import { useLiveQuery } from "dexie-react-hooks";
import { z } from "zod";
import { nanoid } from "nanoid";

// Schemas remain the same
const messageImportSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  createdAt: z
    .string()
    .datetime()
    .transform((date) => new Date(date)),
});
const conversationImportSchema = z.array(messageImportSchema);

interface UseConversationManagementProps {
  initialSelectedItemId?: string | null;
  initialSelectedItemType?: SidebarItemType | null;
  onSelectItem: (id: string | null, type: SidebarItemType | null) => void;
  // DB Functions Passed In
  toggleDbVfs: (id: string, type: SidebarItemType) => Promise<void>;
  getProject: (id: string) => Promise<DbProject | undefined>; // Keep getter
  getConversation: (id: string) => Promise<DbConversation | undefined>; // Keep getter
  getMessagesForConversation: (conversationId: string) => Promise<DbMessage[]>;
  bulkAddMessages: (messages: DbMessage[]) => Promise<unknown>;
  updateConversationTimestamp: (id: string, date: Date) => Promise<void>;
  countChildProjects: (parentId: string) => Promise<number>;
  countChildConversations: (parentId: string) => Promise<number>;
}

// MODIFIED Return Type
interface UseConversationManagementReturn {
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
  toggleVfsEnabled: () => Promise<void>;
  // REMOVED activeConversationData, activeProjectData
}

export function useConversationManagement({
  initialSelectedItemId = null,
  initialSelectedItemType = null,
  onSelectItem,
  // Destructure DB Functions
  toggleDbVfs,
  getProject, // Keep getter prop
  getConversation, // Keep getter prop
  getMessagesForConversation,
  bulkAddMessages,
  updateConversationTimestamp,
  countChildProjects,
  countChildConversations,
}: UseConversationManagementProps): UseConversationManagementReturn {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(
    initialSelectedItemId,
  );
  const [selectedItemType, setSelectedItemType] =
    useState<SidebarItemType | null>(initialSelectedItemType);
  // REMOVED activeConversationData / activeProjectData state

  const storage = useChatStorage();

  const sidebarItems = useLiveQuery<SidebarItem[]>(() => {
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

  // MODIFIED: Selection Logic - Just update state and call prop
  const selectItem = useCallback(
    async (id: string | null, type: SidebarItemType | null) => {
      setSelectedItemId(id);
      setSelectedItemType(type);
      onSelectItem(id, type); // Notify parent (ChatProvider)
      // REMOVED: Fetching active data here
    },
    [onSelectItem],
  );

  // MODIFIED: Toggle VFS - Remove active data refresh
  const toggleVfsEnabled = useCallback(async () => {
    if (!selectedItemId || !selectedItemType) {
      toast.warning("No item selected to toggle VFS.");
      return;
    }
    try {
      await toggleDbVfs(selectedItemId, selectedItemType);
      // REMOVED: Re-fetching active data here
      // Rely on useLiveQuery in storage hook to update sidebarItems eventually
      const item = sidebarItems.find((i) => i.id === selectedItemId);
      const isNowEnabled = item ? !item.vfsEnabled : undefined;
      if (isNowEnabled !== undefined) {
        toast.success(
          `Virtual Filesystem ${isNowEnabled ? "enabled" : "disabled"} for ${selectedItemType}.`,
        );
      } else {
        toast.success(
          `Virtual Filesystem setting updated for ${selectedItemType}.`,
        );
      }
    } catch (err) {
      console.error("Failed to toggle VFS:", err);
      toast.error("Failed to update VFS setting.");
    }
  }, [selectedItemId, selectedItemType, toggleDbVfs, sidebarItems]);

  // --- Creation Logic --- (No change needed)
  const createConversation = useCallback(
    async (
      parentId: string | null,
      title?: string,
      initialSystemPrompt?: string | null,
    ): Promise<string> => {
      const newId = await storage.createConversation(
        parentId,
        title,
        initialSystemPrompt,
      );
      await selectItem(newId, "conversation"); // Select the new item
      return newId;
    },
    [storage, selectItem],
  );

  const createProject = useCallback(
    async (
      parentId: string | null,
      name: string = "New Project",
    ): Promise<{ id: string; name: string }> => {
      const newProject = await storage.createProject(name, parentId);
      return { id: newProject.id, name: newProject.name };
    },
    [storage],
  );

  // --- Deletion Logic --- (No change needed in logic, just dependencies)
  const deleteItem = useCallback(
    async (id: string, type: SidebarItemType): Promise<void> => {
      const currentSelectedId = selectedItemId;

      if (type === "project") {
        try {
          const childProjects = await countChildProjects(id);
          const childConvos = await countChildConversations(id);
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

        if (currentSelectedId === id) {
          const itemsBeforeDelete = sidebarItems || [];
          const remainingItems = itemsBeforeDelete.filter(
            (item) => item.id !== id,
          );
          remainingItems.sort(
            (a, b) =>
              (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0),
          );
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
      storage,
      selectedItemId,
      selectItem,
      countChildProjects,
      countChildConversations,
      sidebarItems,
    ],
  );

  // MODIFIED: Renaming Logic - Remove active data refresh
  const renameItem = useCallback(
    async (
      id: string,
      newName: string,
      type: SidebarItemType,
    ): Promise<void> => {
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
        // REMOVED: Refreshing active data state
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error(`Failed to rename ${type}:`, err);
        toast.error(`Failed to rename ${type}: ${message}`);
        throw err;
      }
    },
    [storage], // Only depends on storage now
  );

  // MODIFIED: Update System Prompt - Remove active data refresh
  const updateConversationSystemPrompt = useCallback(
    async (id: string, systemPrompt: string | null): Promise<void> => {
      const item = sidebarItems.find((i) => i.id === id);
      if (item?.type !== "conversation") {
        console.warn(
          `Attempted to update system prompt for non-conversation item: ${id}`,
        );
        toast.error("Can only update system prompt for conversations.");
        return;
      }
      await storage.updateConversationSystemPrompt(id, systemPrompt);
      // REMOVED: Refreshing active data state
    },
    [storage, sidebarItems], // Depends on storage and sidebarItems
  );

  // --- Import/Export --- (No change needed in logic, just dependencies)
  const exportConversation = useCallback(
    async (conversationId: string | null) => {
      if (!conversationId) {
        toast.error("No conversation selected to export.");
        return;
      }
      try {
        const conversation = await getConversation(conversationId); // Use getter
        const messagesToExport =
          await getMessagesForConversation(conversationId); // Use getter

        if (!conversation) {
          toast.warning("Cannot export non-existent conversation.");
          return;
        }
        const exportData = messagesToExport.map((msg) => ({
          role: msg.role,
          content: msg.content,
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
    [getConversation, getMessagesForConversation], // Keep getter dependencies
  );

  const importConversation = useCallback(
    async (file: File, parentId: string | null) => {
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

          if (importedMessages.length > 0) {
            await bulkAddMessages(
              importedMessages.map((msg) => ({
                id: nanoid(),
                role: msg.role,
                content: msg.content,
                createdAt: msg.createdAt,
                conversationId: newConversationId,
              })),
            );
            const lastMessageTime =
              importedMessages[importedMessages.length - 1].createdAt;
            await updateConversationTimestamp(
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
    [storage, selectItem, bulkAddMessages, updateConversationTimestamp],
  );

  const exportAllConversations = useCallback(async () => {
    try {
      const allConversations = storage.conversations || [];
      if (allConversations.length === 0) {
        toast.info("No conversations to export.");
        return;
      }
      const exportData = [];
      for (const conversation of allConversations) {
        const messages = await getMessagesForConversation(conversation.id); // Use getter
        exportData.push({
          _litechat_meta: {
            id: conversation.id,
            title: conversation.title,
            systemPrompt: conversation.systemPrompt,
            createdAt: conversation.createdAt.toISOString(),
            updatedAt: conversation.updatedAt.toISOString(),
            parentId: conversation.parentId,
            vfsEnabled: conversation.vfsEnabled,
          },
          messages: messages.map((msg) => ({
            role: msg.role,
            content: msg.content,
            createdAt: msg.createdAt.toISOString(),
          })),
        });
      }
      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      link.download = `litechat_all_conversations_export_${timestamp}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success(`All ${allConversations.length} conversations exported.`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("Export All failed:", err);
      toast.error(`Export All failed: ${message}`);
    }
  }, [storage.conversations, getMessagesForConversation]); // Keep getter dependency

  // Effect to load initial item on mount (No change needed)
  useEffect(() => {
    if (initialSelectedItemId && initialSelectedItemType) {
      const timer = setTimeout(() => {
        selectItem(initialSelectedItemId, initialSelectedItemType);
      }, 50);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    sidebarItems: sidebarItems || [],
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
    // REMOVED activeConversationData, activeProjectData
  };
}
