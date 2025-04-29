// src/lib/litechat/conversation-sync-logic.ts
import type { Conversation } from "@/types/litechat/chat";
import type { SyncRepo, SyncStatus } from "@/types/litechat/sync";
import type { Interaction } from "@/types/litechat/interaction";
import * as VfsOps from "@/lib/litechat/vfs-operations";
import { PersistenceService } from "@/services/persistence.service";
import { normalizePath, joinPath } from "@/lib/litechat/file-manager-utils";
import { toast } from "sonner";
import { useInteractionStore } from "@/store/interaction.store";
// Removed VFS store import
import type { fs as FsType } from "@zenfs/core"; // Import fs type

const CONVERSATION_DIR = ".litechat/conversations";
const SYNC_REPO_BASE_DIR = "/synced_repos"; // Base directory for sync repos
export const SYNC_VFS_KEY = "sync_repos"; // Define the key for sync VFS

/**
 * Logic to initialize a local sync repository (clone if needed) or pull updates.
 * @param fsInstance The initialized ZenFS instance for sync operations.
 * @param repo The SyncRepo configuration object.
 * @param setRepoStatus Function to update the initialization status in the store.
 */
export async function initializeOrSyncRepoLogic(
  fsInstance: typeof FsType, // Accept fs instance as parameter
  repo: SyncRepo,
  setRepoStatus: (repoId: string, status: SyncStatus) => void,
): Promise<void> {
  setRepoStatus(repo.id, "syncing");
  const repoDir = normalizePath(`${SYNC_REPO_BASE_DIR}/${repo.id}`);
  const credentials = { username: repo.username, password: repo.password };
  const branchToUse = repo.branch || "main"; // Use configured branch or default to main

  try {
    let isRepoCloned = false;
    try {
      // Check specifically for the .git directory using the passed fsInstance
      await fsInstance.promises.stat(joinPath(repoDir, ".git"));
      isRepoCloned = true; // .git directory exists, repo is cloned
    } catch (e: any) {
      if (e.code === "ENOENT") {
        // .git directory doesn't exist, repo is not cloned (or clone failed previously)
        isRepoCloned = false;
      } else {
        // Rethrow unexpected stat errors
        throw e;
      }
    }

    if (!isRepoCloned) {
      toast.info(`Cloning repository "${repo.name}"...`);
      // Attempt to clone. gitCloneOp handles directory creation and existence checks internally.
      // Pass the specific branch to clone.
      await VfsOps.gitCloneOp(
        repoDir, // Pass the target directory for the repo
        repo.remoteUrl,
        branchToUse, // Pass configured branch
        credentials,
      );
      // Verification is now inside gitCloneOp
      toast.success(`Repository "${repo.name}" cloned successfully.`);
      setRepoStatus(repo.id, "idle");
    } else {
      toast.info(`Pulling latest changes for "${repo.name}"...`);
      // Pass the correct branch name from the repo config
      await VfsOps.gitPullOp(repoDir, branchToUse, credentials); // Pass configured branch
      toast.success(`Repository "${repo.name}" synced successfully.`);
      setRepoStatus(repo.id, "idle");
    }
  } catch (error: any) {
    console.error(`Failed to initialize/sync repository ${repo.name}:`, error);
    // Error toast is handled by VfsOps functions (gitCloneOp/gitPullOp)
    setRepoStatus(repo.id, "error");
    // Do not re-throw here, let the UI reflect the error status
  }
}

/**
 * Logic to synchronize a single conversation with its linked Git repository.
 * Handles pulling, comparing timestamps, and pushing/pulling updates.
 * @param fsInstance The initialized ZenFS instance for sync operations.
 * @param conversation The conversation object to sync.
 * @param repo The linked SyncRepo configuration object.
 * @param setConversationStatus Function to update the conversation's sync status.
 * @param updateConversation Function to update the conversation's lastSyncedAt time.
 * @param getSelectedItemId Function to get the currently selected item ID.
 * @param getSelectedItemType Function to get the currently selected item type.
 */
