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
  messages!: Table<DbMessage, string>;
  apiKeys!: Table<DbApiKey, string>;
  mods!: Table<DbMod, string>;
  providerConfigs!: Table<DbProviderConfig, string>;

  constructor() {
    super("LiteChatDatabase");
    this.version(7).stores({
      providerConfigs:
        "++id, &name, type, apiKeyId, isEnabled, autoFetchModels, modelsLastFetchedAt, createdAt, updatedAt",
      mods: "++id, &name, sourceUrl, enabled, createdAt, loadOrder",
      projects: "++id, name, parentId, createdAt, updatedAt",
      conversations: "id, parentId, createdAt, updatedAt",
      messages: "id, conversationId, createdAt, vfsContextPaths",
      apiKeys: "id, name, providerId, createdAt",
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

    // Add upgrade logic for version 7
    this.version(7).upgrade(async (tx) => {
      // Use toCollection().modify()
      await tx
        .table("providerConfigs")
        .toCollection()
        .modify((config: DbProviderConfig) => {
          // Check if fields exist before assigning defaults
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

    // --- Keep previous version definitions ---
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
