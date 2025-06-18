import React from "react";
import { type ControlModule } from "@/types/litechat/control";
import { type LiteChatModApi } from "@/types/litechat/modding";
import { workflowEvent } from "@/types/litechat/events/workflow.events";
import { WorkflowBuilder } from "@/controls/components/workflow/WorkflowBuilder";
import type { WorkflowTemplate } from "@/types/litechat/workflow";
import { useInteractionStore } from "@/store/interaction.store";
import { promptTemplateEvent } from "@/types/litechat/events/prompt-template.events";
import type { PromptTemplate } from "@/types/litechat/prompt-template";
import { useProviderStore } from "@/store/provider.store";
import type { AiModelConfig, ModelListItem } from "@/types/litechat/provider";
import { providerEvent } from "@/types/litechat/events/provider.events";
import { usePromptTemplateStore } from "@/store/prompt-template.store";
import { PersistenceService } from "@/services/persistence.service";
import { toast } from "sonner";

export class WorkflowControlModule implements ControlModule {
  readonly id = "core-workflow-control";
  private modApi: LiteChatModApi | null = null;
  private eventUnsubscribers: (() => void)[] = [];
  private notifyComponentUpdate: (() => void) | null = null;

  // Provider state
  public globallyEnabledModels: ModelListItem[] = [];
  public isLoadingProviders = false;
  public allTemplates: PromptTemplate[] = [];
  public workflows: WorkflowTemplate[] = [];

  async initialize(modApi: LiteChatModApi): Promise<void> {
    this.modApi = modApi;

    // Get initial provider state
    const providerState = useProviderStore.getState();
    this.globallyEnabledModels = providerState.getGloballyEnabledModelDefinitions();
    this.isLoadingProviders = providerState.isLoading;
    this.allTemplates = usePromptTemplateStore.getState().promptTemplates;

    // Subscribe to provider events to track enabled models
    const unsubGloballyEnabledModelsUpdated = modApi.on(
      providerEvent.globallyEnabledModelsUpdated,
      (payload: { models: ModelListItem[] }) => {
        this.globallyEnabledModels = payload.models;
        this.notifyComponentUpdate?.();
      }
    );

    const unsubInitialDataLoaded = modApi.on(
      providerEvent.initialDataLoaded,
      (data: any) => {
        if (data.globallyEnabledModels) {
          this.globallyEnabledModels = data.globallyEnabledModels;
          this.isLoadingProviders = false;
          this.notifyComponentUpdate?.();
        }
      }
    );

    const unsubTemplatesChanged = modApi.on(
      promptTemplateEvent.promptTemplatesChanged,
      (payload) => {
        if (payload?.promptTemplates) {
          this.allTemplates = payload.promptTemplates;
          this.notifyComponentUpdate?.();
        }
      }
    );

    this.eventUnsubscribers.push(
      unsubGloballyEnabledModelsUpdated,
      unsubInitialDataLoaded,
      unsubTemplatesChanged
    );

    // Request templates on initialization
    modApi.emit(promptTemplateEvent.loadPromptTemplatesRequest, {});
    
    // Load workflows
    await this.loadWorkflows();
  }

  destroy(): void {
    this.eventUnsubscribers.forEach((unsub) => unsub());
    this.eventUnsubscribers = [];
    this.notifyComponentUpdate = null;
    this.modApi = null;
  }

  setNotifyCallback(callback: (() => void) | null): void {
    this.notifyComponentUpdate = callback;
  }

  // Public API for the component
  getPromptTemplates(): PromptTemplate[] {
    return this.allTemplates.filter(t => (t.type || 'prompt') === 'prompt');
  }

  getAgentTasks(): (PromptTemplate & { prefixedName: string })[] {
    const agents = this.allTemplates.filter(t => t.type === 'agent');
    const agentNameById = new Map(agents.map(a => [a.id, a.name]));
    
    return this.allTemplates
      .filter(t => t.type === 'task' && t.parentId)
      .map(t => ({
        ...t,
        prefixedName: `${agentNameById.get(t.parentId!) || 'Unknown Agent'}: ${t.name}`
      }));
  }

  getAllTemplates(): PromptTemplate[] {
    return this.allTemplates;
  }

  getModels(): ModelListItem[] {
    return this.globallyEnabledModels;
  }

  getGlobalModel(): AiModelConfig | undefined {
    return useProviderStore.getState().getSelectedModel();
  }

  async loadWorkflows(): Promise<void> {
    try {
      this.workflows = await PersistenceService.loadWorkflows();
      this.notifyComponentUpdate?.();
    } catch (error) {
      console.error('[WorkflowControlModule] Failed to load workflows:', error);
    }
  }

  getWorkflows(): WorkflowTemplate[] {
    return this.workflows;
  }

  async refreshWorkflows(): Promise<void> {
    await this.loadWorkflows();
  }

  startWorkflow(template: WorkflowTemplate, initialPrompt: string): void {
    const conversationId = useInteractionStore.getState().currentConversationId;
    if (!conversationId) {
      toast.error("Cannot start workflow: No active conversation selected.");
      console.error("[WorkflowControlModule] startWorkflow called without an active conversation.");
      return;
    }
    
    // Start the workflow immediately with the initial prompt
    this.modApi?.emit(workflowEvent.startRequest, { template, initialPrompt, conversationId });
    
    toast.success(`Workflow "${template.name}" started with ${template.steps.length} steps!`);
  }

  register(modApi: LiteChatModApi): void {
    this.modApi = modApi;
    modApi.registerPromptControl({
      id: this.id,
      status: () => "ready",
      triggerRenderer: () => React.createElement(WorkflowBuilder, { module: this }),
    });
  }
} 