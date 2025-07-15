// src/lib/litechat/db.ts
// FULL FILE
import Dexie, { type Table } from "dexie";
import type { Conversation } from "@/types/litechat/chat";
import type { Interaction } from "@/types/litechat/interaction";
import type { DbMod } from "@/types/litechat/modding";
import type { DbProviderConfig, DbApiKey } from "@/types/litechat/provider";
import type { SyncRepo } from "@/types/litechat/sync";
import type { Project } from "@/types/litechat/project";
import type { DbRule, DbTag, DbTagRuleLink } from "@/types/litechat/rules";
import type { DbPromptTemplate } from "@/types/litechat/prompt-template";
import type { 
  DbMarketplaceSource, 
  DbMarketplaceIndex, 
  DbInstalledMarketplaceItem 
} from "@/types/litechat/marketplace";


export interface DbAppState {
  key: string;
  value: any;
}

export interface DbWorkflow {
  id: string;
  name: string;
  description: string;
  definition: string; // JSON representation of WorkflowTemplate
  createdAt: Date;
  updatedAt: Date;
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
  rules!: Table<DbRule, string>;
  tags!: Table<DbTag, string>;
  tagRuleLinks!: Table<DbTagRuleLink, string>;
  promptTemplates!: Table<DbPromptTemplate, string>;
  workflows!: Table<DbWorkflow, string>;
  marketplaceSources!: Table<DbMarketplaceSource, string>;
  marketplaceIndexes!: Table<DbMarketplaceIndex, string>;
  installedMarketplaceItems!: Table<DbInstalledMarketplaceItem, string>;

  constructor() {
    super("LiteChatDatabase_Rewrite_v1");
    // Bump version for rule descriptions
    this.version(12).stores({
      conversations:
        "++id, title, createdAt, updatedAt, syncRepoId, lastSyncedAt, projectId",
      // Add rating index to interactions
      interactions:
        "++id, conversationId, index, type, status, startedAt, parentId, rating",
      mods: "++id, &name, enabled, loadOrder",
      appState: "&key",
      providerConfigs: "++id, &name, type, isEnabled, apiKeyId",
      apiKeys: "++id, &name",
      syncRepos: "++id, &name, remoteUrl, username",
      projects: "++id, &path, parentId, createdAt, updatedAt, name",
      rules: "++id, &name, type, createdAt, updatedAt",
      tags: "++id, &name, createdAt, updatedAt",
      tagRuleLinks: "++id, tagId, ruleId, &[tagId+ruleId]",
      promptTemplates: "++id, &name, createdAt, updatedAt, isPublic",
      workflows: "++id, &name, createdAt, updatedAt",
      marketplaceSources: "++id, &name, &url, enabled, createdAt, lastRefreshed",
      marketplaceIndexes: "++id, sourceId, cachedAt, expiresAt",
      installedMarketplaceItems: "++id, &packageId, sourceId, installedAt, enabled",
    });
    // Previous version for marketplace
    this.version(11).stores({
      conversations:
        "++id, title, createdAt, updatedAt, syncRepoId, lastSyncedAt, projectId",
      // Add rating index to interactions
      interactions:
        "++id, conversationId, index, type, status, startedAt, parentId, rating",
      mods: "++id, &name, enabled, loadOrder",
      appState: "&key",
      providerConfigs: "++id, &name, type, isEnabled, apiKeyId",
      apiKeys: "++id, &name",
      syncRepos: "++id, &name, remoteUrl, username",
      projects: "++id, &path, parentId, createdAt, updatedAt, name",
      rules: "++id, &name, type, createdAt, updatedAt",
      tags: "++id, &name, createdAt, updatedAt",
      tagRuleLinks: "++id, tagId, ruleId, &[tagId+ruleId]",
      promptTemplates: "++id, &name, createdAt, updatedAt, isPublic",
      workflows: "++id, &name, createdAt, updatedAt",
      marketplaceSources: "++id, &name, &url, enabled, createdAt, lastRefreshed",
      marketplaceIndexes: "++id, sourceId, cachedAt, expiresAt",
      installedMarketplaceItems: "++id, &packageId, sourceId, installedAt, enabled",
    });
    // Previous version for migration (workflows)
    this.version(10).stores({
      conversations:
        "++id, title, createdAt, updatedAt, syncRepoId, lastSyncedAt, projectId",
      // Add rating index to interactions
      interactions:
        "++id, conversationId, index, type, status, startedAt, parentId, rating",
      mods: "++id, &name, enabled, loadOrder",
      appState: "&key",
      providerConfigs: "++id, &name, type, isEnabled, apiKeyId",
      apiKeys: "++id, &name",
      syncRepos: "++id, &name, remoteUrl, username",
      projects: "++id, &path, parentId, createdAt, updatedAt, name",
      rules: "++id, &name, type, createdAt, updatedAt",
      tags: "++id, &name, createdAt, updatedAt",
      tagRuleLinks: "++id, tagId, ruleId, &[tagId+ruleId]",
      promptTemplates: "++id, &name, createdAt, updatedAt, isPublic",
      workflows: "++id, &name, createdAt, updatedAt",
    });
    this.version(9).stores({
      conversations:
        "++id, title, createdAt, updatedAt, syncRepoId, lastSyncedAt, projectId",
      // Add rating index to interactions
      interactions:
        "++id, conversationId, index, type, status, startedAt, parentId, rating",
      mods: "++id, &name, enabled, loadOrder",
      appState: "&key",
      providerConfigs: "++id, &name, type, isEnabled, apiKeyId",
      apiKeys: "++id, &name",
      syncRepos: "++id, &name, remoteUrl, username",
      projects: "++id, &path, parentId, createdAt, updatedAt, name",
      rules: "++id, &name, type, createdAt, updatedAt",
      tags: "++id, &name, createdAt, updatedAt",
      tagRuleLinks: "++id, tagId, ruleId, &[tagId+ruleId]",
      promptTemplates: "++id, &name, createdAt, updatedAt, isPublic",
    });
    this.version(8).stores({
      conversations:
        "++id, title, createdAt, updatedAt, syncRepoId, lastSyncedAt, projectId",
      // Add rating index to interactions
      interactions:
        "++id, conversationId, index, type, status, startedAt, parentId, rating",
      mods: "++id, &name, enabled, loadOrder",
      appState: "&key",
      providerConfigs: "++id, &name, type, isEnabled, apiKeyId",
      apiKeys: "++id, &name",
      syncRepos: "++id, &name, remoteUrl, username",
      projects: "++id, &path, parentId, createdAt, updatedAt, name",
      rules: "++id, &name, type, createdAt, updatedAt",
      tags: "++id, &name, createdAt, updatedAt",
      tagRuleLinks: "++id, tagId, ruleId, &[tagId+ruleId]",
    });
    // Define previous versions explicitly for Dexie's upgrade path
    this.version(7).stores({
      conversations:
        "++id, title, createdAt, updatedAt, syncRepoId, lastSyncedAt, projectId",
      interactions:
        "++id, conversationId, index, type, status, startedAt, parentId", // No rating index here
      mods: "++id, &name, enabled, loadOrder",
      appState: "&key",
      providerConfigs: "++id, &name, type, isEnabled, apiKeyId",
      apiKeys: "++id, &name",
      syncRepos: "++id, &name, remoteUrl, username",
      projects: "++id, &path, parentId, createdAt, updatedAt, name",
      rules: "++id, &name, type, createdAt, updatedAt",
      tags: "++id, &name, createdAt, updatedAt",
      tagRuleLinks: "++id, tagId, ruleId, &[tagId+ruleId]",
    });
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
