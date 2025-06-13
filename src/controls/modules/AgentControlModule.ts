import React from "react";
import { type ControlModule } from "@/types/litechat/control";
import { type LiteChatModApi } from "@/types/litechat/modding";
import { promptTemplateEvent } from "@/types/litechat/events/prompt-template.events";
import { promptEvent } from "@/types/litechat/events/prompt.events";
import type { PromptTemplate, PromptFormData, CompiledPrompt } from "@/types/litechat/prompt-template";
import { SettingsAssistantAgent } from "@/controls/components/assistant-settings/SettingsAssistantAgent";
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
        this.allTemplates.push(payload.promptTemplate);
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
    return this.allTemplates.filter(template => template.type === "agent");
  };

  public getTasksForAgent = (agentId: string): PromptTemplate[] => {
    return this.allTemplates.filter(template => 
      template.type === "task" && template.parentId === agentId
    );
  };

  public getIsLoadingTemplates = (): boolean => this.isLoadingTemplates;

  public compileTemplate = async (templateId: string, formData: PromptFormData): Promise<CompiledPrompt> => {
    const { compilePromptTemplate } = usePromptTemplateStore.getState();
    return await compilePromptTemplate(templateId, formData);
  };

  public applyTemplate = async (templateId: string, formData: PromptFormData): Promise<void> => {
    const compiled = await this.compileTemplate(templateId, formData);
    this.modApiRef?.emit(promptEvent.setInputTextRequest, { text: compiled.content });
  };

  public setNotifyCallback = (cb: (() => void) | null) => {
    this.notifyComponentUpdate = cb;
  };

  register(modApi: LiteChatModApi): void {
    this.modApiRef = modApi;
    if (this.unregisterPromptControlCallback) {
      console.warn(`[${this.id}] Already registered. Skipping.`);
      return;
    }
    this.unregisterPromptControlCallback = modApi.registerPromptControl({
      id: this.id,
      status: () => "ready",
      triggerRenderer: () => React.createElement(AgentControl, { module: this }),
    });

    this.unregisterCallback = modApi.registerSettingsTab({
      id: "agent",
      title: "Agents",
      component: SettingsAssistantAgent,
      order: 25, // After prompts (20) but before other tabs
    });
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