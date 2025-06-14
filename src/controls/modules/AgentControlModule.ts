import React from "react";
import { type ControlModule } from "@/types/litechat/control";
import { type LiteChatModApi } from "@/types/litechat/modding";
import { promptTemplateEvent } from "@/types/litechat/events/prompt-template.events";
import { promptEvent } from "@/types/litechat/events/prompt.events";
import type { PromptTemplate, PromptFormData, CompiledPrompt } from "@/types/litechat/prompt-template";
import { AgentControl } from "@/controls/components/prompt/AgentControl";
import { usePromptTemplateStore } from "@/store/prompt-template.store";

export class AgentControlModule implements ControlModule {
  readonly id = "agent-control";
  private unregisterPromptControlCallback: (() => void) | null = null;
  private unregisterCallback?: () => void;
  private eventUnsubscribers: (() => void)[] = [];
  private modApiRef: LiteChatModApi | null = null;

  private allTemplates: PromptTemplate[] = [];
  private isLoadingTemplates = true;
  private notifyComponentUpdate: (() => void) | null = null;

  // Agent state for the current turn
  private currentAgentId: string | null = null;
  private currentAgentSystemPrompt: string | null = null;
  
  // Auto-clear setting
  private autoClearEnabled = false;

  async initialize(modApi: LiteChatModApi): Promise<void> {
    this.modApiRef = modApi;

    // Load templates on initialization
    modApi.emit(promptTemplateEvent.loadPromptTemplatesRequest, {});

    // Listen for template changes
    const unsubTemplatesChanged = modApi.on(promptTemplateEvent.promptTemplatesChanged, (payload) => {
      if (payload?.promptTemplates) {
        this.allTemplates = payload.promptTemplates;
        this.isLoadingTemplates = false;
        this.notifyComponentUpdate?.();
      }
    });

    const unsubTemplateAdded = modApi.on(promptTemplateEvent.promptTemplateAdded, (payload) => {
      if (payload?.promptTemplate) {
        this.allTemplates = [...this.allTemplates, payload.promptTemplate];
        this.notifyComponentUpdate?.();
      }
    });

    const unsubTemplateUpdated = modApi.on(promptTemplateEvent.promptTemplateUpdated, (payload) => {
      if (payload?.promptTemplate) {
        const index = this.allTemplates.findIndex(t => t.id === payload.promptTemplate.id);
        if (index !== -1) {
          this.allTemplates[index] = payload.promptTemplate;
          this.notifyComponentUpdate?.();
        }
      }
    });

    const unsubTemplateDeleted = modApi.on(promptTemplateEvent.promptTemplateDeleted, (payload) => {
      if (payload?.id) {
        this.allTemplates = this.allTemplates.filter(t => t.id !== payload.id);
        this.notifyComponentUpdate?.();
      }
    });

    this.eventUnsubscribers.push(
      unsubTemplatesChanged,
      unsubTemplateAdded,
      unsubTemplateUpdated,
      unsubTemplateDeleted
    );
  }

  // Public API methods for the component
  public getAllTemplates = (): PromptTemplate[] => this.allTemplates;

  public getAgents = (): PromptTemplate[] => {
    return this.allTemplates.filter(template => (template.type || "prompt") === "agent");
  };

  public getTasksForAgent = (agentId: string): PromptTemplate[] => {
    return this.allTemplates.filter(template => 
      (template.type || "prompt") === "task" && template.parentId === agentId
    );
  };

  public getIsLoadingTemplates = (): boolean => this.isLoadingTemplates;

  public compileTemplate = async (templateId: string, formData: PromptFormData): Promise<CompiledPrompt> => {
    const { compilePromptTemplate } = usePromptTemplateStore.getState();
    return await compilePromptTemplate(templateId, formData);
  };

  public compileTaskTemplate = async (taskId: string, formData: PromptFormData): Promise<CompiledPrompt> => {
    const { compilePromptTemplate } = usePromptTemplateStore.getState();
    return await compilePromptTemplate(taskId, formData);
  };

  public applyTemplate = async (templateId: string, formData: PromptFormData): Promise<void> => {
    const compiled = await this.compileTemplate(templateId, formData);
    this.modApiRef?.emit(promptEvent.setInputTextRequest, { text: compiled.content });
    
    // Apply tools and rules if available
    if (compiled.selectedTools && compiled.selectedTools.length > 0) {
      // TODO: Apply tools - need to emit tool selection events
    }
    if (compiled.selectedRules && compiled.selectedRules.length > 0) {
      // TODO: Apply rules - need to emit rule selection events  
    }
  };

