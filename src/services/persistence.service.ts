// src/services/persistence.service.ts
// FULL FILE
import { DbWorkerManager } from "./db.worker.manager";
import type { Conversation } from "@/types/litechat/chat";
import type { Interaction } from "@/types/litechat/interaction";
import type { DbMod } from "@/types/litechat/modding";
import type { DbProviderConfig, DbApiKey } from "@/types/litechat/provider";
import type { SyncRepo } from "@/types/litechat/sync";
import type { Project } from "@/types/litechat/project";
import type { DbRule, DbTag, DbTagRuleLink } from "@/types/litechat/rules";
import type { FullExportOptions } from "./import-export.service";

// Helper function removed - was unused

// Structure for full export
export interface FullExportData {
  version: number;
  exportedAt: string;
  settings?: Record<string, any>;
  apiKeys?: DbApiKey[];
  providerConfigs?: DbProviderConfig[];
  projects?: Project[];
  conversations?: Conversation[];
  interactions?: Interaction[];
  rules?: DbRule[];
  tags?: DbTag[];
  tagRuleLinks?: DbTagRuleLink[];
  mods?: DbMod[];
  syncRepos?: SyncRepo[];
}

export class PersistenceService {
  private static dbWorkerManager = DbWorkerManager.getInstance();

  // Conversations
  static async loadConversations(): Promise<Conversation[]> {
    try {
      return await this.dbWorkerManager.loadConversations();
    } catch (error) {
      console.error("PersistenceService: Error loading conversations:", error);
      throw error;
    }
  }

  static async saveConversation(c: Conversation): Promise<string> {
    try {
      return await this.dbWorkerManager.saveConversation(c);
    } catch (error) {
      console.error("PersistenceService: Error saving conversation:", error);
      throw error;
    }
  }

  static async deleteConversation(id: string): Promise<void> {
    try {
      await this.dbWorkerManager.deleteConversation(id);
    } catch (error) {
      console.error("PersistenceService: Error deleting conversation:", error);
      throw error;
    }
  }

  // Interactions
  static async loadInteractionsForConversation(
    id: string
  ): Promise<Interaction[]> {
    try {
      return await this.dbWorkerManager.loadInteractionsForConversation(id);
    } catch (error) {
      console.error(
        "PersistenceService: Error loading interactions for conversation:",
        error
      );
      throw error;
    }
  }

  static async saveInteraction(i: Interaction): Promise<string> {
    try {
      return await this.dbWorkerManager.saveInteraction(i);
    } catch (error) {
      console.error("PersistenceService: Error saving interaction:", error);
      throw error;
    }
  }

  static async deleteInteraction(id: string): Promise<void> {
    try {
      await this.dbWorkerManager.deleteInteraction(id);
    } catch (error) {
      console.error("PersistenceService: Error deleting interaction:", error);
      throw error;
    }
  }

  static async deleteInteractionsForConversation(id: string): Promise<void> {
    try {
      await this.dbWorkerManager.deleteInteractionsForConversation(id);
    } catch (error) {
      console.error(
        "PersistenceService: Error deleting interactions for conversation:",
        error
      );
      throw error;
    }
  }

  // Mods
  static async loadMods(): Promise<DbMod[]> {
    try {
      return await this.dbWorkerManager.loadMods();
    } catch (error) {
      console.error("PersistenceService: Error loading mods:", error);
      throw error;
    }
  }

  static async saveMod(m: DbMod): Promise<string> {
    try {
      return await this.dbWorkerManager.saveMod(m);
    } catch (error) {
      console.error("PersistenceService: Error saving mod:", error);
      throw error;
    }
  }

  static async deleteMod(id: string): Promise<void> {
    try {
      await this.dbWorkerManager.deleteMod(id);
    } catch (error) {
      console.error("PersistenceService: Error deleting mod:", error);
      throw error;
    }
  }

  // App State (Settings)
  static async saveSetting(key: string, value: any): Promise<string> {
    try {
      return await this.dbWorkerManager.saveSetting(key, value);
    } catch (error) {
      console.error("PersistenceService: Error saving setting:", error);
      throw error;
    }
  }

  static async loadSetting<T>(key: string, defaultVal: T): Promise<T> {
    try {
      return await this.dbWorkerManager.loadSetting(key, defaultVal);
    } catch (error) {
      console.error("PersistenceService: Error loading setting:", error);
      return defaultVal;
    }
  }

