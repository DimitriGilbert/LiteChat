// src/services/sync.service.ts
// Entire file content provided - Contains the actual sync logic
import type { Conversation } from "@/types/litechat/chat";
import type { SyncRepo, SyncStatus } from "@/types/litechat/sync";
import type { Interaction } from "@/types/litechat/interaction";
import * as VfsOps from "@/lib/litechat/vfs-operations";
import { PersistenceService } from "@/services/persistence.service";
import { normalizePath, joinPath } from "@/lib/litechat/file-manager-utils";
import { toast } from "sonner";
import { useInteractionStore } from "@/store/interaction.store";
import type { fs as FsType } from "@zenfs/core";

const CONVERSATION_DIR = ".litechat/conversations";
const SYNC_REPO_BASE_DIR = "/synced_repos";

/**
 * Logic to initialize a local sync repository (clone if needed) or pull updates.
 * @param fsInstance The initialized ZenFS instance for sync operations.
 * @param repo The SyncRepo configuration object.
 * @param setRepoStatus Function to update the initialization status in the store.
 */
export async function initializeOrSyncRepoLogic(
  fsInstance: typeof FsType,
  repo: SyncRepo,
  setRepoStatus: (repoId: string, status: SyncStatus) => void,
): Promise<void> {
  setRepoStatus(repo.id, "syncing");
  const repoDir = normalizePath(`${SYNC_REPO_BASE_DIR}/${repo.id}`);
  const credentials = { username: repo.username, password: repo.password };
  const branchToUse = repo.branch || "main";

  try {
    let isRepoCloned = false;
    try {
      await fsInstance.promises.stat(joinPath(repoDir, ".git"));
      isRepoCloned = true;
    } catch (e: any) {
      if (e.code === "ENOENT") {
        isRepoCloned = false;
      } else {
        throw e;
      }
    }

    if (!isRepoCloned) {
      toast.info(`Cloning repository "${repo.name}"...`);
      await VfsOps.gitCloneOp(
        repoDir,
        repo.remoteUrl,
        branchToUse,
        credentials,
      );
      toast.success(`Repository "${repo.name}" cloned successfully.`);
      setRepoStatus(repo.id, "idle");
    } else {
      toast.info(`Pulling latest changes for "${repo.name}"...`);
      await VfsOps.gitPullOp(repoDir, branchToUse, credentials);
      toast.success(`Repository "${repo.name}" synced successfully.`);
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
 * @param fsInstance The initialized ZenFS instance for sync operations.
 * @param conversation The conversation object to sync.
 * @param repo The linked SyncRepo configuration object.
 * @param setConversationStatus Function to update the conversation's sync status.
 * @param updateConversation Function to update the conversation's lastSyncedAt time.
 * @param getSelectedItemId Function to get the currently selected item ID.
 * @param getSelectedItemType Function to get the currently selected item type.
 */
export async function syncConversationLogic(
  fsInstance: typeof FsType,
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
  const branchToUse = repo.branch || "main";

  try {
    try {
      await fsInstance.promises.stat(joinPath(repoDir, ".git"));
    } catch (e: any) {
      if (e.code === "ENOENT") {
        toast.error(
          `Repository "${repo.name}" not found locally. Please clone/sync it from Settings first.`,
        );
        setConversationStatus(conversation.id, "error", "Repo not cloned");
        return;
      }
      throw e;
    }

    toast.info(`Pulling latest changes for "${repo.name}"...`);
    await VfsOps.gitPullOp(repoDir, branchToUse, credentials);

    let remoteConvoData: {
      conversation: Conversation;
      interactions: Interaction[];
    } | null = null;
    let remoteTimestamp: number | null = null;
    try {
      const fileContent = await VfsOps.readFileOp(convoFilePath);
      const jsonString = new TextDecoder().decode(fileContent);
      remoteConvoData = JSON.parse(jsonString);
      remoteTimestamp = remoteConvoData?.conversation?.updatedAt
        ? new Date(remoteConvoData.conversation.updatedAt).getTime()
        : null;
      if (isNaN(remoteTimestamp ?? NaN)) remoteTimestamp = null;
    } catch (e: any) {
      if (e.code === "ENOENT") {
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
      toast.info("Local changes detected. Pushing to remote...");
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
      await VfsOps.writeFileOp(convoFilePath, localData);
      await VfsOps.gitCommitOp(
        repoDir,
        `Sync conversation: ${conversation.title} (${conversation.id})`,
      );
      await VfsOps.gitPushOp(repoDir, branchToUse, credentials);
      await updateConversation(conversation.id, { lastSyncedAt: new Date() });
      setConversationStatus(conversation.id, "idle");
      toast.success("Conversation synced successfully (pushed).");
    } else if (remoteTimestamp && remoteTimestamp > localTimestamp) {
      toast.info("Remote changes detected. Updating local conversation...");
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
      toast.success("Conversation synced successfully (pulled).");
    } else {
      toast.info("Conversation already up-to-date.");
      await updateConversation(conversation.id, { lastSyncedAt: new Date() });
      setConversationStatus(conversation.id, "idle");
    }
  } catch (error: any) {
    console.error(`Sync failed for conversation ${conversation.id}:`, error);
    setConversationStatus(conversation.id, "error", error.message);
  }
}
