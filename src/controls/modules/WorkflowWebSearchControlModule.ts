import React from "react";
import { nanoid } from "nanoid";
import { type ControlModule } from "@/types/litechat/control";
import { type LiteChatModApi } from "@/types/litechat/modding";
import { emitter } from "@/lib/litechat/event-emitter";
import { interactionEvent } from "@/types/litechat/events/interaction.events";
import { workflowEvent } from "@/types/litechat/events/workflow.events";
import { webSearchEvent } from "@/types/litechat/events/websearch.events";
import { WorkflowWebSearchControlTrigger } from "../components/workflow-websearch/WorkflowWebSearchControlTrigger";
import { useInteractionStore } from "@/store/interaction.store";
import { PersistenceService } from "@/services/persistence.service";
import { websearchPromptTemplates, WEBSEARCH_TEMPLATE_IDS } from "@/lib/litechat/websearch-prompt-templates";
import type { 
  WebSearchConfig, 
  DeepSearchConfig, 
  SearchOperation 
} from "@/types/litechat/websearch";

export class WorkflowWebSearchControlModule implements ControlModule {
  readonly id = "workflow-web-search";
  private unregisterCallback: (() => void) | null = null;
  private eventUnsubscribers: (() => void)[] = [];
  private modApiRef: LiteChatModApi | null = null;

  // Configuration state
  private searchConfig: WebSearchConfig = {
    maxResults: 5,
    searchDepth: 1,
    enableImageSearch: false,
    condensationEnabled: true,
    delayBetweenRequests: 1000,
    maxContentLength: 10000,
    persistAcrossSubmissions: false,
    region: 'us-en',
    safeSearch: 'moderate'
  };

  private deepSearchConfig: DeepSearchConfig = {
    enabled: false,
    maxDepth: 2,
    avenuesPerDepth: 3
  };

  // UI state
  private isEnabled = false;
  private selectedWorkflow = "basic-websearch";
  private isStreaming = false;

  // Runtime state
  private activeSearches = new Map<string, SearchOperation>();
  private notifyComponentUpdate: (() => void) | null = null;

  async initialize(modApi: LiteChatModApi): Promise<void> {
    this.modApiRef = modApi;
    this.isStreaming = useInteractionStore.getState().status === "streaming";
    
    // Load saved configuration from localStorage
    this.loadConfiguration();
    
    // Register websearch prompt templates and workflows
    await this.registerPromptTemplates();
    await this.registerWorkflowTemplates();
    
    // Subscribe to relevant events
    const unsubStatus = modApi.on(interactionEvent.statusChanged, (payload) => {
      if (typeof payload === "object" && payload && "status" in payload) {
        if (this.isStreaming !== (payload.status === "streaming")) {
          this.isStreaming = payload.status === "streaming";
          this.notifyComponentUpdate?.();
        }
      }
    });

    const unsubWorkflowCompleted = modApi.on(workflowEvent.completed, (payload) => {
      if (typeof payload === "object" && payload && "runId" in payload) {
        // Check if this was a websearch workflow
        const search = Array.from(this.activeSearches.values()).find(s => s.id === payload.runId);
        if (search) {
          this.handleSearchCompleted(search.id, payload);
        }
      }
    });

    const unsubWorkflowError = modApi.on(workflowEvent.error, (payload) => {
      if (typeof payload === "object" && payload && "runId" in payload) {
        const search = Array.from(this.activeSearches.values()).find(s => s.id === payload.runId);
        if (search) {
          this.handleSearchFailed(search.id, payload.error || "Workflow failed");
        }
      }
    });

    this.eventUnsubscribers.push(unsubStatus, unsubWorkflowCompleted, unsubWorkflowError);
    this.notifyComponentUpdate?.();
  }

  private loadConfiguration(): void {
    try {
      const savedConfig = localStorage.getItem('workflow-websearch-config');
      if (savedConfig) {
        const parsed = JSON.parse(savedConfig);
        this.searchConfig = { ...this.searchConfig, ...parsed.searchConfig };
        this.deepSearchConfig = { ...this.deepSearchConfig, ...parsed.deepSearchConfig };
        this.selectedWorkflow = parsed.selectedWorkflow || this.selectedWorkflow;
      }
    } catch (error) {
      console.warn('Failed to load websearch configuration:', error);
    }
  }

  private saveConfiguration(): void {
    try {
      const config = {
        searchConfig: this.searchConfig,
        deepSearchConfig: this.deepSearchConfig,
        selectedWorkflow: this.selectedWorkflow
      };
      localStorage.setItem('workflow-websearch-config', JSON.stringify(config));
    } catch (error) {
      console.warn('Failed to save websearch configuration:', error);
    }
  }

