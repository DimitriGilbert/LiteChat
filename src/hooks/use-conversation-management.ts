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
  Message,
} from "@/lib/types";
import { db } from "@/lib/db";
import { toast } from "sonner";
import { useLiveQuery } from "dexie-react-hooks";

interface UseConversationManagementProps {
  initialSelectedItemId?: string | null;
  initialSelectedItemType?: SidebarItemType | null;
  onSelectItem: (id: string | null, type: SidebarItemType | null) => void; // Unified callback
}

interface UseConversationManagementReturn {
  sidebarItems: SidebarItem[]; // The hierarchical list for the UI
  selectedItemId: string | null;
  selectedItemType: SidebarItemType | null;
  selectItem: (
    id: string | null,
    type: SidebarItemType | null,
  ) => Promise<void>;
  createConversation: (
    parentId: string | null,
    title?: string,
  ) => Promise<string>; // Returns ID
  createProject: (
    parentId: string | null,
    name?: string,
  ) => Promise<{ id: string; name: string }>; // Returns ID and initial name
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
  exportAllConversations: () => Promise<void>; // Needs review for project structure
  activeConversationData: DbConversation | null; // Only if selected item is a conversation
}

export function useConversationManagement({
  initialSelectedItemId = null,
  initialSelectedItemType = null,
  onSelectItem,
}: UseConversationManagementProps): UseConversationManagementReturn {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(
    initialSelectedItemId,
  );
  const [selectedItemType, setSelectedItemType] =
    useState<SidebarItemType | null>(initialSelectedItemType);
  const [activeConversationData, setActiveConversationData] =
    useState<DbConversation | null>(null);

  // Use storage hook for basic DB operations
  const storage = useChatStorage();

  // --- Fetch and build the sidebar tree ---
  const sidebarItems = useLiveQuery<SidebarItem[]>(async () => {
    console.log("useLiveQuery (sidebarItems): Fetching ALL items...");
    // Fetch ALL projects and conversations
    const allProjects = await db.projects.toArray();
    const allConversations = await db.conversations.toArray();

    // Combine and map
    const combinedItems: SidebarItem[] = [
      ...allProjects.map(
        (p): ProjectSidebarItem => ({ ...p, type: "project" }),
      ),
      ...allConversations.map(
        (c): ConversationSidebarItem => ({ ...c, type: "conversation" }),
      ),
    ];

    // Sort combined list in memory: most recently updated first
    combinedItems.sort((a, b) => {
      // Handle potential undefined dates defensively, though unlikely
      const dateA = a.updatedAt?.getTime() ?? 0;
      const dateB = b.updatedAt?.getTime() ?? 0;
      return dateB - dateA;
    });

    // TODO: Implement hierarchical structuring here if needed later.
    // For now, return the flat, sorted list.
    console.log(
      `useLiveQuery (sidebarItems): Fetched ${combinedItems.length} total items.`,
      combinedItems,
    );
    return combinedItems;
  }, []); // Re-run when underlying tables (projects, conversations) change

  // --- Selection Logic ---
  const selectItem = useCallback(
    async (id: string | null, type: SidebarItemType | null) => {
      console.log(`useConversationManagement: Selecting item ${id} (${type})`);
      // Update state *immediately*
      setSelectedItemId(id);
      setSelectedItemType(type);
      onSelectItem(id, type); // Notify parent/context

      // Fetch conversation data *after* state update
      if (id && type === "conversation") {
        try {
          console.log(
            `useConversationManagement: Fetching data for convo ${id}`,
          );
          // Use direct db access which might be slightly faster than storage hook wrapper here
          const convoData = await db.conversations.get(id);
          setActiveConversationData(convoData ?? null);
          console.log(
            `useConversationManagement: Set active convo data`,
            convoData,
          );
        } catch (err) {
          console.error("Failed to load conversation data:", err);
          setActiveConversationData(null);
          toast.error("Failed to load conversation details.");
        }
      } else {
        setActiveConversationData(null); // Clear if project or null is selected
        console.log(`useConversationManagement: Cleared active convo data`);
      }
    },
    [onSelectItem], // Removed storage dependency as we use db directly here
  );

  // --- Creation Logic ---
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
      // Select the new conversation AFTER it's created and the live query potentially updates
      // Use a slight delay or ensure the live query updates before selecting,
      // though Dexie LiveQuery should be quite fast.
      // await new Promise(resolve => setTimeout(resolve, 50)); // Optional small delay
      await selectItem(newId, "conversation");
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
      // Don't automatically select the new project, let the UI handle expansion/focus
      // The live query will update the list, and ChatSide will trigger edit mode.
      return { id: newProject.id, name: newProject.name };
    },
    [storage],
  );

  // --- Deletion Logic ---
  const deleteItem = useCallback(
    async (id: string, type: SidebarItemType): Promise<void> => {
      const currentSelectedId = selectedItemId; // Capture before potential change

      // Prevent deleting projects with children (simple approach)
      if (type === "project") {
        // Fetch children directly - more reliable than relying on potentially stale sidebarItems
        const childProjects = await db.projects
          .where("parentId")
          .equals(id)
          .count();
        const childConvos = await db.conversations
          .where("parentId")
          .equals(id)
          .count();
        if (childProjects > 0 || childConvos > 0) {
          toast.error("Cannot delete project with items inside.");
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

        // If the deleted item was selected, select the first available item or null
        if (currentSelectedId === id) {
          console.log(`Deleted item ${id} was selected. Finding next item...`);
          // Re-fetch items to find the next one based on current sort order
          const allProjects = await db.projects.toArray();
          const allConversations = await db.conversations.toArray();
          const combinedItems: (DbProject | DbConversation)[] = [
            ...allProjects,
            ...allConversations,
          ];
          combinedItems.sort(
            (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
          );

          const nextItem = combinedItems[0]; // Get the most recently updated remaining item
          console.log("Next item to select:", nextItem);
          await selectItem(
            nextItem?.id ?? null,
            nextItem
              ? "name" in nextItem // Check if it's a project (has 'name')
                ? "project"
                : "conversation"
              : null,
          );
        }
        // LiveQuery will update the sidebarItems list automatically
      } catch (err: unknown) {
        console.error(`Failed to delete ${type}:`, err);
        if (err instanceof Error) {
          toast.error(`Failed to delete ${type}: ${err.message}`);
        } else {
          toast.error(`Failed to delete ${type}: Unknown error`);
        }
      }
    },
    [storage, selectedItemId, selectItem], // selectedItemId needed for post-delete selection logic
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
        throw new Error("Name cannot be empty."); // Throw to signal failure to HistoryItem
      }
      try {
        console.log(
          // Add log
          `useConversationManagement: Calling storage to rename ${type} ${id} to "${trimmedName}"`,
        );
        if (type === "conversation") {
          await storage.renameConversation(id, trimmedName);
          // If the renamed item is the currently active conversation, refresh its data
          if (id === selectedItemId && type === selectedItemType) {
            const updatedConvoData = await db.conversations.get(id);
            setActiveConversationData(updatedConvoData ?? null);
          }
        } else if (type === "project") {
          await storage.renameProject(id, trimmedName); // This should be called
        }
        console.log(`useConversationManagement: Rename successful for ${id}`); // Add log
        // LiveQuery should update the name in sidebarItems automatically due to updatedAt change
      } catch (err: unknown) {
        console.error(`Failed to rename ${type}:`, err);
        if (err instanceof Error) {
          toast.error(`Failed to rename ${type}: ${err.message}`);
        } else {
          toast.error(`Failed to rename ${type}: Unknown error`);
        }
        throw err; // Re-throw to signal failure
      }
    },
    [storage, selectedItemId, selectedItemType], // Need selectedItemType as well
  );

  // --- Update System Prompt (Conversation Specific) ---
  const updateConversationSystemPrompt = useCallback(
    async (id: string, systemPrompt: string | null): Promise<void> => {
      await storage.updateConversationSystemPrompt(id, systemPrompt);
      if (id === selectedItemId && selectedItemType === "conversation") {
        const updatedConvoData = await db.conversations.get(id);
        setActiveConversationData(updatedConvoData ?? null);
      }
    },
    [storage, selectedItemId, selectedItemType],
  );

  // --- Import/Export ---
  // (Keep existing exportConversation, importConversation, exportAllConversations)
  // ... (exportConversation implementation) ...
  const exportConversation = useCallback(
    async (conversationId: string | null) => {
      if (!conversationId) {
        toast.error("No conversation selected to export.");
        return;
      }
      try {
        const conversation = await db.conversations.get(conversationId);
        const messagesToExport = await db.messages
          .where("conversationId")
          .equals(conversationId)
          .sortBy("createdAt");

        if (!conversation) {
          toast.warning("Cannot export non-existent conversation.");
          return;
        }

        const exportData = messagesToExport.map((msg) => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          createdAt: msg.createdAt.toISOString(), // Standard format
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
        console.error("Export failed:", err);
        if (err instanceof Error) {
          toast.error(`Export failed: ${err.message}`);
        } else {
          toast.error(`Export failed: Unknown error`);
        }
      }
    },
    [], // No storage dependency needed if using db directly
  );

  // ... (importConversation implementation) ...
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

          const newConversationTitle = `Imported: ${file.name.replace(/\.json$/i, "").substring(0, 50)}`; // Limit title length
          const newConversationId = await storage.createConversation(
            parentId,
            newConversationTitle,
          );

          if (importedMessages.length > 0) {
            await db.messages.bulkAdd(
              importedMessages.map((msg: Message) => ({
                ...msg,
                conversationId: newConversationId,
              })),
            );
            const lastMessageTime =
              importedMessages[importedMessages.length - 1].createdAt;
            await db.conversations.update(newConversationId, {
              updatedAt:
                lastMessageTime > new Date() ? lastMessageTime : new Date(), // Use later date
            });
          }

          await selectItem(newConversationId, "conversation");
          toast.success(
            `Conversation imported successfully as "${newConversationTitle}"!`,
          );
        } catch (err: unknown) {
          console.error("Import failed:", err);
          if (err instanceof Error) {
            toast.error(`Import failed: ${err.message}`);
          } else {
            toast.error("Import failed: Unknown error");
          }
        }
      };
      reader.onerror = () => {
        toast.error("Failed to read the file.");
      };
      reader.readAsText(file);
    },
    [storage, selectItem],
  );

  // ... (exportAllConversations implementation) ...
  const exportAllConversations = useCallback(async () => {
    try {
      const allConversations = await db.conversations.toArray();
      if (allConversations.length === 0) {
        toast.info("No conversations to export.");
        return;
      }

      const exportData = [];
      for (const conversation of allConversations) {
        const messages = await db.messages
          .where("conversationId")
          .equals(conversation.id)
          .sortBy("createdAt");
        exportData.push({
          _litechat_meta: {
            id: conversation.id,
            title: conversation.title,
            systemPrompt: conversation.systemPrompt,
            createdAt: conversation.createdAt.toISOString(),
            updatedAt: conversation.updatedAt.toISOString(),
            parentId: conversation.parentId,
          },
          messages: messages.map((msg) => ({
            id: msg.id,
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
      console.error("Export All failed:", err);
      if (err instanceof Error) {
        toast.error(`Export All failed: ${err.message}`);
      } else {
        toast.error("Export All failed: Unknown error");
      }
    }
  }, []);

  // Effect to load initial item if provided
  useEffect(() => {
    if (initialSelectedItemId && initialSelectedItemType) {
      console.log(
        "useConversationManagement: Selecting initial item",
        initialSelectedItemId,
        initialSelectedItemType,
      );
      // Use timeout to ensure live query has potentially run once
      const timer = setTimeout(() => {
        selectItem(initialSelectedItemId, initialSelectedItemType);
      }, 50); // Small delay
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount

  return {
    sidebarItems: sidebarItems || [], // Ensure it's always an array
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
    activeConversationData,
  };
}
