// src/store/sidebar.store.ts
import { create } from "zustand";
import type {
  SidebarItem,
  SidebarItemType,
  DbConversation,
  DbProject,
  ConversationSidebarItem,
  ProjectSidebarItem,
  DbMessage, // Added for import/export logic
} from "@/lib/types";
import { nanoid } from "nanoid";
import { toast } from "sonner";
import { z } from "zod";
import { modEvents, ModEvent } from "@/mods/events";
// Import other stores for cross-store actions
import { useCoreChatStore } from "./core-chat.store";
import { useVfsStore } from "./vfs.store";

// --- Mock/Placeholder Dependencies ---
// These represent external dependencies that need proper injection (Task 8)

// Placeholder storage functions (simulating access via a service/hook result)
// TODO: Replace with actual injected storage service in Task 8
const storage = {
  // Projects
  createProject: async (
    name: string = "New Project",
    parentId: string | null = null,
  ): Promise<DbProject> => {
    console.warn("Placeholder storage.createProject called", {
      name,
      parentId,
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    const newId = nanoid();
    const now = new Date();
    return {
      id: newId,
      name,
      parentId,
      createdAt: now,
      updatedAt: now,
      vfsEnabled: false,
    };
  },
  renameProject: async (id: string, newName: string): Promise<void> => {
    console.warn("Placeholder storage.renameProject called", { id, newName });
    await new Promise((resolve) => setTimeout(resolve, 50));
  },
  deleteProject: async (id: string): Promise<void> => {
    console.warn("Placeholder storage.deleteProject called", { id });
    await new Promise((resolve) => setTimeout(resolve, 50));
  },
  countChildProjects: async (parentId: string): Promise<number> => {
    console.warn("Placeholder storage.countChildProjects called", { parentId });
    await new Promise((resolve) => setTimeout(resolve, 50));
    return 0; // Simulate no children
  },
  getProject: async (id: string): Promise<DbProject | undefined> => {
    console.warn("Placeholder storage.getProject called", { id });
    await new Promise((resolve) => setTimeout(resolve, 50));
    // Simulate finding a project if needed for delete logic derivation
    return undefined;
  },
  // Conversations
  createConversation: async (
    parentId: string | null = null,
    title: string = "New Chat",
    initialSystemPrompt?: string | null,
  ): Promise<string> => {
    console.warn("Placeholder storage.createConversation called", {
      parentId,
      title,
      initialSystemPrompt,
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    return nanoid(); // Return a new ID
  },
  deleteConversation: async (id: string): Promise<void> => {
    console.warn("Placeholder storage.deleteConversation called", { id });
    await new Promise((resolve) => setTimeout(resolve, 50));
    // Simulate deleting messages as well
  },
  renameConversation: async (id: string, newTitle: string): Promise<void> => {
    console.warn("Placeholder storage.renameConversation called", {
      id,
      newTitle,
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
  },
  updateConversationSystemPrompt: async (
    id: string,
    systemPrompt: string | null,
  ): Promise<void> => {
    console.warn("Placeholder storage.updateConversationSystemPrompt called", {
      id,
      systemPrompt,
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
  },
  getConversation: async (id: string): Promise<DbConversation | undefined> => {
    console.warn("Placeholder storage.getConversation called", { id });
    await new Promise((resolve) => setTimeout(resolve, 50));
    // Simulate finding a conversation for export/delete logic
    return {
      id: id,
      title: "Simulated Chat",
      parentId: null,
      systemPrompt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      vfsEnabled: false,
    };
  },
  getMessagesForConversation: async (
    conversationId: string,
  ): Promise<DbMessage[]> => {
    console.warn("Placeholder storage.getMessagesForConversation called", {
      conversationId,
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    // Simulate messages for export
    return [
      {
        id: nanoid(),
        conversationId,
        role: "user",
        content: "Hello",
        createdAt: new Date(Date.now() - 10000),
      },
      {
        id: nanoid(),
        conversationId,
        role: "assistant",
        content: "Hi there!",
        createdAt: new Date(),
      },
    ];
  },
  bulkAddMessages: async (messages: DbMessage[]): Promise<unknown> => {
    console.warn("Placeholder storage.bulkAddMessages called", messages);
    await new Promise((resolve) => setTimeout(resolve, 50));
    return true;
  },
  updateConversationTimestamp: async (
    id: string,
    date: Date,
  ): Promise<void> => {
    console.warn("Placeholder storage.updateConversationTimestamp called", {
      id,
      date,
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
  },
  countChildConversations: async (parentId: string): Promise<number> => {
    console.warn("Placeholder storage.countChildConversations called", {
      parentId,
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    return 0; // Simulate no children
  },
  // VFS Toggle
  toggleVfsEnabled: async (
    id: string,
    type: SidebarItemType,
  ): Promise<void> => {
    // This placeholder needs to simulate the toggle for the optimistic update in the action
    console.warn("Placeholder storage.toggleVfsEnabled called", { id, type });
    await new Promise((resolve) => setTimeout(resolve, 50));
    // In a real scenario, this would update the DB item.
    // The live query would then update the zustand state holding dbProjects/dbConversations.
  },
  // Data Management (for export all)
  getAllConversations: async (): Promise<DbConversation[]> => {
    console.warn("Placeholder storage.getAllConversations called");
    await new Promise((resolve) => setTimeout(resolve, 100));
    // Simulate returning a list of conversations
    return [
      {
        id: "conv1",
        title: "Simulated Chat 1",
        parentId: null,
        systemPrompt: null,
        createdAt: new Date(Date.now() - 20000),
        updatedAt: new Date(Date.now() - 10000),
        vfsEnabled: false,
      },
      {
        id: "conv2",
        title: "Simulated Chat 2",
        parentId: null,
        systemPrompt: "Be helpful",
        createdAt: new Date(Date.now() - 5000),
        updatedAt: new Date(),
        vfsEnabled: true,
      },
    ];
  },
  // Need projects for delete logic derivation
  getAllProjects: async (): Promise<DbProject[]> => {
    console.warn("Placeholder storage.getAllProjects called");
    await new Promise((resolve) => setTimeout(resolve, 100));
    return [
      {
        id: "proj1",
        name: "Simulated Project 1",
        parentId: null,
        createdAt: new Date(Date.now() - 30000),
        updatedAt: new Date(Date.now() - 5000),
        vfsEnabled: false,
      },
    ];
  },
};

// Import Schema (copied from useSidebarManagement)
const messageImportSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(), // Assuming simple string content for import for now
  createdAt: z
    .string()
    .datetime()
    .transform((date) => new Date(date)),
});
const conversationImportSchema = z.array(messageImportSchema);

// --- End Mock/Placeholder Dependencies ---

export interface SidebarState {
  enableSidebar: boolean;
  // sidebarItems: SidebarItem[]; // REMOVED - Will be derived later
  selectedItemId: string | null;
  selectedItemType: SidebarItemType | null;
  // Need temporary state to hold items for delete logic until derivation is implemented
  // TODO: Remove these once sidebarItems derivation from dbProjects/dbConversations is done
  tempDbProjects: DbProject[];
  tempDbConversations: DbConversation[];
}

export interface SidebarActions {
  setEnableSidebar: (enabled: boolean) => void;
  // setSidebarItems: (items: SidebarItem[]) => void; // REMOVED
  // TODO: Add actions to set tempDbProjects and tempDbConversations from storage hook results
  setTempDbProjects: (projects: DbProject[]) => void;
  setTempDbConversations: (conversations: DbConversation[]) => void;
  // selectItem handles setting both ID and Type, plus side effects
  selectItem: (
    id: string | null,
    type: SidebarItemType | null,
  ) => Promise<void>;
  createConversation: (
    parentId: string | null,
    title?: string,
  ) => Promise<string>; // Needs storage access
  createProject: (
    parentId: string | null,
    name?: string,
  ) => Promise<{ id: string; name: string }>; // Needs storage access
  deleteItem: (id: string, type: SidebarItemType) => Promise<void>; // Needs storage access
  renameItem: (
    id: string,
    newName: string,
    type: SidebarItemType,
  ) => Promise<void>; // Needs storage access
  updateConversationSystemPrompt: (
    id: string,
    systemPrompt: string | null,
  ) => Promise<void>; // Needs storage access
  exportConversation: (conversationId: string | null) => Promise<void>; // Needs implementation
  importConversation: (file: File, parentId: string | null) => Promise<void>; // Needs implementation
  exportAllConversations: () => Promise<void>; // Needs implementation
  toggleVfsEnabled: (id: string, type: SidebarItemType) => Promise<void>; // Needs storage access & VFS store update
  // Derived data (activeItemData, activeConversationData) should be handled by selectors outside the store
}

export const useSidebarStore = create<SidebarState & SidebarActions>()(
  (set, get) => ({
    // Initial State
    enableSidebar: true,
    // sidebarItems: [], // REMOVED
    selectedItemId: null,
    selectedItemType: null,
    tempDbProjects: [], // TODO: Remove later
    tempDbConversations: [], // TODO: Remove later

    // Actions
    setEnableSidebar: (enableSidebar) => set({ enableSidebar }),
    // setSidebarItems: (sidebarItems) => set({ sidebarItems }), // REMOVED
    setTempDbProjects: (tempDbProjects) => set({ tempDbProjects }), // TODO: Remove later
    setTempDbConversations: (tempDbConversations) =>
      set({ tempDbConversations }), // TODO: Remove later

    selectItem: async (id, type) => {
      const currentId = get().selectedItemId;
      const currentType = get().selectedItemType;

      // No change if ID and type are the same
      if (currentId === id && currentType === type) return;

      console.log(`[SidebarStore] Selecting item: ${type} - ${id}`);
      set({
        selectedItemId: id,
        selectedItemType: type,
      });

      // --- Trigger side effects in other stores ---

      // 1. Load messages if a conversation is selected
      const coreChatActions = useCoreChatStore.getState();
      if (type === "conversation" && id) {
        await coreChatActions.loadMessages(id);
      } else {
        // Clear messages if no conversation selected or ID is null
        await coreChatActions.loadMessages(null);
      }

      // 2. Update VFS enabled status for the item and clear selection
      const vfsActions = useVfsStore.getState();
      let isVfsEnabledForItem = false;
      if (id && type) {
        // TODO: Replace this temporary lookup with proper derivation logic
        const allItems: SidebarItem[] = [
          ...get().tempDbProjects.map(
            (p): ProjectSidebarItem => ({ ...p, type: "project" }),
          ),
          ...get().tempDbConversations.map(
            (c): ConversationSidebarItem => ({ ...c, type: "conversation" }),
          ),
        ];
        const selectedItem = allItems.find(
          (item) => item.id === id && item.type === type,
        );
        isVfsEnabledForItem = selectedItem?.vfsEnabled ?? false;
      }
      vfsActions.setIsVfsEnabledForItem(isVfsEnabledForItem);
      vfsActions.clearSelectedVfsPaths(); // Clear VFS selection on item change

      // 3. Emit mod event
      modEvents.emit(ModEvent.CHAT_SELECTED, { id, type });
    },

    createConversation: async (parentId, title = "New Chat") => {
      try {
        // Use passed-in DB function
        const newId = await storage.createConversation(parentId, title);
        // Emit event *before* selecting, so listeners know about it first
        modEvents.emit(ModEvent.CHAT_CREATED, {
          id: newId,
          type: "conversation",
          parentId,
        });
        await get().selectItem(newId, "conversation"); // Select the new item
        // Note: No optimistic UI update here. Relies on storage update triggering live query.
        return newId;
      } catch (error) {
        console.error("Failed to create conversation:", error);
        toast.error(
          `Failed to create chat: ${error instanceof Error ? error.message : String(error)}`,
        );
        throw error; // Re-throw
      }
    },

    createProject: async (parentId, name = "New Project") => {
      try {
        // Use passed-in DB function
        const newProject = await storage.createProject(name, parentId);
        // Emit event
        modEvents.emit(ModEvent.CHAT_CREATED, {
          id: newProject.id,
          type: "project",
          parentId,
        });
        // Note: No selection change, no optimistic UI update needed.
        return { id: newProject.id, name: newProject.name };
      } catch (error) {
        console.error("Failed to create project:", error);
        toast.error(
          `Failed to create project: ${error instanceof Error ? error.message : String(error)}`,
        );
        throw error; // Re-throw
      }
    },

    deleteItem: async (id, type) => {
      const currentSelectedId = get().selectedItemId; // Capture before potential change

      if (type === "project") {
        try {
          // Use passed-in DB functions
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
        // Use passed-in DB functions
        if (type === "conversation") {
          await storage.deleteConversation(id);
        } else if (type === "project") {
          await storage.deleteProject(id);
        }

        toast.success(`${type === "project" ? "Project" : "Chat"} deleted.`);
        // Emit 'chat:deleted' event
        modEvents.emit(ModEvent.CHAT_DELETED, { id, type });

        // If the deleted item was selected, select the next most recent item
        if (currentSelectedId === id) {
          // TODO: Replace this temporary derivation with proper selector logic
          // Fetch fresh data (simulated) - in reality, live queries update state
          const currentProjects = await storage.getAllProjects(); // Simulate fetch
          const currentConversations = await storage.getAllConversations(); // Simulate fetch
          get().setTempDbProjects(currentProjects); // Update temp state
          get().setTempDbConversations(currentConversations); // Update temp state

          const remainingItems: SidebarItem[] = [
            ...currentProjects.map(
              (p): ProjectSidebarItem => ({ ...p, type: "project" }),
            ),
            ...currentConversations.map(
              (c): ConversationSidebarItem => ({ ...c, type: "conversation" }),
            ),
          ];

          // Sort remaining items by updatedAt descending (nulls last)
          remainingItems.sort(
            (a, b) =>
              (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0),
          );
          const nextItem = remainingItems[0];
          await get().selectItem(nextItem?.id ?? null, nextItem?.type ?? null);
        }
        // If a different item was selected, no need to change selection
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error(`Failed to delete ${type}:`, err);
        toast.error(`Failed to delete ${type}: ${message}`);
        // Note: No optimistic UI update rollback needed as we rely on storage updates.
      }
    },

    renameItem: async (id, newName, type) => {
      const trimmedName = newName.trim();
      if (!trimmedName) {
        toast.error("Name cannot be empty.");
        throw new Error("Name cannot be empty.");
      }
      try {
        // Use passed-in DB functions
        if (type === "conversation") {
          await storage.renameConversation(id, trimmedName);
        } else if (type === "project") {
          await storage.renameProject(id, trimmedName);
        }
        // Emit event
        modEvents.emit(ModEvent.CHAT_RENAMED, {
          id,
          type,
          newName: trimmedName,
        });
        // Note: No optimistic UI update. Relies on storage update.
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error(`Failed to rename ${type}:`, err);
        toast.error(`Failed to rename ${type}: ${message}`);
        throw err; // Re-throw so UI can handle (e.g., revert edit state)
      }
    },

    updateConversationSystemPrompt: async (id, systemPrompt) => {
      try {
        await storage.updateConversationSystemPrompt(id, systemPrompt);
        // Emit event
        modEvents.emit(ModEvent.CHAT_SYSTEM_PROMPT_UPDATED, {
          id,
          systemPrompt,
        });
        // Note: No optimistic UI update. Relies on storage update.
      } catch (error) {
        console.error("Failed to update system prompt:", error);
        toast.error(
          `Failed to update system prompt: ${error instanceof Error ? error.message : String(error)}`,
        );
        throw error;
      }
    },

    exportConversation: async (conversationId) => {
      if (!conversationId) {
        toast.error("No conversation selected to export.");
        return;
      }
      try {
        // Use passed-in DB functions
        const conversation = await storage.getConversation(conversationId);
        const messagesToExport =
          await storage.getMessagesForConversation(conversationId);

        if (!conversation) {
          // Should ideally not happen if ID is valid, but check anyway
          toast.warning("Cannot export non-existent conversation.");
          return;
        }
        // Map to the simple export format
        const exportData = messagesToExport.map((msg) => ({
          role: msg.role,
          // Assuming simple string content for export for now
          content:
            typeof msg.content === "string"
              ? msg.content
              : JSON.stringify(msg.content),
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

    importConversation: async (file, parentId) => {
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
          const newConversationId = await storage.createConversation(
            parentId,
            newConversationTitle,
          );
          // Emit event *before* selecting
          modEvents.emit(ModEvent.CHAT_CREATED, {
            id: newConversationId,
            type: "conversation",
            parentId,
          });

          if (importedMessages.length > 0) {
            // Use passed-in DB function
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
            // Use passed-in DB function
            await storage.updateConversationTimestamp(
              newConversationId,
              lastMessageTime,
            );
          }

          await get().selectItem(newConversationId, "conversation"); // Select the new item
          toast.success(
            `Conversation imported successfully as "${newConversationTitle}"!`,
          );
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : "Unknown error";
          console.error("Import failed:", err);
          toast.error(`Import failed: ${message}`);
          // Attempt to clean up partially created conversation if creation succeeded but import failed later?
          // Might be complex, maybe just leave it for the user to delete.
        }
      };
      reader.onerror = () => {
        toast.error("Failed to read the file.");
      };
      reader.readAsText(file);
    },

    exportAllConversations: async () => {
      toast.info("Exporting all conversations...");
      try {
        const allConversations = await storage.getAllConversations();
        if (!allConversations || allConversations.length === 0) {
          toast.info("No conversations found to export.");
          return;
        }

        const exportPackage: any[] = [];

        for (const conversation of allConversations) {
          const messages = await storage.getMessagesForConversation(
            conversation.id,
          );
          exportPackage.push({
            id: conversation.id,
            title: conversation.title,
            parentId: conversation.parentId,
            systemPrompt: conversation.systemPrompt,
            createdAt: conversation.createdAt.toISOString(),
            updatedAt: conversation.updatedAt.toISOString(),
            vfsEnabled: conversation.vfsEnabled,
            messages: messages.map((msg) => ({
              role: msg.role,
              // Assuming simple string content for export for now
              content:
                typeof msg.content === "string"
                  ? msg.content
                  : JSON.stringify(msg.content),
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
        link.download = `t3_chat_all_export_${timestamp}.json`;
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
    },

    toggleVfsEnabled: async (id, type) => {
      // TODO: Replace this temporary lookup with proper derivation logic
      const allItems: SidebarItem[] = [
        ...get().tempDbProjects.map(
          (p): ProjectSidebarItem => ({ ...p, type: "project" }),
        ),
        ...get().tempDbConversations.map(
          (c): ConversationSidebarItem => ({ ...c, type: "conversation" }),
        ),
      ];
      const item = allItems.find((i) => i.id === id && i.type === type);

      if (!item) {
        toast.warning("Item not found to toggle VFS.");
        console.warn(
          `[SidebarStore] Item ${id} (${type}) not found for VFS toggle.`,
        );
        return;
      }

      const currentVfsState = item.vfsEnabled;
      const optimisticNewVfsState = !currentVfsState;

      try {
        // Call storage function first
        await storage.toggleVfsEnabled(id, type);

        // Update VFS store *if* the toggled item is the selected one
        if (get().selectedItemId === id) {
          useVfsStore.getState().setIsVfsEnabledForItem(optimisticNewVfsState);
        }

        // Emit event
        modEvents.emit(ModEvent.CHAT_VFS_TOGGLED, {
          id,
          type,
          enabled: optimisticNewVfsState,
        });

        toast.success(
          `Virtual Filesystem ${optimisticNewVfsState ? "enabled" : "disabled"} for ${type}.`,
        );
        // Note: No optimistic UI update for the item list itself. Relies on storage update.
      } catch (err) {
        console.error("Failed to toggle VFS:", err);
        toast.error("Failed to update VFS setting.");
        // Rollback VFS store state if needed? Unlikely to be necessary if storage fails.
      }
    },
  }),
);
