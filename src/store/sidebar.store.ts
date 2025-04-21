// src/store/sidebar.store.ts
import { create } from "zustand";
import type {
  SidebarItem,
  SidebarItemType,
  DbConversation,
  DbProject,
  ConversationSidebarItem,
  ProjectSidebarItem,
  MessageContent, // Import MessageContent
  DbMessage, // Import DbMessage
} from "@/lib/types";
import { nanoid } from "nanoid";
import { toast } from "sonner";
import { z } from "zod";
import { modEvents, ModEvent } from "@/mods/events";
// Import other stores for cross-store actions
import { useCoreChatStore } from "./core-chat.store";
import { useVfsStore } from "./vfs.store";
import { db } from "@/lib/db"; // Import Dexie instance

// Import Schema
const messageImportSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  createdAt: z
    .string()
    .datetime()
    .transform((date) => new Date(date)),
});
const conversationImportSchema = z.array(messageImportSchema);

export interface SidebarState {
  enableSidebar: boolean;
  selectedItemId: string | null;
  selectedItemType: SidebarItemType | null;
  dbProjects: DbProject[];
  dbConversations: DbConversation[];
}

export interface SidebarActions {
  setEnableSidebar: (enabled: boolean) => void;
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
  toggleVfsEnabled: (id: string, type: SidebarItemType) => Promise<void>;
  initializeFromDb: () => Promise<void>;
  getFirstItem: () => SidebarItem | null;
}

