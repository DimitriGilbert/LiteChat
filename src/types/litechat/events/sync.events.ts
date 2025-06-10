// src/types/litechat/events/sync.events.ts
// FULL FILE
import type { SyncStatus } from "@/types/litechat/sync";
import type { BulkSyncProgress } from "@/services/bulk-sync.service";

export const syncEvent = {
  repoChanged: "sync.repo.changed",
  repoInitStatusChanged: "sync.repo.init.status.changed",
  bulkSyncStarted: "sync.bulk.sync.started",
  bulkSyncProgress: "sync.bulk.sync.progress",
  bulkSyncCompleted: "sync.bulk.sync.completed",
  bulkSyncFailed: "sync.bulk.sync.failed",
} as const;

export interface SyncEventPayloads {
  [syncEvent.repoChanged]: {
    repoId: string;
    action: "added" | "updated" | "deleted";
  };
  [syncEvent.repoInitStatusChanged]: { repoId: string; status: SyncStatus };
  [syncEvent.bulkSyncStarted]: { progress: BulkSyncProgress };
  [syncEvent.bulkSyncProgress]: { progress: BulkSyncProgress };
  [syncEvent.bulkSyncCompleted]: { progress: BulkSyncProgress; success: boolean };
  [syncEvent.bulkSyncFailed]: { progress: BulkSyncProgress; error: string };
}
