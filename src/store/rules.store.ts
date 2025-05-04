// src/store/rules.store.ts
// FULL FILE
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { DbRule, DbTag, DbTagRuleLink } from "@/types/litechat/rules";
// Import PersistenceService instead of db
import { PersistenceService } from "@/services/persistence.service";
import { nanoid } from "nanoid";
import { toast } from "sonner";

interface RulesState {
  rules: DbRule[];
  tags: DbTag[];
  tagRuleLinks: DbTagRuleLink[];
  isLoading: boolean;
  error: string | null;
}

interface RulesActions {
  loadRulesAndTags: () => Promise<void>;
  // Rule Actions
  addRule: (
    ruleData: Omit<DbRule, "id" | "createdAt" | "updatedAt">,
  ) => Promise<string>;
  updateRule: (
    id: string,
    updates: Partial<Omit<DbRule, "id" | "createdAt">>,
  ) => Promise<void>;
  deleteRule: (id: string) => Promise<void>;
  // Tag Actions
  addTag: (
    tagData: Omit<DbTag, "id" | "createdAt" | "updatedAt">,
  ) => Promise<string>;
  updateTag: (
    id: string,
    updates: Partial<Omit<DbTag, "id" | "createdAt">>,
  ) => Promise<void>;
  deleteTag: (id: string) => Promise<void>;
  // Link Actions
  linkTagToRule: (tagId: string, ruleId: string) => Promise<void>;
  unlinkTagFromRule: (tagId: string, ruleId: string) => Promise<void>;
  // Selectors
  getRulesForTag: (tagId: string) => DbRule[];
  getTagsForRule: (ruleId: string) => DbTag[];
  getRuleById: (ruleId: string) => DbRule | undefined;
  getTagById: (tagId: string) => DbTag | undefined;
  getRulesByIds: (ruleIds: string[]) => DbRule[];
}

