// src/store/sidebar.store.ts
import { create } from "zustand";
import type {
  SidebarItem,
  SidebarItemType,
  DbConversation,
  DbProject,
  MessageContent,
  DbMessage,
} from "@/lib/types";
import { nanoid } from "nanoid";
import { toast } from "sonner";
import { z } from "zod";
import { modEvents, ModEvent } from "@/mods/events";
import { useCoreChatStore } from "./core-chat.store"; // Import Core Chat Store
import { useVfsStore } from "./vfs.store";
import { db } from "@/lib/db";

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
}

export const useSidebarStore = create<SidebarState & SidebarActions>()(
  (set, get) => ({
    // Initial State
    enableSidebar: true,
    selectedItemId: null,
    selectedItemType: null,

    // Actions
    setEnableSidebar: (enableSidebar) => set({ enableSidebar }),

    selectItem: async (id, type) => {
      const currentId = get().selectedItemId;
      const currentType = get().selectedItemType;

      if (currentId === id && currentType === type) {
        return; // No change
      }

      console.log(`[SidebarStore] Selecting item: ${type} - ${id}`);
      set({
        selectedItemId: id,
        selectedItemType: type,
      });

      // --- Trigger message loading ---
      const coreChatActions = useCoreChatStore.getState();
      if (type === "conversation" && id) {
        console.log(`[SidebarStore] Loading messages for conversation: ${id}`);
        await coreChatActions.loadMessages(id);
      } else {
        console.log(
          "[SidebarStore] Clearing messages (no conversation selected).",
        );
        await coreChatActions.loadMessages(null); // Clear messages if no conversation
      }
      // --- End Trigger message loading ---

      // --- VFS State Update ---
      const vfsActions = useVfsStore.getState();
      let isVfsEnabledForItem = false;
      let vfsKey: string | null = null;

      if (id && type) {
        let selectedItem: DbProject | DbConversation | undefined;
        let parentProject: DbProject | undefined;

        if (type === "project") {
          selectedItem = await db.projects.get(id);
        } else {
          selectedItem = await db.conversations.get(id);
          if (selectedItem?.parentId) {
            parentProject = await db.projects.get(selectedItem.parentId);
          }
        }

        isVfsEnabledForItem = selectedItem?.vfsEnabled ?? false;

        if (type === "project") {
          vfsKey = `project-${id}`;
        } else if (type === "conversation") {
          const convo = selectedItem as DbConversation | undefined;
          if (convo?.parentId && parentProject) {
            vfsKey = `project-${convo.parentId}`;
            isVfsEnabledForItem = parentProject.vfsEnabled ?? false;
          } else {
            vfsKey = "orphan";
            isVfsEnabledForItem = convo?.vfsEnabled ?? false;
          }
        }
      }

      console.log(
        `[SidebarStore] Updating VFS state: key=${vfsKey}, enabled=${isVfsEnabledForItem}`,
      );
      vfsActions.setVfsKey(vfsKey);
      vfsActions.setIsVfsEnabledForItem(isVfsEnabledForItem);
      vfsActions.clearSelectedVfsPaths(); // Clear selected VFS files on item change
      // --- End VFS State Update ---

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
        // Select the newly created conversation
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
        // Optionally select the new project, or let the user do it
        // await get().selectItem(newProject.id, "project");
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
      const itemToDelete =
        type === "project"
          ? await db.projects.get(id)
          : await db.conversations.get(id);

      if (!itemToDelete) {
        toast.error(`${type === "project" ? "Project" : "Chat"} not found.`);
        return;
      }

      if (type === "project") {
        try {
          const childProjectsCount = await db.projects
            .where("parentId")
            .equals(id)
            .count();
          const childConvosCount = await db.conversations
            .where("parentId")
            .equals(id)
            .count();
          if (childProjectsCount > 0 || childConvosCount > 0) {
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
        const parentId = itemToDelete.parentId;
        const now = new Date();

        await db.transaction(
          "rw",
          db.conversations,
          db.messages,
          db.projects,
          async (tx) => {
            if (type === "conversation") {
              await tx.messages.where("conversationId").equals(id).delete();
              await tx.conversations.delete(id);
            } else if (type === "project") {
              // Re-verify inside transaction for safety
              const finalChildProjects = await tx.projects
                .where("parentId")
                .equals(id)
                .count();
              const finalChildConvos = await tx.conversations
                .where("parentId")
                .equals(id)
                .count();
              if (finalChildProjects === 0 && finalChildConvos === 0) {
                await tx.projects.delete(id);
              } else {
                throw new Error(
                  "Project deletion aborted inside transaction due to existing children.",
                );
              }
            }
            // Update parent timestamp if applicable
            if (parentId) {
              await tx.projects.update(parentId, { updatedAt: now });
            }
          },
        );

        toast.success(
          `${type === "project" ? "Project" : "Chat"} "${
            type === "project"
              ? (itemToDelete as DbProject).name
              : (itemToDelete as DbConversation).title
          }" deleted.`,
        );
        modEvents.emit(ModEvent.CHAT_DELETED, { id, type });

        // If the deleted item was selected, select the next most recent item
        if (currentSelectedId === id) {
          const [projects, conversations] = await Promise.all([
            db.projects.orderBy("updatedAt").reverse().toArray(),
            db.conversations.orderBy("updatedAt").reverse().toArray(),
          ]);
          const remainingItems: SidebarItem[] = [
            ...projects.map((p) => ({ ...p, type: "project" as const })),
            ...conversations.map((c) => ({
              ...c,
              type: "conversation" as const,
            })),
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
        let parentId: string | null = null;

        if (type === "conversation") {
          const conversation = await db.conversations.get(id);
          parentId = conversation?.parentId ?? null;
          await db.conversations.update(id, {
            title: trimmedName,
            updatedAt: now,
          });
        } else if (type === "project") {
          const project = await db.projects.get(id);
          parentId = project?.parentId ?? null;
          await db.projects.update(id, { name: trimmedName, updatedAt: now });
        }

        if (parentId) {
          await db.projects.update(parentId, { updatedAt: now });
        }

        modEvents.emit(ModEvent.CHAT_RENAMED, {
          id,
          type,
          newName: trimmedName,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error(`Failed to rename ${type}:`, err);
        toast.error(`Failed to rename ${type}: ${message}`);
        throw err;
      }
    },

    updateConversationSystemPrompt: async (id, systemPrompt) => {
      try {
        const now = new Date();
        const conversation = await db.conversations.get(id);
        await db.conversations.update(id, {
          systemPrompt: systemPrompt,
          updatedAt: now,
        });
        if (conversation?.parentId) {
          await db.projects.update(conversation.parentId, { updatedAt: now });
        }
        modEvents.emit(ModEvent.CHAT_SYSTEM_PROMPT_UPDATED, {
          id,
          systemPrompt,
        });
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
        const exportData = messagesToExport.map((msg: DbMessage) => ({
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

          // Validate the structure of the imported data
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

          // Create a new conversation for the imported data
          const newConversationTitle = `Imported: ${file.name.replace(/\.json$/i, "").substring(0, 50)}`;
          const newConversationId = nanoid();
          const now = new Date();
          const newConversation: DbConversation = {
            id: newConversationId,
            parentId,
            title: newConversationTitle,
            systemPrompt: null, // Or try to extract from import if available
            createdAt: now,
            updatedAt: now,
            vfsEnabled: false, // Default VFS state for imported chats
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

          // Bulk add the imported messages
          if (importedMessages.length > 0) {
            await db.messages.bulkAdd(
              importedMessages.map((msg) => ({
                id: nanoid(), // Generate new IDs for imported messages
                role: msg.role,
                content: msg.content as MessageContent, // Assume content is string for now
                createdAt: msg.createdAt,
                conversationId: newConversationId,
              })),
            );
            // Update conversation timestamp to the last message's time
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

          // Select the newly imported conversation
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
        const allConversations = await db.conversations.toArray();
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
            // Conversation metadata
            id: conversation.id,
            title: conversation.title,
            parentId: conversation.parentId,
            systemPrompt: conversation.systemPrompt,
            createdAt: conversation.createdAt.toISOString(),
            updatedAt: conversation.updatedAt.toISOString(),
            vfsEnabled: conversation.vfsEnabled,
            // Messages
            messages: messages.map((msg: DbMessage) => ({
              role: msg.role,
              content:
                typeof msg.content === "string"
                  ? msg.content
                  : JSON.stringify(msg.content), // Basic serialization for complex content
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
      let item: DbProject | DbConversation | undefined;
      if (type === "conversation") {
        item = await db.conversations.get(id);
      } else {
        item = await db.projects.get(id);
      }

      if (!item) {
        toast.warning("Item not found to toggle VFS.");
        console.warn(
          `[SidebarStore] Item ${id} (${type}) not found for VFS toggle.`,
        );
        return;
      }

      const optimisticNewVfsState = !item.vfsEnabled;
      console.log(
        `[SidebarStore] Toggling VFS for ${type} ${id} to ${optimisticNewVfsState}`,
      );

      try {
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

        // If the toggled item is the currently selected item, update VfsStore
        if (get().selectedItemId === id) {
          const vfsStore = useVfsStore.getState();
          let newVfsKey: string | null = null;
          let newEnabledState = optimisticNewVfsState;

          // Determine the correct VFS key and potentially override enabled state based on parent project
          if (type === "project") {
            newVfsKey = `project-${id}`;
          } else if (type === "conversation") {
            const convo = item as DbConversation;
            if (convo.parentId) {
              const parentProject = await db.projects.get(convo.parentId);
              if (parentProject) {
                newVfsKey = `project-${convo.parentId}`;
                // For conversations, we need to check if the parent project has VFS enabled
                // If the parent project has VFS enabled, the conversation inherits that
                newEnabledState = parentProject.vfsEnabled ?? false;
              } else {
                // Parent project not found, treat as orphan
                newVfsKey = "orphan";
              }
            } else {
              // Orphan conversation
              newVfsKey = "orphan";
            }
          }

          console.log(
            `[SidebarStore] Updating VFS store: isVfsEnabledForItem=${newEnabledState}, vfsKey=${newVfsKey}`,
          );

          // Reset VFS state first to force a clean initialization
          if (vfsStore.isVfsReady) {
            console.log(
              `[SidebarStore] Resetting VFS ready state before changing key/enabled state`,
            );
            vfsStore.setVfsReady(false);
            vfsStore.setConfiguredVfsKey(null);
            vfsStore._setFsInstance(null);
          }

          // Update VFS store state
          vfsStore.setVfsKey(newVfsKey);
          vfsStore.setIsVfsEnabledForItem(newEnabledState);

          // Directly initialize VFS if enabled
          if (newEnabledState) {
            console.log(
              "[SidebarStore] Directly initializing VFS after toggle",
            );
            // Use setTimeout to ensure state updates propagate before init
            setTimeout(() => {
              vfsStore.initializeVfs();
            }, 0);
          }
        }

        modEvents.emit(ModEvent.CHAT_VFS_TOGGLED, {
          id,
          type,
          enabled: optimisticNewVfsState,
        });

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
