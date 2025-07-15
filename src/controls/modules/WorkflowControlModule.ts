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
import { emitter } from "@/lib/litechat/event-emitter";
import { useControlRegistryStore } from "@/store/control.store";
import type { TriggerNamespace, TriggerExecutionContext } from "@/types/litechat/text-triggers";

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

    // Subscribe to workflow update events
    const unsubWorkflowUpdateRequest = modApi.on(
      workflowEvent.updateWorkflowRequest,
      async (payload) => {
        await this.updateWorkflow(payload.id, payload.updates);
      }
    );

    this.eventUnsubscribers.push(
      unsubGloballyEnabledModelsUpdated,
      unsubInitialDataLoaded,
      unsubTemplatesChanged,
      unsubWorkflowUpdateRequest
    );

    // Request templates on initialization
    modApi.emit(promptTemplateEvent.loadPromptTemplatesRequest, {});
    
    // Load workflows
    await this.loadWorkflows();
  }

  getTextTriggerNamespaces(): TriggerNamespace[] {
    return [{
      id: 'workflow',
      name: 'Workflow',
      methods: {
        run: {
          id: 'run',
          name: 'Run Workflow',
          description: 'Execute a specific workflow',
          argSchema: {
            minArgs: 1,
            maxArgs: 1,
            argTypes: ['string' as const]
          },
          handler: this.handleWorkflowRun
        }
      },
      moduleId: this.id
    }];
  }

  private handleWorkflowRun = async (args: string[], context: TriggerExecutionContext) => {
    const workflowId = args[0];
    const workflow = this.workflows.find(w => w.id === workflowId || w.name === workflowId);
    
    if (workflow) {
      // Start the workflow with the current prompt content
      this.startWorkflow(workflow, context.turnData.content);
      // Clear the content since the workflow will handle the prompt
      context.turnData.content = '';
    }
  };

  destroy(): void {
    this.eventUnsubscribers.forEach((unsub) => unsub());
    this.eventUnsubscribers = [];

    // Unregister text trigger namespaces
    const triggerNamespaces = this.getTextTriggerNamespaces();
    triggerNamespaces.forEach(namespace => {
      useControlRegistryStore.getState().unregisterTextTriggerNamespace(namespace.id);
    });

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

  // Template compilation method for preview functionality
  async compileTemplate(templateId: string, formData: Record<string, any> = {}): Promise<{ content: string; selectedTools?: string[]; selectedRules?: string[]; }> {
    const { compilePromptTemplate } = usePromptTemplateStore.getState();
    return await compilePromptTemplate(templateId, formData);
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

  // Validate transform queries against a sample context
  validateTransformQuery(query: string, workflow?: WorkflowTemplate, stepIndex?: number): { isValid: boolean; error?: string; result?: any } {
    if (!query.trim()) {
      return { isValid: false, error: 'Query cannot be empty' };
    }
    
    // Basic JSONPath validation
    if (!query.startsWith('$.')) {
      return { isValid: false, error: 'Query must start with "$."' };
    }
    
    // Check for invalid characters or patterns
    const invalidChars = /[^a-zA-Z0-9_.$\[\]]/;
    if (invalidChars.test(query.replace(/\[(\d+)\]/g, ''))) {
      return { isValid: false, error: 'Invalid characters in query' };
    }
    
    // Build realistic sample context based on actual workflow
    const sampleContext = this._buildRealisticSampleContext(workflow, stepIndex);
    
    // Test the query against the sample context
    try {
      const result = this._resolveJsonPath(sampleContext, query);
      return { isValid: true, result };
    } catch (error) {
      return { isValid: false, error: `Query execution failed: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  }

  // Build realistic sample context based on actual workflow and form data
  private _buildRealisticSampleContext(workflow?: WorkflowTemplate, stepIndex?: number): Record<string, any> {
    // Keep original workflow template intact - NO TRANSFORMATIONS
    const context: Record<string, any> = {
      workflow: workflow || {
        id: 'sample-workflow',
        name: 'Sample Workflow',
        description: 'A sample workflow for validation',
        triggerType: 'custom',
        triggerPrompt: 'Sample initial prompt',
        steps: [],
      }
    };

    // Build initial_step data - this should be RAW AI OUTPUT, not template metadata!
    let initialStepData: any = {};
    
    if (workflow) {
      // Check if first step is a transform to determine if we should show raw text or structured data
      const firstStep = workflow.steps[0];
      const isNextStepTransform = firstStep?.type === 'transform';
      
      if (isNextStepTransform) {
        // Next step is transform - show RAW TEXT output (no structured format)
        initialStepData = "Sample AI response text that would be output by the initial step. This is raw, unstructured text that the transform step will process using JSONPath queries to extract specific data.";
      } else {
        // Next step needs structured data - show structured output
        if (workflow.triggerType === 'custom') {
          initialStepData = {
            analysis: "Sample analysis of the custom prompt",
            key_points: ["point 1", "point 2", "point 3"],
            confidence: 0.85
          };
        } else if (workflow.triggerType === 'template' && workflow.triggerRef) {
          const template = this.allTemplates.find(t => t.id === workflow.triggerRef);
          initialStepData = {
            summary: `Sample output from template: ${template?.name || 'Selected Template'}`,
            extracted_data: "Sample extracted information",
            status: "completed"
          };
        } else if (workflow.triggerType === 'task' && workflow.triggerRef) {
          const task = this.allTemplates.find(t => t.id === workflow.triggerRef);
          initialStepData = {
            result: `Sample result from agent task: ${task?.name || 'Selected Task'}`,
            recommendations: ["rec 1", "rec 2"],
            next_actions: "Sample next actions"
          };
        }
      }
    } else {
      // Fallback sample - assume transform step to show raw text
      initialStepData = "Sample AI response text for validation purposes.";
    }
    
    context.initial_step = initialStepData;

    // Build outputs array with proper indexing - limit to previous steps only
    const outputs: any[] = [];
    
    // outputs[0] = initial_step (trigger output)
    outputs[0] = initialStepData;
    
    // Generate realistic previous step outputs based on workflow steps
    if (workflow && stepIndex !== undefined) {
      for (let i = 0; i < stepIndex; i++) {
        const step = workflow.steps[i];
        let stepOutput: any = {};
        
        // Check if the NEXT step (i+1) is a transform to determine output format
        const nextStepAfterThis = workflow.steps[i + 1];
        const isNextStepTransform = nextStepAfterThis?.type === 'transform';
        
        if (step.type === 'prompt' || step.type === 'agent-task') {
          if (isNextStepTransform) {
            // Next step is transform - provide RAW TEXT output
            stepOutput = `Sample AI response from ${step.name}. This is the raw text output that would be generated by the AI model when processing this step. It contains unstructured information that the transform step will extract using JSONPath queries.`;
          } else {
            // Next step needs structured data
            const template = this.allTemplates.find(t => t.id === step.templateId);
            if (template?.variables) {
              // Create sample outputs based on template variables
              stepOutput = template.variables.reduce((acc: any, variable: any) => {
                switch (variable.type) {
                  case 'number':
                    acc[variable.name] = 42;
                    break;
                  case 'boolean':
                    acc[variable.name] = true;
                    break;
                  case 'array':
                    acc[variable.name] = ['item1', 'item2'];
                    break;
                  case 'object':
                    acc[variable.name] = { nested: 'value' };
                    break;
                  default:
                    acc[variable.name] = `Sample ${variable.name}`;
                }
                return acc;
              }, {});
            } else {
              stepOutput = {
                result: `Sample output from ${step.name}`,
                step_type: step.type,
                step_name: step.name
              };
            }
          }
        } else if (step.type === 'transform') {
          stepOutput = {
            transformed_data: 'Sample transformed data',
            step_type: 'transform',
            step_name: step.name
          };
        } else if (step.type === 'human-in-the-loop') {
          stepOutput = {
            human_input: 'Sample human review result',
            approved: true,
            step_type: 'human-in-the-loop',
            step_name: step.name
          };
        }
        
        // outputs[1] = step0, outputs[2] = step1, etc.
        outputs[i + 1] = stepOutput;
      }
    } else {
      // Default sample previous steps - assume no transform for now
      outputs[1] = { 
        analysis: 'Sample analysis result', 
        confidence: 0.85,
        entities: ['entity1', 'entity2']
      };
      outputs[2] = { 
        summary: 'Sample summary from step 1', 
        items: ['processed_item1', 'processed_item2'],
        metadata: { source: 'step1', timestamp: '2024-01-01T00:00:00Z' }
      };
    }

    // Add outputs array to context
    context.outputs = outputs;

    return context;
  }

  // Helper method for JSONPath resolution (copied from WorkflowService)
  private _resolveJsonPath(obj: any, path: string): any {
    if (path.startsWith('$.')) path = path.substring(2);
    
    try {
      return path.split('.').reduce((acc, part) => {
        if (acc === null || acc === undefined) return undefined;
        if (part.includes('[') && part.includes(']')) {
          const [prop, indexStr] = part.split('[');
          const index = parseInt(indexStr.replace(']', ''));
          return acc[prop]?.[index];
        }
        return acc[part];
      }, obj);
    } catch (error) {
      throw new Error(`JSONPath resolution failed for ${path}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  register(modApi: LiteChatModApi): void {
    this.modApi = modApi;

    // Register text trigger namespaces
    const triggerNamespaces = this.getTextTriggerNamespaces();
    triggerNamespaces.forEach(namespace => {
      useControlRegistryStore.getState().registerTextTriggerNamespace(namespace);
    });

    modApi.registerPromptControl({
      id: this.id,
      status: () => "ready",
      triggerRenderer: () => React.createElement(WorkflowBuilder, { module: this }),
    });
  }

  // Add updateWorkflow method for event-driven updates
  async updateWorkflow(id: string, updates: Partial<WorkflowTemplate>): Promise<void> {
    try {
      // Find the workflow to update
      const workflowIndex = this.workflows.findIndex(w => w.id === id);
      if (workflowIndex === -1) {
        console.error(`[WorkflowControlModule] Workflow with id ${id} not found`);
        return;
      }

      // Update the workflow
      const updatedWorkflow = {
        ...this.workflows[workflowIndex],
        ...updates,
        updatedAt: new Date().toISOString()
      };

      // Save to persistence
      await PersistenceService.saveWorkflow(updatedWorkflow);
      
      // Update local state
      this.workflows[workflowIndex] = updatedWorkflow;
      this.notifyComponentUpdate?.();

      // Emit update event
      emitter.emit(workflowEvent.workflowUpdated, { id, updates });
    } catch (error) {
      console.error('[WorkflowControlModule] Failed to update workflow:', error);
      toast.error('Failed to update workflow');
    }
  }

  // Get shortcut workflows for hover display
  getShortcutWorkflows(): WorkflowTemplate[] {
    return this.workflows.filter(workflow => workflow.isShortcut === true);
  }

  // Check if any interactions are currently streaming
  getIsStreaming(): boolean {
    return useInteractionStore.getState().streamingInteractionIds.length > 0;
  }
} 