import React from "react";
import { type ControlModule } from "@/types/litechat/control";
import { type LiteChatModApi } from "@/types/litechat/modding";
import { workflowEvent } from "@/types/litechat/events/workflow.events";
import { WorkflowControlFooter } from "@/controls/components/workflow/WorkflowControlFooter";

export class WorkflowDisplayModule implements ControlModule {
  readonly id = "core-workflow-display";
  private modApi: LiteChatModApi | null = null;
  private unregisterCallback: (() => void) | null = null;
  private eventUnsubscribers: (() => void)[] = [];

  async initialize(modApi: LiteChatModApi): Promise<void> {
    this.modApi = modApi;

    // Subscribe to workflow events to trigger re-renders
    const unsubPaused = modApi.on(workflowEvent.paused, () => {
      // Component will handle the state checking
    });
    const unsubResumed = modApi.on(workflowEvent.resumed, () => {
      // Component will handle the state checking
    });
    const unsubCompleted = modApi.on(workflowEvent.completed, () => {
      // Component will handle the state checking
    });
    const unsubError = modApi.on(workflowEvent.error, () => {
      // Component will handle the state checking
    });

    this.eventUnsubscribers.push(unsubPaused, unsubResumed, unsubCompleted, unsubError);
  }

  // Public API for the component
  resumeWorkflow(runId: string, resumeData?: any): void {
    this.modApi?.emit(workflowEvent.resumeRequest, { runId, resumeData });
  }
  
  cancelWorkflow(runId: string): void {
    this.modApi?.emit(workflowEvent.cancelRequest, { runId });
  }

  register(modApi: LiteChatModApi): void {
    this.modApi = modApi;
    this.unregisterCallback = modApi.registerChatControl({
      id: this.id,
      panel: 'sidebar-footer',
      renderer: () => {
        // Let the component handle state checking using hooks properly
        return React.createElement(WorkflowControlFooter, { module: this });
      },
    });
  }

  destroy(): void {
    this.eventUnsubscribers.forEach((unsub) => unsub());
    this.eventUnsubscribers = [];
    this.unregisterCallback?.();
    this.modApi = null;
  }
} 