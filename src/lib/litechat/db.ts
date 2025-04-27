// src/lib/litechat/db.ts
import Dexie, { type Table } from "dexie";
import type { Conversation } from "@/types/litechat/chat";
import type { Interaction } from "@/types/litechat/interaction";
import type { DbMod } from "@/types/litechat/modding";
import type { DbProviderConfig, DbApiKey } from "@/types/litechat/provider";
import type { SyncRepo } from "@/types/litechat/sync"; // Import SyncRepo type

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
  syncRepos!: Table<SyncRepo, string>; // Added SyncRepo table

  constructor() {
    super("LiteChatDatabase_Rewrite_v1"); // Keep name consistent for now
    this.version(2) // Bump version for new table
      .stores({
        conversations:
          "++id, title, createdAt, updatedAt, syncRepoId, lastSyncedAt", // Add sync fields
        interactions:
          "++id, conversationId, index, type, status, startedAt, parentId",
        mods: "++id, &name, enabled, loadOrder",
        appState: "&key",
        providerConfigs: "++id, &name, type, isEnabled, apiKeyId",
        apiKeys: "++id, &name",
        syncRepos: "++id, &name, remoteUrl", // Added SyncRepo store definition
      })
      .upgrade((tx) => {
        console.log("Upgrading DB to version 2, adding syncRepos table.");
        // Migration logic if needed:
        // If you need to add default values for syncRepoId/lastSyncedAt to existing conversations:
        // return tx.table('conversations').toCollection().modify(convo => {
        //   convo.syncRepoId = convo.syncRepoId ?? null;
        //   convo.lastSyncedAt = convo.lastSyncedAt ?? null;
        // });
      });
    // Keep v1 definition for users who haven't upgraded yet
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
