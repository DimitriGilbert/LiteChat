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
  // Message, // No longer needed directly if import schema doesn't use it
} from "@/lib/types";
import { db } from "@/lib/db";
import { toast } from "sonner";
import { useLiveQuery } from "dexie-react-hooks";
import { z } from "zod";
import { nanoid } from "nanoid";

// Define Zod schema for import validation
const messageImportSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  createdAt: z
    .string()
    .datetime()
    .transform((date) => new Date(date)), // Parse ISO string to Date
});

// Schema for the expected array structure in the imported JSON file
const conversationImportSchema = z.array(messageImportSchema);

interface UseConversationManagementProps {
  initialSelectedItemId?: string | null;
  initialSelectedItemType?: SidebarItemType | null;
  onSelectItem: (id: string | null, type: SidebarItemType | null) => void;
  toggleDbVfs: (id: string, type: SidebarItemType) => Promise<void>; // Receive DB toggle function
}

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
  activeConversationData: DbConversation | null;
  activeProjectData: DbProject | null; // Expose active project data
  toggleVfsEnabled: () => Promise<void>; // Expose UI toggle function
}

export function useConversationManagement({
  initialSelectedItemId = null,
  initialSelectedItemType = null,
  onSelectItem,
  toggleDbVfs, // Receive DB toggle function
}: UseConversationManagementProps): UseConversationManagementReturn {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(
    initialSelectedItemId,
  );
  const [selectedItemType, setSelectedItemType] =
    useState<SidebarItemType | null>(initialSelectedItemType);
  const [activeConversationData, setActiveConversationData] =
    useState<DbConversation | null>(null);
  const [activeProjectData, setActiveProjectData] = useState<DbProject | null>(
    null,
  ); // State for active project

  // Use the low-level storage hook
  const storage = useChatStorage();

  // Fetch and build the sidebar tree (sorted by updatedAt desc) using Dexie LiveQuery
  const sidebarItems = useLiveQuery<SidebarItem[]>(async () => {
    const allProjects = await db.projects.toArray();
    const allConversations = await db.conversations.toArray();
    // Combine projects and conversations into a single list with type information
    const combinedItems: SidebarItem[] = [
      ...allProjects.map(
        (p): ProjectSidebarItem => ({ ...p, type: "project" }),
      ),
      ...allConversations.map(
        (c): ConversationSidebarItem => ({ ...c, type: "conversation" }),
      ),
    ];
    // Sort the combined list by the 'updatedAt' timestamp in descending order
    combinedItems.sort(
      (a, b) => (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0),
    );
    return combinedItems;
  }, []); // Dependency array is empty, Dexie handles reactivity

  // Selection Logic: Update state and fetch corresponding data
  const selectItem = useCallback(
    async (id: string | null, type: SidebarItemType | null) => {
      // Update local state for selected item ID and type
      setSelectedItemId(id);
      setSelectedItemType(type);
      // Notify parent/context about the selection change
      onSelectItem(id, type);

      // Clear previously active data before fetching new data
      setActiveConversationData(null);
      setActiveProjectData(null);

      // Fetch and set the active data if an item ID is provided
      if (id) {
        try {
          if (type === "conversation") {
            const convoData = await db.conversations.get(id);
            setActiveConversationData(convoData ?? null); // Set conversation data or null if not found
          } else if (type === "project") {
            const projData = await db.projects.get(id);
            setActiveProjectData(projData ?? null); // Set project data or null if not found
          }
        } catch (err) {
          console.error(`Failed to load ${type} data:`, err);
          toast.error(`Failed to load ${type} details.`);
        }
      }
    },
    [onSelectItem], // Dependency: the callback function passed from parent
  );

  // Toggle VFS Enabled: Call DB function and refresh active data
  const toggleVfsEnabled = useCallback(async () => {
    // Ensure an item is actually selected
    if (!selectedItemId || !selectedItemType) {
      toast.warning("No item selected to toggle VFS.");
      return;
    }
    try {
      // Call the database toggle function passed via props
      await toggleDbVfs(selectedItemId, selectedItemType);
      // Re-fetch the active data to update the UI state immediately
      if (selectedItemType === "conversation") {
        const updatedData = await db.conversations.get(selectedItemId);
        setActiveConversationData(updatedData ?? null);
        // Provide user feedback
        toast.success(
          `Virtual Filesystem ${updatedData?.vfsEnabled ? "enabled" : "disabled"} for chat.`,
        );
      } else if (selectedItemType === "project") {
        const updatedData = await db.projects.get(selectedItemId);
        setActiveProjectData(updatedData ?? null);
        // Provide user feedback
        toast.success(
          `Virtual Filesystem ${updatedData?.vfsEnabled ? "enabled" : "disabled"} for project.`,
        );
      }
    } catch (err) {
      console.error("Failed to toggle VFS:", err);
      toast.error("Failed to update VFS setting.");
    }
  }, [selectedItemId, selectedItemType, toggleDbVfs]); // Dependencies: selected item and DB toggle function

  // --- Creation Logic ---
  const createConversation = useCallback(
    async (
      parentId: string | null,
      title?: string,
      initialSystemPrompt?: string | null,
    ): Promise<string> => {
      // Use storage hook to create the conversation in DB
      const newId = await storage.createConversation(
        parentId,
        title,
        initialSystemPrompt,
      );
      // Automatically select the newly created conversation
      await selectItem(newId, "conversation");
      return newId; // Return the ID of the new conversation
    },
    [storage, selectItem], // Dependencies: storage hook and selectItem function
  );

  const createProject = useCallback(
    async (
      parentId: string | null,
      name: string = "New Project",
    ): Promise<{ id: string; name: string }> => {
      // Use storage hook to create the project in DB
      const newProject = await storage.createProject(name, parentId);
      // Don't select automatically; let the UI handle triggering edit mode
      return { id: newProject.id, name: newProject.name }; // Return ID and initial name
    },
    [storage], // Dependency: storage hook
  );

  // --- Deletion Logic ---
  const deleteItem = useCallback(
    async (id: string, type: SidebarItemType): Promise<void> => {
      const currentSelectedId = selectedItemId; // Capture ID before potential change

      // Prevent deleting non-empty projects (simple check)
      if (type === "project") {
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
          return; // Abort deletion
        }
      }

      try {
        // Call appropriate delete function from storage hook
        if (type === "conversation") {
          await storage.deleteConversation(id);
          // TODO: Optionally delete associated VFS data if vfsEnabled was true
        } else if (type === "project") {
          await storage.deleteProject(id);
          // TODO: Optionally delete associated VFS data if vfsEnabled was true
        }

        toast.success(`${type === "project" ? "Project" : "Chat"} deleted.`);

        // If the deleted item was the one currently selected, select the next available item
        if (currentSelectedId === id) {
          // Re-fetch all items to determine the next selection based on current sort order
          const allProjects = await db.projects.toArray();
          const allConversations = await db.conversations.toArray();
          const combinedItems: (DbProject | DbConversation)[] = [
            ...allProjects,
            ...allConversations,
          ];
          combinedItems.sort(
            (a, b) =>
              (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0),
          );
          const nextItem = combinedItems[0]; // Get the most recently updated remaining item
          // Select the next item (or null if none remain)
          await selectItem(
            nextItem?.id ?? null,
            nextItem
              ? "name" in nextItem // Check if project by checking 'name' property
                ? "project"
                : "conversation"
              : null,
          );
        }
        // LiveQuery will automatically update the sidebarItems list
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error(`Failed to delete ${type}:`, err);
        toast.error(`Failed to delete ${type}: ${message}`);
      }
    },
    [storage, selectedItemId, selectItem], // Dependencies: storage, selected ID, select function
  );

  // --- Renaming Logic ---
  const renameItem = useCallback(
    async (
      id: string,
      newName: string,
      type: SidebarItemType,
    ): Promise<void> => {
      const trimmedName = newName.trim();
      // Prevent renaming to empty string
      if (!trimmedName) {
        toast.error("Name cannot be empty.");
        throw new Error("Name cannot be empty."); // Signal failure to UI
      }
      try {
        // Call appropriate rename function from storage hook
        if (type === "conversation") {
          await storage.renameConversation(id, trimmedName);
          // If the renamed item is the currently active conversation, refresh its data
          if (id === selectedItemId && type === selectedItemType) {
            const updatedData = await db.conversations.get(id);
            setActiveConversationData(updatedData ?? null);
          }
        } else if (type === "project") {
          await storage.renameProject(id, trimmedName);
          // If the renamed item is the currently active project, refresh its data
          if (id === selectedItemId && type === selectedItemType) {
            const updatedData = await db.projects.get(id);
            setActiveProjectData(updatedData ?? null);
          }
        }
        // LiveQuery should update the name in sidebarItems automatically due to updatedAt change
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error(`Failed to rename ${type}:`, err);
        toast.error(`Failed to rename ${type}: ${message}`);
        throw err; // Re-throw to signal failure to UI
      }
    },
    [storage, selectedItemId, selectedItemType], // Dependencies: storage, selected item state
  );

  // --- Update System Prompt (Conversation Specific) ---
  const updateConversationSystemPrompt = useCallback(
    async (id: string, systemPrompt: string | null): Promise<void> => {
      // Call storage function to update DB
      await storage.updateConversationSystemPrompt(id, systemPrompt);
      // If the updated conversation is the currently selected one, refresh its active data
      if (id === selectedItemId && selectedItemType === "conversation") {
        const updatedData = await db.conversations.get(id);
        setActiveConversationData(updatedData ?? null);
      }
    },
    [storage, selectedItemId, selectedItemType], // Dependencies: storage, selected item state
  );

  // --- Import/Export ---
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

        // Prepare data for export (excluding internal IDs)
        const exportData = messagesToExport.map((msg) => ({
          role: msg.role,
          content: msg.content,
          createdAt: msg.createdAt.toISOString(), // Use ISO format for dates
        }));

        // Create JSON blob and trigger download
        const jsonString = JSON.stringify(exportData, null, 2); // Pretty print JSON
        const blob = new Blob([jsonString], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        // Generate a filename based on title and ID
        const filename = `${conversation.title.replace(/[^a-z0-9]/gi, "_").toLowerCase() || "chat"}_${conversationId.substring(0, 6)}.json`;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url); // Clean up blob URL
        toast.success(`Conversation "${conversation.title}" exported.`);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error("Export failed:", err);
        toast.error(`Export failed: ${message}`);
      }
    },
    [], // No dependencies needed as it uses db directly
  );

  const importConversation = useCallback(
    async (file: File, parentId: string | null) => {
      // Validate file type
      if (!file || file.type !== "application/json") {
        toast.error("Please select a valid JSON file.");
        return;
      }

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const jsonString = event.target?.result as string;
          const parsedData = JSON.parse(jsonString);

          // Validate the parsed data against the Zod schema
          const validationResult =
            conversationImportSchema.safeParse(parsedData);
          if (!validationResult.success) {
            // Log detailed validation errors and show user-friendly message
            console.error("Import validation error:", validationResult.error);
            toast.error(
              `Import failed: Invalid file format. ${validationResult.error.errors[0]?.message || ""}`,
            );
            return;
          }
          // Use the validated and transformed data
          const importedMessages = validationResult.data;

          // Create a new conversation for the imported messages
          const newConversationTitle = `Imported: ${file.name.replace(/\.json$/i, "").substring(0, 50)}`;
          const newConversationId = await storage.createConversation(
            parentId,
            newConversationTitle,
          );

          // Bulk add validated messages to the database
          if (importedMessages.length > 0) {
            await db.messages.bulkAdd(
              importedMessages.map((msg) => ({
                id: nanoid(), // Generate a new unique ID for each imported message
                role: msg.role,
                content: msg.content,
                createdAt: msg.createdAt, // Use the parsed Date object
                conversationId: newConversationId,
              })),
            );
            // Update the new conversation's timestamp to match the last imported message
            const lastMessageTime =
              importedMessages[importedMessages.length - 1].createdAt;
            await db.conversations.update(newConversationId, {
              updatedAt: lastMessageTime,
            });
          }

          // Select the newly imported conversation
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
      reader.readAsText(file); // Read the file content as text
    },
    [storage, selectItem], // Dependencies: storage hook and selectItem function
  );

  const exportAllConversations = useCallback(async () => {
    try {
      const allConversations = await db.conversations.toArray();
      if (allConversations.length === 0) {
        toast.info("No conversations to export.");
        return;
      }

      const exportData = [];
      // Iterate through each conversation and fetch its messages
      for (const conversation of allConversations) {
        const messages = await db.messages
          .where("conversationId")
          .equals(conversation.id)
          .sortBy("createdAt");
        // Add conversation metadata and messages to the export array
        exportData.push({
          _litechat_meta: {
            id: conversation.id,
            title: conversation.title,
            systemPrompt: conversation.systemPrompt,
            createdAt: conversation.createdAt.toISOString(),
            updatedAt: conversation.updatedAt.toISOString(),
            parentId: conversation.parentId,
            vfsEnabled: conversation.vfsEnabled, // Include VFS status in metadata
          },
          messages: messages.map((msg) => ({
            role: msg.role,
            content: msg.content,
            createdAt: msg.createdAt.toISOString(),
          })),
        });
      }

      // Note: This currently only exports conversations. Project structure and VFS data are not included.
      // TODO: Enhance export to include projects and potentially VFS data if needed.

      // Create JSON blob and trigger download
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
  }, []); // No dependencies needed as it uses db directly

  // Effect to load initial item on mount
  useEffect(() => {
    if (initialSelectedItemId && initialSelectedItemType) {
      // Use a small timeout to allow initial render/live query to potentially run
      const timer = setTimeout(() => {
        selectItem(initialSelectedItemId, initialSelectedItemType);
      }, 50);
      return () => clearTimeout(timer); // Clear timeout on unmount
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on component mount

  return {
    sidebarItems: sidebarItems || [], // Ensure sidebarItems is always an array
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
    activeProjectData, // Return active project data
    toggleVfsEnabled, // Return the UI toggle function
  };
}
