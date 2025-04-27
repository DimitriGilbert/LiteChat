// src/lib/litechat/db.ts
import Dexie, { type Table } from "dexie";
import type { Conversation } from "@/types/litechat/chat";
import type { Interaction } from "@/types/litechat/interaction";
import type { DbMod } from "@/types/litechat/modding";
import type { DbProviderConfig, DbApiKey } from "@/types/litechat/provider";
import type { SyncRepo } from "@/types/litechat/sync";
import type { Project } from "@/types/litechat/project"; // Import Project type

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
  projects!: Table<Project, string>; // Added projects table

  constructor() {
    super("LiteChatDatabase_Rewrite_v1"); // Keep name consistent for now
    this.version(3) // Bump version for projects table
      .stores({
        conversations:
          "++id, title, createdAt, updatedAt, syncRepoId, lastSyncedAt, projectId", // Add projectId index
        interactions:
          "++id, conversationId, index, type, status, startedAt, parentId",
        mods: "++id, &name, enabled, loadOrder",
        appState: "&key",
        providerConfigs: "++id, &name, type, isEnabled, apiKeyId",
        apiKeys: "++id, &name",
        syncRepos: "++id, &name, remoteUrl",
        projects: "++id, &name, parentId, createdAt, updatedAt", // Added projects store definition
      })
      .upgrade(async (tx) => {
        console.log("Upgrading DB to version 3, adding projects table.");
        // Add projectId: null to existing conversations
        await tx
          .table("conversations")
          .toCollection()
          .modify((convo) => {
            convo.projectId = convo.projectId ?? null;
          });
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
