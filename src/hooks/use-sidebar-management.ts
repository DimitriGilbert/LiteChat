// src/hooks/use-sidebar-management.ts
import { useState, useCallback, useEffect } from "react";
import type {
  DbConversation,
  DbProject,
  SidebarItemType,
  DbMessage,
} from "@/lib/types";
import { toast } from "sonner";
import { z } from "zod";
import { nanoid } from "nanoid";
import { modEvents, ModEvent } from "@/mods/events"; // Import mod events and ModEvent constants

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

// --- NEW: Props Interface ---
interface UseSidebarManagementProps {
  initialSelectedItemId?: string | null;
  initialSelectedItemType?: SidebarItemType | null;
  onSelectItem: (id: string | null, type: SidebarItemType | null) => void;
  // DB/Action Functions Passed In
  dbCreateConversation: (
    parentId: string | null,
    title?: string,
    initialSystemPrompt?: string | null,
  ) => Promise<string>;
  dbCreateProject: (
    name?: string,
    parentId?: string | null,
  ) => Promise<DbProject>;
  dbDeleteConversation: (id: string) => Promise<void>;
  dbDeleteProject: (id: string) => Promise<void>;
  dbRenameConversation: (id: string, newTitle: string) => Promise<void>;
  dbRenameProject: (id: string, newName: string) => Promise<void>;
  dbUpdateConversationSystemPrompt: (
    id: string,
    systemPrompt: string | null,
  ) => Promise<void>;
  dbGetConversation: (id: string) => Promise<DbConversation | undefined>;
  dbGetMessagesForConversation: (
    conversationId: string,
  ) => Promise<DbMessage[]>;
  dbBulkAddMessages: (messages: DbMessage[]) => Promise<unknown>;
  dbUpdateConversationTimestamp: (id: string, date: Date) => Promise<void>;
  dbCountChildProjects: (parentId: string) => Promise<number>;
  dbCountChildConversations: (parentId: string) => Promise<number>;
  dbToggleVfsEnabled: (id: string, type: SidebarItemType) => Promise<void>;
  // Need the live items array to find the next item after deletion
  sidebarItems: Array<{ id: string; type: SidebarItemType; updatedAt?: Date }>;
}

// --- MODIFIED Return Type ---
interface UseSidebarManagementReturn {
  selectedItemId: string | null;
  selectedItemType: SidebarItemType | null;
  selectItem: (
    id: string | null,
    type: SidebarItemType | null,
  ) => Promise<void>; // Keep async for potential future needs
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
  exportAllConversations: () => Promise<void>; // Keep this, needs access to all convos via props eventually
  toggleVfsEnabled: (
    id: string,
    type: SidebarItemType,
    currentVfsState: boolean,
  ) => Promise<void>;
}

