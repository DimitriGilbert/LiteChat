// src/services/persistence.service.ts
import { db } from "@/lib/litechat/db";
import type { Conversation } from "@/types/litechat/chat";
import type { Interaction } from "@/types/litechat/interaction";
import type { DbMod } from "@/types/litechat/modding";
import type { DbProviderConfig, DbApiKey } from "@/types/litechat/provider";
import type { SyncRepo } from "@/types/litechat/sync";

export class PersistenceService {
  // Conversations
  static async loadConversations(): Promise<Conversation[]> {
    try {
      return await db.conversations.orderBy("updatedAt").reverse().toArray();
    } catch (error) {
      console.error("PersistenceService: Error loading conversations:", error);
      throw error;
    }
  }

  static async saveConversation(c: Conversation): Promise<string> {
    try {
      // Ensure sync fields have default values if missing
      const conversationToSave: Conversation = {
        ...c,
        syncRepoId: c.syncRepoId ?? null,
        lastSyncedAt: c.lastSyncedAt ?? null,
      };
      return await db.conversations.put(conversationToSave);
    } catch (error) {
      console.error("PersistenceService: Error saving conversation:", error);
      throw error;
    }
  }

  static async deleteConversation(id: string): Promise<void> {
    try {
      await db.conversations.delete(id);
    } catch (error) {
      console.error("PersistenceService: Error deleting conversation:", error);
      throw error;
    }
  }

  // Interactions
  static async loadInteractionsForConversation(
    id: string,
  ): Promise<Interaction[]> {
    try {
      return await db.interactions
        .where({ conversationId: id })
        .sortBy("index");
    } catch (error) {
      console.error(
        "PersistenceService: Error loading interactions for conversation:",
        error,
      );
      throw error;
    }
  }

  static async saveInteraction(i: Interaction): Promise<string> {
    try {
      return await db.interactions.put(i);
    } catch (error) {
      console.error("PersistenceService: Error saving interaction:", error);
      throw error;
    }
  }

  static async deleteInteraction(id: string): Promise<void> {
    try {
      await db.interactions.delete(id);
    } catch (error) {
      console.error("PersistenceService: Error deleting interaction:", error);
      throw error;
    }
  }

  static async deleteInteractionsForConversation(id: string): Promise<void> {
    try {
      await db.interactions.where({ conversationId: id }).delete();
    } catch (error) {
      console.error(
        "PersistenceService: Error deleting interactions for conversation:",
        error,
      );
      throw error;
    }
  }

  // Mods
  static async loadMods(): Promise<DbMod[]> {
    try {
      return await db.mods.orderBy("loadOrder").toArray();
    } catch (error) {
      console.error("PersistenceService: Error loading mods:", error);
      throw error;
    }
  }

  static async saveMod(m: DbMod): Promise<string> {
    try {
      return await db.mods.put(m);
    } catch (error) {
      console.error("PersistenceService: Error saving mod:", error);
      throw error;
    }
  }

  static async deleteMod(id: string): Promise<void> {
    try {
      await db.mods.delete(id);
    } catch (error) {
      console.error("PersistenceService: Error deleting mod:", error);
      throw error;
    }
  }

  // App State (Settings)
  static async saveSetting(key: string, value: any): Promise<string> {
    try {
      return await db.appState.put({ key: `settings:${key}`, value });
    } catch (error) {
      console.error("PersistenceService: Error saving setting:", error);
      throw error;
    }
  }

  static async loadSetting<T>(key: string, defaultVal: T): Promise<T> {
    try {
      const setting = await db.appState.get(`settings:${key}`);
      return setting?.value !== undefined ? (setting.value as T) : defaultVal;
    } catch (error) {
      console.error("PersistenceService: Error loading setting:", error);
      return defaultVal;
    }
  }

  // Provider Configs
  static async loadProviderConfigs(): Promise<DbProviderConfig[]> {
    try {
      return (await db.providerConfigs?.toArray()) ?? [];
    } catch (error) {
      console.error(
        "PersistenceService: Error loading provider configs:",
        error,
      );
      throw error;
    }
  }

