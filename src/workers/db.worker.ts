import Dexie from "dexie";
import type { Conversation } from "@/types/litechat/chat";
import type { Interaction } from "@/types/litechat/interaction";
import type { DbMod } from "@/types/litechat/modding";
import type { DbProviderConfig, DbApiKey } from "@/types/litechat/provider";
import type { SyncRepo } from "@/types/litechat/sync";
import type { Project } from "@/types/litechat/project";
import type { DbRule, DbTag, DbTagRuleLink } from "@/types/litechat/rules";

export interface DbWorkerMessage {
  type: 'query' | 'mutation' | 'transaction' | 'broadcast';
  id: string;
  operation: string;
  payload?: any;
}

export interface DbWorkerResponse {
  type: 'success' | 'error' | 'broadcast';
  id: string;
  operation: string;
  payload?: any;
  error?: string;
}

// Database schema matching the main thread database
interface DbAppState {
  key: string;
  value: any;
}

class LiteChatDB extends Dexie {
  conversations!: Dexie.Table<Conversation, string>;
  interactions!: Dexie.Table<Interaction, string>;
  mods!: Dexie.Table<DbMod, string>;
  appState!: Dexie.Table<DbAppState, string>;
  providerConfigs!: Dexie.Table<DbProviderConfig, string>;
  apiKeys!: Dexie.Table<DbApiKey, string>;
  syncRepos!: Dexie.Table<SyncRepo, string>;
  projects!: Dexie.Table<Project, string>;
  rules!: Dexie.Table<DbRule, string>;
  tags!: Dexie.Table<DbTag, string>;
  tagRuleLinks!: Dexie.Table<DbTagRuleLink, string>;

