// PWA-specific event types for update management
export const pwaEvent = {
  updateAvailable: "pwa.update.available",
  updateAccepted: "pwa.update.accepted",
  updateRejected: "pwa.update.rejected",
  updateInstalled: "pwa.update.installed",
  updateError: "pwa.update.error",
  offlineReady: "pwa.offline.ready",
} as const;

export type PWAEventPayloads = {
  [pwaEvent.updateAvailable]: {
    updateSW: () => Promise<void>;
    showUpdatePrompt: boolean;
  };
  [pwaEvent.updateAccepted]: {
    updateSW: () => Promise<void>;
  };
  [pwaEvent.updateRejected]: {
    timestamp: number;
  };
  [pwaEvent.updateInstalled]: {
    needsRefresh: boolean;
  };
  [pwaEvent.updateError]: {
    error: Error;
    context: string;
  };
  [pwaEvent.offlineReady]: {
    timestamp: number;
  };
};