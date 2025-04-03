import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import type { DbConversation, DbMessage, DbApiKey } from "@/lib/types";
import { nanoid } from "nanoid";

export function useChatStorage(conversationId: string | null) {
  // === Conversations ===
  const conversations = useLiveQuery(
    () => db.conversations.orderBy("updatedAt").reverse().toArray(),
    [],
    [],
  );

  const createConversation = async (
    title: string = "New Chat",
    initialSystemPrompt?: string | null,
  ): Promise<string> => {
    // ... (keep existing implementation)
    const newId = nanoid();
    const now = new Date();
    const newConversation: DbConversation = {
      id: newId,
      title,
      systemPrompt: initialSystemPrompt ?? null,
      createdAt: now,
      updatedAt: now,
    };
    await db.conversations.add(newConversation);
    return newId;
  };

  const deleteConversation = async (id: string): Promise<void> => {
    // ... (keep existing implementation)
    await db.transaction("rw", db.conversations, db.messages, async () => {
      await db.messages.where("conversationId").equals(id).delete();
      await db.conversations.delete(id);
    });
  };

  const renameConversation = async (
    id: string,
    newTitle: string,
  ): Promise<void> => {
    await db.conversations.update(id, {
      title: newTitle,
      updatedAt: new Date(),
    });
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

  // === Messages ===
  const messages = useLiveQuery(
    () => {
      if (!conversationId) return [];
      return db.messages
        .where("conversationId")
        .equals(conversationId)
        .sortBy("createdAt");
    },
    [conversationId],
    [],
  );

  const addDbMessage = async (
    messageData: Omit<DbMessage, "id" | "createdAt"> &
      Partial<Pick<DbMessage, "id" | "createdAt">>,
  ): Promise<string> => {
    // ... (keep existing implementation)
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
    await db.messages.add(newMessage);
    await db.conversations.update(messageData.conversationId, {
      updatedAt: new Date(),
    });
    return newMessage.id;
  };

  const updateDbMessageContent = async (
    messageId: string,
    newContent: string,
  ): Promise<void> => {
    // ... (keep existing implementation)
    await db.messages.update(messageId, { content: newContent });
  };

  const deleteDbMessage = async (messageId: string): Promise<void> => {
    await db.messages.delete(messageId);
  };

  const getDbMessagesUpTo = async (
    convId: string,
    messageId: string,
  ): Promise<DbMessage[]> => {
    // Helper to get history for regeneration
    const targetMsg = await db.messages.get(messageId);
    if (!targetMsg) return [];
    return db.messages
      .where("conversationId")
      .equals(convId)
      .and((msg) => msg.createdAt < targetMsg.createdAt) // Messages *before* the target
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
    conversations: conversations || [],
    createConversation,
    deleteConversation,
    renameConversation,
    updateConversationSystemPrompt,
    messages: (messages || []) as DbMessage[],
    addDbMessage,
    updateDbMessageContent,
    deleteDbMessage,
    getDbMessagesUpTo,
    apiKeys: apiKeys || [],
    addApiKey,
    deleteApiKey,
  };
}
