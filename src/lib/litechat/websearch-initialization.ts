// src/lib/litechat/websearch-initialization.ts

import { usePromptTemplateStore } from '@/store/prompt-template.store';
import { PersistenceService } from '@/services/persistence.service';
import { websearchPromptTemplates, WEBSEARCH_TEMPLATE_IDS } from './websearch-prompt-templates';
import type { WorkflowTemplate } from '@/types/litechat/workflow';

/**
 * Initialize the websearch system by setting up prompt templates and workflow templates
 */
export class WebSearchInitialization {
  private static isInitialized = false;

  /**
   * Initialize all websearch components
   */
  static async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('[WebSearchInitialization] Already initialized, skipping...');
      return;
    }

    try {
      console.log('[WebSearchInitialization] Starting websearch system initialization...');
      
      await this.initializePromptTemplates();
      await this.initializeWorkflowTemplates();
      
      this.isInitialized = true;
      console.log('[WebSearchInitialization] Websearch system initialized successfully');
    } catch (error) {
      console.error('[WebSearchInitialization] Failed to initialize websearch system:', error);
      throw error;
    }
  }

  /**
   * Initialize prompt templates for websearch
   */
  private static async initializePromptTemplates(): Promise<void> {
    const promptTemplateStore = usePromptTemplateStore.getState();
    const existingTemplates = promptTemplateStore.promptTemplates;

    for (const template of websearchPromptTemplates) {
      // Check if template already exists
      const existingTemplate = existingTemplates.find(t => 
        t.name === template.name || 
        t.tags.includes('websearch') && t.description === template.description
      );

      if (!existingTemplate) {
        try {
          await promptTemplateStore.addPromptTemplate(template);
          console.log(`[WebSearchInitialization] Added prompt template: ${template.name}`);
        } catch (error) {
          console.error(`[WebSearchInitialization] Failed to add prompt template ${template.name}:`, error);
        }
      } else {
        console.log(`[WebSearchInitialization] Prompt template already exists: ${template.name}`);
      }
    }
  }

  /**
   * Initialize workflow templates for websearch
   */
  private static async initializeWorkflowTemplates(): Promise<void> {
    try {
      const existingWorkflows = await PersistenceService.loadWorkflows();
      
      // Load workflow templates from JSON files
      const basicWorkflow = await this.loadWorkflowTemplate('/src/assets/workflows/basic-websearch.json');
      const deepWorkflow = await this.loadWorkflowTemplate('/src/assets/workflows/deep-websearch.json');
      
      const workflowsToAdd = [basicWorkflow, deepWorkflow].filter(Boolean) as WorkflowTemplate[];
      
      for (const workflow of workflowsToAdd) {
        const existingWorkflow = existingWorkflows.find(w => w.id === workflow.id);
        
        if (!existingWorkflow) {
          try {
            await PersistenceService.saveWorkflow(workflow);
            console.log(`[WebSearchInitialization] Added workflow template: ${workflow.name}`);
          } catch (error) {
            console.error(`[WebSearchInitialization] Failed to add workflow template ${workflow.name}:`, error);
          }
        } else {
          console.log(`[WebSearchInitialization] Workflow template already exists: ${workflow.name}`);
        }
      }
    } catch (error) {
      console.error('[WebSearchInitialization] Failed to initialize workflow templates:', error);
    }
  }

  /**
   * Load workflow template from JSON file
   */
  private static async loadWorkflowTemplate(path: string): Promise<WorkflowTemplate | null> {
    try {
      const response = await fetch(path);
      if (!response.ok) {
        throw new Error(`Failed to load workflow template: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`[WebSearchInitialization] Failed to load workflow template from ${path}:`, error);
      return null;
    }
  }

  /**
   * Update workflow templates with correct template IDs
   */
  static async updateWorkflowTemplateIds(): Promise<void> {
    try {
      const workflows = await PersistenceService.loadWorkflows();
      const promptTemplates = usePromptTemplateStore.getState().promptTemplates;
      
      // Create mapping of template names to IDs
      const templateIdMap: Record<string, string> = {};
      for (const template of promptTemplates) {
        if (template.tags.includes('websearch')) {
          if (template.name.includes('Query Generator')) {
            templateIdMap['websearch-query-generator'] = template.id;
          } else if (template.name.includes('Result Selector')) {
            templateIdMap['websearch-result-selector'] = template.id;
          } else if (template.name.includes('Content Condenser')) {
            templateIdMap['websearch-content-condenser'] = template.id;
          } else if (template.name.includes('Avenue Identifier')) {
            templateIdMap['websearch-avenue-identifier'] = template.id;
          } else if (template.name.includes('Result Synthesizer')) {
            templateIdMap['websearch-deep-synthesizer'] = template.id;
          }
        }
      }

      // Update workflow templates with correct template IDs
      for (const workflow of workflows) {
        if (workflow.id.includes('websearch')) {
          let updated = false;
          
          for (const step of workflow.steps) {
            if (step.templateId && templateIdMap[step.templateId]) {
              step.templateId = templateIdMap[step.templateId];
              updated = true;
            }
          }
          
          if (updated) {
            await PersistenceService.saveWorkflow(workflow);
            console.log(`[WebSearchInitialization] Updated template IDs for workflow: ${workflow.name}`);
          }
        }
      }
    } catch (error) {
      console.error('[WebSearchInitialization] Failed to update workflow template IDs:', error);
    }
  }

  /**
   * Check if websearch system is initialized
   */
  static isWebSearchInitialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Reset initialization state (for testing)
   */
  static reset(): void {
    this.isInitialized = false;
  }
}

/**
 * Auto-initialize websearch system when this module is imported
 * DISABLED - Now handled by WorkflowWebSearchControlModule
 */
export const initializeWebSearch = () => {
  // DISABLED - initialization now handled by control module
  // setTimeout(() => {
  //   WebSearchInitialization.initialize().catch(error => {
  //     console.error('[WebSearchInitialization] Auto-initialization failed:', error);
  //   });
  // }, 1000);
};

// Export template IDs for use in other modules
export { WEBSEARCH_TEMPLATE_IDS };