  public applyAgent = async (agentId: string, formData: PromptFormData): Promise<void> => {
    const compiled = await this.compileTemplate(agentId, formData);
    
    // Store agent state for the current turn
    this.currentAgentId = agentId;
    this.currentAgentSystemPrompt = compiled.content;
    
    // Notify component to update UI
    this.notifyComponentUpdate?.();
    
    // Apply tools and rules if available
    if (compiled.selectedTools && compiled.selectedTools.length > 0) {
      // TODO: Apply tools - need to emit tool selection events
    }
    if (compiled.selectedRules && compiled.selectedRules.length > 0) {
      // TODO: Apply rules - need to emit rule selection events  
    }
  };

  public applyAgentWithTask = async (
    agentId: string, 
    taskId: string, 
    agentFormData: PromptFormData, 
    taskFormData: PromptFormData
  ): Promise<void> => {
    // First apply the agent (system prompt + tools/rules)
    await this.applyAgent(agentId, agentFormData);
    
    // Then apply the task content to input
    const taskCompiled = await this.compileTemplate(taskId, taskFormData);
    this.modApiRef?.emit(promptEvent.setInputTextRequest, { text: taskCompiled.content });
    
    // Apply additional task tools and rules
    if (taskCompiled.selectedTools && taskCompiled.selectedTools.length > 0) {
      // TODO: Apply additional tools
    }
    if (taskCompiled.selectedRules && taskCompiled.selectedRules.length > 0) {
      // TODO: Apply additional rules
    }
  };

  // Getters for current agent state
  public getCurrentAgentId = (): string | null => this.currentAgentId;
  public getCurrentAgentSystemPrompt = (): string | null => this.currentAgentSystemPrompt;
  public hasActiveAgent = (): boolean => this.currentAgentId !== null;

  // Auto-clear methods
  public getAutoClearEnabled = (): boolean => this.autoClearEnabled;
  public setAutoClearEnabled = (enabled: boolean): void => {
    this.autoClearEnabled = enabled;
  };

  // Clear agent state manually
  public clearOnSubmit = (): void => {
    this.currentAgentId = null;
    this.currentAgentSystemPrompt = null;
    this.notifyComponentUpdate?.();
  };

  public setNotifyCallback = (cb: (() => void) | null) => {
    this.notifyComponentUpdate = cb;
  };

  public loadPromptTemplates = (): void => {
    this.modApiRef?.emit(promptTemplateEvent.loadPromptTemplatesRequest, {});
  };

  register(modApi: LiteChatModApi): void {
    this.modApiRef = modApi;
    
    // Register prompt control if not already registered
    if (!this.unregisterPromptControlCallback) {
      this.unregisterPromptControlCallback = modApi.registerPromptControl({
        id: this.id,
        status: () => "ready",
        triggerRenderer: () => React.createElement(AgentControl, { module: this }),
        getMetadata: () => {
          // Provide agent system prompt if an agent is active
          if (this.currentAgentSystemPrompt) {
            return { turnSystemPrompt: this.currentAgentSystemPrompt };
          }
          return undefined;
        },
        clearOnSubmit: () => {
          // Only clear agent state if auto-clear is enabled
          if (this.autoClearEnabled) {
            this.currentAgentId = null;
            this.currentAgentSystemPrompt = null;
            this.notifyComponentUpdate?.();
          }
        },
      });
    }

    // Agent settings are now part of the Assistant settings tab
    // No longer registering as a separate main settings tab
  }

  destroy(_modApi: LiteChatModApi): void {
    // Clean up event listeners
    this.eventUnsubscribers.forEach(unsubscribe => unsubscribe());
    this.eventUnsubscribers = [];

    // Clean up control registration
    if (this.unregisterPromptControlCallback) {
      this.unregisterPromptControlCallback();
      this.unregisterPromptControlCallback = null;
    }

    // Clean up references
    this.modApiRef = null;
    this.notifyComponentUpdate = null;

    if (this.unregisterCallback) {
      this.unregisterCallback();
    }
  }


} 