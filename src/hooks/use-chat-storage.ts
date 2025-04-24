// src/hooks/use-chat-storage.ts
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
  Workflow,
} from "@/lib/types";
import type { DbMod } from "@/mods/types";
import { nanoid } from "nanoid";
import { useCallback } from "react";
import { Dexie } from "dexie";
import { toast } from "sonner"; // Import toast

export function useChatStorage() {
  // === Live Queries ===
  const projects = useLiveQuery(
    () => db.projects.orderBy("updatedAt").reverse().toArray(),
    [], // Dependencies
    [], // Default value
  );
  const conversations = useLiveQuery(
    () => db.conversations.orderBy("updatedAt").reverse().toArray(),
    [], // Dependencies
    [], // Default value
  );
  const apiKeys = useLiveQuery(
    () => db.apiKeys.orderBy("createdAt").toArray(),
    [], // Dependencies
    [], // Default value
  );
  const mods = useLiveQuery(
    () => db.mods.orderBy("loadOrder").toArray(),
    [], // Dependencies
    [], // Default value
  );
  const providerConfigs = useLiveQuery(
    () => db.providerConfigs.orderBy("createdAt").toArray(),
    [], // Dependencies
    [], // Default value
  );

  // === Projects ===
  const createProject = useCallback(
    async (
      name: string = "New Project",
      parentId: string | null = null,
    ): Promise<DbProject> => {
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
          // Initialize optional git fields
          gitRepoUrl: null,
          gitRepoBranch: null,
          gitRepoEnabled: false,
        };
        await db.projects.add(newProject);
        if (parentId) {
          await db.projects.update(parentId, { updatedAt: now });
        }
        return newProject;
      } catch (error) {
        console.error("useChatStorage: Failed to create project", error);
        toast.error(
          `Failed to create project: ${error instanceof Error ? error.message : String(error)}`,
        );
        throw error; // Re-throw after logging/toasting
      }
    },
    [],
  );

  const renameProject = useCallback(
    async (id: string, newName: string): Promise<void> => {
      try {
        await db.projects.update(id, { name: newName, updatedAt: new Date() });
      } catch (error) {
        console.error(`useChatStorage: Failed to update project ${id}`, error);
        toast.error(
          `Failed to rename project: ${error instanceof Error ? error.message : String(error)}`,
        );
        throw error;
      }
    },
    [],
  );

  const deleteProject = useCallback(async (id: string): Promise<void> => {
    try {
      await db.projects.delete(id);
    } catch (error) {
      console.error(`useChatStorage: Failed to delete project ${id}`, error);
      toast.error(
        `Failed to delete project: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }, []);

  const getProject = useCallback(
    async (id: string): Promise<DbProject | undefined> => {
      try {
        return await db.projects.get(id);
      } catch (error) {
        console.error(`useChatStorage: Failed to get project ${id}`, error);
        toast.error(
          `Failed to load project details: ${error instanceof Error ? error.message : String(error)}`,
        );
        return undefined;
      }
    },
    [],
  );

  const countChildProjects = useCallback(
    async (parentId: string): Promise<number> => {
      try {
        return await db.projects.where("parentId").equals(parentId).count();
      } catch (error) {
        console.error(
          `useChatStorage: Failed to count child projects for ${parentId}`,
          error,
        );
        toast.error(
          `Failed to count child projects: ${error instanceof Error ? error.message : String(error)}`,
        );
        return 0; // Return 0 on error
      }
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
      try {
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
          // Initialize optional git fields
          gitRepoUrl: null,
          gitRepoBranch: null,
          gitRepoEnabled: false,
        };
        await db.conversations.add(newConversation);
        if (parentId) {
          await db.projects.update(parentId, { updatedAt: now });
        }
        return newId;
      } catch (error) {
        console.error("useChatStorage: Failed to create conversation", error);
        toast.error(
          `Failed to create chat: ${error instanceof Error ? error.message : String(error)}`,
        );
        throw error;
      }
    },
    [],
  );

  const deleteConversation = useCallback(async (id: string): Promise<void> => {
    try {
      await db.transaction("rw", db.conversations, db.messages, async () => {
        await db.messages.where("conversationId").equals(id).delete();
        await db.conversations.delete(id);
      });
    } catch (error) {
      console.error(
        `useChatStorage: Failed to delete conversation ${id}`,
        error,
      );
      toast.error(
        `Failed to delete chat: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }, []);

  const renameConversation = useCallback(
    async (id: string, newTitle: string): Promise<void> => {
      try {
        const now = new Date();
        const conversation = await db.conversations.get(id);
        await db.conversations.update(id, {
          title: newTitle,
          updatedAt: now,
        });
        if (conversation?.parentId) {
          await db.projects.update(conversation.parentId, { updatedAt: now });
        }
      } catch (error) {
        console.error(
          `useChatStorage: Failed to rename conversation ${id}`,
          error,
        );
        toast.error(
          `Failed to rename chat: ${error instanceof Error ? error.message : String(error)}`,
        );
        throw error;
      }
    },
    [],
  );

  const updateConversationSystemPrompt = useCallback(
    async (id: string, systemPrompt: string | null): Promise<void> => {
      try {
        await db.conversations.update(id, {
          systemPrompt: systemPrompt,
          updatedAt: new Date(),
        });
      } catch (error) {
        console.error(
          `useChatStorage: Failed to update system prompt for conversation ${id}`,
          error,
        );
        toast.error(
          `Failed to update system prompt: ${error instanceof Error ? error.message : String(error)}`,
        );
        throw error;
      }
    },
    [],
  );

  const getConversation = useCallback(
    async (id: string): Promise<DbConversation | undefined> => {
      try {
        return await db.conversations.get(id);
      } catch (error) {
        console.error(
          `useChatStorage: Failed to get conversation ${id}`,
          error,
        );
        toast.error(
          `Failed to load chat details: ${error instanceof Error ? error.message : String(error)}`,
        );
        return undefined;
      }
    },
    [],
  );

  const countChildConversations = useCallback(
    async (parentId: string): Promise<number> => {
      try {
        return await db.conversations
          .where("parentId")
          .equals(parentId)
          .count();
      } catch (error) {
        console.error(
          `useChatStorage: Failed to count child conversations for ${parentId}`,
          error,
        );
        toast.error(
          `Failed to count child chats: ${error instanceof Error ? error.message : String(error)}`,
        );
        return 0;
      }
    },
    [],
  );

  // === VFS Toggle ===
  const toggleVfsEnabled = useCallback(
    async (id: string, type: SidebarItemType): Promise<void> => {
      try {
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
            throw new Error("Conversation not found");
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
            throw new Error("Project not found");
          }
        } else {
          throw new Error("Unknown item type");
        }
      } catch (error) {
        console.error(
          `useChatStorage: Failed to toggle VFS for ${type} ${id}`,
          error,
        );
        toast.error(
          `Failed to update VFS setting: ${error instanceof Error ? error.message : String(error)}`,
        );
        throw error;
      }
    },
    [],
  );

  // === Messages ===
  const getMessagesForConversation = useCallback(
    async (conversationId: string): Promise<DbMessage[]> => {
      try {
        // Use the compound index for efficient sorting
        return await db.messages
          .where("[conversationId+createdAt]")
          .between(
            [conversationId, Dexie.minKey],
            [conversationId, Dexie.maxKey],
          )
          .sortBy("createdAt");
      } catch (error) {
        console.error(
          `useChatStorage: Failed to get messages for conversation ${conversationId}`,
          error,
        );
        toast.error(
          `Failed to load messages: ${error instanceof Error ? error.message : String(error)}`,
        );
        return []; // Return empty array on error
      }
    },
    [],
  );

  const addDbMessage = useCallback(
    async (
      messageData: Omit<DbMessage, "id" | "createdAt"> &
        Partial<Pick<DbMessage, "id" | "createdAt">>,
    ): Promise<string> => {
      if (!messageData.conversationId) {
        throw new Error("Cannot add message without a conversationId");
      }
      try {
        const newMessage: DbMessage = {
          id: messageData.id ?? nanoid(),
          createdAt: messageData.createdAt ?? new Date(),
          role: messageData.role,
          content: messageData.content,
          conversationId: messageData.conversationId,
          vfsContextPaths: messageData.vfsContextPaths ?? undefined,
          tool_calls: messageData.tool_calls ?? undefined,
          tool_call_id: messageData.tool_call_id ?? undefined,
          children: messageData.children ?? undefined,
          workflow: messageData.workflow ?? undefined,
          providerId: messageData.providerId ?? undefined,
          modelId: messageData.modelId ?? undefined,
          tokensInput: messageData.tokensInput ?? undefined,
          tokensOutput: messageData.tokensOutput ?? undefined,
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
      } catch (error) {
        console.error("useChatStorage: Failed to add message", error);
        toast.error(
          `Failed to save message: ${error instanceof Error ? error.message : String(error)}`,
        );
        throw error;
      }
    },
    [],
  );

  const updateDbMessageContent = useCallback(
    async (messageId: string, newContent: MessageContent): Promise<void> => {
      try {
        await db.messages.update(messageId, { content: newContent });
      } catch (error) {
        console.error(
          `useChatStorage: Failed to update content for message ${messageId}`,
          error,
        );
        toast.error(
          `Failed to update message content: ${error instanceof Error ? error.message : String(error)}`,
        );
        throw error;
      }
    },
    [],
  );

  const updateDbMessageWorkflow = useCallback(
    async (messageId: string, workflow: Workflow | null): Promise<void> => {
      try {
        await db.messages.update(messageId, {
          workflow: workflow ?? undefined,
        });
      } catch (error) {
        console.error(
          `useChatStorage: Failed to update workflow for message ${messageId}`,
          error,
        );
        toast.error(
          `Failed to update workflow status: ${error instanceof Error ? error.message : String(error)}`,
        );
        throw error;
      }
    },
    [],
  );

  const deleteDbMessage = useCallback(
    async (messageId: string): Promise<void> => {
      try {
        await db.messages.delete(messageId);
      } catch (error) {
        console.error(
          `useChatStorage: Failed to delete message ${messageId}`,
          error,
        );
        toast.error(
          `Failed to delete message: ${error instanceof Error ? error.message : String(error)}`,
        );
        throw error;
      }
    },
    [],
  );

  const getDbMessagesUpTo = useCallback(
    async (convId: string, messageId: string): Promise<DbMessage[]> => {
      try {
        const targetMsg = await db.messages.get(messageId);
        if (!targetMsg) return [];
        return await db.messages
          .where("[conversationId+createdAt]")
          .between(
            [convId, Dexie.minKey],
            [convId, targetMsg.createdAt],
            false, // lower bound exclusive (minKey)
            true, // upper bound inclusive (target message time)
          )
          .sortBy("createdAt");
      } catch (error) {
        console.error(
          `useChatStorage: Failed to get messages up to ${messageId} in conversation ${convId}`,
          error,
        );
        toast.error(
          `Failed to load message history: ${error instanceof Error ? error.message : String(error)}`,
        );
        return [];
      }
    },
    [],
  );

  const bulkAddMessages = useCallback(
    async (messages: DbMessage[]): Promise<void> => {
      // Renamed return type to void as it doesn't return anything specific
      if (messages.length === 0) return;
      try {
        const latestMessage = messages.reduce((latest, current) =>
          latest.createdAt > current.createdAt ? latest : current,
        );
        const conversationId = latestMessage.conversationId;
        const conversation = await db.conversations.get(conversationId);
        const now = new Date();

        await db.transaction(
          "rw",
          db.messages,
          db.conversations,
          db.projects,
          async () => {
            await db.messages.bulkAdd(messages);
            await db.conversations.update(conversationId, { updatedAt: now });
            if (conversation?.parentId) {
              await db.projects.update(conversation.parentId, {
                updatedAt: now,
              });
            }
          },
        );
      } catch (error) {
        console.error("useChatStorage: Failed to bulk add messages", error);
        toast.error(
          `Failed to save messages: ${error instanceof Error ? error.message : String(error)}`,
        );
        throw error;
      }
    },
    [],
  );

  const updateConversationTimestamp = useCallback(
    async (id: string, date: Date): Promise<void> => {
      try {
        await db.conversations.update(id, { updatedAt: date });
        const conversation = await db.conversations.get(id);
        if (conversation?.parentId) {
          await db.projects.update(conversation.parentId, { updatedAt: date });
        }
      } catch (error) {
        console.error(
          `useChatStorage: Failed to update timestamp for conversation ${id}`,
          error,
        );
        // Avoid toast here as it might be too noisy during normal operation
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
      try {
        const newId = nanoid();
        const newKey: DbApiKey = {
          id: newId,
          name,
          providerId, // Note: This field might be less useful now, consider removing if not used
          value,
          createdAt: new Date(),
        };
        await db.apiKeys.add(newKey);
        return newId;
      } catch (error) {
        console.error("useChatStorage: Failed to add API key", error);
        toast.error(
          `Failed to add API Key: ${error instanceof Error ? error.message : String(error)}`,
        );
        throw error;
      }
    },
    [],
  );

  const deleteApiKey = useCallback(async (id: string): Promise<void> => {
    try {
      await db.transaction("rw", db.apiKeys, db.providerConfigs, async () => {
        await db.apiKeys.delete(id);
        // Unlink this key from any provider configs using it
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
    } catch (error) {
      console.error(`useChatStorage: Failed to delete API key ${id}`, error);
      toast.error(
        `Failed to delete API Key: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }, []);

  // === Mods ===
  const addMod = useCallback(
    async (modData: Omit<DbMod, "id" | "createdAt">): Promise<string> => {
      try {
        const newId = nanoid();
        const newMod: DbMod = {
          id: newId,
          createdAt: new Date(),
          ...modData,
          loadOrder: modData.loadOrder ?? Date.now(), // Ensure loadOrder has a default
        };
        await db.mods.add(newMod);
        return newId;
      } catch (error) {
        console.error("useChatStorage: Failed to add mod", error);
        toast.error(
          `Failed to add Mod: ${error instanceof Error ? error.message : String(error)}`,
        );
        throw error;
      }
    },
    [],
  );

  const updateMod = useCallback(
    async (id: string, changes: Partial<DbMod>): Promise<void> => {
      try {
        await db.mods.update(id, changes);
      } catch (error) {
        console.error(`useChatStorage: Failed to update mod ${id}`, error);
        toast.error(
          `Failed to update Mod: ${error instanceof Error ? error.message : String(error)}`,
        );
        throw error;
      }
    },
    [],
  );

  const deleteMod = useCallback(async (id: string): Promise<void> => {
    try {
      await db.mods.delete(id);
    } catch (error) {
      console.error(`useChatStorage: Failed to delete mod ${id}`, error);
      toast.error(
        `Failed to delete Mod: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }, []);

  const getMods = useCallback(async (): Promise<DbMod[]> => {
    try {
      return await db.mods.orderBy("loadOrder").toArray();
    } catch (error) {
      console.error("useChatStorage: Failed to get mods", error);
      toast.error(
        `Failed to load Mods: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  }, []);

  // === Provider Configs ===
  const addProviderConfig = useCallback(
    async (
      configData: Omit<DbProviderConfig, "id" | "createdAt" | "updatedAt">,
    ): Promise<string> => {
      try {
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
      } catch (error) {
        console.error("useChatStorage: Failed to add provider config", error);
        toast.error(
          `Failed to add Provider: ${error instanceof Error ? error.message : String(error)}`,
        );
        throw error;
      }
    },
    [],
  );

  const updateProviderConfig = useCallback(
    async (id: string, changes: Partial<DbProviderConfig>): Promise<void> => {
      try {
        await db.providerConfigs.update(id, {
          ...changes,
          updatedAt: new Date(),
        });
      } catch (error) {
        console.error(
          `useChatStorage: Failed to update provider config ${id}`,
          error,
        );
        toast.error(
          `Failed to update Provider: ${error instanceof Error ? error.message : String(error)}`,
        );
        throw error;
      }
    },
    [],
  );

  const deleteProviderConfig = useCallback(
    async (id: string): Promise<void> => {
      try {
        await db.providerConfigs.delete(id);
      } catch (error) {
        console.error(
          `useChatStorage: Failed to delete provider config ${id}`,
          error,
        );
        toast.error(
          `Failed to delete Provider: ${error instanceof Error ? error.message : String(error)}`,
        );
        throw error;
      }
    },
    [],
  );

  // === Data Management ===
  const clearAllData = useCallback(async (): Promise<void> => {
    try {
      await Promise.all([
        db.projects.clear(),
        db.conversations.clear(),
        db.messages.clear(),
        db.apiKeys.clear(),
        db.mods.clear(),
        db.providerConfigs.clear(),
        db.appState.clear(),
      ]);
    } catch (error) {
      console.error("useChatStorage: Failed to clear all data", error);
      toast.error(
        `Failed to clear data: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }, []);

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
    updateDbMessageWorkflow,
    deleteDbMessage,
    getDbMessagesUpTo,
    bulkAddMessages,
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
