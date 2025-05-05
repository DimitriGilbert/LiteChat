// src/lib/litechat/db.ts
// FULL FILE
import Dexie, { type Table } from "dexie";
import type { Conversation } from "@/types/litechat/chat";
import type { Interaction } from "@/types/litechat/interaction";
import type { DbMod } from "@/types/litechat/modding";
import type { DbProviderConfig, DbApiKey } from "@/types/litechat/provider";
import type { SyncRepo } from "@/types/litechat/sync";
import type { Project } from "@/types/litechat/project";
// Import new types
import type { DbRule, DbTag, DbTagRuleLink } from "@/types/litechat/rules";

export interface DbAppState {
  key: string;
  value: any;
}

export class LiteChatDatabase extends Dexie {
  conversations!: Table<Conversation, string>;
  interactions!: Table<Interaction, string>;
  mods!: Table<DbMod, string>;
  appState!: Table<DbAppState, string>;
  providerConfigs!: Table<DbProviderConfig, string>;
  apiKeys!: Table<DbApiKey, string>;
  syncRepos!: Table<SyncRepo, string>;
  projects!: Table<Project, string>;
  // Add new tables
  rules!: Table<DbRule, string>;
  tags!: Table<DbTag, string>;
  tagRuleLinks!: Table<DbTagRuleLink, string>;

  constructor() {
    super("LiteChatDatabase_Rewrite_v1");
    this.version(7) // Bump version for rules and tags
      .stores({
        conversations:
          "++id, title, createdAt, updatedAt, syncRepoId, lastSyncedAt, projectId",
        interactions:
          "++id, conversationId, index, type, status, startedAt, parentId",
        mods: "++id, &name, enabled, loadOrder",
        appState: "&key",
        providerConfigs: "++id, &name, type, isEnabled, apiKeyId",
        apiKeys: "++id, &name",
        syncRepos: "++id, &name, remoteUrl, username",
        projects: "++id, &path, parentId, createdAt, updatedAt, name",
        // Define new tables and indices
        rules: "++id, &name, type, createdAt, updatedAt",
        tags: "++id, &name, createdAt, updatedAt",
        tagRuleLinks: "++id, tagId, ruleId, &[tagId+ruleId]",
      });
    // Define previous versions explicitly for Dexie's upgrade path
    this.version(6).stores({
      conversations:
        "++id, title, createdAt, updatedAt, syncRepoId, lastSyncedAt, projectId",
      interactions:
        "++id, conversationId, index, type, status, startedAt, parentId",
      mods: "++id, &name, enabled, loadOrder",
      appState: "&key",
      providerConfigs: "++id, &name, type, isEnabled, apiKeyId",
      apiKeys: "++id, &name",
      syncRepos: "++id, &name, remoteUrl, username",
      projects: "++id, &path, parentId, createdAt, updatedAt, name",
    });
    this.version(5).stores({
      conversations:
        "++id, title, createdAt, updatedAt, syncRepoId, lastSyncedAt, projectId",
      interactions:
        "++id, conversationId, index, type, status, startedAt, parentId",
      mods: "++id, &name, enabled, loadOrder",
      appState: "&key",
      providerConfigs: "++id, &name, type, isEnabled, apiKeyId",
      apiKeys: "++id, &name",
      syncRepos: "++id, &name, remoteUrl",
      projects: "++id, &path, parentId, createdAt, updatedAt, name",
    });
    this.version(4).stores({
      conversations:
        "++id, title, createdAt, updatedAt, syncRepoId, lastSyncedAt, projectId",
      interactions:
        "++id, conversationId, index, type, status, startedAt, parentId",
      mods: "++id, &name, enabled, loadOrder",
      appState: "&key",
      providerConfigs: "++id, &name, type, isEnabled, apiKeyId",
      apiKeys: "++id, &name",
      syncRepos: "++id, &name, remoteUrl",
      projects: "++id, name, parentId, createdAt, updatedAt",
    });
    this.version(3).stores({
      conversations:
        "++id, title, createdAt, updatedAt, syncRepoId, lastSyncedAt, projectId",
      interactions:
        "++id, conversationId, index, type, status, startedAt, parentId",
      mods: "++id, &name, enabled, loadOrder",
      appState: "&key",
      providerConfigs: "++id, &name, type, isEnabled, apiKeyId",
      apiKeys: "++id, &name",
      syncRepos: "++id, &name, remoteUrl",
      projects: "++id, &name, parentId, createdAt, updatedAt",
    });
    this.version(2).stores({
      conversations:
        "++id, title, createdAt, updatedAt, syncRepoId, lastSyncedAt",
      interactions:
        "++id, conversationId, index, type, status, startedAt, parentId",
      mods: "++id, &name, enabled, loadOrder",
      appState: "&key",
      providerConfigs: "++id, &name, type, isEnabled, apiKeyId",
      apiKeys: "++id, &name",
      syncRepos: "++id, &name, remoteUrl",
    });
    this.version(1).stores({
      conversations: "++id, title, createdAt, updatedAt",
      interactions:
        "++id, conversationId, index, type, status, startedAt, parentId",
      mods: "++id, &name, enabled, loadOrder",
      appState: "&key",
      providerConfigs: "++id, &name, type, isEnabled, apiKeyId",
      apiKeys: "++id, &name",
    });
  }
}
export const db = new LiteChatDatabase();