export async function syncConversationLogic(
  fsInstance: typeof FsType, // Accept fs instance as parameter
  conversation: Conversation,
  repo: SyncRepo,
  setConversationStatus: (
    conversationId: string,
    status: SyncStatus,
    error?: string | null,
  ) => void,
  updateConversation: (
    id: string,
    updates: Partial<Omit<Conversation, "id" | "createdAt">>,
  ) => Promise<void>,
  getSelectedItemId: () => string | null,
  getSelectedItemType: () => string | null,
): Promise<void> {
  setConversationStatus(conversation.id, "syncing");
  const repoDir = normalizePath(`${SYNC_REPO_BASE_DIR}/${repo.id}`);
  const convoFilePath = joinPath(
    repoDir,
    CONVERSATION_DIR,
    `${conversation.id}.json`,
  );
  const credentials = { username: repo.username, password: repo.password };
  const branchToUse = repo.branch || "main"; // Use configured branch or default to main

  try {
    // --- Check if repo exists locally ---
    try {
      // Check for .git directory using the passed fsInstance
      await fsInstance.promises.stat(joinPath(repoDir, ".git"));
    } catch (e: any) {
      if (e.code === "ENOENT") {
        toast.error(
          `Repository "${repo.name}" not found locally. Please clone/sync it from Settings first.`,
        );
        setConversationStatus(conversation.id, "error", "Repo not cloned");
        return; // Stop sync
      }
      throw e; // Rethrow other stat errors
    }

    // --- Pull latest changes ---
    toast.info(`Pulling latest changes for "${repo.name}"...`);
    // Pass the correct branch name from the repo config
    await VfsOps.gitPullOp(repoDir, branchToUse, credentials); // Pass configured branch

    // --- Compare local and remote ---
    let remoteConvoData: {
      conversation: Conversation;
      interactions: Interaction[];
    } | null = null;
    let remoteTimestamp: number | null = null;
    try {
      const fileContent = await VfsOps.readFileOp(convoFilePath);
      const jsonString = new TextDecoder().decode(fileContent);
      remoteConvoData = JSON.parse(jsonString);
      // Ensure updatedAt is parsed correctly
      remoteTimestamp = remoteConvoData?.conversation?.updatedAt
        ? new Date(remoteConvoData.conversation.updatedAt).getTime()
        : null;
      if (isNaN(remoteTimestamp ?? NaN)) remoteTimestamp = null; // Handle invalid date strings
    } catch (e: any) {
      if (e.code === "ENOENT") {
        console.log(
          `Conversation file ${convoFilePath} not found in repo. Will push local version.`,
        );
      } else {
        // Log specific read error but continue (will likely push)
        console.error(
          `Failed to read or parse remote conversation file: ${e.message}`,
        );
        toast.warning(
          `Could not read remote version of conversation: ${e.message}`,
        );
      }
    }

    const localTimestamp = conversation.updatedAt.getTime();
    const lastSyncTimestamp = conversation.lastSyncedAt?.getTime() ?? 0;

    // --- Push local changes if newer ---
    if (
      !remoteConvoData || // No remote version exists
      localTimestamp > (remoteTimestamp ?? 0) || // Local is strictly newer than remote
      (localTimestamp > lastSyncTimestamp && // Local updated since last sync AND...
        localTimestamp >= (remoteTimestamp ?? 0)) // ...local is same or newer than remote (covers edge case)
    ) {
      toast.info("Local changes detected. Pushing to remote...");
      const interactions =
        await PersistenceService.loadInteractionsForConversation(
          conversation.id,
        );
      // Ensure lastSyncedAt is NOT included in the saved JSON
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { lastSyncedAt, ...conversationToSave } = conversation;
      const localData = JSON.stringify(
        { conversation: conversationToSave, interactions },
        null,
        2,
      );
      await VfsOps.writeFileOp(convoFilePath, localData);
      await VfsOps.gitCommitOp(
        repoDir,
        `Sync conversation: ${conversation.title} (${conversation.id})`,
      );
      // Pass configured branch to push
      await VfsOps.gitPushOp(repoDir, branchToUse, credentials);
      // Update lastSyncedAt only AFTER successful push
      await updateConversation(conversation.id, { lastSyncedAt: new Date() });
      setConversationStatus(conversation.id, "idle");
      toast.success("Conversation synced successfully (pushed).");
    }
    // --- Pull remote changes if newer ---
    else if (remoteTimestamp && remoteTimestamp > localTimestamp) {
      toast.info("Remote changes detected. Updating local conversation...");
      // Ensure dates from JSON are converted back to Date objects
      const syncedConversationData = {
        ...remoteConvoData!.conversation,
        createdAt: new Date(remoteConvoData!.conversation.createdAt),
        updatedAt: new Date(remoteConvoData!.conversation.updatedAt),
        lastSyncedAt: new Date(), // Update lastSyncedAt on pull
      };
      await PersistenceService.saveConversation(syncedConversationData);
      await PersistenceService.deleteInteractionsForConversation(
        conversation.id,
      );
      const interactionPromises = remoteConvoData!.interactions.map((i) =>
        PersistenceService.saveInteraction({
          ...i,
          conversationId: conversation.id,
          // Ensure dates are Date objects
          startedAt: i.startedAt ? new Date(i.startedAt) : null,
          endedAt: i.endedAt ? new Date(i.endedAt) : null,
        }),
      );
      await Promise.all(interactionPromises);

      // Update the conversation in the store state
      // This needs to be done via the store's action or set function
      // We pass the data back to the store action to handle this.
      // For now, we assume the caller (store action) will update the state.
      // TODO: Refactor store action to handle state update after calling this logic.

      // Reload interactions if this conversation is currently selected
      if (
        getSelectedItemId() === conversation.id &&
        getSelectedItemType() === "conversation"
      ) {
        await useInteractionStore.getState().loadInteractions(conversation.id);
      }
      setConversationStatus(conversation.id, "idle");
      toast.success("Conversation synced successfully (pulled).");
    }
    // --- Already up-to-date ---
    else {
      toast.info("Conversation already up-to-date.");
      // Update lastSyncedAt even if no changes were pulled/pushed
      await updateConversation(conversation.id, { lastSyncedAt: new Date() });
      setConversationStatus(conversation.id, "idle");
    }
  } catch (error: any) {
    console.error(`Sync failed for conversation ${conversation.id}:`, error);
    // Error toast handled by VfsOps functions
    setConversationStatus(conversation.id, "error", error.message);
    // Do not re-throw, let UI reflect error status
  }
}
