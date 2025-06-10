// src/services/db.worker.manager.ts
import type { 
  DbWorkerMessage, 
  DbWorkerResponse 
} from "@/workers/db.worker";
import { nanoid } from "nanoid";
import { emitter } from "@/lib/litechat/event-emitter";

export class DbWorkerManager {
  private static instance: DbWorkerManager;
  private worker: Worker | null = null;
  private pendingOperations = new Map<string, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
  }>();
  private initialized = false;
  private broadcastChannel: BroadcastChannel | null = null;

  private constructor() {
    // Set up broadcast channel for multi-tab sync
    if (typeof BroadcastChannel !== 'undefined') {
      this.broadcastChannel = new BroadcastChannel('litechat-db-sync');
      this.broadcastChannel.onmessage = (event) => {
        this.handleBroadcast(event.data);
      };
    }
  }

  static getInstance(): DbWorkerManager {
    if (!DbWorkerManager.instance) {
      DbWorkerManager.instance = new DbWorkerManager();
    }
    return DbWorkerManager.instance;
  }

  private async initializeWorker(): Promise<void> {
    if (this.initialized && this.worker) return;

    try {
      const workerUrl = new URL('../workers/db.worker.ts', import.meta.url);
      this.worker = new Worker(workerUrl, { type: 'module' });
      
      this.worker.onmessage = (event: MessageEvent<DbWorkerResponse>) => {
        this.handleWorkerMessage(event.data);
      };

      this.worker.onerror = (error) => {
        console.error('[DbWorkerManager] Worker error:', error);
      };

      this.initialized = true;
      console.log('[DbWorkerManager] Database Worker initialized');
    } catch (error) {
      console.error('[DbWorkerManager] Failed to initialize worker:', error);
      throw error;
    }
  }

  private handleWorkerMessage(response: DbWorkerResponse): void {
    const { type, id, operation, payload, error } = response;

    console.log(`[DbWorkerManager] Received response: ${operation} (${type})`, payload);

    if (type === 'broadcast') {
      // Forward broadcasts to other tabs
      if (this.broadcastChannel) {
        this.broadcastChannel.postMessage({ operation, payload });
      }
      return;
    }

    const pending = this.pendingOperations.get(id);
    if (!pending) {
      console.warn(`[DbWorkerManager] No pending operation found for ${id}`);
      return;
    }

    this.pendingOperations.delete(id);

    if (type === 'success') {
      pending.resolve(payload);
    } else {
      pending.reject(new Error(error || 'Unknown database error'));
    }
  }

  private handleBroadcast(data: { operation: string; payload: any }): void {
    const { operation, payload } = data;
    console.log(`[DbWorkerManager] Received broadcast: ${operation}`, payload);
    
    // Emit events for store updates
    switch (operation) {
      case 'conversationSaved':
        emitter.emit('db.conversation.saved', payload);
        break;
      case 'conversationDeleted':
        emitter.emit('db.conversation.deleted', payload);
        break;
      case 'interactionSaved':
        emitter.emit('db.interaction.saved', payload);
        break;
      case 'interactionDeleted':
        emitter.emit('db.interaction.deleted', payload);
        break;
      case 'settingSaved':
        emitter.emit('db.setting.saved', payload);
        break;
      case 'projectSaved':
        emitter.emit('db.project.saved', payload);
        break;
      case 'projectDeleted':
        emitter.emit('db.project.deleted', payload);
        break;
      // Add more broadcast events as needed
      default:
        emitter.emit(`db.${operation}`, payload);
    }
  }

  private async sendOperation(operation: string, payload?: any): Promise<any> {
    await this.initializeWorker();
    
    if (!this.worker) {
      throw new Error('Failed to initialize database worker');
    }

    const id = nanoid();
    const message: DbWorkerMessage = {
      type: 'mutation',
      id,
      operation,
      payload
    };

    console.log(`[DbWorkerManager] Sending operation: ${operation}`, payload);

    return new Promise((resolve, reject) => {
      this.pendingOperations.set(id, { resolve, reject });
      this.worker!.postMessage(message);
    });
  }

  // Conversation operations
  async loadConversations(): Promise<any[]> {
    return this.sendOperation('loadConversations');
  }

  async saveConversation(conversation: any): Promise<string> {
    return this.sendOperation('saveConversation', conversation);
  }

  async deleteConversation(id: string): Promise<void> {
    return this.sendOperation('deleteConversation', { id });
  }

  // Interaction operations
  async loadInteractionsForConversation(conversationId: string): Promise<any[]> {
    return this.sendOperation('loadInteractionsForConversation', { id: conversationId });
  }

  async saveInteraction(interaction: any): Promise<string> {
    return this.sendOperation('saveInteraction', interaction);
  }

  async deleteInteraction(id: string): Promise<void> {
    return this.sendOperation('deleteInteraction', { id });
  }

  async deleteInteractionsForConversation(conversationId: string): Promise<void> {
    return this.sendOperation('deleteInteractionsForConversation', { id: conversationId });
  }

  // Mod operations
  async loadMods(): Promise<any[]> {
    return this.sendOperation('loadMods');
  }

  async saveMod(mod: any): Promise<string> {
    return this.sendOperation('saveMod', mod);
  }

  async deleteMod(id: string): Promise<void> {
    return this.sendOperation('deleteMod', { id });
  }

  // Settings operations
  async saveSetting(key: string, value: any): Promise<string> {
    return this.sendOperation('saveSetting', { key, value });
  }

  async loadSetting<T>(key: string, defaultVal: T): Promise<T> {
    return this.sendOperation('loadSetting', { key, defaultVal });
  }

  // Provider operations
  async loadProviderConfigs(): Promise<any[]> {
    return this.sendOperation('loadProviderConfigs');
  }

  async saveProviderConfig(config: any): Promise<string> {
    return this.sendOperation('saveProviderConfig', config);
  }

  async deleteProviderConfig(id: string): Promise<void> {
    return this.sendOperation('deleteProviderConfig', { id });
  }

  // API Key operations
  async loadApiKeys(): Promise<any[]> {
    return this.sendOperation('loadApiKeys');
  }

  async saveApiKey(apiKey: any): Promise<string> {
    return this.sendOperation('saveApiKey', apiKey);
  }

  async deleteApiKey(id: string): Promise<void> {
    return this.sendOperation('deleteApiKey', { id });
  }

  // Sync Repos operations
  async loadSyncRepos(): Promise<any[]> {
    return this.sendOperation('loadSyncRepos');
  }

  async saveSyncRepo(repo: any): Promise<string> {
    return this.sendOperation('saveSyncRepo', repo);
  }

  async deleteSyncRepo(id: string): Promise<void> {
    return this.sendOperation('deleteSyncRepo', { id });
  }

  // Project operations
  async loadProjects(): Promise<any[]> {
    return this.sendOperation('loadProjects');
  }

  async saveProject(project: any): Promise<string> {
    return this.sendOperation('saveProject', project);
  }

  async deleteProject(id: string): Promise<void> {
    return this.sendOperation('deleteProject', { id });
  }

  // Rules operations
  async loadRules(): Promise<any[]> {
    return this.sendOperation('loadRules');
  }

  async saveRule(rule: any): Promise<string> {
    return this.sendOperation('saveRule', rule);
  }

  async deleteRule(id: string): Promise<void> {
    return this.sendOperation('deleteRule', { id });
  }

  // Tags operations
  async loadTags(): Promise<any[]> {
    return this.sendOperation('loadTags');
  }

  async saveTag(tag: any): Promise<string> {
    return this.sendOperation('saveTag', tag);
  }

  async deleteTag(id: string): Promise<void> {
    return this.sendOperation('deleteTag', { id });
  }

  // Tag Rule Links operations
  async loadTagRuleLinks(): Promise<any[]> {
    return this.sendOperation('loadTagRuleLinks');
  }

  async saveTagRuleLink(link: any): Promise<string> {
    return this.sendOperation('saveTagRuleLink', link);
  }

  async deleteTagRuleLink(id: string): Promise<void> {
    return this.sendOperation('deleteTagRuleLink', { id });
  }

  // Bulk operations
  async clearAllData(): Promise<void> {
    return this.sendOperation('clearAllData');
  }

  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.initialized = false;
      this.pendingOperations.clear();
    }
    if (this.broadcastChannel) {
      this.broadcastChannel.close();
      this.broadcastChannel = null;
    }
  }
} 