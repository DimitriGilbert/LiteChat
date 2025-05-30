// src/store/rules.store.ts
// FULL FILE
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { DbRule, DbTag, DbTagRuleLink } from "@/types/litechat/rules";
import { PersistenceService } from "@/services/persistence.service";
import { nanoid } from "nanoid";
import { toast } from "sonner";
import { emitter } from "@/lib/litechat/event-emitter";
import {
  rulesEvent,
  RulesEventPayloads,
} from "@/types/litechat/events/rules.events";
import type {
  RegisteredActionHandler,
  ActionHandler,
} from "@/types/litechat/control";

interface RulesState {
  rules: DbRule[];
  tags: DbTag[];
  tagRuleLinks: DbTagRuleLink[];
  isLoading: boolean;
  error: string | null;
}

interface RulesActions {
  loadRulesAndTags: () => Promise<void>;
  addRule: (
    ruleData: Omit<DbRule, "id" | "createdAt" | "updatedAt">
  ) => Promise<string>;
  updateRule: (
    id: string,
    updates: Partial<Omit<DbRule, "id" | "createdAt">>
  ) => Promise<void>;
  deleteRule: (id: string) => Promise<void>;
  addTag: (
    tagData: Omit<DbTag, "id" | "createdAt" | "updatedAt">
  ) => Promise<string>;
  updateTag: (
    id: string,
    updates: Partial<Omit<DbTag, "id" | "createdAt">>
  ) => Promise<void>;
  deleteTag: (id: string) => Promise<void>;
  linkTagToRule: (tagId: string, ruleId: string) => Promise<void>;
  unlinkTagFromRule: (tagId: string, ruleId: string) => Promise<void>;
  getRulesForTag: (tagId: string) => DbRule[];
  getTagsForRule: (ruleId: string) => DbTag[];
  getRuleById: (ruleId: string) => DbRule | undefined;
  getTagById: (tagId: string) => DbTag | undefined;
  getRulesByIds: (ruleIds: string[]) => DbRule[];
  getRegisteredActionHandlers: () => RegisteredActionHandler[];
}