  private async registerPromptTemplates(): Promise<void> {
    try {
      // Update cutoff date - templates older than this will be updated
      const UPDATE_CUTOFF_DATE = new Date('2025-07-14T19:02:00Z');
      
      const existingTemplates = await PersistenceService.loadPromptTemplates();
      const templateIds = Object.values(WEBSEARCH_TEMPLATE_IDS);
      
      for (let i = 0; i < websearchPromptTemplates.length; i++) {
        const template = websearchPromptTemplates[i];
        const templateId = templateIds[i];
        
        // Check for existing template by ID or name (to handle duplicates)
        const existingById = existingTemplates.find(t => t.id === templateId);
        const existingByName = existingTemplates.find(t => t.name === template.name);
        const existing = existingById || existingByName;
        
        if (!existing) {
          // Register new template
          const fullTemplate = {
            id: templateId,
            createdAt: new Date(),
            updatedAt: new Date(),
            ...template
          };
          
          await PersistenceService.savePromptTemplate(fullTemplate);
          console.log(`[${this.id}] Registered new prompt template: ${templateId}`);
        } else if (existing.updatedAt < UPDATE_CUTOFF_DATE) {
          // Update existing template if it's older than cutoff
          if (existing.id !== templateId) {
            // Delete old template with wrong ID first
            await PersistenceService.deletePromptTemplate(existing.id);
          }
          
          const updatedTemplate = {
            ...existing,
            ...template,
            id: templateId, // Ensure correct ID
            updatedAt: new Date()
          };
          
          await PersistenceService.savePromptTemplate(updatedTemplate);
          console.log(`[${this.id}] Updated prompt template: ${templateId} (was: ${existing.id})`);
        }
      }
    } catch (error) {
      console.warn(`[${this.id}] Failed to register prompt templates:`, error);
    }
  }

  private async registerWorkflowTemplates(): Promise<void> {
    try {
      // Load workflow templates from public assets
      const basicWorkflowResponse = await fetch('/assets/workflows/basic-websearch.json');
      const deepWorkflowResponse = await fetch('/assets/workflows/deep-websearch.json');
      
      if (basicWorkflowResponse.ok && deepWorkflowResponse.ok) {
        const basicWorkflow = await basicWorkflowResponse.json();
        const deepWorkflow = await deepWorkflowResponse.json();
        
        // Check if workflows are already registered
        const existingWorkflows = await PersistenceService.loadWorkflows();
        
        if (!existingWorkflows.some(w => w.id === 'basic-websearch')) {
          await PersistenceService.saveWorkflow(basicWorkflow);
          console.log(`[${this.id}] Registered workflow template: basic-websearch`);
        }
        
        if (!existingWorkflows.some(w => w.id === 'deep-websearch')) {
          await PersistenceService.saveWorkflow(deepWorkflow);
          console.log(`[${this.id}] Registered workflow template: deep-websearch`);
        }
      }
    } catch (error) {
      console.warn(`[${this.id}] Failed to register workflow templates:`, error);
    }
  }

  private handleSearchCompleted(searchId: string, payload: any): void {
    const search = this.activeSearches.get(searchId);
    if (search) {
      search.status = 'completed';
      search.endTime = new Date().toISOString();
      
      emitter.emit(webSearchEvent.searchCompleted, {
        searchId,
        operation: search,
        results: payload.results || [],
        totalTime: new Date(search.endTime).getTime() - new Date(search.startTime).getTime()
      });
      
      this.activeSearches.delete(searchId);
      this.notifyComponentUpdate?.();
    }
  }

  private handleSearchFailed(searchId: string, error: string): void {
    const search = this.activeSearches.get(searchId);
    if (search) {
      search.status = 'failed';
      search.error = error;
      search.endTime = new Date().toISOString();
      
      emitter.emit(webSearchEvent.searchFailed, {
        searchId,
        operation: search,
        error
      });
      
      this.activeSearches.delete(searchId);
      this.notifyComponentUpdate?.();
    }
  }

  // Public API methods
  public getIsEnabled = (): boolean => this.isEnabled;
  public getIsStreaming = (): boolean => this.isStreaming;

  public getSelectedWorkflow = (): string => this.selectedWorkflow;
  public getSearchConfig = (): WebSearchConfig => ({ ...this.searchConfig });
  public getDeepSearchConfig = (): DeepSearchConfig => ({ ...this.deepSearchConfig });
  public getActiveSearches = (): SearchOperation[] => Array.from(this.activeSearches.values());

  public toggleEnabled = (): void => {
    this.isEnabled = !this.isEnabled;
    this.notifyComponentUpdate?.();
  };

  public setEnabled = (enabled: boolean): void => {
    this.isEnabled = enabled;
    this.notifyComponentUpdate?.();
  };



