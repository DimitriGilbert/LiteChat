import { useConversationStore } from "@/store/conversation.store";
import { toast } from "sonner";
import type { Conversation } from "@/types/litechat/chat";
import type { SyncRepo } from "@/types/litechat/sync";
import { emitter } from "@/lib/litechat/event-emitter";
import { syncEvent } from "@/types/litechat/events/sync.events";

export interface BulkSyncProgress {
  totalRepos: number;
  completedRepos: number;
  totalConversations: number;
  completedConversations: number;
  currentOperation: string;
  errors: Array<{ type: 'repo' | 'conversation'; id: string; error: string }>;
}

export interface BulkSyncOptions {
  syncRepos: boolean;
  syncConversations: boolean;
  continueOnError: boolean;
  maxConcurrent: number;
}

export class BulkSyncService {
  private static isRunning = false;
  private static abortController: AbortController | null = null;

  /**
   * Sync all repositories and their linked conversations
   */
  static async syncAll(options: Partial<BulkSyncOptions> = {}): Promise<void> {
    const opts: BulkSyncOptions = {
      syncRepos: true,
      syncConversations: true,
      continueOnError: true,
      maxConcurrent: 3,
      ...options
    };

    if (this.isRunning) {
      toast.warning("Bulk sync already in progress");
      return;
    }

    this.isRunning = true;
    this.abortController = new AbortController();
    
    const conversationStore = useConversationStore.getState();
    const repos = conversationStore.syncRepos;
    const conversations = conversationStore.conversations.filter(c => c.syncRepoId);

    const progress: BulkSyncProgress = {
      totalRepos: opts.syncRepos ? repos.length : 0,
      completedRepos: 0,
      totalConversations: opts.syncConversations ? conversations.length : 0,
      completedConversations: 0,
      currentOperation: "Starting bulk sync...",
      errors: []
    };

    try {
      emitter.emit(syncEvent.bulkSyncStarted, { progress });
      toast.info(`Starting bulk sync: ${repos.length} repositories, ${conversations.length} conversations`);

      // Phase 1: Initialize/sync all repositories
      if (opts.syncRepos && repos.length > 0) {
        await this.syncRepositoriesInBatches(repos, opts, progress);
      }

      // Phase 2: Sync all conversations
      if (opts.syncConversations && conversations.length > 0) {
        await this.syncConversationsInBatches(conversations, opts, progress);
      }

      const hasErrors = progress.errors.length > 0;
      emitter.emit(syncEvent.bulkSyncCompleted, { progress, success: !hasErrors });
      
      if (hasErrors) {
        toast.warning(`Bulk sync completed with ${progress.errors.length} errors. Check console for details.`);
        console.warn("Bulk sync errors:", progress.errors);
      } else {
        toast.success("Bulk sync completed successfully!");
      }

    } catch (error) {
      console.error("Bulk sync failed:", error);
      toast.error(`Bulk sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      emitter.emit(syncEvent.bulkSyncFailed, { progress, error: String(error) });
    } finally {
      this.isRunning = false;
      this.abortController = null;
    }
  }

  /**
   * Sync all conversations that need syncing
   */
  static async syncPendingConversations(): Promise<void> {
    const conversationStore = useConversationStore.getState();
    const pendingConversations = conversationStore.conversations.filter(c => {
      const status = conversationStore.conversationSyncStatus[c.id];
      return c.syncRepoId && status === 'needs-sync';
    });

    if (pendingConversations.length === 0) {
      toast.info("No conversations need syncing");
      return;
    }

    toast.info(`Syncing ${pendingConversations.length} pending conversations...`);
    await this.syncAll({
      syncRepos: false,
      syncConversations: true,
      continueOnError: true,
      maxConcurrent: 2
    });
  }

  /**
   * Initialize all repositories that haven't been cloned yet
   */
  static async initializeAllRepositories(): Promise<void> {
    const conversationStore = useConversationStore.getState();
    const repos = conversationStore.syncRepos;
    
    if (repos.length === 0) {
      toast.info("No repositories configured");
      return;
    }

    toast.info(`Initializing ${repos.length} repositories...`);
    await this.syncAll({
      syncRepos: true,
      syncConversations: false,
      continueOnError: true,
      maxConcurrent: 2
    });
  }

  /**
   * Stop any running bulk sync operation
   */
  static abort(): void {
    if (this.isRunning && this.abortController) {
      this.abortController.abort();
      toast.info("Bulk sync operation cancelled");
    }
  }

  /**
   * Check if bulk sync is currently running
   */
  static isActive(): boolean {
    return this.isRunning;
  }

  private static async syncRepositoriesInBatches(
    repos: SyncRepo[],
    options: BulkSyncOptions,
    progress: BulkSyncProgress
  ): Promise<void> {
    progress.currentOperation = "Initializing repositories...";
    emitter.emit(syncEvent.bulkSyncProgress, { progress });

    const batches = this.createBatches(repos, options.maxConcurrent);
    
    for (const batch of batches) {
      if (this.abortController?.signal.aborted) {
        throw new Error("Operation cancelled");
      }

      const promises = batch.map(async (repo) => {
        try {
          progress.currentOperation = `Syncing repository: ${repo.name}`;
          emitter.emit(syncEvent.bulkSyncProgress, { progress });
          
          await useConversationStore.getState().initializeOrSyncRepo(repo.id, true);
          progress.completedRepos++;
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          progress.errors.push({ type: 'repo', id: repo.id, error: errorMsg });
          console.error(`Failed to sync repository ${repo.name}:`, error);
          
          if (!options.continueOnError) {
            throw error;
          }
        }
      });

      await Promise.all(promises);
      emitter.emit(syncEvent.bulkSyncProgress, { progress });
    }
  }

  private static async syncConversationsInBatches(
    conversations: Conversation[],
    options: BulkSyncOptions,
    progress: BulkSyncProgress
  ): Promise<void> {
    progress.currentOperation = "Syncing conversations...";
    emitter.emit(syncEvent.bulkSyncProgress, { progress });

    const batches = this.createBatches(conversations, options.maxConcurrent);
    
    for (const batch of batches) {
      if (this.abortController?.signal.aborted) {
        throw new Error("Operation cancelled");
      }

      const promises = batch.map(async (conversation) => {
        try {
          progress.currentOperation = `Syncing conversation: ${conversation.title}`;
          emitter.emit(syncEvent.bulkSyncProgress, { progress });
          
          await useConversationStore.getState().syncConversation(conversation.id, true);
          progress.completedConversations++;
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          progress.errors.push({ type: 'conversation', id: conversation.id, error: errorMsg });
          console.error(`Failed to sync conversation ${conversation.title}:`, error);
          
          if (!options.continueOnError) {
            throw error;
          }
        }
      });

      await Promise.all(promises);
      emitter.emit(syncEvent.bulkSyncProgress, { progress });
    }
  }

  private static createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }
} 