export const useRulesStore = create(
  immer<RulesState & RulesActions>((set, get) => ({
    // Initial State
    rules: [],
    tags: [],
    tagRuleLinks: [],
    isLoading: false,
    error: null,

    // Actions
    loadRulesAndTags: async () => {
      set({ isLoading: true, error: null });
      try {
        // Use PersistenceService to load data
        const [dbRules, dbTags, dbLinks] = await Promise.all([
          PersistenceService.loadRules(),
          PersistenceService.loadTags(),
          PersistenceService.loadTagRuleLinks(),
        ]);
        set({
          // ensureDateFields is handled by PersistenceService now
          rules: dbRules,
          tags: dbTags,
          tagRuleLinks: dbLinks,
          isLoading: false,
        });
      } catch (e) {
        console.error("RulesStore: Error loading rules and tags", e);
        set({ error: "Failed load rules/tags", isLoading: false });
        toast.error("Failed to load rules and tags.");
      }
    },

    // --- Rule Actions ---
    addRule: async (ruleData) => {
      const newId = nanoid();
      const now = new Date();
      const newRule: DbRule = {
        id: newId,
        createdAt: now,
        updatedAt: now,
        ...ruleData,
      };
      // Optimistic UI update
      set((state) => {
        state.rules.push(newRule);
        state.rules.sort((a, b) => a.name.localeCompare(b.name));
      });
      try {
        // Use PersistenceService to save
        await PersistenceService.saveRule(newRule);
        toast.success(`Rule "${newRule.name}" added.`);
        return newId;
      } catch (e) {
        console.error("RulesStore: Error adding rule", e);
        // Revert optimistic update
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
      if (!originalRule) return;

      const updatedRuleData = {
        ...originalRule,
        ...updates,
        updatedAt: new Date(),
      };

      // Optimistic UI update
      set((state) => {
        const index = state.rules.findIndex((r) => r.id === id);
        if (index !== -1) {
          state.rules[index] = updatedRuleData;
          state.rules.sort((a, b) => a.name.localeCompare(b.name));
        }
      });

      try {
        // Use PersistenceService to save
        await PersistenceService.saveRule(updatedRuleData);
        toast.success(`Rule "${updatedRuleData.name}" updated.`);
      } catch (e) {
        console.error("RulesStore: Error updating rule", e);
        // Revert optimistic update
        set((state) => {
          const index = state.rules.findIndex((r) => r.id === id);
          if (index !== -1) {
            state.rules[index] = originalRule; // Revert
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
      if (!ruleToDelete) return;
      const originalLinks = get().tagRuleLinks.filter(
        (link) => link.ruleId === id,
      );

      // Optimistic UI update
      set((state) => ({
        rules: state.rules.filter((r) => r.id !== id),
        tagRuleLinks: state.tagRuleLinks.filter((link) => link.ruleId !== id),
      }));

      try {
        // Use PersistenceService to delete (handles transaction)
        await PersistenceService.deleteRule(id);
        toast.success(`Rule "${ruleToDelete.name}" deleted.`);
      } catch (e) {
        console.error("RulesStore: Error deleting rule", e);
        // Revert optimistic update
        set((state) => {
          state.rules.push(ruleToDelete);
          state.rules.sort((a, b) => a.name.localeCompare(b.name));
          state.tagRuleLinks.push(...originalLinks); // Restore links
          state.error = "Failed to delete rule";
        });
        toast.error("Failed to delete rule.");
        throw e;
      }
    },

    // --- Tag Actions ---
    addTag: async (tagData) => {
      const newId = nanoid();
      const now = new Date();
      const newTag: DbTag = {
        id: newId,
        createdAt: now,
        updatedAt: now,
        ...tagData,
      };
      // Optimistic UI update
      set((state) => {
        state.tags.push(newTag);
        state.tags.sort((a, b) => a.name.localeCompare(b.name));
      });
      try {
        // Use PersistenceService to save
        await PersistenceService.saveTag(newTag);
        toast.success(`Tag "${newTag.name}" added.`);
        return newId;
      } catch (e) {
        console.error("RulesStore: Error adding tag", e);
        // Revert optimistic update
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
      if (!originalTag) return;

      const updatedTagData = {
        ...originalTag,
        ...updates,
        updatedAt: new Date(),
      };

      // Optimistic UI update
      set((state) => {
        const index = state.tags.findIndex((t) => t.id === id);
        if (index !== -1) {
          state.tags[index] = updatedTagData;
          state.tags.sort((a, b) => a.name.localeCompare(b.name));
        }
      });

      try {
        // Use PersistenceService to save
        await PersistenceService.saveTag(updatedTagData);
        toast.success(`Tag "${updatedTagData.name}" updated.`);
      } catch (e) {
        console.error("RulesStore: Error updating tag", e);
        // Revert optimistic update
        set((state) => {
          const index = state.tags.findIndex((t) => t.id === id);
          if (index !== -1) {
            state.tags[index] = originalTag; // Revert
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
      if (!tagToDelete) return;
      const originalLinks = get().tagRuleLinks.filter(
        (link) => link.tagId === id,
      );

      // Optimistic UI update
      set((state) => ({
        tags: state.tags.filter((t) => t.id !== id),
        tagRuleLinks: state.tagRuleLinks.filter((link) => link.tagId !== id),
      }));

      try {
        // Use PersistenceService to delete (handles transaction)
        await PersistenceService.deleteTag(id);
        toast.success(`Tag "${tagToDelete.name}" deleted.`);
      } catch (e) {
        console.error("RulesStore: Error deleting tag", e);
        // Revert optimistic update
        set((state) => {
          state.tags.push(tagToDelete);
          state.tags.sort((a, b) => a.name.localeCompare(b.name));
          state.tagRuleLinks.push(...originalLinks); // Restore links
          state.error = "Failed to delete tag";
        });
        toast.error("Failed to delete tag.");
        throw e;
      }
    },

    // --- Link Actions ---
    linkTagToRule: async (tagId, ruleId) => {
      const linkId = `${tagId}-${ruleId}`; // Simple compound key
      const existingLink = get().tagRuleLinks.find((l) => l.id === linkId);
      if (existingLink) return; // Already linked

      const newLink: DbTagRuleLink = { id: linkId, tagId, ruleId };
      // Optimistic UI update
      set((state) => {
        state.tagRuleLinks.push(newLink);
      });
      try {
        // Use PersistenceService to save
        await PersistenceService.saveTagRuleLink(newLink);
      } catch (e) {
        console.error("RulesStore: Error linking tag to rule", e);
        // Revert optimistic update
        set((state) => ({
          error: "Failed to link tag and rule",
          tagRuleLinks: state.tagRuleLinks.filter((l) => l.id !== linkId),
        }));
        toast.error("Failed to link tag and rule.");
        throw e;
      }
    },

    unlinkTagFromRule: async (tagId, ruleId) => {
      const linkId = `${tagId}-${ruleId}`;
      const linkToDelete = get().tagRuleLinks.find((l) => l.id === linkId);
      if (!linkToDelete) return; // Not linked

      // Optimistic UI update
      set((state) => ({
        tagRuleLinks: state.tagRuleLinks.filter((l) => l.id !== linkId),
      }));
      try {
        // Use PersistenceService to delete
        await PersistenceService.deleteTagRuleLink(linkId);
      } catch (e) {
        console.error("RulesStore: Error unlinking tag from rule", e);
        // Revert optimistic update
        set((state) => {
          state.tagRuleLinks.push(linkToDelete); // Revert
          state.error = "Failed to unlink tag and rule";
        });
        toast.error("Failed to unlink tag and rule.");
        throw e;
      }
    },

    // --- Selectors (remain the same) ---
    getRulesForTag: (tagId) => {
      const state = get();
      const ruleIds = new Set(
        state.tagRuleLinks
          .filter((link) => link.tagId === tagId)
          .map((link) => link.ruleId),
      );
      return state.rules.filter((rule) => ruleIds.has(rule.id));
    },

    getTagsForRule: (ruleId) => {
      const state = get();
      const tagIds = new Set(
        state.tagRuleLinks
          .filter((link) => link.ruleId === ruleId)
          .map((link) => link.tagId),
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
  })),
);
