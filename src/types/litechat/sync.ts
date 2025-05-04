// src/types/litechat/sync.ts
import type { DbBase } from "./common";

export interface SyncRepo extends DbBase {
  name: string;
  remoteUrl: string;
  branch: string;
  // Add fields for authentication later if needed (e.g., credentialId)
  username?: string | null
  password?: string | null
  lastPulledAt?: Date | null;
  lastPushedAt?: Date | null;
  lastSyncError?: string | null;
}

export type SyncStatus =
  | "idle" // Synced or never synced
  | "syncing" // Actively pulling or pushing
  | "error" // Last sync failed
  | "needs-sync"