  public updateSearchConfig = (config: Partial<WebSearchConfig>): void => {
    const oldConfig = { ...this.searchConfig };
    this.searchConfig = { ...this.searchConfig, ...config };
    this.saveConfiguration();
    
    emitter.emit(webSearchEvent.configUpdated, {
      oldConfig,
      newConfig: this.searchConfig,
      changedFields: Object.keys(config)
    });
    
    this.notifyComponentUpdate?.();
  };

  public updateDeepSearchConfig = (config: Partial<DeepSearchConfig>): void => {
    this.deepSearchConfig = { ...this.deepSearchConfig, ...config };
    this.saveConfiguration();
    this.notifyComponentUpdate?.();
  };

  public selectWorkflow = (workflowId: string): void => {
    this.selectedWorkflow = workflowId;
    this.saveConfiguration();
    
    emitter.emit(webSearchEvent.workflowSelected, {
      workflowId,
      workflowName: this.getWorkflowName(workflowId)
    });
    
    this.notifyComponentUpdate?.();
  };

  public startSearch = async (query: string): Promise<void> => {
    if (!this.modApiRef) {
      throw new Error('Module not initialized');
    }

    const searchId = nanoid();
    const conversationId = useInteractionStore.getState().currentConversationId || nanoid();
    
    const searchOperation: SearchOperation = {
      id: searchId,
      conversationId,
      originalQuery: query,
      config: { ...this.searchConfig },
      deepSearchConfig: this.deepSearchConfig.enabled ? { ...this.deepSearchConfig } : undefined,
      steps: [],
      status: 'initializing',
      startTime: new Date().toISOString(),
      totalResults: 0,
      selectedWorkflow: this.selectedWorkflow
    };

    this.activeSearches.set(searchId, searchOperation);
    
    emitter.emit(webSearchEvent.searchStarted, {
      searchId,
      operation: searchOperation
    });

    try {
      // Load workflow templates
      const workflows = await PersistenceService.loadWorkflows();
      const workflowTemplate = workflows.find(t => t.id === this.selectedWorkflow);
      
      if (!workflowTemplate) {
        throw new Error(`Workflow template not found: ${this.selectedWorkflow}`);
      }

      // Update search operation status
      searchOperation.status = 'running';
      
      // Trigger the workflow with the search query
      this.modApiRef.emit(workflowEvent.startRequest, {
        template: workflowTemplate,
        initialPrompt: query,
        conversationId
      });

      this.notifyComponentUpdate?.();
    } catch (error) {
      this.handleSearchFailed(searchId, error instanceof Error ? error.message : 'Unknown error');
    }
  };

  public cancelSearch = (searchId: string): void => {
    const search = this.activeSearches.get(searchId);
    if (search) {
      search.status = 'cancelled';
      search.endTime = new Date().toISOString();
      
      emitter.emit(webSearchEvent.searchCancelled, {
        searchId,
        operation: search
      });
      
      this.activeSearches.delete(searchId);
      this.notifyComponentUpdate?.();
    }
  };

  public setNotifyCallback = (cb: (() => void) | null): void => {
    this.notifyComponentUpdate = cb;
  };

  private getWorkflowName(workflowId: string): string {
    const workflowNames: Record<string, string> = {
      'basic-websearch': 'Basic Web Search',
      'deep-websearch': 'Deep Web Search',
      'research-websearch': 'Research Web Search'
    };
    return workflowNames[workflowId] || workflowId;
  }

  register(modApi: LiteChatModApi): void {
    this.modApiRef = modApi;
    if (this.unregisterCallback) {
      console.warn(`[${this.id}] Already registered. Skipping.`);
      return;
    }

    this.unregisterCallback = modApi.registerPromptControl({
      id: this.id,
      status: () => "ready",
      triggerRenderer: () => React.createElement(WorkflowWebSearchControlTrigger, { module: this }),
      getMetadata: () => this.isEnabled ? {
        workflowWebSearchEnabled: true,
        searchConfig: this.searchConfig,
        selectedWorkflow: this.selectedWorkflow,
        activeSearches: this.activeSearches.size
      } : undefined,
      clearOnSubmit: () => {
        if (!this.searchConfig.persistAcrossSubmissions) {
          this.isEnabled = false;
          this.notifyComponentUpdate?.();
        }
      }
    });
  }

  destroy(): void {
    this.eventUnsubscribers.forEach((unsub) => unsub());
    this.eventUnsubscribers = [];
    
    if (this.unregisterCallback) {
      this.unregisterCallback();
      this.unregisterCallback = null;
    }
    
    // Cancel any active searches
    for (const searchId of this.activeSearches.keys()) {
      this.cancelSearch(searchId);
    }
    
    this.notifyComponentUpdate = null;
    this.modApiRef = null;
    console.log(`[${this.id}] Destroyed.`);
  }
}