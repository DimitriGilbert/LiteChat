// src/services/sync.service.ts
// FULL FILE
import type { Conversation } from "@/types/litechat/chat";
import type { SyncRepo, SyncStatus } from "@/types/litechat/sync";
import type { Interaction } from "@/types/litechat/interaction";
import { VfsService } from "@/services/vfs.service";
import { PersistenceService } from "@/services/persistence.service";
import { normalizePath, joinPath } from "@/lib/litechat/file-manager-utils";
import { toast } from "sonner";
import { useInteractionStore } from "@/store/interaction.store";
import { SYNC_VFS_KEY } from "@/lib/litechat/constants";

const CONVERSATION_DIR = ".litechat/conversations";
const SYNC_REPO_BASE_DIR = "/synced_repos";

/**
 * Logic to initialize a local sync repository (clone if needed) or pull updates.
 * @param repo The SyncRepo configuration object.
 * @param setRepoStatus Function to update the initialization status in the store.
 */
export async function initializeOrSyncRepoLogic(
  repo: SyncRepo,
  setRepoStatus: (repoId: string, status: SyncStatus) => void,
  silent = false,
): Promise<void> {
  setRepoStatus(repo.id, "syncing");
  const repoDir = normalizePath(`${SYNC_REPO_BASE_DIR}/${repo.id}`);
  const credentials = { username: repo.username, password: repo.password };
  const branchToUse = repo.branch || "main";

  try {
    const isRepoCloned = await VfsService.isGitRepoOp(SYNC_VFS_KEY, repoDir);

    if (!isRepoCloned) {
      if (!silent) toast.info(`Cloning repository "${repo.name}"...`);
      await VfsService.gitCloneOp(
        SYNC_VFS_KEY,
        repoDir,
        repo.remoteUrl,
        branchToUse,
        credentials,
      );
      if (!silent) toast.success(`Repository "${repo.name}" cloned successfully.`);
      setRepoStatus(repo.id, "idle");
    } else {
      if (!silent) toast.info(`Pulling latest changes for "${repo.name}"...`);
      await VfsService.gitPullOp(SYNC_VFS_KEY, repoDir, branchToUse, credentials);
      if (!silent) toast.success(`Repository "${repo.name}" synced successfully.`);
      setRepoStatus(repo.id, "idle");
    }
  } catch (error: any) {
    console.error(`Failed to initialize/sync repository ${repo.name}:`, error);
    setRepoStatus(repo.id, "error");
  }
}

/**
 * Logic to synchronize a single conversation with its linked Git repository.
 * Handles pulling, comparing timestamps, and pushing/pulling updates.
 * @param conversation The conversation object to sync.
 * @param repo The linked SyncRepo configuration object.
 * @param setConversationStatus Function to update the conversation's sync status.
 * @param updateConversation Function to update the conversation's lastSyncedAt time.
 * @param getSelectedItemId Function to get the currently selected item ID.
 * @param getSelectedItemType Function to get the currently selected item type.
 */
export async function syncConversationLogic(
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
  silent = false,
): Promise<void> {
  setConversationStatus(conversation.id, "syncing");
  const repoDir = normalizePath(`${SYNC_REPO_BASE_DIR}/${repo.id}`);
  const convoFilePath = joinPath(
    repoDir,
    CONVERSATION_DIR,
    `${conversation.id}.json`,
  );
  const credentials = { username: repo.username, password: repo.password };
  const branchToUse = repo.branch || "main";

  try {
    const isRepoCloned = await VfsService.isGitRepoOp(SYNC_VFS_KEY, repoDir);
    if (!isRepoCloned) {
      toast.error(
        `Repository "${repo.name}" not found locally. Please clone/sync it from Settings first.`,
      );
      setConversationStatus(conversation.id, "error", "Repo not cloned");
      return;
    }

    if (!silent) toast.info(`Pulling latest changes for "${repo.name}"...`);
    await VfsService.gitPullOp(SYNC_VFS_KEY, repoDir, branchToUse, credentials);

    let remoteConvoData: {
      conversation: Conversation;
      interactions: Interaction[];
    } | null = null;
    let remoteTimestamp: number | null = null;
    try {
      const fileContent = await VfsService.readFileOp(SYNC_VFS_KEY, convoFilePath);
      const jsonString = new TextDecoder().decode(fileContent);
      remoteConvoData = JSON.parse(jsonString);
      remoteTimestamp = remoteConvoData?.conversation?.updatedAt
        ? new Date(remoteConvoData.conversation.updatedAt).getTime()
        : null;
      if (isNaN(remoteTimestamp ?? NaN)) remoteTimestamp = null;
    } catch (e: any) {
      if (e.message?.includes("ENOENT") || e.message?.includes("not found")) {
        console.log(
          `Conversation file ${convoFilePath} not found in repo. Will push local version.`,
        );
      } else {
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

    if (
      !remoteConvoData ||
      localTimestamp > (remoteTimestamp ?? 0) ||
      (localTimestamp > lastSyncTimestamp &&
        localTimestamp >= (remoteTimestamp ?? 0))
    ) {
      if (!silent) toast.info("Local changes detected. Pushing to remote...");
      const interactions =
        await PersistenceService.loadInteractionsForConversation(
          conversation.id,
        );
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { lastSyncedAt, ...conversationToSave } = conversation;
      const localData = JSON.stringify(
        { conversation: conversationToSave, interactions },
        null,
        2,
      );
      await VfsService.writeFileOp(SYNC_VFS_KEY, convoFilePath, localData);
      await VfsService.gitCommitOp(
        SYNC_VFS_KEY,
        repoDir,
        `Sync conversation: ${conversation.title} (${conversation.id})`,
      );
      await VfsService.gitPushOp(SYNC_VFS_KEY, repoDir, branchToUse, credentials);
      await updateConversation(conversation.id, { lastSyncedAt: new Date() });
      setConversationStatus(conversation.id, "idle");
      if (!silent) toast.success("Conversation synced successfully (pushed).");
    } else if (remoteTimestamp && remoteTimestamp > localTimestamp) {
      if (!silent) toast.info("Remote changes detected. Updating local conversation...");
      const syncedConversationData = {
        ...remoteConvoData!.conversation,
        createdAt: new Date(remoteConvoData!.conversation.createdAt),
        updatedAt: new Date(remoteConvoData!.conversation.updatedAt),
        lastSyncedAt: new Date(),
      };
      await PersistenceService.saveConversation(syncedConversationData);
      await PersistenceService.deleteInteractionsForConversation(
        conversation.id,
      );
      const interactionPromises = remoteConvoData!.interactions.map((i) =>
        PersistenceService.saveInteraction({
          ...i,
          conversationId: conversation.id,
          startedAt: i.startedAt ? new Date(i.startedAt) : null,
          endedAt: i.endedAt ? new Date(i.endedAt) : null,
        }),
      );
      await Promise.all(interactionPromises);

      if (
        getSelectedItemId() === conversation.id &&
        getSelectedItemType() === "conversation"
      ) {
        await useInteractionStore.getState().loadInteractions(conversation.id);
      }
      setConversationStatus(conversation.id, "idle");
      if (!silent) toast.success("Conversation synced successfully (pulled).");
    } else {
      if (!silent) toast.info("Conversation already up-to-date.");
      await updateConversation(conversation.id, { lastSyncedAt: new Date() });
      setConversationStatus(conversation.id, "idle");
    }
  } catch (error: any) {
    console.error(`Sync failed for conversation ${conversation.id}:`, error);
    setConversationStatus(conversation.id, "error", error.message);
  }
}
