// src/hooks/use-chat-storage.ts
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import type {
  DbConversation,
  DbMessage,
  DbApiKey,
  DbProject,
  SidebarItemType, // Ensure SidebarItemType is imported
} from "@/lib/types";
import { nanoid } from "nanoid";

// Note: This hook provides low-level DB access.
// Higher-level logic (like fetching tree structures) is in use-conversation-management.
export function useChatStorage() {
  // === Projects ===
  const projects = useLiveQuery(
    () => db.projects.orderBy("updatedAt").reverse().toArray(),
    [], // Dependencies
    [], // Initial value
  );

  const createProject = async (
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
      vfsEnabled: false, // Initialize vfsEnabled
    };
    await db.projects.add(newProject);
    // If nested, update parent project's timestamp
    if (parentId) {
      await db.projects.update(parentId, { updatedAt: now });
    }
    return newProject;
  };

  const renameProject = async (id: string, newName: string): Promise<void> => {
    try {
      console.log(
        `useChatStorage: Updating project ${id} name to "${newName}"`,
      );
      await db.projects.update(id, { name: newName, updatedAt: new Date() });
      console.log(`useChatStorage: Project ${id} updated successfully.`);
    } catch (error) {
      console.error(`useChatStorage: Failed to update project ${id}`, error);
      throw error; // Re-throw the error
    }
  };

  const deleteProject = async (id: string): Promise<void> => {
    // Simple delete: Assumes children are handled elsewhere or deletion is prevented if children exist.
    // For cascading delete, a transaction would be needed.
    await db.projects.delete(id); // Simple delete for now
    // TODO: Consider deleting associated VFS data if vfsEnabled was true
  };

  const getProject = async (id: string): Promise<DbProject | undefined> => {
    return db.projects.get(id);
  };

  // === Conversations ===
  const conversations = useLiveQuery(
    () => db.conversations.orderBy("updatedAt").reverse().toArray(),
    [],
    [],
  );

  const createConversation = async (
    parentId: string | null = null, // Add parentId
    title: string = "New Chat",
    initialSystemPrompt?: string | null,
  ): Promise<string> => {
    const newId = nanoid();
    const now = new Date();
    const newConversation: DbConversation = {
      id: newId,
      parentId, // Set parentId
      title,
      systemPrompt: initialSystemPrompt ?? null,
      createdAt: now,
      updatedAt: now,
      vfsEnabled: false, // Initialize vfsEnabled
    };
    await db.conversations.add(newConversation);
    // Optionally update parent project's updatedAt timestamp
    if (parentId) {
      await db.projects.update(parentId, { updatedAt: now });
    }
    return newId;
  };

  const deleteConversation = async (id: string): Promise<void> => {
    await db.transaction("rw", db.conversations, db.messages, async () => {
      await db.messages.where("conversationId").equals(id).delete();
      await db.conversations.delete(id);
    });
    // TODO: Consider deleting associated VFS data if vfsEnabled was true
  };

  const renameConversation = async (
    id: string,
    newTitle: string,
  ): Promise<void> => {
    const now = new Date();
    const conversation = await db.conversations.get(id);
    await db.conversations.update(id, {
      title: newTitle,
      updatedAt: now,
    });
    // Update parent project timestamp if applicable
    if (conversation?.parentId) {
      await db.projects.update(conversation.parentId, { updatedAt: now });
    }
  };

  const updateConversationSystemPrompt = async (
    id: string,
    systemPrompt: string | null,
  ): Promise<void> => {
    await db.conversations.update(id, {
      systemPrompt: systemPrompt,
      updatedAt: new Date(), // Also update timestamp
    });
  };

  const getConversation = async (
    id: string,
  ): Promise<DbConversation | undefined> => {
    return db.conversations.get(id);
  };

  // === VFS Toggle ===
  // Function to update the vfsEnabled flag in the database for a given item
  const toggleVfsEnabled = async (
    id: string,
    type: SidebarItemType,
  ): Promise<void> => {
    const now = new Date();
    // Determine the correct Dexie table based on the item type
    const table = type === "conversation" ? db.conversations : db.projects;
    // Get the current state of the item
    const current = await table.get(id);

    if (current) {
      // Update the item with the toggled vfsEnabled state and new timestamp
      await table.update(id, {
        vfsEnabled: !current.vfsEnabled,
        updatedAt: now,
      });
      // If the item has a parent project, update its timestamp as well
      if (current.parentId) {
        await db.projects.update(current.parentId, { updatedAt: now });
      }
    } else {
      // Log a warning and throw an error if the item wasn't found
      console.warn(`[DB] Item ${id} (${type}) not found for VFS toggle.`);
      throw new Error("Item not found");
    }
  };

  // === Messages ===
  // useMessageHandling fetches messages directly when the conversation ID changes.

  // MODIFIED: Accept vfsContextPaths
  const addDbMessage = async (
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
      vfsContextPaths: messageData.vfsContextPaths ?? undefined, // Save paths if provided
    };
    const conversation = await db.conversations.get(messageData.conversationId);
    await db.messages.add(newMessage);
    // Update conversation and potentially parent project timestamp
    const now = new Date();
    await db.conversations.update(messageData.conversationId, {
      updatedAt: now,
    });
    if (conversation?.parentId) {
      await db.projects.update(conversation.parentId, { updatedAt: now });
    }
    return newMessage.id;
  };

  const updateDbMessageContent = async (
    messageId: string,
    newContent: string,
  ): Promise<void> => {
    await db.messages.update(messageId, { content: newContent });
  };

  const deleteDbMessage = async (messageId: string): Promise<void> => {
    await db.messages.delete(messageId);
  };

  const getDbMessagesUpTo = async (
    convId: string,
    messageId: string,
  ): Promise<DbMessage[]> => {
    const targetMsg = await db.messages.get(messageId);
    if (!targetMsg) return [];
    // Fetch messages strictly *before* the target message's creation time
    return db.messages
      .where("conversationId")
      .equals(convId)
      .and((msg) => msg.createdAt.getTime() < targetMsg.createdAt.getTime())
      .sortBy("createdAt");
  };

  // === API Keys ===
  const apiKeys = useLiveQuery(
    () => db.apiKeys.orderBy("createdAt").toArray(),
    [],
    [],
  );

  const addApiKey = async (
    name: string,
    providerId: string,
    value: string,
  ): Promise<string> => {
    const newId = nanoid();
    const newKey: DbApiKey = {
      id: newId,
      name,
      providerId,
      value, // Storing value directly; consider obfuscation/encryption if needed
      createdAt: new Date(),
    };
    await db.apiKeys.add(newKey);
    return newId;
  };

  const deleteApiKey = async (id: string): Promise<void> => {
    await db.apiKeys.delete(id);
  };

  return {
    // Projects
    projects: projects || [],
    createProject,
    renameProject,
    deleteProject,
    getProject,
    // Conversations
    conversations: conversations || [],
    createConversation,
    deleteConversation,
    renameConversation,
    updateConversationSystemPrompt,
    getConversation,
    // VFS Toggle
    toggleVfsEnabled, // Expose the DB toggle function
    // Messages
    addDbMessage, // Keep existing functions
    updateDbMessageContent,
    deleteDbMessage,
    getDbMessagesUpTo,
    // API Keys
    apiKeys: apiKeys || [],
    addApiKey,
    deleteApiKey,
  };
}
