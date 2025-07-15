import React from "react";
import { type ControlModule } from "@/types/litechat/control";
import { type LiteChatModApi } from "@/types/litechat/modding";
import { promptTemplateEvent } from "@/types/litechat/events/prompt-template.events";
import { promptEvent } from "@/types/litechat/events/prompt.events";
import type {
  PromptTemplate,
  PromptFormData,
  CompiledPrompt,
} from "@/types/litechat/prompt-template";
import { AgentControl } from "@/controls/components/prompt/AgentControl";
import { usePromptTemplateStore } from "@/store/prompt-template.store";
import { useControlRegistryStore } from "@/store/control.store";
import type { TriggerNamespace, TriggerExecutionContext } from "@/types/litechat/text-triggers";

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

    // Listen for template changes - BUT ONLY FOR AGENTS AND TASKS
    const unsubTemplatesChanged = modApi.on(
      promptTemplateEvent.promptTemplatesChanged,
      (payload) => {
        if (payload?.promptTemplates) {
          // Always create a new array to avoid read-only issues
          this.allTemplates = [...payload.promptTemplates];
          this.isLoadingTemplates = false;
          this.notifyComponentUpdate?.();
        }
      }
    );

    const unsubTemplateAdded = modApi.on(
      promptTemplateEvent.promptTemplateAdded,
      (payload) => {
        if (payload?.promptTemplate) {
          const template = payload.promptTemplate;
          // Only react to agent and task templates
          if (template.type === "agent" || template.type === "task") {
            // Always create a completely new array to avoid read-only issues
            this.allTemplates = [...this.allTemplates, template];
            this.notifyComponentUpdate?.();
          }
        }
      }
    );

    const unsubTemplateUpdated = modApi.on(
      promptTemplateEvent.promptTemplateUpdated,
      (payload) => {
        if (payload?.promptTemplate) {
          const template = payload.promptTemplate;
          // Only react to agent and task templates
          if (template.type === "agent" || template.type === "task") {
            const index = this.allTemplates.findIndex(
              (t) => t.id === template.id
            );
            if (index !== -1) {
              // Create a completely new array to avoid read-only errors
              const newTemplates = [...this.allTemplates];
              newTemplates[index] = { ...template }; // Also clone the template object
              this.allTemplates = newTemplates;
              this.notifyComponentUpdate?.();
            }
          }
        }
      }
    );

    const unsubTemplateDeleted = modApi.on(
      promptTemplateEvent.promptTemplateDeleted,
      (payload) => {
        if (payload?.id) {
          // Find the template to see if it was an agent or task
          const templateToDelete = this.allTemplates.find(
            (t) => t.id === payload.id
          );
          if (
            templateToDelete &&
            (templateToDelete.type === "agent" ||
              templateToDelete.type === "task")
          ) {
            // Create a new array to avoid read-only issues
            this.allTemplates = this.allTemplates.filter(
              (t) => t.id !== payload.id
            );
            this.notifyComponentUpdate?.();
          }
        }
      }
    );

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
    return this.allTemplates.filter(
      (template) => (template.type || "prompt") === "agent"
    );
  };

  public getTasksForAgent = (agentId: string): PromptTemplate[] => {
    return this.allTemplates.filter(
      (template) =>
        (template.type || "prompt") === "task" && template.parentId === agentId
    );
  };

  public getShortcutAgents = (): PromptTemplate[] => {
    return this.getAgents().filter((agent) => agent.isShortcut === true);
  };

  public getIsLoadingTemplates = (): boolean => this.isLoadingTemplates;

  public compileTemplate = async (
    templateId: string,
    formData: PromptFormData
  ): Promise<CompiledPrompt> => {
    const { compilePromptTemplate } = usePromptTemplateStore.getState();
    return await compilePromptTemplate(templateId, formData);
  };

  public compileTaskTemplate = async (
    taskId: string,
    formData: PromptFormData
  ): Promise<CompiledPrompt> => {
    const { compilePromptTemplate } = usePromptTemplateStore.getState();
    return await compilePromptTemplate(taskId, formData);
  };

  public applyTemplate = async (
    templateId: string,
    formData: PromptFormData
  ): Promise<void> => {
    const compiled = await this.compileTemplate(templateId, formData);
    this.modApiRef?.emit(promptEvent.setInputTextRequest, {
      text: compiled.content,
    });

    // Apply tools and rules if available
    if (compiled.selectedTools && compiled.selectedTools.length > 0) {
      // TODO: Apply tools - need to emit tool selection events
    }
    if (compiled.selectedRules && compiled.selectedRules.length > 0) {
      // TODO: Apply rules - need to emit rule selection events
    }
  };

  public applyAgent = async (
    agentId: string,
    formData: PromptFormData
  ): Promise<void> => {
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
    this.modApiRef?.emit(promptEvent.setInputTextRequest, {
      text: taskCompiled.content,
    });

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
  public getCurrentAgentSystemPrompt = (): string | null =>
    this.currentAgentSystemPrompt;
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

    // Register text trigger namespaces
    const triggerNamespaces = this.getTextTriggerNamespaces();
    triggerNamespaces.forEach(namespace => {
      useControlRegistryStore.getState().registerTextTriggerNamespace(namespace);
    });

    // Register prompt control if not already registered
    if (!this.unregisterPromptControlCallback) {
      this.unregisterPromptControlCallback = modApi.registerPromptControl({
        id: this.id,
        status: () => "ready",
        triggerRenderer: () =>
          React.createElement(AgentControl, { module: this }),
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

  getTextTriggerNamespaces(): TriggerNamespace[] {
    return [{
      id: 'agent',
      name: 'Agent',
      methods: {
        use: {
          id: 'use',
          name: 'Use Agent',
          description: 'Select and use a specific agent',
          argSchema: {
            minArgs: 1,
            maxArgs: 1,
            argTypes: ['string' as const]
          },
          handler: this.handleAgentUse
        }
      },
      moduleId: this.id
    }];
  }

  private handleAgentUse = async (args: string[], _context: TriggerExecutionContext) => {
    const agentId = args[0];
    const agent = this.allTemplates.find(t => t.id === agentId || t.name === agentId);
    if (agent) {
      // Parse key=value pairs from the rest of the args
      const formData: Record<string, any> = {};
      for (let i = 1; i < args.length; i++) {
        const [key, ...rest] = args[i].split("=");
        if (key && rest.length > 0) {
          formData[key] = rest.join("=");
        }
      }
      await this.applyAgent(agent.id, formData);
    }
  };

  destroy(_modApi: LiteChatModApi): void {
    // Clean up event listeners
    this.eventUnsubscribers.forEach((unsubscribe) => unsubscribe());
    this.eventUnsubscribers = [];

    // Clean up control registration
    if (this.unregisterPromptControlCallback) {
      this.unregisterPromptControlCallback();
      this.unregisterPromptControlCallback = null;
    }

    // Unregister text trigger namespaces
    const triggerNamespaces = this.getTextTriggerNamespaces();
    triggerNamespaces.forEach(namespace => {
      useControlRegistryStore.getState().unregisterTextTriggerNamespace(namespace.id);
    });

    // Clean up references
    this.modApiRef = null;
    this.notifyComponentUpdate = null;

    if (this.unregisterCallback) {
      this.unregisterCallback();
    }
  }
}