  static async saveProviderConfig(c: DbProviderConfig): Promise<string> {
    try {
      return await db.providerConfigs.put(c);
    } catch (error) {
      console.error("PersistenceService: Error saving provider config:", error);
      throw error;
    }
  }

  static async deleteProviderConfig(id: string): Promise<void> {
    try {
      await db.providerConfigs.delete(id);
    } catch (error) {
      console.error(
        "PersistenceService: Error deleting provider config:",
        error,
      );
      throw error;
    }
  }

  // API Keys
  static async loadApiKeys(): Promise<DbApiKey[]> {
    try {
      return (await db.apiKeys?.toArray()) ?? [];
    } catch (error) {
      console.error("PersistenceService: Error loading API keys:", error);
      throw error;
    }
  }

  static async saveApiKey(k: DbApiKey): Promise<string> {
    try {
      return await db.apiKeys.put(k);
    } catch (error) {
      console.error("PersistenceService: Error saving API key:", error);
      throw error;
    }
  }

  static async deleteApiKey(id: string): Promise<void> {
    try {
      await db.transaction("rw", [db.apiKeys, db.providerConfigs], async () => {
        const configsToUpdate = await db.providerConfigs
          .where("apiKeyId")
          .equals(id)
          .toArray();

        if (configsToUpdate.length > 0) {
          const updates = configsToUpdate.map((config) =>
            db.providerConfigs.update(config.id, { apiKeyId: null }),
          );
          await Promise.all(updates);
          console.log(
            `PersistenceService: Unlinked API key ${id} from ${configsToUpdate.length} provider configs.`,
          );
        }
        await db.apiKeys.delete(id);
      });
    } catch (error) {
      console.error("PersistenceService: Error deleting API key:", error);
      throw error;
    }
  }

  // --- Sync Repos ---
  static async loadSyncRepos(): Promise<SyncRepo[]> {
    try {
      return await db.syncRepos.toArray();
    } catch (error) {
      console.error("PersistenceService: Error loading sync repos:", error);
      throw error;
    }
  }

  static async saveSyncRepo(repo: SyncRepo): Promise<string> {
    try {
      return await db.syncRepos.put(repo);
    } catch (error) {
      console.error("PersistenceService: Error saving sync repo:", error);
      throw error;
    }
  }

  static async deleteSyncRepo(id: string): Promise<void> {
    try {
      // Unlink from conversations within a transaction
      await db.transaction("rw", [db.syncRepos, db.conversations], async () => {
        const convosToUpdate = await db.conversations
          .where("syncRepoId")
          .equals(id)
          .toArray();
        if (convosToUpdate.length > 0) {
          const updates = convosToUpdate.map((convo) =>
            db.conversations.update(convo.id, { syncRepoId: null }),
          );
          await Promise.all(updates);
          console.log(
            `PersistenceService: Unlinked SyncRepo ${id} from ${convosToUpdate.length} conversations.`,
          );
        }
        await db.syncRepos.delete(id);
      });
    } catch (error) {
      console.error("PersistenceService: Error deleting sync repo:", error);
      throw error;
    }
  }

  // --- Clear All Data ---
  static async clearAllData(): Promise<void> {
    try {
      await db.transaction(
        "rw",
        [
          db.conversations,
          db.interactions,
          db.mods,
          db.appState,
          db.providerConfigs,
          db.apiKeys,
          db.syncRepos, // Add syncRepos table
        ],
        async () => {
          await db.interactions.clear();
          await db.conversations.clear();
          await db.mods.clear();
          await db.appState.clear();
          await db.providerConfigs.clear();
          await db.apiKeys.clear();
          await db.syncRepos.clear(); // Clear syncRepos table
        },
      );
      console.log("PersistenceService: All data cleared.");
    } catch (error) {
      console.error("PersistenceService: Error clearing all data:", error);
      throw error;
    }
  }
}
