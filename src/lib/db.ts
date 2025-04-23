
import Dexie, { type Table } from "dexie";
import type {
  DbConversation,
  DbMessage,
  DbApiKey,
  DbProject,
  DbProviderConfig,
  // Workflow, // Removed unused import
} from "./types";
import type { DbMod } from "@/mods/types";


export interface DbAppState {
  key: string; // Primary key (e.g., 'lastSelection')
  value: any; // Store various state values
}

export class ChatDatabase extends Dexie {
  projects!: Table<DbProject, string>;
  conversations!: Table<DbConversation, string>;
  messages!: Table<DbMessage, string>;
  apiKeys!: Table<DbApiKey, string>;
  mods!: Table<DbMod, string>;
  providerConfigs!: Table<DbProviderConfig, string>;
  appState!: Table<DbAppState, string>; // Add the new table definition

  constructor() {
    super("LiteChatDatabase");
    // Increment version number for the schema change (adding providerId, modelId to messages)
    this.version(12).stores({
      // Keep previous definitions
      providerConfigs:
        "++id, &name, type, apiKeyId, isEnabled, autoFetchModels, modelsLastFetchedAt, createdAt, updatedAt",
      mods: "++id, &name, sourceUrl, enabled, createdAt, loadOrder",
      projects: "++id, name, parentId, createdAt, updatedAt",
      conversations: "id, parentId, createdAt, updatedAt",
      // Add 'providerId', 'modelId' to the messages schema string. They are not indexed.
      messages:
        "id, conversationId, createdAt, role, tool_call_id, children, workflow, providerId, modelId, [conversationId+createdAt]",
      apiKeys: "id, name, providerId, createdAt",
      appState: "&key",
    });
    // No upgrade needed for v11 -> v12 as we are just adding non-indexed fields

    // --- Keep previous version definitions ---
    this.version(11).stores({
      providerConfigs:
        "++id, &name, type, apiKeyId, isEnabled, autoFetchModels, modelsLastFetchedAt, createdAt, updatedAt",
      mods: "++id, &name, sourceUrl, enabled, createdAt, loadOrder",
      projects: "++id, name, parentId, createdAt, updatedAt",
      conversations: "id, parentId, createdAt, updatedAt",
      // Schema for v11 (with 'children', 'workflow', without provider/model)
      messages:
        "id, conversationId, createdAt, role, tool_call_id, children, workflow, [conversationId+createdAt]",
      apiKeys: "id, name, providerId, createdAt",
      appState: "&key",
    });

    this.version(10).stores({
      providerConfigs:
        "++id, &name, type, apiKeyId, isEnabled, autoFetchModels, modelsLastFetchedAt, createdAt, updatedAt",
      mods: "++id, &name, sourceUrl, enabled, createdAt, loadOrder",
      projects: "++id, name, parentId, createdAt, updatedAt",
      conversations: "id, parentId, createdAt, updatedAt",
      // Schema for v10 (with 'children', without 'workflow', provider/model)
      messages:
        "id, conversationId, createdAt, role, tool_call_id, children, [conversationId+createdAt]",
      apiKeys: "id, name, providerId, createdAt",
      appState: "&key",
    });

    this.version(9).stores({
      providerConfigs:
        "++id, &name, type, apiKeyId, isEnabled, autoFetchModels, modelsLastFetchedAt, createdAt, updatedAt",
      mods: "++id, &name, sourceUrl, enabled, createdAt, loadOrder",
      projects: "++id, name, parentId, createdAt, updatedAt",
      conversations: "id, parentId, createdAt, updatedAt",
      // Schema for v9 (without 'children', 'workflow', provider/model)
      messages:
        "id, conversationId, createdAt, role, tool_call_id, [conversationId+createdAt]",
      apiKeys: "id, name, providerId, createdAt",
      appState: "&key",
    });

    this.version(8).stores({
      providerConfigs:
        "++id, &name, type, apiKeyId, isEnabled, autoFetchModels, modelsLastFetchedAt, createdAt, updatedAt",
      mods: "++id, &name, sourceUrl, enabled, createdAt, loadOrder",
      projects: "++id, name, parentId, createdAt, updatedAt",
      conversations: "id, parentId, createdAt, updatedAt",
      messages:
        "id, conversationId, createdAt, role, tool_call_id, [conversationId+createdAt]",
      apiKeys: "id, name, providerId, createdAt",
    });

    this.version(7).stores({
      providerConfigs:
        "++id, &name, type, apiKeyId, isEnabled, autoFetchModels, modelsLastFetchedAt, createdAt, updatedAt",
      mods: "++id, &name, sourceUrl, enabled, createdAt, loadOrder",
      projects: "++id, name, parentId, createdAt, updatedAt",
      conversations: "id, parentId, createdAt, updatedAt",
      messages: "id, conversationId, createdAt, vfsContextPaths",
      apiKeys: "id, name, providerId, createdAt",
    });
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
