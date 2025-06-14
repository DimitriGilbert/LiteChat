// src/services/persistence.service.ts
// FULL FILE
import { db } from "@/lib/litechat/db";
import type { Conversation } from "@/types/litechat/chat";
import type { Interaction } from "@/types/litechat/interaction";
import type { DbMod } from "@/types/litechat/modding";
import type { DbProviderConfig, DbApiKey } from "@/types/litechat/provider";
import type { SyncRepo } from "@/types/litechat/sync";
import type { Project } from "@/types/litechat/project";
import type { DbRule, DbTag, DbTagRuleLink } from "@/types/litechat/rules";
import type { DbPromptTemplate, PromptTemplate } from "@/types/litechat/prompt-template";
import type { DbAppState } from "@/lib/litechat/db";
import type { FullExportOptions } from "./import-export.service";

// Helper function to ensure date fields are Date objects
const ensureDateFields = <
  T extends { createdAt?: any; updatedAt?: any; [key: string]: any }
>(
  item: T,
  otherDateFields: string[] = []
): T => {
  const newItem = { ...item };
  if (item.createdAt && !(item.createdAt instanceof Date)) {
    newItem.createdAt = new Date(item.createdAt);
  }
  if (item.updatedAt && !(item.updatedAt instanceof Date)) {
    newItem.updatedAt = new Date(item.updatedAt);
  }
  if (Array.isArray(otherDateFields)) {
    otherDateFields.forEach((field) => {
      if (item[field] && !(item[field] instanceof Date)) {
        (newItem as any)[field] = new Date(item[field]);
      }
    });
  } else {
    console.warn(
      "[ensureDateFields] Expected otherDateFields to be an array, but received:",
      otherDateFields
    );
  }
  return newItem;
};

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
  mcpServers?: any[]; // MCP server configurations
  promptTemplates?: any[]; // All prompt templates
  agents?: any[]; // Agents with their tasks
}

export class PersistenceService {
  // Conversations
  static async loadConversations(): Promise<Conversation[]> {
    try {
      const conversations = await db.conversations
        .orderBy("updatedAt")
        .reverse()
        .toArray();
      return conversations.map((c) => ensureDateFields(c, ["lastSyncedAt"]));
    } catch (error) {
      console.error("PersistenceService: Error loading conversations:", error);
      throw error;
    }
  }

  static async saveConversation(c: Conversation): Promise<string> {
    try {
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

  // Interactions
  static async loadInteractionsForConversation(
    id: string
  ): Promise<Interaction[]> {
    try {
      const interactions = await db.interactions
        .where({ conversationId: id })
        .sortBy("index");
      return interactions.map((i) =>
        ensureDateFields(i, ["startedAt", "endedAt"])
      );
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
        error
      );
      throw error;
    }
  }

  // Mods
  static async loadMods(): Promise<DbMod[]> {
    try {
      const mods = await db.mods.orderBy("loadOrder").toArray();
      return mods.map((m) => ensureDateFields(m, []));
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
      const configs = (await db.providerConfigs?.toArray()) ?? [];
      return configs.map((c) => ensureDateFields(c, ["modelsLastFetchedAt"]));
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
        error
      );
      throw error;
    }
  }

