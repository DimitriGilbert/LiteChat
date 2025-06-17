import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { nanoid } from "nanoid";
import { emitter } from "@/lib/litechat/event-emitter";
import { toast } from "sonner";
import { PersistenceService } from "@/services/persistence.service";
import type { PromptTemplate, CompiledPrompt, PromptFormData, PromptTemplateType } from "@/types/litechat/prompt-template";
import type { RegisteredActionHandler } from "@/types/litechat/control";
import { promptTemplateEvent } from "@/types/litechat/events/prompt-template.events";
import { compilePromptTemplate as compileUtil } from '@/lib/litechat/prompt-util';

interface PromptTemplateState {
  promptTemplates: PromptTemplate[];
  loading: boolean;
  error: string | null;
}

interface PromptTemplateActions {
  loadPromptTemplates: () => Promise<void>;
  addPromptTemplate: (template: Omit<PromptTemplate, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updatePromptTemplate: (id: string, updates: Partial<Omit<PromptTemplate, 'id' | 'createdAt' | 'updatedAt'>>) => Promise<void>;
  deletePromptTemplate: (id: string) => Promise<void>;
  compilePromptTemplate: (templateId: string, formData: PromptFormData) => Promise<CompiledPrompt>;
  // Helper methods for new functionality
  getTemplatesByType: (type: PromptTemplateType) => PromptTemplate[];
  getAgents: () => PromptTemplate[];
  getTasksForAgent: (agentId: string) => PromptTemplate[];
  getAvailableFollowUps: (templateId: string, type: PromptTemplateType) => PromptTemplate[];
  getRegisteredActionHandlers: () => RegisteredActionHandler[];
}

export const usePromptTemplateStore = create(
  immer<PromptTemplateState & PromptTemplateActions>((set, get) => ({
    // State
    promptTemplates: [],
    loading: false,
    error: null,

    // Actions
    loadPromptTemplates: async () => {
      set((state) => {
        state.loading = true;
        state.error = null;
      });

      try {
        const templates = await PersistenceService.loadPromptTemplates();
        set((state) => {
          state.promptTemplates = templates;
          state.loading = false;
        });

        emitter.emit(promptTemplateEvent.promptTemplatesChanged, { promptTemplates: templates });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to load prompt templates";
        set((state) => {
          state.error = errorMessage;
          state.loading = false;
        });
        toast.error(errorMessage);
      }
    },

    addPromptTemplate: async (templateData) => {
      const newTemplate: PromptTemplate = {
        id: nanoid(),
        createdAt: new Date(),
        updatedAt: new Date(),
        ...templateData,
      };

      // Optimistic update
      set((state) => {
        state.promptTemplates.push(newTemplate);
      });

      try {
        await PersistenceService.savePromptTemplate(newTemplate);
        emitter.emit(promptTemplateEvent.promptTemplateAdded, { promptTemplate: newTemplate });
        toast.success("Prompt template created successfully");
        return newTemplate.id;
      } catch (error) {
        // Rollback optimistic update
        set((state) => {
          state.promptTemplates = state.promptTemplates.filter(t => t.id !== newTemplate.id);
        });
        const errorMessage = error instanceof Error ? error.message : "Failed to create prompt template";
        set((state) => { state.error = errorMessage; });
        toast.error(errorMessage);
        throw error;
      }
    },

    updatePromptTemplate: async (id, updates) => {
      const existingTemplate = get().promptTemplates.find(t => t.id === id);
      if (!existingTemplate) {
        toast.error("Prompt template not found");
        return;
      }

      const updatedTemplate: PromptTemplate = {
        ...existingTemplate,
        ...updates,
        updatedAt: new Date(),
      };

      // Optimistic update
      set((state) => {
        const index = state.promptTemplates.findIndex(t => t.id === id);
        if (index !== -1) {
          state.promptTemplates[index] = updatedTemplate;
        }
      });

      try {
        await PersistenceService.savePromptTemplate(updatedTemplate);
        emitter.emit(promptTemplateEvent.promptTemplateUpdated, { promptTemplate: updatedTemplate });
        toast.success("Prompt template updated successfully");
      } catch (error) {
        // Rollback optimistic update
        set((state) => {
          const index = state.promptTemplates.findIndex(t => t.id === id);
          if (index !== -1) {
            state.promptTemplates[index] = existingTemplate;
          }
        });
        const errorMessage = error instanceof Error ? error.message : "Failed to update prompt template";
        set((state) => { state.error = errorMessage; });
        toast.error(errorMessage);
        throw error;
      }
    },

    deletePromptTemplate: async (id) => {
      const templateToDelete = get().promptTemplates.find(t => t.id === id);
      if (!templateToDelete) {
        toast.error("Prompt template not found");
        return;
      }

      // Optimistic update
      set((state) => {
        state.promptTemplates = state.promptTemplates.filter(t => t.id !== id);
      });

      try {
        await PersistenceService.deletePromptTemplate(id);
        emitter.emit(promptTemplateEvent.promptTemplateDeleted, { id });
        toast.success("Prompt template deleted successfully");
      } catch (error) {
        // Rollback optimistic update
        set((state) => {
          state.promptTemplates.push(templateToDelete);
        });
        const errorMessage = error instanceof Error ? error.message : "Failed to delete prompt template";
        set((state) => { state.error = errorMessage; });
        toast.error(errorMessage);
        throw error;
      }
    },

    compilePromptTemplate: async (templateId, formData) => {
      const template = get().promptTemplates.find(t => t.id === templateId);
      if (!template) {
        throw new Error("Template not found");
      }

      try {
        return await compileUtil(template, formData);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to compile prompt template";
        toast.error(errorMessage);
        throw error;
      }
    },

    // Helper methods for new functionality
    getTemplatesByType: (type: PromptTemplateType) => {
      return get().promptTemplates.filter(template => (template.type || "prompt") === type);
    },

    getAgents: () => {
      return get().promptTemplates.filter(template => (template.type || "prompt") === "agent");
    },

    getTasksForAgent: (agentId: string) => {
      return get().promptTemplates.filter(template => 
        (template.type || "prompt") === "task" && template.parentId === agentId
      );
    },

    getAvailableFollowUps: (templateId: string, type: PromptTemplateType) => {
      const templates = get().promptTemplates;
      const currentTemplate = templates.find(t => t.id === templateId);
      
      if (type === "task" && currentTemplate?.parentId) {
        // For tasks, only show other tasks with the same parentId
        return templates.filter(t => 
          (t.type || "prompt") === "task" && 
          t.parentId === currentTemplate.parentId && 
          t.id !== templateId
        );
      } else {
        // For prompts and agents, show all prompts
        return templates.filter(t => (t.type || "prompt") === "prompt" && t.id !== templateId);
      }
    },

    getRegisteredActionHandlers: (): RegisteredActionHandler[] => {
      const actions = get();
      return [
        {
          eventName: promptTemplateEvent.loadPromptTemplatesRequest,
          handler: () => actions.loadPromptTemplates(),
          storeId: "promptTemplateStore",
        },
        {
          eventName: promptTemplateEvent.addPromptTemplateRequest,
          handler: async (payload) => {
            await actions.addPromptTemplate(payload.promptTemplate);
          },
          storeId: "promptTemplateStore",
        },
        {
          eventName: promptTemplateEvent.updatePromptTemplateRequest,
          handler: (payload) => actions.updatePromptTemplate(payload.id, payload.updates),
          storeId: "promptTemplateStore",
        },
        {
          eventName: promptTemplateEvent.deletePromptTemplateRequest,
          handler: (payload) => actions.deletePromptTemplate(payload.id),
          storeId: "promptTemplateStore",
        },
        {
          eventName: promptTemplateEvent.compilePromptTemplateRequest,
          handler: async (payload) => {
            await actions.compilePromptTemplate(payload.templateId, payload.formData);
          },
          storeId: "promptTemplateStore",
        },
      ];
    },
  }))
); 