  // Provider Configs
  static async loadProviderConfigs(): Promise<DbProviderConfig[]> {
    try {
      return await this.dbWorkerManager.loadProviderConfigs();
    } catch (error) {
      console.error(
        "PersistenceService: Error loading provider configs:",
        error
      );
      throw error;
    }
  }

  static async saveProviderConfig(c: DbProviderConfig): Promise<string> {
    try {
      return await this.dbWorkerManager.saveProviderConfig(c);
    } catch (error) {
      console.error("PersistenceService: Error saving provider config:", error);
      throw error;
    }
  }

  static async deleteProviderConfig(id: string): Promise<void> {
    try {
      await this.dbWorkerManager.deleteProviderConfig(id);
    } catch (error) {
      console.error(
        "PersistenceService: Error deleting provider config:",
        error
      );
      throw error;
    }
  }

  // API Keys
  static async loadApiKeys(): Promise<DbApiKey[]> {
    try {
      return await this.dbWorkerManager.loadApiKeys();
    } catch (error) {
      console.error("PersistenceService: Error loading API keys:", error);
      throw error;
    }
  }

  static async saveApiKey(k: DbApiKey): Promise<string> {
    try {
      return await this.dbWorkerManager.saveApiKey(k);
    } catch (error) {
      console.error("PersistenceService: Error saving API key:", error);
      throw error;
    }
  }

  static async deleteApiKey(id: string): Promise<void> {
    try {
      await this.dbWorkerManager.deleteApiKey(id);
    } catch (error) {
      console.error("PersistenceService: Error deleting API key:", error);
      throw error;
    }
  }

  // Sync Repos
  static async loadSyncRepos(): Promise<SyncRepo[]> {
    try {
      return await this.dbWorkerManager.loadSyncRepos();
    } catch (error) {
      console.error("PersistenceService: Error loading sync repos:", error);
      throw error;
    }
  }

  static async saveSyncRepo(repo: SyncRepo): Promise<string> {
    try {
      return await this.dbWorkerManager.saveSyncRepo(repo);
    } catch (error) {
      console.error("PersistenceService: Error saving sync repo:", error);
      throw error;
    }
  }

  static async deleteSyncRepo(id: string): Promise<void> {
    try {
      await this.dbWorkerManager.deleteSyncRepo(id);
    } catch (error) {
      console.error("PersistenceService: Error deleting sync repo:", error);
      throw error;
    }
  }

  // Projects
  static async loadProjects(): Promise<Project[]> {
    try {
      return await this.dbWorkerManager.loadProjects();
    } catch (error) {
      console.error("PersistenceService: Error loading projects:", error);
      throw error;
    }
  }

  static async saveProject(p: Project): Promise<string> {
    try {
      return await this.dbWorkerManager.saveProject(p);
    } catch (error) {
      console.error("PersistenceService: Error saving project:", error);
      throw error;
    }
  }

  static async deleteProject(id: string): Promise<void> {
    try {
      await this.dbWorkerManager.deleteProject(id);
    } catch (error) {
      console.error("PersistenceService: Error deleting project:", error);
      throw error;
    }
  }

  // Rules
  static async loadRules(): Promise<DbRule[]> {
    try {
      return await this.dbWorkerManager.loadRules();
    } catch (error) {
      console.error("PersistenceService: Error loading rules:", error);
      throw error;
    }
  }

  static async saveRule(rule: DbRule): Promise<string> {
    try {
      return await this.dbWorkerManager.saveRule(rule);
    } catch (error) {
      console.error("PersistenceService: Error saving rule:", error);
      throw error;
    }
  }

  static async deleteRule(id: string): Promise<void> {
    try {
      await this.dbWorkerManager.deleteRule(id);
    } catch (error) {
      console.error("PersistenceService: Error deleting rule:", error);
      throw error;
    }
  }

  // Tags
  static async loadTags(): Promise<DbTag[]> {
    try {
      return await this.dbWorkerManager.loadTags();
    } catch (error) {
      console.error("PersistenceService: Error loading tags:", error);
      throw error;
    }
  }

  static async saveTag(tag: DbTag): Promise<string> {
    try {
      return await this.dbWorkerManager.saveTag(tag);
    } catch (error) {
      console.error("PersistenceService: Error saving tag:", error);
      throw error;
    }
  }