export const useRulesStore = create(
  immer<RulesState & RulesActions>((set, get) => ({
    rules: [],
    tags: [],
    tagRuleLinks: [],
    isLoading: false,
    error: null,

    loadRulesAndTags: async () => {
      set({ isLoading: true, error: null });
      try {
        const [dbRules, dbTags, dbLinks] = await Promise.all([
          PersistenceService.loadRules(),
          PersistenceService.loadTags(),
          PersistenceService.loadTagRuleLinks(),
        ]);
        set({
          rules: dbRules,
          tags: dbTags,
          tagRuleLinks: dbLinks,
          isLoading: false,
        });
        emitter.emit(rulesEvent.dataLoaded, {
          rules: dbRules,
          tags: dbTags,
          links: dbLinks,
        });
      } catch (e) {
        console.error("RulesStore: Error loading rules and tags", e);
        set({ error: "Failed load rules/tags", isLoading: false });
        toast.error("Failed to load rules and tags.");
        emitter.emit(rulesEvent.loadingStateChanged, {
          isLoading: false,
          error: "Failed load rules/tags",
        });
      }
    },

    addRule: async (ruleData) => {
      const newId = nanoid();
      const now = new Date();
      const newRule: DbRule = {
        id: newId,
        createdAt: now,
        updatedAt: now,
        ...ruleData,
      };
      set((state) => {
        state.rules.push(newRule);
        state.rules.sort((a, b) => a.name.localeCompare(b.name));
      });
      try {
        await PersistenceService.saveRule(newRule);
        toast.success(`Rule "${newRule.name}" added.`);
        emitter.emit(rulesEvent.ruleSaved, { rule: newRule });
        
        const { rules, tags, tagRuleLinks } = get();
        emitter.emit(rulesEvent.dataLoaded, { 
          rules: [...rules],
          tags: [...tags],
          links: [...tagRuleLinks]
        });
        return newId;
      } catch (e) {
        console.error("RulesStore: Error adding rule", e);
        set((state) => ({
          error: "Failed to save new rule",
          rules: state.rules.filter((r) => r.id !== newId),
        }));
        toast.error("Failed to save new rule.");
        throw e;
      }
    },

    updateRule: async (id, updates) => {
      const originalRule = get().rules.find((r) => r.id === id);
      if (!originalRule) {
        toast.error("Rule not found for update.");
        throw new Error("Rule not found");
      }

      const updatedRuleData: DbRule = {
        ...originalRule,
        ...updates,
        updatedAt: new Date(),
      };

      set((state) => {
        const index = state.rules.findIndex((r) => r.id === id);
        if (index !== -1) {
          state.rules[index] = updatedRuleData;
          state.rules.sort((a, b) => a.name.localeCompare(b.name));
        }
      });

      try {
        await PersistenceService.saveRule(updatedRuleData);
        toast.success(`Rule "${updatedRuleData.name}" updated.`);
        emitter.emit(rulesEvent.ruleSaved, { rule: updatedRuleData });
        
        const { rules, tags, tagRuleLinks } = get();
        emitter.emit(rulesEvent.dataLoaded, { 
          rules: [...rules],
          tags: [...tags],
          links: [...tagRuleLinks]
        });
      } catch (e) {
        console.error("RulesStore: Error updating rule", e);
        set((state) => {
          const index = state.rules.findIndex((r) => r.id === id);
          if (index !== -1) {
            state.rules[index] = originalRule;
            state.rules.sort((a, b) => a.name.localeCompare(b.name));
          }
          state.error = "Failed to save rule update";
        });
        toast.error("Failed to save rule update.");
        throw e;
      }
    },

    deleteRule: async (id) => {
      const ruleToDelete = get().rules.find((r) => r.id === id);
      if (!ruleToDelete) {
        toast.error("Rule not found for deletion.");
        throw new Error("Rule not found");
      }
      const originalLinks = [...get().tagRuleLinks.filter((link) => link.ruleId === id)];
      const originalRuleCopy = {...ruleToDelete};

      set((state) => {
        state.rules = state.rules.filter((r) => r.id !== id);
        state.tagRuleLinks = state.tagRuleLinks.filter((link) => link.ruleId !== id);
      });

      try {
        await PersistenceService.deleteRule(id);
        toast.success(`Rule "${ruleToDelete.name}" deleted.`);
        emitter.emit(rulesEvent.ruleDeleted, { ruleId: id });
        
        const { rules, tags, tagRuleLinks } = get();
        emitter.emit(rulesEvent.dataLoaded, { 
          rules: [...rules],
          tags: [...tags],
          links: [...tagRuleLinks]
        });
      } catch (e) {
        console.error("RulesStore: Error deleting rule", e);
        set((state) => {
          if (!state.rules.find(r => r.id === originalRuleCopy.id)) {
            state.rules.push(originalRuleCopy);
            state.rules.sort((a, b) => a.name.localeCompare(b.name));
          }
          originalLinks.forEach(ol => {
            if (!state.tagRuleLinks.find(sl => sl.tagId === ol.tagId && sl.ruleId === ol.ruleId)) {
              state.tagRuleLinks.push(ol);
            }
          });
          state.error = "Failed to delete rule";
        });
        toast.error("Failed to delete rule.");
        throw e;
      }
    },

    addTag: async (tagData) => {
      const newId = nanoid();
      const now = new Date();
      const newTag: DbTag = {
        id: newId,
        createdAt: now,
        updatedAt: now,
        ...tagData,
      };
      set((state) => {
        state.tags.push(newTag);
        state.tags.sort((a, b) => a.name.localeCompare(b.name));
      });
      try {
        await PersistenceService.saveTag(newTag);
        toast.success(`Tag "${newTag.name}" added.`);
        emitter.emit(rulesEvent.tagSaved, { tag: newTag });
        
        const { rules, tags, tagRuleLinks } = get();
        emitter.emit(rulesEvent.dataLoaded, { 
          rules: [...rules],
          tags: [...tags],
          links: [...tagRuleLinks]
        });
        return newId;
      } catch (e) {
        console.error("RulesStore: Error adding tag", e);
        set((state) => ({
          error: "Failed to save new tag",
          tags: state.tags.filter((t) => t.id !== newId),
        }));
        toast.error("Failed to save new tag.");
        throw e;
      }
    },

    updateTag: async (id, updates) => {
      const originalTag = get().tags.find((t) => t.id === id);
      if (!originalTag) {
        toast.error("Tag not found for update.");
        throw new Error("Tag not found");
      }

      const updatedTagData: DbTag = {
        ...originalTag,
        ...updates,
        updatedAt: new Date(),
      };
      set((state) => {
        const index = state.tags.findIndex((t) => t.id === id);
        if (index !== -1) {
          state.tags[index] = updatedTagData;
          state.tags.sort((a, b) => a.name.localeCompare(b.name));
        }
      });

      try {
        await PersistenceService.saveTag(updatedTagData);
        toast.success(`Tag "${updatedTagData.name}" updated.`);
        emitter.emit(rulesEvent.tagSaved, { tag: updatedTagData });
        
        const { rules, tags, tagRuleLinks } = get();
        emitter.emit(rulesEvent.dataLoaded, { 
          rules: [...rules],
          tags: [...tags],
          links: [...tagRuleLinks]
        });
      } catch (e) {
        console.error("RulesStore: Error updating tag", e);
        set((state) => {
          const index = state.tags.findIndex((t) => t.id === id);
          if (index !== -1) {
            state.tags[index] = originalTag;
            state.tags.sort((a, b) => a.name.localeCompare(b.name));
          }
          state.error = "Failed to save tag update";
        });
        toast.error("Failed to save tag update.");
        throw e;
      }
    },

    deleteTag: async (id) => {
      const tagToDelete = get().tags.find((t) => t.id === id);
      if (!tagToDelete) {
        toast.error("Tag not found for deletion.");
        throw new Error("Tag not found");
      }
      const originalTagCopy = { ...tagToDelete };
      const originalLinks = [...get().tagRuleLinks.filter(link => link.tagId === id)];

      set((state) => {
        state.tags = state.tags.filter((t) => t.id !== id);
        state.tagRuleLinks = state.tagRuleLinks.filter((link) => link.tagId !== id);
      });

      try {
        await PersistenceService.deleteTag(id);
        toast.success(`Tag "${tagToDelete.name}" deleted.`);
        emitter.emit(rulesEvent.tagDeleted, { tagId: id });
        
        const { rules, tags, tagRuleLinks } = get();
        emitter.emit(rulesEvent.dataLoaded, { 
          rules: [...rules],
          tags: [...tags],
          links: [...tagRuleLinks]
        });
      } catch (e) {
        console.error("RulesStore: Error deleting tag", e);
        set((state) => {
          if (!state.tags.find(t => t.id === originalTagCopy.id)) {
            state.tags.push(originalTagCopy);
            state.tags.sort((a, b) => a.name.localeCompare(b.name));
          }
          originalLinks.forEach(ol => {
            if (!state.tagRuleLinks.find(sl => sl.tagId === ol.tagId && sl.ruleId === ol.ruleId)) {
              state.tagRuleLinks.push(ol);
            }
          });
          state.error = "Failed to delete tag";
        });
        toast.error("Failed to delete tag.");
        throw e;
      }
    },

    linkTagToRule: async (tagId, ruleId) => {
      const linkId = `${tagId}-${ruleId}`;
      
      if (get().tagRuleLinks.some(link => link.id === linkId)) {
        toast.info("Link already exists.");
        return;
      }
      
      const newLink: DbTagRuleLink = { id: linkId, tagId, ruleId }; 

      set((state) => {
        state.tagRuleLinks.push(newLink);
      });

      try {
        await PersistenceService.saveTagRuleLink(newLink);
        toast.success("Tag linked to rule.");
        if (rulesEvent.linkSaved) {
            emitter.emit(rulesEvent.linkSaved, { link: newLink }); 
        }
        
        const { rules, tags, tagRuleLinks } = get();
        emitter.emit(rulesEvent.dataLoaded, { 
          rules: [...rules],
          tags: [...tags],
          links: [...tagRuleLinks]
        });
      } catch (e) {
        console.error("RulesStore: Error linking tag to rule", e);
        set((state) => {
          state.tagRuleLinks = state.tagRuleLinks.filter(
            (link) => link.id !== linkId
          );
          state.error = "Failed to link tag to rule";
        });
        toast.error("Failed to link tag to rule.");
        throw e;
      }
    },

    unlinkTagFromRule: async (tagId, ruleId) => {
      const linkId = `${tagId}-${ruleId}`;
      const linkToDelete = get().tagRuleLinks.find((l) => l.id === linkId);
      
      if (!linkToDelete) {
        toast.info("Link not found for unlinking.");
      }
      
      set((state) => {
        state.tagRuleLinks = state.tagRuleLinks.filter(
          (link) => link.id !== linkId
        );
      });

      try {
        await PersistenceService.deleteTagRuleLink(linkId);
        toast.success("Tag unlinked from rule.");
        if (rulesEvent.linkDeleted) {
            emitter.emit(rulesEvent.linkDeleted, { linkId }); 
        }

        const { rules, tags, tagRuleLinks } = get();
        emitter.emit(rulesEvent.dataLoaded, { 
          rules: [...rules],
          tags: [...tags],
          links: [...tagRuleLinks]
        });
      } catch (e) {
        console.error("RulesStore: Error unlinking tag from rule", e);
        if (linkToDelete) {
          set((state) => {
            if (!state.tagRuleLinks.some(link => link.id === linkToDelete.id)) {
               state.tagRuleLinks.push(linkToDelete);
            }
            state.error = "Failed to unlink tag from rule";
          });
        }
        toast.error("Failed to unlink tag from rule.");
        throw e;
      }
    },

    getRulesForTag: (tagId) => {
      const state = get();
      const ruleIds = new Set(
        state.tagRuleLinks
          .filter((link) => link.tagId === tagId)
          .map((link) => link.ruleId)
      );
      return state.rules.filter((rule) => ruleIds.has(rule.id));
    },

    getTagsForRule: (ruleId) => {
      const state = get();
      const tagIds = new Set(
        state.tagRuleLinks
          .filter((link) => link.ruleId === ruleId)
          .map((link) => link.tagId)
      );
      return state.tags.filter((tag) => tagIds.has(tag.id));
    },

    getRuleById: (ruleId) => {
      return get().rules.find((r) => r.id === ruleId);
    },

    getTagById: (tagId) => {
      return get().tags.find((t) => t.id === tagId);
    },

    getRulesByIds: (ruleIds) => {
      const idSet = new Set(ruleIds);
      return get().rules.filter((r) => idSet.has(r.id));
    },
    getRegisteredActionHandlers: (): RegisteredActionHandler[] => {
      const storeId = "rulesStore";
      const actions = get();
      const wrapPromiseString =
        <P>(fn: (payload: P) => Promise<string>): ActionHandler<P> =>
        async (payload: P) => {
          await fn(payload);
        };
      return [
        {
          eventName: rulesEvent.loadRulesAndTagsRequest,
          handler: actions.loadRulesAndTags,
          storeId,
        },
        {
          eventName: rulesEvent.addRuleRequest,
          handler: wrapPromiseString(actions.addRule),
          storeId,
        },
        {
          eventName: rulesEvent.updateRuleRequest,
          handler: (
            p: RulesEventPayloads[typeof rulesEvent.updateRuleRequest]
          ) => actions.updateRule(p.id, p.updates),
          storeId,
        },
        {
          eventName: rulesEvent.deleteRuleRequest,
          handler: (
            p: RulesEventPayloads[typeof rulesEvent.deleteRuleRequest]
          ) => actions.deleteRule(p.id),
          storeId,
        },
        {
          eventName: rulesEvent.addTagRequest,
          handler: wrapPromiseString(actions.addTag),
          storeId,
        },
        {
          eventName: rulesEvent.updateTagRequest,
          handler: (
            p: RulesEventPayloads[typeof rulesEvent.updateTagRequest]
          ) => actions.updateTag(p.id, p.updates),
          storeId,
        },
        {
          eventName: rulesEvent.deleteTagRequest,
          handler: (
            p: RulesEventPayloads[typeof rulesEvent.deleteTagRequest]
          ) => actions.deleteTag(p.id),
          storeId,
        },
        {
          eventName: rulesEvent.linkTagToRuleRequest,
          handler: (
            p: RulesEventPayloads[typeof rulesEvent.linkTagToRuleRequest]
          ) => actions.linkTagToRule(p.tagId, p.ruleId),
          storeId,
        },
        {
          eventName: rulesEvent.unlinkTagFromRuleRequest,
          handler: (
            p: RulesEventPayloads[typeof rulesEvent.unlinkTagFromRuleRequest]
          ) => actions.unlinkTagFromRule(p.tagId, p.ruleId),
          storeId,
        },
      ];
    },
  }))
);