  // API Keys
  static async loadApiKeys(): Promise<DbApiKey[]> {
    try {
      const keys = (await db.apiKeys?.toArray()) ?? [];
      return keys.map((k) => ensureDateFields(k, []));
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
            db.providerConfigs.update(config.id, { apiKeyId: null })
          );
          await Promise.all(updates);
          console.log(
            `PersistenceService: Unlinked API key ${id} from ${configsToUpdate.length} provider configs.`
          );
        }
        await db.apiKeys.delete(id);
      });
    } catch (error) {
      console.error("PersistenceService: Error deleting API key:", error);
      throw error;
    }
  }

  // Sync Repos
  static async loadSyncRepos(): Promise<SyncRepo[]> {
    try {
      const repos = await db.syncRepos.toArray();
      return repos.map((r) =>
        ensureDateFields(r, ["lastPulledAt", "lastPushedAt"])
      );
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
      await db.transaction("rw", [db.syncRepos, db.conversations], async () => {
        const convosToUpdate = await db.conversations
          .where("syncRepoId")
          .equals(id)
          .toArray();
        if (convosToUpdate.length > 0) {
          const updates = convosToUpdate.map((convo) =>
            db.conversations.update(convo.id, { syncRepoId: null })
          );
          await Promise.all(updates);
          console.log(
            `PersistenceService: Unlinked SyncRepo ${id} from ${convosToUpdate.length} conversations.`
          );
        }
        await db.syncRepos.delete(id);
      });
    } catch (error) {
      console.error("PersistenceService: Error deleting sync repo:", error);
      throw error;
    }
  }

  // Projects
  static async loadProjects(): Promise<Project[]> {
    try {
      const projects = await db.projects
        .orderBy("updatedAt")
        .reverse()
        .toArray();
      return projects.map((p) => ensureDateFields(p, []));
    } catch (error) {
      console.error("PersistenceService: Error loading projects:", error);
      throw error;
    }
  }

  static async saveProject(p: Project): Promise<string> {
    try {
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
        maxTokens: p.maxTokens ?? null,
        topP: p.topP ?? null,
        topK: p.topK ?? null,
        presencePenalty: p.presencePenalty ?? null,
        frequencyPenalty: p.frequencyPenalty ?? null,
        defaultTagIds: p.defaultTagIds ?? null,
        defaultRuleIds: p.defaultRuleIds ?? null,
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
      const deleteRecursive = async (projectId: string) => {
        const childProjects = await db.projects
          .where("parentId")
          .equals(projectId)
          .toArray();
        for (const child of childProjects) {
          await deleteRecursive(child.id);
        }
        // Conversations are unlinked by ProjectStore via an event,
        // or ConversationStore listening to project.deleted
        await db.projects.delete(projectId);
        console.log(`PersistenceService: Deleted Project ${projectId}`);
      };
      await db.transaction("rw", [db.projects], async () => {
        await deleteRecursive(id);
      });
    } catch (error) {
      console.error("PersistenceService: Error deleting project:", error);
      throw error;
    }
  }

  // Rules
  static async loadRules(): Promise<DbRule[]> {
    try {
      const rules = await db.rules.orderBy("name").toArray();
      return rules.map((r) => ensureDateFields(r));
    } catch (error) {
      console.error("PersistenceService: Error loading rules:", error);
      throw error;
    }
  }

  static async saveRule(rule: DbRule): Promise<string> {
    try {
      return await db.rules.put(rule);
    } catch (error) {
      console.error("PersistenceService: Error saving rule:", error);
      throw error;
    }
  }

  static async deleteRule(id: string): Promise<void> {
    try {
      await db.transaction("rw", [db.rules, db.tagRuleLinks], async () => {
        await db.tagRuleLinks.where("ruleId").equals(id).delete();
        await db.rules.delete(id);
      });
    } catch (error) {
      console.error("PersistenceService: Error deleting rule:", error);
      throw error;
    }
  }

  // Tags
  static async loadTags(): Promise<DbTag[]> {
    try {
      const tags = await db.tags.orderBy("name").toArray();
      return tags.map((t) => ensureDateFields(t));
    } catch (error) {
      console.error("PersistenceService: Error loading tags:", error);
      throw error;
    }
  }

  static async saveTag(tag: DbTag): Promise<string> {
    try {
      return await db.tags.put(tag);
    } catch (error) {
      console.error("PersistenceService: Error saving tag:", error);
      throw error;
    }
  }

  static async deleteTag(id: string): Promise<void> {
    try {
      await db.transaction("rw", [db.tags, db.tagRuleLinks], async () => {
        await db.tagRuleLinks.where("tagId").equals(id).delete();
        await db.tags.delete(id);
      });
    } catch (error) {
      console.error("PersistenceService: Error deleting tag:", error);
      throw error;
    }
  }

  // TagRuleLinks
  static async loadTagRuleLinks(): Promise<DbTagRuleLink[]> {
    try {
      return await db.tagRuleLinks.toArray();
    } catch (error) {
      console.error("PersistenceService: Error loading tag-rule links:", error);
      throw error;
    }
  }

  static async saveTagRuleLink(link: DbTagRuleLink): Promise<string> {
    try {
      return await db.tagRuleLinks.put(link);
    } catch (error) {
      console.error("PersistenceService: Error saving tag-rule link:", error);
      throw error;
    }
  }

  static async deleteTagRuleLink(id: string): Promise<void> {
    try {
      await db.tagRuleLinks.delete(id);
    } catch (error) {
      console.error("PersistenceService: Error deleting tag-rule link:", error);
      throw error;
    }
  }

  // --- Full Export/Import ---
  static async getAllDataForExport(
    options: FullExportOptions
  ): Promise<FullExportData> {
    const exportData: FullExportData = {
      version: 1,
      exportedAt: new Date().toISOString(),
    };

    // Conditionally fetch data based on options
    if (options.importSettings) {
      const appState = await db.appState.toArray();
      exportData.settings = {};
      appState.forEach((item) => {
        if (item.key.startsWith("settings:")) {
          exportData.settings![item.key.substring(9)] = item.value;
        }
      });
    }
    if (options.importApiKeys) {
      exportData.apiKeys = await db.apiKeys.toArray();
    }
    if (options.importProviderConfigs) {
      exportData.providerConfigs = await db.providerConfigs.toArray();
    }
    if (options.importProjects) {
      exportData.projects = await db.projects.toArray();
    }
    if (options.importConversations) {
      exportData.conversations = await db.conversations.toArray();
      exportData.interactions = await db.interactions.toArray();
    }
    if (options.importRulesAndTags) {
      exportData.rules = await db.rules.toArray();
      exportData.tags = await db.tags.toArray();
      exportData.tagRuleLinks = await db.tagRuleLinks.toArray();
    }
    if (options.importMods) {
      exportData.mods = await db.mods.toArray();
    }
    if (options.importSyncRepos) {
      exportData.syncRepos = await db.syncRepos.toArray();
    }
    if (options.importMcpServers) {
      // MCP servers are stored as settings
      const appState = await db.appState.toArray();
      const mcpServersItem = appState.find(item => item.key === "settings:mcpServers");
      exportData.mcpServers = mcpServersItem ? mcpServersItem.value : [];
    }
    if (options.importPromptTemplates) {
      // Export all prompt templates (including regular prompts, tasks, and agents)
      exportData.promptTemplates = await db.promptTemplates.toArray();
    }
    if (options.importAgents) {
      // Export agents and their associated tasks
      const allTemplates = await db.promptTemplates.toArray();
      const agents = allTemplates.filter(t => (t as any).type === "agent");
      const agentIds = agents.map(a => a.id);
      const tasks = allTemplates.filter(t => (t as any).type === "task" && agentIds.includes((t as any).parentId));
      exportData.agents = [...agents, ...tasks];
    }

    return exportData;
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
      importMcpServers?: boolean;
      importPromptTemplates?: boolean;
      importAgents?: boolean;
    }
  ): Promise<void> {
    if (data.version !== 1) {
      throw new Error(
        `Unsupported export version: ${data.version}. Expected version 1.`
      );
    }

    await db.transaction(
      "rw",
      [
        db.appState,
        db.apiKeys,
        db.providerConfigs,
        db.projects,
        db.conversations,
        db.interactions,
        db.rules,
        db.tags,
        db.tagRuleLinks,
        db.mods,
        db.syncRepos,
        db.promptTemplates,
      ],
      async () => {
        if (options.importSettings) await db.appState.clear();
        if (options.importApiKeys) await db.apiKeys.clear();
        if (options.importProviderConfigs) await db.providerConfigs.clear();
        if (options.importProjects) await db.projects.clear();
        if (options.importConversations) {
          await db.conversations.clear();
          await db.interactions.clear();
        }
        if (options.importRulesAndTags) {
          await db.rules.clear();
          await db.tags.clear();
          await db.tagRuleLinks.clear();
        }
        if (options.importMods) await db.mods.clear();
        if (options.importSyncRepos) await db.syncRepos.clear();
        if (options.importMcpServers) {
          // Clear MCP servers setting
          await db.appState.where("key").equals("settings:mcpServers").delete();
        }
        if (options.importPromptTemplates && options.importAgents) {
          // Clear all prompt templates when both are selected (agents will be included in promptTemplates)
          await db.promptTemplates.clear();
        } else if (options.importPromptTemplates) {
          // Clear only regular prompt templates (type is "prompt" or undefined), keep agents and tasks
          await db.promptTemplates.where("type").noneOf(["agent", "task"]).delete();
        } else if (options.importAgents) {
          // Clear agents and tasks only if not importing prompt templates
          await db.promptTemplates.where("type").anyOf(["agent", "task"]).delete();
        }

        if (options.importSettings && data.settings) {
          const settingsToPut: DbAppState[] = Object.entries(data.settings).map(
            ([key, value]) => ({ key: `settings:${key}`, value })
          );
          await db.appState.bulkPut(settingsToPut);
        }
        if (options.importApiKeys && data.apiKeys) {
          await db.apiKeys.bulkPut(
            data.apiKeys.map((k) => ensureDateFields(k))
          );
        }
        if (options.importProviderConfigs && data.providerConfigs) {
          await db.providerConfigs.bulkPut(
            data.providerConfigs.map((c) =>
              ensureDateFields(c, ["modelsLastFetchedAt"])
            )
          );
        }
        if (options.importProjects && data.projects) {
          await db.projects.bulkPut(
            data.projects.map((p) => ensureDateFields(p))
          );
        }
        if (options.importConversations && data.conversations) {
          await db.conversations.bulkPut(
            data.conversations.map((c) => ensureDateFields(c, ["lastSyncedAt"]))
          );
          if (data.interactions) {
            await db.interactions.bulkPut(
              data.interactions.map((i) =>
                ensureDateFields(i, ["startedAt", "endedAt"])
              )
            );
          }
        }
        if (options.importRulesAndTags) {
          if (data.rules) {
            await db.rules.bulkPut(data.rules.map((r) => ensureDateFields(r)));
          }
          if (data.tags) {
            await db.tags.bulkPut(data.tags.map((t) => ensureDateFields(t)));
          }
          if (data.tagRuleLinks) {
            await db.tagRuleLinks.bulkPut(data.tagRuleLinks);
          }
        }
        if (options.importMods && data.mods) {
          await db.mods.bulkPut(data.mods.map((m) => ensureDateFields(m)));
        }
        if (options.importSyncRepos && data.syncRepos) {
          await db.syncRepos.bulkPut(
            data.syncRepos.map((r) =>
              ensureDateFields(r, ["lastPulledAt", "lastPushedAt"])
            )
          );
        }
        if (options.importMcpServers && data.mcpServers) {
          // Import MCP servers as a setting
          await db.appState.put({
            key: "settings:mcpServers",
            value: data.mcpServers
          });
        }
        if (options.importPromptTemplates && data.promptTemplates) {
          await db.promptTemplates.bulkPut(
            data.promptTemplates.map((t) => ensureDateFields(t, ["createdAt", "updatedAt"]))
          );
        }
        if (options.importAgents && data.agents && !options.importPromptTemplates) {
          // Import agents and tasks only if not already imported via promptTemplates
          await db.promptTemplates.bulkPut(
            data.agents.map((a) => ensureDateFields(a, ["createdAt", "updatedAt"]))
          );
        }
      }
    );
  }
  // --- End Full Config Export/Import ---

  // Prompt Templates
  static async loadPromptTemplates(): Promise<PromptTemplate[]> {
    try {
      const templates = await db.promptTemplates.orderBy("name").toArray();
      return templates.map((t) => ensureDateFields(t, ["createdAt", "updatedAt"])) as PromptTemplate[];
    } catch (error) {
      console.error("PersistenceService: Error loading prompt templates:", error);
      throw error;
    }
  }

  static async savePromptTemplate(template: PromptTemplate): Promise<string> {
    try {
      return await db.promptTemplates.put(template as DbPromptTemplate);
    } catch (error) {
      console.error("PersistenceService: Error saving prompt template:", error);
      throw error;
    }
  }

  static async deletePromptTemplate(id: string): Promise<void> {
    try {
      await db.promptTemplates.delete(id);
    } catch (error) {
      console.error("PersistenceService: Error deleting prompt template:", error);
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
          db.rules,
          db.tags,
          db.tagRuleLinks,
          db.promptTemplates,
        ],
        async () => {
          await db.conversations.clear();
          await db.interactions.clear();
          await db.mods.clear();
          await db.appState.clear();
          await db.providerConfigs.clear();
          await db.apiKeys.clear();
          await db.syncRepos.clear();
          await db.projects.clear();
          await db.rules.clear();
          await db.tags.clear();
          await db.tagRuleLinks.clear();
          await db.promptTemplates.clear();
        }
      );
    } catch (error) {
      console.error("PersistenceService: Error clearing all data:", error);
      throw error;
    }
  }
}
