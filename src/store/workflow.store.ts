import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { WorkflowRun, WorkflowRunStatus } from "@/types/litechat/workflow";
import type { RegisteredActionHandler } from "@/types/litechat/control";
import { workflowEvent, type WorkflowEventPayloads } from "@/types/litechat/events/workflow.events";
import { emitter } from "@/lib/litechat/event-emitter";

export interface WorkflowState {
  activeRun: WorkflowRun | null;
}

export interface WorkflowActions {
  // Internal actions triggered by events
  _handleWorkflowStarted: (run: WorkflowRun) => void;
  _handleStepCompleted: (runId: string, stepId: string, output: any) => void;
  _handleWorkflowPaused: (runId: string) => void;
  _handleWorkflowResumed: (runId: string) => void;
  _handleWorkflowCompleted: (runId: string) => void;
  _handleWorkflowError: (runId: string, error: string) => void;
  _handleWorkflowCancelled: (runId: string) => void;
  _updateRun: (runId: string, status: WorkflowRunStatus, updateFn?: (run: WorkflowRun) => void) => void;
  
  // For the EventActionCoordinator
  getRegisteredActionHandlers: () => RegisteredActionHandler[];
}

export const useWorkflowStore = create(
  immer<WorkflowState & WorkflowActions>((set, get) => ({
    activeRun: null,

    _handleWorkflowStarted: (run) => {
      set((state) => {
        state.activeRun = run;
      });
    },

    _updateRun: (runId, status, updateFn) => {
      set((state) => {
        if (state.activeRun && state.activeRun.runId === runId) {
          state.activeRun.status = status;
          if (updateFn) {
            updateFn(state.activeRun);
          }
        }
      });
    },

    _handleStepCompleted: (runId, stepId, output) => {
      get()._updateRun(runId, "RUNNING", (run: WorkflowRun) => {
        run.stepOutputs[stepId] = output;
        run.currentStepIndex += 1;
      });
    },

    _handleWorkflowPaused: (runId) => {
      get()._updateRun(runId, "PAUSED");
    },

    _handleWorkflowResumed: (runId) => {
      get()._updateRun(runId, "RUNNING");
    },

    _handleWorkflowCompleted: (runId) => {
      get()._updateRun(runId, "COMPLETED", (run: WorkflowRun) => {
        run.endedAt = new Date().toISOString();
      });
      // Optionally clear after a delay
      setTimeout(() => set({ activeRun: null }), 5000);
    },

    _handleWorkflowError: (runId, error) => {
      get()._updateRun(runId, "ERROR", (run: WorkflowRun) => {
        run.error = error;
        run.endedAt = new Date().toISOString();
      });
    },

    _handleWorkflowCancelled: (runId) => {
      if (get().activeRun?.runId === runId) {
        set({ activeRun: null });
      }
    },

    getRegisteredActionHandlers: () => {
      const actions = get();
      return [
        {
          eventName: workflowEvent.started,
          handler: (payload: WorkflowEventPayloads[typeof workflowEvent.started]) => actions._handleWorkflowStarted(payload.run),
          storeId: "WorkflowStore",
        },
        {
          eventName: workflowEvent.stepCompleted,
          handler: (payload: WorkflowEventPayloads[typeof workflowEvent.stepCompleted]) => actions._handleStepCompleted(payload.runId, payload.stepId, payload.output),
          storeId: "WorkflowStore",
        },
        {
          eventName: workflowEvent.paused,
          handler: (payload: WorkflowEventPayloads[typeof workflowEvent.paused]) => actions._handleWorkflowPaused(payload.runId),
          storeId: "WorkflowStore",
        },
        {
            eventName: workflowEvent.resumed,
            handler: (payload: WorkflowEventPayloads[typeof workflowEvent.resumed]) => actions._handleWorkflowResumed(payload.runId),
            storeId: "WorkflowStore",
        },
        {
            eventName: workflowEvent.completed,
            handler: (payload: WorkflowEventPayloads[typeof workflowEvent.completed]) => actions._handleWorkflowCompleted(payload.runId),
            storeId: "WorkflowStore",
        },
        {
            eventName: workflowEvent.error,
            handler: (payload: WorkflowEventPayloads[typeof workflowEvent.error]) => actions._handleWorkflowError(payload.runId, payload.error),
            storeId: "WorkflowStore",
        },
        {
            eventName: workflowEvent.cancelRequest, // Listen to request to clear state
            handler: (payload: WorkflowEventPayloads[typeof workflowEvent.cancelRequest]) => actions._handleWorkflowCancelled(payload.runId),
            storeId: "WorkflowStore",
        },
      ];
    },
  }))
); 