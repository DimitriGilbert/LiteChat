// src/types/litechat/events/sync.events.ts
// FULL FILE
import type { SyncStatus } from "@/types/litechat/sync";

export const syncEvent = {
  repoChanged: "sync.repo.changed",
  repoInitStatusChanged: "sync.repo.init.status.changed",
} as const;

export interface SyncEventPayloads {
  [syncEvent.repoChanged]: {
    repoId: string;
    action: "added" | "updated" | "deleted";
  };
  [syncEvent.repoInitStatusChanged]: { repoId: string; status: SyncStatus };
}
