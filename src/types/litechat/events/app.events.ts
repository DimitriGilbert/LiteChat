// src/types/litechat/events/app.events.ts
// FULL FILE
export const appEvent = {
  loaded: "app.loaded",
  errorBoundaryTriggered: "app.error.boundary.triggered",
  initializationPhaseCompleted: "app.initialization.phase.completed",
} as const;

// Define payload types for events specific to app
export interface AppEventPayloads {
  [appEvent.loaded]: undefined;
  [appEvent.errorBoundaryTriggered]: {
    error: Error;
    errorInfo: React.ErrorInfo;
  };
  [appEvent.initializationPhaseCompleted]: {
    phase:
      | "coreData"
      | "controlModulesInit"
      | "controlModulesRegister"
      | "externalMods"
      | "uiStateSync"
      | "all";
  };
}
