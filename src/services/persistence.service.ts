import { db } from "@/lib/litechat/db";
import type { Conversation } from "@/types/litechat/chat";
import type { Interaction } from "@/types/litechat/interaction";
import type { DbMod } from "@/types/litechat/modding";
import type { DbProviderConfig, DbApiKey } from "@/types/litechat/provider";
import type { DbAppState } from "@/lib/litechat/db";

export class PersistenceService {
  // Conversations
  static async loadConversations(): Promise<Conversation[]> {
    return await db.conversations.orderBy("updatedAt").reverse().toArray();
  }
  static async saveConversation(c: Conversation): Promise<string> {
    return await db.conversations.put(c);
  }
  static async deleteConversation(id: string): Promise<void> {
    await db.conversations.delete(id);
  }

  // Interactions
  static async loadInteractionsForConversation(
    id: string,
  ): Promise<Interaction[]> {
    return await db.interactions.where({ conversationId: id }).sortBy("index");
  }
  static async saveInteraction(i: Interaction): Promise<string> {
    return await db.interactions.put(i);
  }
  static async deleteInteraction(id: string): Promise<void> {
    await db.interactions.delete(id);
  }
  static async deleteInteractionsForConversation(id: string): Promise<void> {
    await db.interactions.where({ conversationId: id }).delete();
  }

  // Mods
  static async loadMods(): Promise<DbMod[]> {
    return await db.mods.orderBy("loadOrder").toArray();
  }
  static async saveMod(m: DbMod): Promise<string> {
    return await db.mods.put(m);
  }
  static async deleteMod(id: string): Promise<void> {
    await db.mods.delete(id);
  }

  // App State
  static async saveSetting(key: string, value: any): Promise<string> {
    return await db.appState.put({ key: `settings:${key}`, value });
  }
  static async loadSetting<T>(key: string, defaultVal: T): Promise<T> {
    const s = await db.appState.get(`settings:${key}`);
    return s?.value ?? defaultVal;
  }

  // Provider Configs
  static async loadProviderConfigs(): Promise<DbProviderConfig[]> {
    return (await db.providerConfigs?.toArray()) ?? [];
  }
  static async saveProviderConfig(c: DbProviderConfig): Promise<string> {
    return await db.providerConfigs.put(c);
  }
  static async deleteProviderConfig(id: string): Promise<void> {
    await db.providerConfigs.delete(id);
  }

  // API Keys
  static async loadApiKeys(): Promise<DbApiKey[]> {
    return (await db.apiKeys?.toArray()) ?? [];
  }
  static async saveApiKey(k: DbApiKey): Promise<string> {
    return await db.apiKeys.put(k);
  }
  static async deleteApiKey(id: string): Promise<void> {
    // Unlink before deleting
    const configsToUpdate = await db.providerConfigs
      .where("apiKeyId")
      .equals(id)
      .toArray();
    if (configsToUpdate.length > 0) {
      const updates = configsToUpdate.map((config) =>
        db.providerConfigs.update(config.id, { apiKeyId: null }),
      );
      await Promise.all(updates);
    }
    await db.apiKeys.delete(id);
  }
}
