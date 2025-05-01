// src/lib/litechat/db.ts
import Dexie, { type Table } from "dexie";
import type { Conversation } from "@/types/litechat/chat";
import type { Interaction } from "@/types/litechat/interaction";
import type { DbMod } from "@/types/litechat/modding";
import type { DbProviderConfig, DbApiKey } from "@/types/litechat/provider";
import type { SyncRepo } from "@/types/litechat/sync";
import type { Project } from "@/types/litechat/project";

export interface DbAppState {
  key: string;
  value: any;
}

// Helper function to build project path during migration
// async function buildProjectPath(
//   projectId: string,
//   projectTable: Table<Project, string>,
// ): Promise<string> {
//   const project = await projectTable.get(projectId);
//   if (!project) return "/"

//   if (!project.parentId) {
//     return normalizePath(`/${project.name}`);
//   }

//   const parentPath = await buildProjectPath(project.parentId, projectTable);
//   return normalizePath(`${parentPath}/${project.name}`);
// }

export class LiteChatDatabase extends Dexie {
  conversations!: Table<Conversation, string>;
  interactions!: Table<Interaction, string>;
  mods!: Table<DbMod, string>;
  appState!: Table<DbAppState, string>;
  providerConfigs!: Table<DbProviderConfig, string>;
  apiKeys!: Table<DbApiKey, string>;
  syncRepos!: Table<SyncRepo, string>;
  projects!: Table<Project, string>;

  constructor() {
    super("LiteChatDatabase_Rewrite_v1");
    this.version(6) // Bump version for sync repo auth fields
      .stores({
        conversations:
          "++id, title, createdAt, updatedAt, syncRepoId, lastSyncedAt, projectId",
        interactions:
          "++id, conversationId, index, type, status, startedAt, parentId",
        mods: "++id, &name, enabled, loadOrder",
        appState: "&key",
        providerConfigs: "++id, &name, type, isEnabled, apiKeyId",
        apiKeys: "++id, &name",
        // Added optional username field to index for potential future lookups? (Maybe not needed)
        syncRepos: "++id, &name, remoteUrl, username",
        projects: "++id, &path, parentId, createdAt, updatedAt, name",
      });
    // Define previous versions explicitly for Dexie's upgrade path
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
