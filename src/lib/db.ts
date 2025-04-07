// src/lib/db.ts
import Dexie, { type Table } from "dexie";
import type { DbConversation, DbMessage, DbApiKey, DbProject } from "./types"; // Import DbProject

export class ChatDatabase extends Dexie {
  projects!: Table<DbProject, string>; // Add projects table
  conversations!: Table<DbConversation, string>;
  messages!: Table<DbMessage, string>;
  apiKeys!: Table<DbApiKey, string>;

  constructor() {
    super("LiteChatDatabase");
    // Bump version number when schema changes
    this.version(3).stores({
      // Added projects table with index on parentId
      projects: "++id, name, parentId, createdAt, updatedAt",
      // Added parentId index to conversations
      conversations: "id, parentId, createdAt, updatedAt",
      messages: "id, conversationId, createdAt",
      apiKeys: "id, name, providerId, createdAt",
    });
    // Define previous versions for migration
    this.version(2).stores({
      conversations: "id, createdAt, updatedAt", // Old schema
      messages: "id, conversationId, createdAt",
      apiKeys: "id, name, providerId, createdAt",
    });
    // Add upgrade logic if needed for complex changes,
    // Dexie handles simple additions like adding 'parentId' automatically if default value is acceptable (null/undefined)
    // this.version(3).upgrade(tx => {
    // Add default parentId to existing conversations if necessary
    // return tx.table('conversations').toCollection().modify(convo => {
    //   if (convo.parentId === undefined) {
    //     convo.parentId = null;
    //   }
    // });
    // });
  }
}

export const db = new ChatDatabase();
