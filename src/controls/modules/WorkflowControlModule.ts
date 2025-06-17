import React from "react";
import { type ControlModule } from "@/types/litechat/control";
import { type LiteChatModApi } from "@/types/litechat/modding";
import { workflowEvent } from "@/types/litechat/events/workflow.events";
import { WorkflowBuilder } from "@/controls/components/workflow/WorkflowBuilder";
import type { WorkflowTemplate } from "@/types/litechat/workflow";
import { useInteractionStore } from "@/store/interaction.store";
import { promptTemplateEvent } from "@/types/litechat/events/prompt-template.events";
import type { PromptTemplate } from "@/types/litechat/prompt-template";

export class WorkflowControlModule implements ControlModule {
  readonly id = "core-workflow-control";
  private modApi: LiteChatModApi | null = null;
  private isStreaming = false;
  private notifyComponentUpdate: (() => void) | null = null;
  private eventUnsubscribers: (() => void)[] = [];
  private allTemplates: PromptTemplate[] = [];

  async initialize(modApi: LiteChatModApi): Promise<void> {
    this.modApi = modApi;
    this.isStreaming = useInteractionStore.getState().status === "streaming";

    const unsubStatus = modApi.on("interaction.status.changed", (payload) => {
      if (typeof payload === "object" && payload && "status" in payload) {
        const newStreamingStatus = payload.status === "streaming";
        if (this.isStreaming !== newStreamingStatus) {
          this.isStreaming = newStreamingStatus;
          this.notifyComponentUpdate?.();
        }
      }
    });

    const unsubTemplatesChanged = modApi.on(promptTemplateEvent.promptTemplatesChanged, (payload) => {
        if (payload?.promptTemplates) {
            this.allTemplates = payload.promptTemplates;
            this.notifyComponentUpdate?.();
        }
    });

    this.eventUnsubscribers.push(unsubStatus, unsubTemplatesChanged);
    
    // Request templates on initialization
    modApi.emit(promptTemplateEvent.loadPromptTemplatesRequest, {});
  }

  // --- Public API for the Component ---
  
  public getIsStreaming = (): boolean => this.isStreaming;
  public getPromptTemplates = (): PromptTemplate[] => this.allTemplates.filter(t => (t.type || 'prompt') === 'prompt');
  public getAgentTasks = (): PromptTemplate[] => this.allTemplates.filter(t => t.type === 'agent' || t.type === 'task');

  public setNotifyCallback = (cb: (() => void) | null): void => {
    this.notifyComponentUpdate = cb;
  };

  public startWorkflow = (template: WorkflowTemplate, initialPrompt: string): void => {
    this.modApi?.emit(workflowEvent.startRequest, { template, initialPrompt });
  };

  // --- ControlModule Implementation ---

  register(modApi: LiteChatModApi): void {
    this.modApi = modApi;
    modApi.registerPromptControl({
      id: this.id,
      status: () => "ready",
      triggerRenderer: () => React.createElement(WorkflowBuilder, { module: this }),
    });
  }

  destroy(): void {
    this.eventUnsubscribers.forEach((unsub) => unsub());
    this.eventUnsubscribers = [];
    this.notifyComponentUpdate = null;
    this.modApi = null;
    console.log(`[${this.id}] Destroyed.`);
  }
} 