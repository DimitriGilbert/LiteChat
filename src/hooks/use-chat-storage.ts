// src/hooks/use-chat-storage.ts
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import type {
  DbConversation,
  DbMessage,
  DbApiKey,
  DbProject,
  SidebarItemType,
} from "@/lib/types";
import { nanoid } from "nanoid";
import { useCallback } from "react"; // Import useCallback

export function useChatStorage() {
  // === Live Queries (remain the same) ===
  const projects = useLiveQuery(
    () => db.projects.orderBy("updatedAt").reverse().toArray(),
    [],
    [],
  );
  const conversations = useLiveQuery(
    () => db.conversations.orderBy("updatedAt").reverse().toArray(),
    [],
    [],
  );
  const apiKeys = useLiveQuery(
    () => db.apiKeys.orderBy("createdAt").toArray(),
    [],
    [],
  );

  // === Projects (Wrap functions in useCallback) ===
  const createProject = useCallback(
    async (
      name: string = "New Project",
      parentId: string | null = null,
    ): Promise<DbProject> => {
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
      return newProject;
    },
    [], // No dependencies needed for this DB operation
  );

  const renameProject = useCallback(
    async (id: string, newName: string): Promise<void> => {
      try {
        await db.projects.update(id, { name: newName, updatedAt: new Date() });
      } catch (error) {
        console.error(`useChatStorage: Failed to update project ${id}`, error);
        throw error;
      }
    },
    [], // No dependencies needed
  );

  const deleteProject = useCallback(async (id: string): Promise<void> => {
    await db.projects.delete(id);
  }, []); // No dependencies needed

  const getProject = useCallback(
    async (id: string): Promise<DbProject | undefined> => {
      return db.projects.get(id);
    },
    [], // No dependencies needed
  );

  const countChildProjects = useCallback(
    async (parentId: string): Promise<number> => {
      return db.projects.where("parentId").equals(parentId).count();
    },
    [], // No dependencies needed
  );

  // === Conversations (Wrap functions in useCallback) ===
  const createConversation = useCallback(
    async (
      parentId: string | null = null,
      title: string = "New Chat",
      initialSystemPrompt?: string | null,
    ): Promise<string> => {
      const newId = nanoid();
      const now = new Date();
      const newConversation: DbConversation = {
        id: newId,
        parentId,
        title,
        systemPrompt: initialSystemPrompt ?? null,
        createdAt: now,
        updatedAt: now,
        vfsEnabled: false,
      };
      await db.conversations.add(newConversation);
      if (parentId) {
        await db.projects.update(parentId, { updatedAt: now });
      }
      return newId;
    },
    [], // No dependencies needed
  );

  const deleteConversation = useCallback(async (id: string): Promise<void> => {
    await db.transaction("rw", db.conversations, db.messages, async () => {
      await db.messages.where("conversationId").equals(id).delete();
      await db.conversations.delete(id);
    });
  }, []); // No dependencies needed

  const renameConversation = useCallback(
    async (id: string, newTitle: string): Promise<void> => {
      const now = new Date();
      const conversation = await db.conversations.get(id);
      await db.conversations.update(id, {
        title: newTitle,
        updatedAt: now,
      });
      if (conversation?.parentId) {
        await db.projects.update(conversation.parentId, { updatedAt: now });
      }
    },
    [], // No dependencies needed
  );

  const updateConversationSystemPrompt = useCallback(
    async (id: string, systemPrompt: string | null): Promise<void> => {
      await db.conversations.update(id, {
        systemPrompt: systemPrompt,
        updatedAt: new Date(),
      });
    },
    [], // No dependencies needed
  );

  const getConversation = useCallback(
    async (id: string): Promise<DbConversation | undefined> => {
      return db.conversations.get(id);
    },
    [], // No dependencies needed
  );

  const countChildConversations = useCallback(
    async (parentId: string): Promise<number> => {
      return db.conversations.where("parentId").equals(parentId).count();
    },
    [], // No dependencies needed
  );

  // === VFS Toggle (Wrap in useCallback) ===
  const toggleVfsEnabled = useCallback(
    async (id: string, type: SidebarItemType): Promise<void> => {
      const now = new Date();
      // Use separate if blocks to satisfy TypeScript's type checking for update
      if (type === "conversation") {
        const current = await db.conversations.get(id);
        if (current) {
          await db.conversations.update(id, {
            vfsEnabled: !current.vfsEnabled,
            updatedAt: now,
          });
          if (current.parentId) {
            await db.projects.update(current.parentId, { updatedAt: now });
          }
        } else {
          console.warn(
            `[DB] Item ${id} (conversation) not found for VFS toggle.`,
          );
          throw new Error("Item not found");
        }
      } else if (type === "project") {
        const current = await db.projects.get(id);
        if (current) {
          await db.projects.update(id, {
            vfsEnabled: !current.vfsEnabled,
            updatedAt: now,
          });
          if (current.parentId) {
            await db.projects.update(current.parentId, { updatedAt: now });
          }
        } else {
          console.warn(`[DB] Item ${id} (project) not found for VFS toggle.`);
          throw new Error("Item not found");
        }
      } else {
        console.warn(`[DB] Unknown item type ${type} for VFS toggle.`);
        throw new Error("Unknown item type");
      }
    },
    [], // No dependencies needed
  );

  // === Messages (Wrap functions in useCallback) ===
  const getMessagesForConversation = useCallback(
    async (conversationId: string): Promise<DbMessage[]> => {
      return db.messages
        .where("conversationId")
        .equals(conversationId)
        .sortBy("createdAt");
    },
    [], // No dependencies needed
  );

  const addDbMessage = useCallback(
    async (
      messageData: Omit<DbMessage, "id" | "createdAt"> &
        Partial<Pick<DbMessage, "id" | "createdAt">>,
    ): Promise<string> => {
      if (!messageData.conversationId) {
        throw new Error("Cannot add message without a conversationId");
      }
      const newMessage: DbMessage = {
        id: messageData.id ?? nanoid(),
        createdAt: messageData.createdAt ?? new Date(),
        role: messageData.role,
        content: messageData.content,
        conversationId: messageData.conversationId,
        vfsContextPaths: messageData.vfsContextPaths ?? undefined,
      };
      const conversation = await db.conversations.get(
        messageData.conversationId,
      );
      await db.messages.add(newMessage);
      const now = new Date();
      await db.conversations.update(messageData.conversationId, {
        updatedAt: now,
      });
      if (conversation?.parentId) {
        await db.projects.update(conversation.parentId, { updatedAt: now });
      }
      return newMessage.id;
    },
    [], // No dependencies needed
  );

  const updateDbMessageContent = useCallback(
    async (messageId: string, newContent: string): Promise<void> => {
      await db.messages.update(messageId, { content: newContent });
    },
    [], // No dependencies needed
  );

  const deleteDbMessage = useCallback(
    async (messageId: string): Promise<void> => {
      await db.messages.delete(messageId);
    },
    [],
  ); // No dependencies needed

  const getDbMessagesUpTo = useCallback(
    async (convId: string, messageId: string): Promise<DbMessage[]> => {
      const targetMsg = await db.messages.get(messageId);
      if (!targetMsg) return [];
      return db.messages
        .where("conversationId")
        .equals(convId)
        .and((msg) => msg.createdAt.getTime() < targetMsg.createdAt.getTime())
        .sortBy("createdAt");
    },
    [], // No dependencies needed
  );

  const bulkAddMessages = useCallback(
    async (messages: DbMessage[]): Promise<unknown> => {
      return db.messages.bulkAdd(messages);
    },
    [], // No dependencies needed
  );

  const updateConversationTimestamp = useCallback(
    async (id: string, date: Date): Promise<void> => {
      await db.conversations.update(id, { updatedAt: date });
      const conversation = await db.conversations.get(id);
      if (conversation?.parentId) {
        await db.projects.update(conversation.parentId, { updatedAt: date });
      }
    },
    [], // No dependencies needed
  );

  // === API Keys (Wrap functions in useCallback) ===
  const addApiKey = useCallback(
    async (
      name: string,
      providerId: string,
      value: string,
    ): Promise<string> => {
      const newId = nanoid();
      const newKey: DbApiKey = {
        id: newId,
        name,
        providerId,
        value,
        createdAt: new Date(),
      };
      await db.apiKeys.add(newKey);
      return newId;
    },
    [], // No dependencies needed
  );

  const deleteApiKey = useCallback(async (id: string): Promise<void> => {
    await db.apiKeys.delete(id);
  }, []); // No dependencies needed

  // === Data Management (Wrap in useCallback) ===
  const clearAllData = useCallback(async (): Promise<void> => {
    await db.delete();
  }, []); // No dependencies needed

  // Return memoized functions and live query results
  return {
    // Projects
    projects: projects || [],
    createProject,
    renameProject,
    deleteProject,
    getProject,
    countChildProjects,
    // Conversations
    conversations: conversations || [],
    createConversation,
    deleteConversation,
    renameConversation,
    updateConversationSystemPrompt,
    getConversation,
    updateConversationTimestamp,
    countChildConversations,
    // VFS Toggle
    toggleVfsEnabled,
    // Messages
    getMessagesForConversation,
    addDbMessage,
    updateDbMessageContent,
    deleteDbMessage,
    getDbMessagesUpTo,
    bulkAddMessages,
    // API Keys
    apiKeys: apiKeys || [],
    addApiKey,
    deleteApiKey,
    // Data Management
    clearAllData,
  };
}
