
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import type {
  DbConversation,
  DbMessage,
  DbApiKey,
  DbProject,
  SidebarItemType,
  DbProviderConfig,
  MessageContent,
  Workflow, // Import Workflow type
} from "@/lib/types";
import type { DbMod } from "@/mods/types";
import { nanoid } from "nanoid";
import { useCallback } from "react";
import { Dexie } from "dexie";

export function useChatStorage() {
  // === Live Queries ===
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
  const mods = useLiveQuery(
    () => db.mods.orderBy("loadOrder").toArray(),
    [],
    [],
  );
  const providerConfigs = useLiveQuery(
    () => db.providerConfigs.orderBy("createdAt").toArray(),
    [],
    [],
  );

  // === Projects ===
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
    [],
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
    [],
  );

  const deleteProject = useCallback(async (id: string): Promise<void> => {
    await db.projects.delete(id);
  }, []);

  const getProject = useCallback(
    async (id: string): Promise<DbProject | undefined> => {
      return db.projects.get(id);
    },
    [],
  );

  const countChildProjects = useCallback(
    async (parentId: string): Promise<number> => {
      return db.projects.where("parentId").equals(parentId).count();
    },
    [],
  );

  // === Conversations ===
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
    [],
  );

  const deleteConversation = useCallback(async (id: string): Promise<void> => {
    await db.transaction("rw", db.conversations, db.messages, async () => {
      await db.messages.where("conversationId").equals(id).delete();
      await db.conversations.delete(id);
    });
  }, []);

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
    [],
  );

  const updateConversationSystemPrompt = useCallback(
    async (id: string, systemPrompt: string | null): Promise<void> => {
      await db.conversations.update(id, {
        systemPrompt: systemPrompt,
        updatedAt: new Date(),
      });
    },
    [],
  );

  const getConversation = useCallback(
    async (id: string): Promise<DbConversation | undefined> => {
      return db.conversations.get(id);
    },
    [],
  );

  const countChildConversations = useCallback(
    async (parentId: string): Promise<number> => {
      return db.conversations.where("parentId").equals(parentId).count();
    },
    [],
  );

  // === VFS Toggle ===
  const toggleVfsEnabled = useCallback(
    async (id: string, type: SidebarItemType): Promise<void> => {
      const now = new Date();
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
    [],
  );

  // === Messages ===
  const getMessagesForConversation = useCallback(
    async (conversationId: string): Promise<DbMessage[]> => {
      // Use the compound index for efficient sorting
      return db.messages
        .where("[conversationId+createdAt]")
        .between([conversationId, Dexie.minKey], [conversationId, Dexie.maxKey])
        .sortBy("createdAt");
    },
    [],
  );

  const addDbMessage = useCallback(
    async (
      // Accept the potentially complex MessageContent type for 'content'
      // and new optional fields like tool_call_id, tool_calls, children, workflow, providerId, modelId
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
        content: messageData.content, // Store the MessageContent directly
        conversationId: messageData.conversationId,
        vfsContextPaths: messageData.vfsContextPaths ?? undefined,
        // Include optional tool fields if provided
        tool_calls: messageData.tool_calls ?? undefined,
        tool_call_id: messageData.tool_call_id ?? undefined,
        // Include children if provided
        children: messageData.children ?? undefined,
        // Include workflow if provided
        workflow: messageData.workflow ?? undefined,
        // Include provider/model if provided
        providerId: messageData.providerId ?? undefined,
        modelId: messageData.modelId ?? undefined,
        // Include tokens if provided
        tokensInput: messageData.tokensInput ?? undefined,
        tokensOutput: messageData.tokensOutput ?? undefined,
      };
      const conversation = await db.conversations.get(
        messageData.conversationId,
      );
      // Dexie handles storing the object/array structure
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
    [],
  );

  const updateDbMessageContent = useCallback(
    // Accept MessageContent for the new content
    async (messageId: string, newContent: MessageContent): Promise<void> => {
      // Dexie handles updating the object/array structure
      await db.messages.update(messageId, { content: newContent });
    },
    [],
  );

  // Add a function to update the workflow status of a message
  const updateDbMessageWorkflow = useCallback(
    async (messageId: string, workflow: Workflow | null): Promise<void> => {
      await db.messages.update(messageId, { workflow: workflow ?? undefined });
    },
    [],
  );

  const deleteDbMessage = useCallback(
    async (messageId: string): Promise<void> => {
      await db.messages.delete(messageId);
    },
    [],
  );

  const getDbMessagesUpTo = useCallback(
    async (convId: string, messageId: string): Promise<DbMessage[]> => {
      const targetMsg = await db.messages.get(messageId);
      if (!targetMsg) return [];
      // Use compound index for potentially faster filtering and sorting
      return db.messages
        .where("[conversationId+createdAt]")
        .between(
          [convId, Dexie.minKey],
          [convId, targetMsg.createdAt],
          false, // lower bound exclusive (minKey is okay)
          true, // upper bound exclusive (don't include targetMsg)
        )
        .sortBy("createdAt");
    },
    [],
  );

  const bulkAddMessages = useCallback(
    async (messages: DbMessage[]): Promise<unknown> => {
      if (messages.length === 0) return;
      // Dexie handles bulk adding objects with complex fields
      // Ensure conversation timestamp is updated based on the latest message
      const latestMessage = messages.reduce((latest, current) =>
        latest.createdAt > current.createdAt ? latest : current,
      );
      const conversationId = latestMessage.conversationId;
      const conversation = await db.conversations.get(conversationId);
      const now = new Date(); // Use a consistent time for updates

      await db.transaction(
        "rw",
        db.messages,
        db.conversations,
        db.projects,
        async () => {
          await db.messages.bulkAdd(messages);
          await db.conversations.update(conversationId, { updatedAt: now });
          if (conversation?.parentId) {
            await db.projects.update(conversation.parentId, { updatedAt: now });
          }
        },
      );
    },
    [],
  );

  const updateConversationTimestamp = useCallback(
    async (id: string, date: Date): Promise<void> => {
      await db.conversations.update(id, { updatedAt: date });
      const conversation = await db.conversations.get(id);
      if (conversation?.parentId) {
        await db.projects.update(conversation.parentId, { updatedAt: date });
      }
    },
    [],
  );

  // === API Keys ===
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
    [],
  );

  const deleteApiKey = useCallback(async (id: string): Promise<void> => {
    await db.transaction("rw", db.apiKeys, db.providerConfigs, async () => {
      await db.apiKeys.delete(id);
      const configsToUpdate = await db.providerConfigs
        .where("apiKeyId")
        .equals(id)
        .toArray();
      if (configsToUpdate.length > 0) {
        const updates = configsToUpdate.map((config) =>
          db.providerConfigs.update(config.id, { apiKeyId: null }),
        );
        await Promise.all(updates);
      }
    });
  }, []);

  // === Mods ===
  const addMod = useCallback(
    async (modData: Omit<DbMod, "id" | "createdAt">): Promise<string> => {
      const newId = nanoid();
      const newMod: DbMod = {
        id: newId,
        createdAt: new Date(),
        ...modData,
      };
      await db.mods.add(newMod);
      return newId;
    },
    [],
  );

  const updateMod = useCallback(
    async (id: string, changes: Partial<DbMod>): Promise<void> => {
      await db.mods.update(id, changes);
    },
    [],
  );

  const deleteMod = useCallback(async (id: string): Promise<void> => {
    await db.mods.delete(id);
  }, []);

  const getMods = useCallback(async (): Promise<DbMod[]> => {
    return db.mods.orderBy("loadOrder").toArray();
  }, []);

  // === Provider Configs ===
  const addProviderConfig = useCallback(
    async (
      configData: Omit<DbProviderConfig, "id" | "createdAt" | "updatedAt">,
    ): Promise<string> => {
      const newId = nanoid();
      const now = new Date();
      const newConfig: DbProviderConfig = {
        id: newId,
        createdAt: now,
        updatedAt: now,
        ...configData,
      };
      await db.providerConfigs.add(newConfig);
      return newId;
    },
    [],
  );

  const updateProviderConfig = useCallback(
    async (id: string, changes: Partial<DbProviderConfig>): Promise<void> => {
      await db.providerConfigs.update(id, {
        ...changes,
        updatedAt: new Date(),
      });
    },
    [],
  );

  const deleteProviderConfig = useCallback(
    async (id: string): Promise<void> => {
      await db.providerConfigs.delete(id);
    },
    [],
  );

  // === Data Management ===
  const clearAllData = useCallback(async (): Promise<void> => {
    await Promise.all([
      db.projects.clear(),
      db.conversations.clear(),
      db.messages.clear(),
      db.apiKeys.clear(),
      db.mods.clear(),
      db.providerConfigs.clear(),
      db.appState.clear(), // Clear app state as well
    ]);
  }, []);

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
    addDbMessage, // Handles new fields implicitly
    updateDbMessageContent,
    updateDbMessageWorkflow, // Added workflow update function
    deleteDbMessage,
    getDbMessagesUpTo,
    bulkAddMessages, // Handles new fields implicitly
    // API Keys
    apiKeys: apiKeys || [],
    addApiKey,
    deleteApiKey,
    // Mods
    mods: mods || [],
    addMod,
    updateMod,
    deleteMod,
    getMods,
    // Provider Configs
    providerConfigs: providerConfigs || [],
    addProviderConfig,
    updateProviderConfig,
    deleteProviderConfig,
    // Data Management
    clearAllData,
  };
}
