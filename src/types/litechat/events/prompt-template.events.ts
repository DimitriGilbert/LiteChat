import type { PromptTemplate } from "@/types/litechat/prompt-template";

export const promptTemplateEvent = {
  // State change events
  promptTemplatesChanged: "prompt-template.prompts.changed",
  promptTemplateAdded: "prompt-template.added",
  promptTemplateUpdated: "prompt-template.updated",
  promptTemplateDeleted: "prompt-template.deleted",
  
  // Request events
  loadPromptTemplatesRequest: "prompt-template.load.request",
  addPromptTemplateRequest: "prompt-template.add.request",
  updatePromptTemplateRequest: "prompt-template.update.request",
  deletePromptTemplateRequest: "prompt-template.delete.request",
  selectPromptTemplateRequest: "prompt-template.select.request",
  compilePromptTemplateRequest: "prompt-template.compile.request",
} as const;

export interface PromptTemplateEventPayloads {
  [promptTemplateEvent.promptTemplatesChanged]: { 
    promptTemplates: PromptTemplate[] 
  };
  [promptTemplateEvent.promptTemplateAdded]: { 
    promptTemplate: PromptTemplate 
  };
  [promptTemplateEvent.promptTemplateUpdated]: { 
    promptTemplate: PromptTemplate 
  };
  [promptTemplateEvent.promptTemplateDeleted]: { 
    id: string 
  };
  [promptTemplateEvent.loadPromptTemplatesRequest]: {};
  [promptTemplateEvent.addPromptTemplateRequest]: { 
    promptTemplate: Omit<PromptTemplate, 'id' | 'createdAt' | 'updatedAt'> 
  };
  [promptTemplateEvent.updatePromptTemplateRequest]: { 
    id: string; 
    updates: Partial<Omit<PromptTemplate, 'id' | 'createdAt' | 'updatedAt'>> 
  };
  [promptTemplateEvent.deletePromptTemplateRequest]: { 
    id: string 
  };
  [promptTemplateEvent.selectPromptTemplateRequest]: {
    templateId: string;
    formData: Record<string, any>;
  };
  [promptTemplateEvent.compilePromptTemplateRequest]: {
    templateId: string;
    formData: Record<string, any>;
  };
} 