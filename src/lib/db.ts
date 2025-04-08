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
    this.version(4).stores({
      // Added projects table with index on parentId
      projects: "++id, name, parentId, createdAt, updatedAt",
      // Added parentId index to conversations
      conversations: "id, parentId, createdAt, updatedAt",
      // Added vfsContextPaths to messages (Dexie handles optional fields)
      messages: "id, conversationId, createdAt, vfsContextPaths",
      apiKeys: "id, name, providerId, createdAt",
    });
    // Define previous versions for migration
    this.version(3).stores({
      projects: "++id, name, parentId, createdAt, updatedAt",
      conversations: "id, parentId, createdAt, updatedAt",
      messages: "id, conversationId, createdAt", // Old messages schema
      apiKeys: "id, name, providerId, createdAt",
    });
    this.version(2).stores({
      conversations: "id, createdAt, updatedAt", // Older schema
      messages: "id, conversationId, createdAt",
      apiKeys: "id, name, providerId, createdAt",
    });
    // No upgrade function needed for adding an optional field like vfsContextPaths
  }
}

export const db = new ChatDatabase();
