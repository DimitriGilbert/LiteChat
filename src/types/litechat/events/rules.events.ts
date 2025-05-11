// src/types/litechat/events/rules.events.ts
// FULL FILE
import type { DbRule, DbTag, DbTagRuleLink } from "@/types/litechat/rules";

export const rulesEvent = {
  // State Change Events
  dataLoaded: "rules.data.loaded",
  ruleSaved: "rules.rule.saved",
  ruleDeleted: "rules.rule.deleted",
  tagSaved: "rules.tag.saved",
  tagDeleted: "rules.tag.deleted",
  linkSaved: "rules.link.saved",
  linkDeleted: "rules.link.deleted",
  loadingStateChanged: "rules.loading.state.changed",

  // Action Request Events
  loadRulesAndTagsRequest: "rules.load.rules.and.tags.request",
  addRuleRequest: "rules.add.rule.request",
  updateRuleRequest: "rules.update.rule.request",
  deleteRuleRequest: "rules.delete.rule.request",
  addTagRequest: "rules.add.tag.request",
  updateTagRequest: "rules.update.tag.request",
  deleteTagRequest: "rules.delete.tag.request",
  linkTagToRuleRequest: "rules.link.tag.to.rule.request",
  unlinkTagFromRuleRequest: "rules.unlink.tag.from.rule.request",
} as const;

export interface RulesEventPayloads {
  [rulesEvent.dataLoaded]: {
    rules: DbRule[];
    tags: DbTag[];
    links: DbTagRuleLink[];
  };
  [rulesEvent.ruleSaved]: { rule: DbRule };
  [rulesEvent.ruleDeleted]: { ruleId: string };
  [rulesEvent.tagSaved]: { tag: DbTag };
  [rulesEvent.tagDeleted]: { tagId: string };
  [rulesEvent.linkSaved]: { link: DbTagRuleLink };
  [rulesEvent.linkDeleted]: { linkId: string };
  [rulesEvent.loadingStateChanged]: {
    isLoading: boolean;
    error: string | null;
  };
  [rulesEvent.loadRulesAndTagsRequest]: undefined;
  [rulesEvent.addRuleRequest]: Omit<DbRule, "id" | "createdAt" | "updatedAt">;
  [rulesEvent.updateRuleRequest]: {
    id: string;
    updates: Partial<Omit<DbRule, "id" | "createdAt">>;
  };
  [rulesEvent.deleteRuleRequest]: { id: string };
  [rulesEvent.addTagRequest]: Omit<DbTag, "id" | "createdAt" | "updatedAt">;
  [rulesEvent.updateTagRequest]: {
    id: string;
    updates: Partial<Omit<DbTag, "id" | "createdAt">>;
  };
  [rulesEvent.deleteTagRequest]: { id: string };
  [rulesEvent.linkTagToRuleRequest]: { tagId: string; ruleId: string };
  [rulesEvent.unlinkTagFromRuleRequest]: { tagId: string; ruleId: string };
}