  static async deleteTag(id: string): Promise<void> {
    try {
      await this.dbWorkerManager.deleteTag(id);
    } catch (error) {
      console.error("PersistenceService: Error deleting tag:", error);
      throw error;
    }
  }

  // Tag Rule Links
  static async loadTagRuleLinks(): Promise<DbTagRuleLink[]> {
    try {
      return await this.dbWorkerManager.loadTagRuleLinks();
    } catch (error) {
      console.error("PersistenceService: Error loading tag rule links:", error);
      throw error;
    }
  }

  static async saveTagRuleLink(link: DbTagRuleLink): Promise<string> {
    try {
      return await this.dbWorkerManager.saveTagRuleLink(link);
    } catch (error) {
      console.error("PersistenceService: Error saving tag rule link:", error);
      throw error;
    }
  }

  static async deleteTagRuleLink(id: string): Promise<void> {
    try {
      await this.dbWorkerManager.deleteTagRuleLink(id);
    } catch (error) {
      console.error("PersistenceService: Error deleting tag rule link:", error);
      throw error;
    }
  }

  // Full Export/Import (simplified - needs proper implementation)
  static async getAllDataForExport(
    options: FullExportOptions
  ): Promise<FullExportData> {
    try {
      const exportData: FullExportData = {
        version: 1,
        exportedAt: new Date().toISOString(),
      };

      if (options.importConversations) {
        exportData.conversations = await this.loadConversations();
        // Load interactions for each conversation
        const allInteractions: Interaction[] = [];
        for (const conv of exportData.conversations) {
          const interactions = await this.loadInteractionsForConversation(conv.id);
          allInteractions.push(...interactions);
        }
        exportData.interactions = allInteractions;
      }

      if (options.importProjects) {
        exportData.projects = await this.loadProjects();
      }

      if (options.importProviderConfigs) {
        exportData.providerConfigs = await this.loadProviderConfigs();
      }

      if (options.importApiKeys) {
        exportData.apiKeys = await this.loadApiKeys();
      }

      if (options.importRulesAndTags) {
        exportData.rules = await this.loadRules();
        exportData.tags = await this.loadTags();
        exportData.tagRuleLinks = await this.loadTagRuleLinks();
      }

      if (options.importMods) {
        exportData.mods = await this.loadMods();
      }

      return exportData;
    } catch (error) {
      console.error("PersistenceService: Error exporting data:", error);
      throw error;
    }
  }

  static async importAllData(
    data: FullExportData,
    options: {
      importSettings?: boolean;
      importApiKeys?: boolean;
      importProviderConfigs?: boolean;
      importProjects?: boolean;
      importConversations?: boolean;
      importRulesAndTags?: boolean;
      importMods?: boolean;
      importSyncRepos?: boolean;
    }
  ): Promise<void> {
    try {
      if (options.importProjects && data.projects) {
        for (const project of data.projects) {
          await this.saveProject(project);
        }
      }

      if (options.importConversations && data.conversations) {
        for (const conversation of data.conversations) {
          await this.saveConversation(conversation);
        }
      }

      if (options.importConversations && data.interactions) {
        for (const interaction of data.interactions) {
          await this.saveInteraction(interaction);
        }
      }

      if (options.importProviderConfigs && data.providerConfigs) {
        for (const config of data.providerConfigs) {
          await this.saveProviderConfig(config);
        }
      }

      if (options.importApiKeys && data.apiKeys) {
        for (const apiKey of data.apiKeys) {
          await this.saveApiKey(apiKey);
        }
      }

      if (options.importRulesAndTags) {
        if (data.tags) {
          for (const tag of data.tags) {
            await this.saveTag(tag);
          }
        }
        if (data.rules) {
          for (const rule of data.rules) {
            await this.saveRule(rule);
          }
        }
        if (data.tagRuleLinks) {
          for (const link of data.tagRuleLinks) {
            await this.saveTagRuleLink(link);
          }
        }
      }

      if (options.importMods && data.mods) {
        for (const mod of data.mods) {
          await this.saveMod(mod);
        }
      }
    } catch (error) {
      console.error("PersistenceService: Error importing data:", error);
      throw error;
    }
  }

  static async clearAllData(): Promise<void> {
    try {
      await this.dbWorkerManager.clearAllData();
    } catch (error) {
      console.error("PersistenceService: Error clearing all data:", error);
      throw error;
    }
  }

  // Terminate worker (for cleanup)
  static terminate(): void {
    this.dbWorkerManager.terminate();
  }
}
