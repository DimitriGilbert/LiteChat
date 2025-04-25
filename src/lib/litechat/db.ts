import Dexie, { type Table } from "dexie";
import type { Conversation } from "@/types/litechat/chat";
import type { Interaction } from "@/types/litechat/interaction";
import type { DbMod } from "@/types/litechat/modding";
import type { DbProviderConfig, DbApiKey } from "@/types/litechat/provider";

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

  constructor() {
    super("LiteChatDatabase_Rewrite_v1");
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
