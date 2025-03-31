import Dexie, { type Table } from "dexie";
import type { DbConversation, DbMessage, DbApiKey } from "./types"; // Import DbApiKey

export class ChatDatabase extends Dexie {
  conversations!: Table<DbConversation, string>;
  messages!: Table<DbMessage, string>;
  apiKeys!: Table<DbApiKey, string>; // Add apiKeys table

  constructor() {
    super("LiteChatDatabase");
    // Bump version number when schema changes
    this.version(2).stores({
      conversations: "id, createdAt, updatedAt",
      messages: "id, conversationId, createdAt",
      // Add index for providerId for efficient lookup
      apiKeys: "id, name, providerId, createdAt",
    });
    // Define previous versions if needed for migration (optional for simple additions)
    // this.version(1).stores({
    //   conversations: "id, createdAt, updatedAt",
    //   messages: "id, conversationId, createdAt",
    // });
  }
}

export const db = new ChatDatabase();