export function useSidebarManagement({
  initialSelectedItemId = null,
  initialSelectedItemType = null,
  onSelectItem,
  // Destructure DB/Action Functions
  dbCreateConversation,
  dbCreateProject,
  dbDeleteConversation,
  dbDeleteProject,
  dbRenameConversation,
  dbRenameProject,
  dbUpdateConversationSystemPrompt,
  dbGetConversation,
  dbGetMessagesForConversation,
  dbBulkAddMessages,
  dbUpdateConversationTimestamp,
  dbCountChildProjects,
  dbCountChildConversations,
  dbToggleVfsEnabled,
  sidebarItems, // Use live items passed in
}: UseSidebarManagementProps): UseSidebarManagementReturn {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(
    initialSelectedItemId,
  );
  const [selectedItemType, setSelectedItemType] =
    useState<SidebarItemType | null>(initialSelectedItemType);

  // --- Selection Logic ---
  const selectItem = useCallback(
    async (id: string | null, type: SidebarItemType | null) => {
      setSelectedItemId(id);
      setSelectedItemType(type);
      onSelectItem(id, type); // Notify parent (ChatProvider)
      // Event emission moved to ChatProvider's handleSelectItem
    },
    [onSelectItem],
  );

  // --- Toggle VFS ---
  const toggleVfsEnabled = useCallback(
    async (
      id: string,
      type: SidebarItemType,
      currentVfsState: boolean,
    ): Promise<void> => {
      if (!id || !type) {
        toast.warning("No item selected to toggle VFS.");
        return;
      }
      try {
        await dbToggleVfsEnabled(id, type);
        const isNowEnabled = !currentVfsState;
        toast.success(
          `Virtual Filesystem ${isNowEnabled ? "enabled" : "disabled"} for ${type}.`,
        );
      } catch (err) {
        console.error("Failed to toggle VFS:", err);
        toast.error("Failed to update VFS setting.");
      }
    },
    [dbToggleVfsEnabled],
  );

  // --- Creation Logic ---
  const createConversation = useCallback(
    async (
      parentId: string | null,
      title?: string,
      initialSystemPrompt?: string | null,
    ): Promise<string> => {
      // Use passed-in DB function
      const newId = await dbCreateConversation(
        parentId,
        title,
        initialSystemPrompt,
      );
      await selectItem(newId, "conversation"); // Select the new item
      // Event emission moved to ChatProvider's handleSubmit
      return newId;
    },
    [dbCreateConversation, selectItem],
  );

  const createProject = useCallback(
    async (
      parentId: string | null,
      name: string = "New Project",
    ): Promise<{ id: string; name: string }> => {
      // Use passed-in DB function
      const newProject = await dbCreateProject(name, parentId);
      // Don't select project automatically, just return info
      // Phase 5: Emit 'chat:created' event for projects
      modEvents.emit(ModEvent.CHAT_CREATED, {
        // Use ModEvent constant
        id: newProject.id,
        type: "project",
        parentId,
      });
      return { id: newProject.id, name: newProject.name };
    },
    [dbCreateProject],
  );

  // --- Deletion Logic ---
  const deleteItem = useCallback(
    async (id: string, type: SidebarItemType): Promise<void> => {
      const currentSelectedId = selectedItemId; // Capture before potential change

      if (type === "project") {
        try {
          // Use passed-in DB functions
          const childProjects = await dbCountChildProjects(id);
          const childConvos = await dbCountChildConversations(id);
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
        // Use passed-in DB functions
        if (type === "conversation") {
          await dbDeleteConversation(id);
        } else if (type === "project") {
          await dbDeleteProject(id);
        }

        toast.success(`${type === "project" ? "Project" : "Chat"} deleted.`);
        // Phase 5: Emit 'chat:deleted' event
        modEvents.emit(ModEvent.CHAT_DELETED, { id, type }); // Use ModEvent constant

        // If the deleted item was selected, select the next most recent item
        if (currentSelectedId === id) {
          const itemsBeforeDelete = sidebarItems || [];
          const remainingItems = itemsBeforeDelete.filter(
            (item) => item.id !== id,
          );
          // Sort remaining items by updatedAt descending (nulls last)
          remainingItems.sort(
            (a, b) =>
              (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0),
          );
          const nextItem = remainingItems[0];
          await selectItem(nextItem?.id ?? null, nextItem?.type ?? null);
        }
        // If a different item was selected, no need to change selection
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error(`Failed to delete ${type}:`, err);
        toast.error(`Failed to delete ${type}: ${message}`);
      }
    },
    [
      selectedItemId, // Need current selection state
      selectItem,
      dbCountChildProjects,
      dbCountChildConversations,
      dbDeleteConversation,
      dbDeleteProject,
      sidebarItems, // Need live items to find next selection
    ],
  );

  // --- Renaming Logic ---
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
        // Use passed-in DB functions
        if (type === "conversation") {
          await dbRenameConversation(id, trimmedName);
        } else if (type === "project") {
          await dbRenameProject(id, trimmedName);
        }
        // No need to refresh active data here
        // TODO: Phase 5 - Emit 'chat:renamed' event if needed
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error(`Failed to rename ${type}:`, err);
        toast.error(`Failed to rename ${type}: ${message}`);
        throw err; // Re-throw so UI can handle (e.g., revert edit state)
      }
    },
    [dbRenameConversation, dbRenameProject], // Only depends on DB functions now
  );

  // --- Update System Prompt ---
  const updateConversationSystemPrompt = useCallback(
    async (id: string, systemPrompt: string | null): Promise<void> => {
      // No need to check type here, assume caller provides correct ID
      // Use passed-in DB function
      await dbUpdateConversationSystemPrompt(id, systemPrompt);
      // No need to refresh active data here
      // TODO: Phase 5 - Emit 'chat:systemPromptUpdated' event if needed
    },
    [dbUpdateConversationSystemPrompt], // Only depends on DB function now
  );

  // --- Import/Export ---
  const exportConversation = useCallback(
    async (conversationId: string | null) => {
      if (!conversationId) {
        toast.error("No conversation selected to export.");
        return;
      }
      try {
        // Use passed-in DB functions
        const conversation = await dbGetConversation(conversationId);
        const messagesToExport =
          await dbGetMessagesForConversation(conversationId);

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
    [dbGetConversation, dbGetMessagesForConversation], // Depend on passed-in functions
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
          // Use passed-in DB function
          const newConversationId = await dbCreateConversation(
            parentId,
            newConversationTitle,
          );
          // Event emission moved to ChatProvider's handleSubmit/createConversation
          // Phase 5: Emit 'chat:created' event for imported conversations
          modEvents.emit(ModEvent.CHAT_CREATED, {
            // Use ModEvent constant
            id: newConversationId,
            type: "conversation",
            parentId,
          });

          if (importedMessages.length > 0) {
            // Use passed-in DB function
            await dbBulkAddMessages(
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
            // Use passed-in DB function
            await dbUpdateConversationTimestamp(
              newConversationId,
              lastMessageTime,
            );
          }

          await selectItem(newConversationId, "conversation"); // Select the new item
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
    [
      dbCreateConversation,
      dbBulkAddMessages,
      dbUpdateConversationTimestamp,
      selectItem,
    ], // Depend on passed-in functions
  );

  // TODO: Implement exportAllConversations using passed-in functions if needed later
  const exportAllConversations = useCallback(async () => {
    toast.info("Export All Conversations is not fully implemented yet.");
    // Implementation would require access to *all* conversations, likely passed via props
    // or fetched using a passed-in `dbGetAllConversations` function.
  }, []);

  // --- Effect to load initial item ---
  // This effect ensures the parent's `onSelectItem` is called initially if needed.
  useEffect(() => {
    if (initialSelectedItemId && initialSelectedItemType) {
      // Call onSelectItem directly to inform the parent
      onSelectItem(initialSelectedItemId, initialSelectedItemType);
    }
    // Run only once on mount based on initial props
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSelectedItemId, initialSelectedItemType]);

  // --- Return ---
  return {
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
  };
}