export const useSidebarStore = create<SidebarState & SidebarActions>()(
  (set, get) => ({
    // Initial State
    enableSidebar: true,
    selectedItemId: null,
    selectedItemType: null,
    dbProjects: [],
    dbConversations: [],

    // Actions
    setEnableSidebar: (enableSidebar) => set({ enableSidebar }),

    initializeFromDb: async () => {
      try {
        const [projects, conversations] = await Promise.all([
          db.projects.orderBy("updatedAt").reverse().toArray(),
          db.conversations.orderBy("updatedAt").reverse().toArray(),
        ]);
        set({ dbProjects: projects, dbConversations: conversations });
        console.log("[SidebarStore] Initialized from DB.");
      } catch (error) {
        console.error("[SidebarStore] Failed to initialize from DB:", error);
        toast.error("Failed to load sidebar data.");
      }
    },

    getFirstItem: () => {
      const { dbProjects, dbConversations } = get();
      const combinedItems: SidebarItem[] = [
        ...dbProjects.map(
          (p): ProjectSidebarItem => ({ ...p, type: "project" }),
        ),
        ...dbConversations.map(
          (c): ConversationSidebarItem => ({ ...c, type: "conversation" }),
        ),
      ];
      combinedItems.sort(
        (a, b) => (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0),
      );
      return combinedItems[0] || null;
    },

    selectItem: async (id, type) => {
      const currentId = get().selectedItemId;
      const currentType = get().selectedItemType;

      if (currentId === id && currentType === type) return;

      console.log(`[SidebarStore] Selecting item: ${type} - ${id}`);
      set({
        selectedItemId: id,
        selectedItemType: type,
      });

      const coreChatActions = useCoreChatStore.getState();
      if (type === "conversation" && id) {
        await coreChatActions.loadMessages(id);
      } else {
        await coreChatActions.loadMessages(null);
      }

      const vfsActions = useVfsStore.getState();
      let isVfsEnabledForItem = false;
      let vfsKey: string | null = null;

      if (id && type) {
        const allItems: SidebarItem[] = [
          ...get().dbProjects.map(
            (p): ProjectSidebarItem => ({ ...p, type: "project" }),
          ),
          ...get().dbConversations.map(
            (c): ConversationSidebarItem => ({ ...c, type: "conversation" }),
          ),
        ];
        const selectedItem = allItems.find(
          (item) => item.id === id && item.type === type,
        );
        isVfsEnabledForItem = selectedItem?.vfsEnabled ?? false;

        if (type === "project") {
          vfsKey = `project-${id}`;
        } else if (type === "conversation") {
          const convo = selectedItem as ConversationSidebarItem | undefined;
          if (convo?.parentId) {
            const parentProject = allItems.find(
              (item) => item.id === convo.parentId && item.type === "project",
            ) as ProjectSidebarItem | undefined;
            if (parentProject?.vfsEnabled) {
              vfsKey = `project-${convo.parentId}`;
              isVfsEnabledForItem = true;
            } else {
              vfsKey = null;
              isVfsEnabledForItem = false;
            }
          } else {
            vfsKey = "orphan";
            isVfsEnabledForItem = convo?.vfsEnabled ?? false;
          }
        }
      }

      vfsActions.setVfsKey(vfsKey);
      vfsActions.setIsVfsEnabledForItem(isVfsEnabledForItem);
      vfsActions.clearSelectedVfsPaths();

      modEvents.emit(ModEvent.CHAT_SELECTED, { id, type });
    },

    createConversation: async (parentId, title = "New Chat") => {
      try {
        const newId = nanoid();
        const now = new Date();
        const newConversation: DbConversation = {
          id: newId,
          parentId,
          title,
          systemPrompt: null,
          createdAt: now,
          updatedAt: now,
          vfsEnabled: false,
        };
        await db.conversations.add(newConversation);
        if (parentId) {
          await db.projects.update(parentId, { updatedAt: now });
        }
        modEvents.emit(ModEvent.CHAT_CREATED, {
          id: newId,
          type: "conversation",
          parentId,
        });
        await get().selectItem(newId, "conversation");
        return newId;
      } catch (error) {
        console.error("Failed to create conversation:", error);
        toast.error(
          `Failed to create chat: ${error instanceof Error ? error.message : String(error)}`,
        );
        throw error;
      }
    },

    createProject: async (parentId, name = "New Project") => {
      try {
        const newId = nanoid();
        const now = new Date();
        const newProject: DbProject = {
          id: newId,
          name,
          parentId,
          createdAt: now,
          updatedAt: now,
          vfsEnabled: false,
        };
        await db.projects.add(newProject);
        if (parentId) {
          await db.projects.update(parentId, { updatedAt: now });
        }
        modEvents.emit(ModEvent.CHAT_CREATED, {
          id: newProject.id,
          type: "project",
          parentId,
        });
        return { id: newProject.id, name: newProject.name };
      } catch (error) {
        console.error("Failed to create project:", error);
        toast.error(
          `Failed to create project: ${error instanceof Error ? error.message : String(error)}`,
        );
        throw error;
      }
    },

    deleteItem: async (id, type) => {
      const currentSelectedId = get().selectedItemId;

      if (type === "project") {
        try {
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
          await db.transaction(
            "rw",
            db.conversations,
            db.messages,
            async () => {
              await db.messages.where("conversationId").equals(id).delete();
              await db.conversations.delete(id);
            },
          );
        } else if (type === "project") {
          await db.projects.delete(id);
        }

        toast.success(`${type === "project" ? "Project" : "Chat"} deleted.`);
        modEvents.emit(ModEvent.CHAT_DELETED, { id, type });

        if (currentSelectedId === id) {
          const remainingItems: SidebarItem[] = [
            ...get().dbProjects.map(
              (p): ProjectSidebarItem => ({ ...p, type: "project" }),
            ),
            ...get().dbConversations.map(
              (c): ConversationSidebarItem => ({ ...c, type: "conversation" }),
            ),
          ];
          remainingItems.sort(
            (a, b) =>
              (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0),
          );
          const nextItem = remainingItems[0];
          await get().selectItem(nextItem?.id ?? null, nextItem?.type ?? null);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error(`Failed to delete ${type}:`, err);
        toast.error(`Failed to delete ${type}: ${message}`);
      }
    },

    renameItem: async (id, newName, type) => {
      const trimmedName = newName.trim();
      if (!trimmedName) {
        toast.error("Name cannot be empty.");
        throw new Error("Name cannot be empty.");
      }
      try {
        const now = new Date();
        if (type === "conversation") {
          const conversation = await db.conversations.get(id);
          await db.conversations.update(id, {
            title: trimmedName,
            updatedAt: now,
          });
          if (conversation?.parentId) {
            await db.projects.update(conversation.parentId, { updatedAt: now });
          }
        } else if (type === "project") {
          await db.projects.update(id, { name: trimmedName, updatedAt: now });
        }
        console.warn(
          "ModEvent.CHAT_RENAMED event emission skipped (event definition missing?)",
        );
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error(`Failed to rename ${type}:`, err);
        toast.error(`Failed to rename ${type}: ${message}`);
        throw err;
      }
    },

    updateConversationSystemPrompt: async (id, systemPrompt) => {
      try {
        await db.conversations.update(id, {
          systemPrompt: systemPrompt,
          updatedAt: new Date(),
        });
        console.warn(
          "ModEvent.CHAT_SYSTEM_PROMPT_UPDATED event emission skipped (event definition missing?)",
        );
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
        const conversation = await db.conversations.get(conversationId);
        const messagesToExport = await db.messages
          .where("conversationId")
          .equals(conversationId)
          .sortBy("createdAt");

        if (!conversation) {
          toast.warning("Cannot export non-existent conversation.");
          return;
        }
        // FIX: Add explicit type for msg
        const exportData = messagesToExport.map((msg: DbMessage) => ({
          role: msg.role,
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
          const newConversationId = nanoid();
          const now = new Date();
          const newConversation: DbConversation = {
            id: newConversationId,
            parentId,
            title: newConversationTitle,
            systemPrompt: null,
            createdAt: now,
            updatedAt: now,
            vfsEnabled: false,
          };
          await db.conversations.add(newConversation);
          if (parentId) {
            await db.projects.update(parentId, { updatedAt: now });
          }

          modEvents.emit(ModEvent.CHAT_CREATED, {
            id: newConversationId,
            type: "conversation",
            parentId,
          });

          if (importedMessages.length > 0) {
            await db.messages.bulkAdd(
              importedMessages.map((msg) => ({
                id: nanoid(),
                role: msg.role,
                content: msg.content as MessageContent,
                createdAt: msg.createdAt,
                conversationId: newConversationId,
              })),
            );
            const lastMessageTime =
              importedMessages[importedMessages.length - 1].createdAt;
            await db.conversations.update(newConversationId, {
              updatedAt: lastMessageTime,
            });
            if (parentId) {
              await db.projects.update(parentId, {
                updatedAt: lastMessageTime,
              });
            }
          }

          await get().selectItem(newConversationId, "conversation");
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

    exportAllConversations: async () => {
      toast.info("Exporting all conversations...");
      try {
        const allConversations = get().dbConversations;
        if (!allConversations || allConversations.length === 0) {
          toast.info("No conversations found to export.");
          return;
        }

        const exportPackage: any[] = [];

        for (const conversation of allConversations) {
          const messages = await db.messages
            .where("conversationId")
            .equals(conversation.id)
            .sortBy("createdAt");
          exportPackage.push({
            id: conversation.id,
            title: conversation.title,
            parentId: conversation.parentId,
            systemPrompt: conversation.systemPrompt,
            createdAt: conversation.createdAt.toISOString(),
            updatedAt: conversation.updatedAt.toISOString(),
            vfsEnabled: conversation.vfsEnabled,
            // FIX: Add explicit type for msg
            messages: messages.map((msg: DbMessage) => ({
              role: msg.role,
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
    },

    toggleVfsEnabled: async (id, type) => {
      const allItems: SidebarItem[] = [
        ...get().dbProjects.map(
          (p): ProjectSidebarItem => ({ ...p, type: "project" }),
        ),
        ...get().dbConversations.map(
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

      const optimisticNewVfsState = !item.vfsEnabled;

      try {
        // FIX: Use db.table.update
        const now = new Date();
        if (type === "conversation") {
          await db.conversations.update(id, {
            vfsEnabled: optimisticNewVfsState,
            updatedAt: now,
          });
          if (item.parentId) {
            await db.projects.update(item.parentId, { updatedAt: now });
          }
        } else if (type === "project") {
          await db.projects.update(id, {
            vfsEnabled: optimisticNewVfsState,
            updatedAt: now,
          });
          if (item.parentId) {
            await db.projects.update(item.parentId, { updatedAt: now });
          }
        }
        // State update via live query

        if (get().selectedItemId === id) {
          useVfsStore.getState().setIsVfsEnabledForItem(optimisticNewVfsState);
        }

        console.warn(
          "ModEvent.CHAT_VFS_TOGGLED event emission skipped (event definition missing?)",
        );

        toast.success(
          `Virtual Filesystem ${optimisticNewVfsState ? "enabled" : "disabled"} for ${type}.`,
        );
      } catch (err) {
        console.error("Failed to toggle VFS:", err);
        toast.error("Failed to update VFS setting.");
      }
    },
  }),
);
