// src/services/persistence.service.ts
import { db } from "@/lib/litechat/db";
import type { Conversation } from "@/types/litechat/chat";
import type { Interaction } from "@/types/litechat/interaction";
import type { DbMod } from "@/types/litechat/modding";
import type { DbProviderConfig, DbApiKey } from "@/types/litechat/provider";
import type { SyncRepo } from "@/types/litechat/sync";
import type { Project } from "@/types/litechat/project";

// Helper function to ensure date fields are Date objects
const ensureDateFields = <
  T extends { createdAt?: any; updatedAt?: any; [key: string]: any },
>(
  item: T,
  otherDateFields: string[] = [],
): T => {
  const newItem = { ...item };
  if (item.createdAt && !(item.createdAt instanceof Date)) {
    newItem.createdAt = new Date(item.createdAt);
  }
  if (item.updatedAt && !(item.updatedAt instanceof Date)) {
    newItem.updatedAt = new Date(item.updatedAt);
  }
  // Check if otherDateFields is actually an array before iterating
  if (Array.isArray(otherDateFields)) {
    otherDateFields.forEach((field) => {
      if (item[field] && !(item[field] instanceof Date)) {
        // Cast newItem to any to allow indexed assignment
        (newItem as any)[field] = new Date(item[field]);
      }
    });
  } else {
    // Log a warning if it's not an array, though this shouldn't happen with the fix below
    console.warn(
      "[ensureDateFields] Expected otherDateFields to be an array, but received:",
      otherDateFields,
    );
  }
  return newItem;
};

export class PersistenceService {
  // Conversations
  static async loadConversations(): Promise<Conversation[]> {
    try {
      const conversations = await db.conversations
        .orderBy("updatedAt")
        .reverse()
        .toArray();
      // Ensure createdAt, updatedAt, and lastSyncedAt are Date objects
      return conversations.map((c) => ensureDateFields(c, ["lastSyncedAt"]));
    } catch (error) {
      console.error("PersistenceService: Error loading conversations:", error);
      throw error;
    }
  }

