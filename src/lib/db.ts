// src/lib/db.ts
import Dexie, { type Table } from "dexie";
import type {
  DbConversation,
  DbMessage,
  DbApiKey,
  DbProject,
  DbProviderConfig, // Import new type
} from "./types";
import type { DbMod } from "@/mods/types"; // Import DbMod type

export class ChatDatabase extends Dexie {
  projects!: Table<DbProject, string>;
  conversations!: Table<DbConversation, string>;
  messages!: Table<DbMessage, string>;
  apiKeys!: Table<DbApiKey, string>;
  mods!: Table<DbMod, string>;
  providerConfigs!: Table<DbProviderConfig, string>; // Add providerConfigs table

  constructor() {
    super("LiteChatDatabase");
    // Bump version number when schema changes
    this.version(6).stores({
      // Added providerConfigs table
      providerConfigs:
        "++id, &name, type, apiKeyId, isEnabled, createdAt, updatedAt",
      // Previous tables (ensure indexes match previous version)
      mods: "++id, &name, sourceUrl, enabled, createdAt, loadOrder",
      projects: "++id, name, parentId, createdAt, updatedAt",
      conversations: "id, parentId, createdAt, updatedAt",
      messages: "id, conversationId, createdAt, vfsContextPaths",
      apiKeys: "id, name, providerId, createdAt", // providerId might be less useful now
    });
    // Define previous versions for migration
    this.version(5).stores({
      mods: "++id, &name, sourceUrl, enabled, createdAt, loadOrder",
      projects: "++id, name, parentId, createdAt, updatedAt",
      conversations: "id, parentId, createdAt, updatedAt",
      messages: "id, conversationId, createdAt, vfsContextPaths",
      apiKeys: "id, name, providerId, createdAt",
    });
    this.version(4).stores({
      projects: "++id, name, parentId, createdAt, updatedAt",
      conversations: "id, parentId, createdAt, updatedAt",
      messages: "id, conversationId, createdAt, vfsContextPaths",
      apiKeys: "id, name, providerId, createdAt",
    });
    this.version(3).stores({
      projects: "++id, name, parentId, createdAt, updatedAt",
      conversations: "id, parentId, createdAt, updatedAt",
      messages: "id, conversationId, createdAt",
      apiKeys: "id, name, providerId, createdAt",
    });
    this.version(2).stores({
      conversations: "id, createdAt, updatedAt",
      messages: "id, conversationId, createdAt",
      apiKeys: "id, name, providerId, createdAt",
    });
    // No upgrade function needed for adding a new table
  }
}

export const db = new ChatDatabase();
