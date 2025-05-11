// src/types/litechat/events/stores/rules.events.ts
// FULL FILE
export const rulesStoreEvent = {
  // State Change Events
  dataLoaded: "stores.rules.data.loaded",
  ruleSaved: "stores.rules.rule.saved",
  ruleDeleted: "stores.rules.rule.deleted",
  tagSaved: "stores.rules.tag.saved",
  tagDeleted: "stores.rules.tag.deleted",
  linkSaved: "stores.rules.link.saved",
  linkDeleted: "stores.rules.link.deleted",
  loadingStateChanged: "stores.rules.loading.state.changed", // Added this event

  // Action Request Events
  loadRulesAndTagsRequest: "stores.rules.load.rules.and.tags.request",
  addRuleRequest: "stores.rules.add.rule.request",
  updateRuleRequest: "stores.rules.update.rule.request",
  deleteRuleRequest: "stores.rules.delete.rule.request",
  addTagRequest: "stores.rules.add.tag.request",
  updateTagRequest: "stores.rules.update.tag.request",
  deleteTagRequest: "stores.rules.delete.tag.request",
  linkTagToRuleRequest: "stores.rules.link.tag.to.rule.request",
  unlinkTagFromRuleRequest: "stores.rules.unlink.tag.from.rule.request",
} as const;