  static async saveConversation(c: Conversation): Promise<string> {
    try {
      // Ensure sync and project fields have default values if missing
      // Dates are already Date objects here, Dexie handles serialization
      const conversationToSave: Conversation = {
        ...c,
        syncRepoId: c.syncRepoId ?? null,
        lastSyncedAt: c.lastSyncedAt ?? null,
        projectId: c.projectId ?? null,
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

  // Interactions (Ensure dates are handled if needed, though less likely to be sorted directly)
  static async loadInteractionsForConversation(
    id: string,
  ): Promise<Interaction[]> {
    try {
      const interactions = await db.interactions
        .where({ conversationId: id })
        .sortBy("index");
      // Ensure startedAt and endedAt are Date objects if they exist
      return interactions.map((i) =>
        ensureDateFields(i, ["startedAt", "endedAt"]),
      );
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
      // Dates are already Date objects here
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

  // Mods (Ensure dates are handled)
  static async loadMods(): Promise<DbMod[]> {
    try {
      const mods = await db.mods.orderBy("loadOrder").toArray();
      // Ensure createdAt is a Date object
      // Explicitly pass empty array for otherDateFields
      return mods.map((m) => ensureDateFields(m, []));
    } catch (error) {
      console.error("PersistenceService: Error loading mods:", error);
      throw error;
    }
  }

  static async saveMod(m: DbMod): Promise<string> {
    try {
      // Dates are already Date objects here
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

  // App State (Settings) (no changes needed)
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

  // Provider Configs (Ensure dates are handled)
  static async loadProviderConfigs(): Promise<DbProviderConfig[]> {
    try {
      const configs = (await db.providerConfigs?.toArray()) ?? [];
      // Ensure date fields are Date objects
      return configs.map((c) => ensureDateFields(c, ["modelsLastFetchedAt"]));
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
      // Dates are already Date objects here
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

  // API Keys (Ensure dates are handled)
  static async loadApiKeys(): Promise<DbApiKey[]> {
    try {
      const keys = (await db.apiKeys?.toArray()) ?? [];
      // Ensure date fields are Date objects
      // Explicitly pass empty array for otherDateFields
      return keys.map((k) => ensureDateFields(k, []));
    } catch (error) {
      console.error("PersistenceService: Error loading API keys:", error);
      throw error;
    }
  }

  static async saveApiKey(k: DbApiKey): Promise<string> {
    try {
      // Dates are already Date objects here
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

  // Sync Repos (Ensure dates are handled)
  static async loadSyncRepos(): Promise<SyncRepo[]> {
    try {
      const repos = await db.syncRepos.toArray();
      // Ensure date fields are Date objects
      return repos.map((r) =>
        ensureDateFields(r, ["lastPulledAt", "lastPushedAt"]),
      );
    } catch (error) {
      console.error("PersistenceService: Error loading sync repos:", error);
      throw error;
    }
  }

  static async saveSyncRepo(repo: SyncRepo): Promise<string> {
    try {
      // Dates are already Date objects here
      return await db.syncRepos.put(repo);
    } catch (error) {
      console.error("PersistenceService: Error saving sync repo:", error);
      throw error;
    }
  }

  static async deleteSyncRepo(id: string): Promise<void> {
    try {
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

  // --- Projects ---
  static async loadProjects(): Promise<Project[]> {
    try {
      const projects = await db.projects
        .orderBy("updatedAt")
        .reverse()
        .toArray();
      // Ensure date fields are Date objects
      // Explicitly pass empty array for otherDateFields
      return projects.map((p) => ensureDateFields(p, []));
    } catch (error) {
      console.error("PersistenceService: Error loading projects:", error);
      throw error;
    }
  }

  static async saveProject(p: Project): Promise<string> {
    try {
      // Ensure the object is clean and cloneable, including the path
      // Dates are already Date objects here
      const projectToSave: Project = {
        id: p.id,
        path: p.path,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        name: p.name,
        parentId: p.parentId ?? null,
        systemPrompt: p.systemPrompt ?? null,
        modelId: p.modelId ?? null,
        temperature: p.temperature ?? null,
        metadata: p.metadata ? { ...p.metadata } : {},
      };
      return await db.projects.put(projectToSave);
    } catch (error) {
      console.error("PersistenceService: Error saving project:", error);
      throw error;
    }
  }

  static async deleteProject(id: string): Promise<void> {
    try {
      // Recursively delete child projects and unlink conversations
      const deleteRecursive = async (projectId: string) => {
        // Find and delete child projects
        const childProjects = await db.projects
          .where("parentId")
          .equals(projectId)
          .toArray();
        for (const child of childProjects) {
          await deleteRecursive(child.id);
        }

        // Find and unlink conversations associated with this project
        const convosToUnlink = await db.conversations
          .where("projectId")
          .equals(projectId)
          .toArray();
        if (convosToUnlink.length > 0) {
          const updates = convosToUnlink.map((convo) =>
            db.conversations.update(convo.id, { projectId: null }),
          );
          await Promise.all(updates);
          console.log(
            `PersistenceService: Unlinked Project ${projectId} from ${convosToUnlink.length} conversations.`,
          );
        }

        // Delete the project itself
        await db.projects.delete(projectId);
        console.log(`PersistenceService: Deleted Project ${projectId}`);
      };

      await db.transaction("rw", [db.projects, db.conversations], async () => {
        await deleteRecursive(id);
      });
    } catch (error) {
      console.error("PersistenceService: Error deleting project:", error);
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
          db.syncRepos,
          db.projects,
        ],
        async () => {
          await db.interactions.clear();
          await db.conversations.clear();
          await db.projects.clear();
          await db.mods.clear();
          await db.appState.clear();
          await db.providerConfigs.clear();
          await db.apiKeys.clear();
          await db.syncRepos.clear();
        },
      );
      console.log("PersistenceService: All data cleared.");
    } catch (error) {
      console.error("PersistenceService: Error clearing all data:", error);
      throw error;
    }
  }
}
