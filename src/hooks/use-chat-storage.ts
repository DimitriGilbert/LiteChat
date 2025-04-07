// src/hooks/use-chat-storage.ts
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import type {
  DbConversation,
  DbMessage,
  DbApiKey,
  DbProject,
} from "@/lib/types";
import { nanoid } from "nanoid";
import Dexie from "dexie"; // Import Dexie for minKey

// Note: This hook now provides low-level DB access.
// Higher-level logic (like fetching tree structures) will be in use-conversation-management.
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
      ); // Add log
      await db.projects.update(id, { name: newName, updatedAt: new Date() });
      console.log(`useChatStorage: Project ${id} updated successfully.`); // Add log
    } catch (error) {
      console.error(`useChatStorage: Failed to update project ${id}`, error); // Add error log
      throw error; // Re-throw the error
    }
  };

  const deleteProject = async (id: string): Promise<void> => {
    // Simple delete: Assumes children are handled elsewhere or deletion is prevented if children exist.
    // For cascading delete, you'd need a transaction:
    // await db.transaction('rw', db.projects, db.conversations, db.messages, async () => {
    //   const childrenProjects = await db.projects.where('parentId').equals(id).toArray();
    //   for (const child of childrenProjects) {
    //     await deleteProject(child.id); // Recursive delete
    //   }
    //   const childrenConvos = await db.conversations.where('parentId').equals(id).toArray();
    //   for (const convo of childrenConvos) {
    //     await deleteConversation(convo.id); // Assumes deleteConversation handles messages
    //   }
    //   await db.projects.delete(id);
    // });
    await db.projects.delete(id); // Simple delete for now
  };

  const getProject = async (id: string): Promise<DbProject | undefined> => {
    return db.projects.get(id);
  };

  // Removed getProjectsByParentId using useLiveQuery here, as it's better handled
  // in the component/hook that needs the specific filtered list, or via the main sidebarItems query.

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

  // Removed getConversationsByParentId using useLiveQuery here.

  // === Messages ===
  // REMOVED the problematic useLiveQuery export for messages.
  // useMessageHandling fetches messages directly when the conversation ID changes.

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
      value,
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
    // Messages
    // getMessagesForConversation: messages, // REMOVED
    addDbMessage,
    updateDbMessageContent,
    deleteDbMessage,
    getDbMessagesUpTo,
    // API Keys
    apiKeys: apiKeys || [],
    addApiKey,
    deleteApiKey,
  };
}
