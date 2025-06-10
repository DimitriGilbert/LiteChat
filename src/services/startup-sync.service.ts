import { useConversationStore } from "@/store/conversation.store";
import { useSettingsStore } from "@/store/settings.store";
import { BulkSyncService } from "@/services/bulk-sync.service";

export class StartupSyncService {
  private static hasRunStartupSync = false;

  /**
   * Run startup sync operations
   * This should be called once during app initialization
   */
  static async runStartupSync(): Promise<void> {
    if (this.hasRunStartupSync) {
      return;
    }

    this.hasRunStartupSync = true;

    try {
      const conversationStore = useConversationStore.getState();
      const settingsStore = useSettingsStore.getState();

      // Wait a bit for stores to be fully loaded
      await new Promise(resolve => setTimeout(resolve, 1000));

      const repos = conversationStore.syncRepos;
      const conversations = conversationStore.conversations.filter(c => c.syncRepoId);

      if (repos.length === 0) {
        console.log("[StartupSync] No repositories configured, skipping startup sync");
        return;
      }

      console.log(`[StartupSync] Found ${repos.length} repositories and ${conversations.length} synced conversations`);

      // Check if any repositories need initialization
      const uninitializedRepos = repos.filter(repo => {
        const status = conversationStore.repoInitializationStatus[repo.id];
        return !status || status === 'error';
      });

      if (uninitializedRepos.length > 0 && settingsStore.autoInitializeReposOnStartup) {
        console.log(`[StartupSync] Initializing ${uninitializedRepos.length} repositories in background`);
        
        // Initialize repositories in background without blocking UI
        setTimeout(async () => {
          try {
            await BulkSyncService.syncAll({
              syncRepos: true,
              syncConversations: false,
              continueOnError: true,
              maxConcurrent: 1 // Be gentle on startup
            });
          } catch (error) {
            console.warn("[StartupSync] Background repo initialization failed:", error);
          }
        }, 2000);
      } else if (uninitializedRepos.length > 0) {
        console.log(`[StartupSync] Found ${uninitializedRepos.length} uninitialized repositories, but auto-initialization is disabled`);
      }

      // Check for conversations that need syncing
      const pendingConversations = conversations.filter(c => {
        const status = conversationStore.conversationSyncStatus[c.id];
        return status === 'needs-sync';
      });

      if (pendingConversations.length > 0 && settingsStore.autoSyncOnStreamComplete) {
        console.log(`[StartupSync] Found ${pendingConversations.length} conversations pending sync`);
        
        // Auto-sync pending conversations in background after repos are ready
        setTimeout(async () => {
          try {
            await BulkSyncService.syncPendingConversations();
          } catch (error) {
            console.warn("[StartupSync] Background conversation sync failed:", error);
          }
        }, 5000);
      }

    } catch (error) {
      console.error("[StartupSync] Startup sync failed:", error);
    }
  }

  /**
   * Reset the startup sync flag (useful for testing)
   */
  static reset(): void {
    this.hasRunStartupSync = false;
  }
} 