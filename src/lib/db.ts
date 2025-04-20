// src/lib/db.ts
import Dexie, { type Table } from "dexie";
import type {
  DbConversation,
  DbMessage,
  DbApiKey,
  DbProject,
  DbProviderConfig,
} from "./types";
import type { DbMod } from "@/mods/types";

export class ChatDatabase extends Dexie {
  projects!: Table<DbProject, string>;
  conversations!: Table<DbConversation, string>;
  // Specify DbMessage with its potentially complex 'content' type
  messages!: Table<DbMessage, string>;
  apiKeys!: Table<DbApiKey, string>;
  mods!: Table<DbMod, string>;
  providerConfigs!: Table<DbProviderConfig, string>;

  constructor() {
    super("LiteChatDatabase");
    // Version 8: Added 'role' and 'tool_call_id' indices to messages table.
    //            Added compound index for faster message fetching/sorting.
    this.version(8).stores({
      // No change from v7
      providerConfigs:
        "++id, &name, type, apiKeyId, isEnabled, autoFetchModels, modelsLastFetchedAt, createdAt, updatedAt",
      // No change from v7
      mods: "++id, &name, sourceUrl, enabled, createdAt, loadOrder",
      // No change from v7
      projects: "++id, name, parentId, createdAt, updatedAt",
      // No change from v7
      conversations: "id, parentId, createdAt, updatedAt",
      // 'content' is not indexed.
      // 'tool_calls' is not indexed.
      // Index 'role' for potential filtering.
      // Index 'tool_call_id' for linking tool results.
      // Add compound index for efficient sorting within conversations.
      messages:
        "id, conversationId, createdAt, role, tool_call_id, [conversationId+createdAt]", // Added role, tool_call_id, compound index
      // No change from v7
      apiKeys: "id, name, providerId, createdAt",
    });

    // --- Keep previous version definitions ---
    // Version 7: Added providerConfigs fields
    this.version(7).stores({
      providerConfigs:
        "++id, &name, type, apiKeyId, isEnabled, autoFetchModels, modelsLastFetchedAt, createdAt, updatedAt",
      mods: "++id, &name, sourceUrl, enabled, createdAt, loadOrder",
      projects: "++id, name, parentId, createdAt, updatedAt",
      conversations: "id, parentId, createdAt, updatedAt",
      messages: "id, conversationId, createdAt, vfsContextPaths", // Previous schema
      apiKeys: "id, name, providerId, createdAt",
    });
    // Add upgrade logic for version 7 (remains the same)
    this.version(7).upgrade(async (tx) => {
      await tx
        .table("providerConfigs")
        .toCollection()
        .modify((config: DbProviderConfig) => {
          if (typeof config.autoFetchModels === "undefined") {
            config.autoFetchModels = [
              "openai",
              "openrouter",
              "ollama",
              "openai-compatible",
            ].includes(config.type);
          }
          if (typeof config.fetchedModels === "undefined") {
            config.fetchedModels = null;
          }
          if (typeof config.modelsLastFetchedAt === "undefined") {
            config.modelsLastFetchedAt = null;
          }
        });
    });

    this.version(6).stores({
      providerConfigs:
        "++id, &name, type, apiKeyId, isEnabled, createdAt, updatedAt",
      mods: "++id, &name, sourceUrl, enabled, createdAt, loadOrder",
      projects: "++id, name, parentId, createdAt, updatedAt",
      conversations: "id, parentId, createdAt, updatedAt",
      messages: "id, conversationId, createdAt, vfsContextPaths",
      apiKeys: "id, name, providerId, createdAt",
    });
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
  }
}

export const db = new ChatDatabase();