  constructor() {
    super("LiteChatDatabase_Rewrite_v1");
    // Match the exact same schema as the main database
    this.version(8).stores({
      conversations:
        "++id, title, createdAt, updatedAt, syncRepoId, lastSyncedAt, projectId",
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
    // Define all previous versions for upgrade path
    this.version(7).stores({
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
  }
  return newItem;
};

class DbWorkerService {
  private db: LiteChatDB;
  
  constructor() {
    this.db = new LiteChatDB();
  }

  async handleOperation(message: DbWorkerMessage): Promise<DbWorkerResponse> {
    const { id, operation, payload } = message;

    console.log(`[DbWorker] Handling operation: ${operation}`, payload);

    try {
      let result: any;

      switch (operation) {
        // Conversations
        case 'loadConversations':
          result = await this.db.conversations
            .orderBy("updatedAt")
            .reverse()
            .toArray();
          result = result.map((c: Conversation) => ensureDateFields(c, ["lastSyncedAt"]));
          break;

        case 'saveConversation':
          const conversationToSave: Conversation = {
            ...payload,
            syncRepoId: payload.syncRepoId ?? null,
            lastSyncedAt: payload.lastSyncedAt ?? null,
            projectId: payload.projectId ?? null,
          };
          result = await this.db.conversations.put(conversationToSave);
          this.broadcast('conversationSaved', { id: result, conversation: conversationToSave });
          break;

        case 'deleteConversation':
          await this.db.conversations.delete(payload.id);
          result = { success: true };
          this.broadcast('conversationDeleted', { id: payload.id });
          break;

        // Interactions
        case 'loadInteractionsForConversation':
          result = await this.db.interactions
            .where({ conversationId: payload.id })
            .sortBy("index");
          result = result.map((i: Interaction) =>
            ensureDateFields(i, ["startedAt", "endedAt"])
          );
          break;

        case 'saveInteraction':
          result = await this.db.interactions.put(payload);
          this.broadcast('interactionSaved', { id: result, interaction: payload });
          break;

        case 'deleteInteraction':
          await this.db.interactions.delete(payload.id);
          result = { success: true };
          this.broadcast('interactionDeleted', { id: payload.id });
          break;

        case 'deleteInteractionsForConversation':
          await this.db.interactions.where({ conversationId: payload.id }).delete();
          result = { success: true };
          this.broadcast('interactionsDeletedForConversation', { conversationId: payload.id });
          break;

        // Mods
        case 'loadMods':
          result = await this.db.mods.orderBy("loadOrder").toArray();
          result = result.map((m: DbMod) => ensureDateFields(m, []));
          break;

        case 'saveMod':
          result = await this.db.mods.put(payload);
          this.broadcast('modSaved', { id: result, mod: payload });
          break;

        case 'deleteMod':
          await this.db.mods.delete(payload.id);
          result = { success: true };
          this.broadcast('modDeleted', { id: payload.id });
          break;

        // App State (Settings)
        case 'saveSetting':
          result = await this.db.appState.put({ key: `settings:${payload.key}`, value: payload.value });
          this.broadcast('settingSaved', { key: payload.key, value: payload.value });
          break;

        case 'loadSetting':
          const setting = await this.db.appState.get(`settings:${payload.key}`);
          result = setting?.value !== undefined ? setting.value : payload.defaultVal;
          break;

        // Provider Configs
        case 'loadProviderConfigs':
          result = (await this.db.providerConfigs?.toArray()) ?? [];
          result = result.map((c: DbProviderConfig) => ensureDateFields(c, ["modelsLastFetchedAt"]));
          break;

        case 'saveProviderConfig':
          result = await this.db.providerConfigs.put(payload);
          this.broadcast('providerConfigSaved', { id: result, config: payload });
          break;

        case 'deleteProviderConfig':
          await this.db.providerConfigs.delete(payload.id);
          result = { success: true };
          this.broadcast('providerConfigDeleted', { id: payload.id });
          break;

        // API Keys
        case 'loadApiKeys':
          result = (await this.db.apiKeys?.toArray()) ?? [];
          result = result.map((k: DbApiKey) => ensureDateFields(k, []));
          break;

        case 'saveApiKey':
          result = await this.db.apiKeys.put(payload);
          this.broadcast('apiKeySaved', { id: result, apiKey: payload });
          break;

        case 'deleteApiKey':
          await this.db.apiKeys.delete(payload.id);
          result = { success: true };
          this.broadcast('apiKeyDeleted', { id: payload.id });
          break;

        // Sync Repos
        case 'loadSyncRepos':
          result = await this.db.syncRepos.toArray();
          result = result.map((r: SyncRepo) => ensureDateFields(r, ["lastPulledAt", "lastPushedAt"]));
          break;

        case 'saveSyncRepo':
          result = await this.db.syncRepos.put(payload);
          this.broadcast('syncRepoSaved', { id: result, repo: payload });
          break;

        case 'deleteSyncRepo':
          // Unlink conversations first
          const convosToUpdate = await this.db.conversations.where({ syncRepoId: payload.id }).toArray();
          for (const conv of convosToUpdate) {
            await this.db.conversations.update(conv.id, { syncRepoId: null });
          }
          await this.db.syncRepos.delete(payload.id);
          result = { success: true };
          this.broadcast('syncRepoDeleted', { id: payload.id });
          break;

        // Projects
        case 'loadProjects':
          result = await this.db.projects.orderBy("name").toArray();
          result = result.map((p: Project) => ensureDateFields(p, []));
          break;

        case 'saveProject':
          result = await this.db.projects.put(payload);
          this.broadcast('projectSaved', { id: result, project: payload });
          break;

        case 'deleteProject':
          // Recursive project deletion
          const deleteRecursive = async (projectId: string) => {
            const childProjects = await this.db.projects.where({ parentId: projectId }).toArray();
            for (const child of childProjects) {
              await deleteRecursive(child.id);
            }
            const conversations = await this.db.conversations.where({ projectId }).toArray();
            for (const conv of conversations) {
              await this.db.interactions.where({ conversationId: conv.id }).delete();
              await this.db.conversations.delete(conv.id);
            }
            await this.db.projects.delete(projectId);
          };
          await deleteRecursive(payload.id);
          result = { success: true };
          this.broadcast('projectDeleted', { id: payload.id });
          break;

        // Rules
        case 'loadRules':
          result = await this.db.rules.toArray();
          result = result.map((r: DbRule) => ensureDateFields(r, []));
          break;

        case 'saveRule':
          result = await this.db.rules.put(payload);
          this.broadcast('ruleSaved', { id: result, rule: payload });
          break;

        case 'deleteRule':
          await this.db.tagRuleLinks.where({ ruleId: payload.id }).delete();
          await this.db.rules.delete(payload.id);
          result = { success: true };
          this.broadcast('ruleDeleted', { id: payload.id });
          break;

        // Tags
        case 'loadTags':
          result = await this.db.tags.orderBy("name").toArray();
          result = result.map((t: DbTag) => ensureDateFields(t, []));
          break;

        case 'saveTag':
          result = await this.db.tags.put(payload);
          this.broadcast('tagSaved', { id: result, tag: payload });
          break;

        case 'deleteTag':
          await this.db.tagRuleLinks.where({ tagId: payload.id }).delete();
          await this.db.tags.delete(payload.id);
          result = { success: true };
          this.broadcast('tagDeleted', { id: payload.id });
          break;

        // Tag Rule Links
        case 'loadTagRuleLinks':
          result = await this.db.tagRuleLinks.toArray();
          result = result.map((l: DbTagRuleLink) => ensureDateFields(l, []));
          break;

        case 'saveTagRuleLink':
          result = await this.db.tagRuleLinks.put(payload);
          this.broadcast('tagRuleLinkSaved', { id: result, link: payload });
          break;

        case 'deleteTagRuleLink':
          await this.db.tagRuleLinks.delete(payload.id);
          result = { success: true };
          this.broadcast('tagRuleLinkDeleted', { id: payload.id });
          break;

        // Bulk operations
        case 'clearAllData':
          await this.db.transaction('rw', [
            this.db.conversations,
            this.db.interactions,
            this.db.mods,
            this.db.appState,
            this.db.providerConfigs,
            this.db.apiKeys,
            this.db.syncRepos,
            this.db.projects,
            this.db.rules,
            this.db.tags,
            this.db.tagRuleLinks
          ], async () => {
            await this.db.conversations.clear();
            await this.db.interactions.clear();
            await this.db.mods.clear();
            await this.db.appState.clear();
            await this.db.providerConfigs.clear();
            await this.db.apiKeys.clear();
            await this.db.syncRepos.clear();
            await this.db.projects.clear();
            await this.db.rules.clear();
            await this.db.tags.clear();
            await this.db.tagRuleLinks.clear();
          });
          result = { success: true };
          this.broadcast('allDataCleared', {});
          break;

        default:
          throw new Error(`Unknown operation: ${operation}`);
      }

      return {
        type: 'success',
        id,
        operation,
        payload: result
      };

    } catch (error) {
      console.error(`[DbWorker] Error in operation ${operation}:`, error);
      return {
        type: 'error',
        id,
        operation,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private broadcast(event: string, data: any): void {
    // Broadcast to all tabs/windows
    self.postMessage({
      type: 'broadcast',
      id: 'broadcast',
      operation: event,
      payload: data
    });
  }
}

const dbWorkerService = new DbWorkerService();

self.onmessage = async (event: MessageEvent<DbWorkerMessage>) => {
  const response = await dbWorkerService.handleOperation(event.data);
  self.postMessage(response);
}; 