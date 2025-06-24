// src/controls/modules/RulesControlModule.ts
// FULL FILE
import React from "react";
import { type ControlModule } from "@/types/litechat/control";
import { type LiteChatModApi } from "@/types/litechat/modding";
import { interactionEvent } from "@/types/litechat/events/interaction.events";
import { rulesEvent } from "@/types/litechat/events/rules.events";
import { uiEvent } from "@/types/litechat/events/ui.events";
import { RulesControlTrigger } from "@/controls/components/rules/RulesControlTrigger";
import { SettingsRulesAndTags } from "@/controls/components/rules/SettingsRulesAndTags";
import type { DbRule, DbTag } from "@/types/litechat/rules";
import type { ResolvedRuleContent } from "@/types/litechat/prompt";

export class RulesControlModule implements ControlModule {
  readonly id = "core-rules-tags";
  private unregisterPromptControlCallback: (() => void) | null = null;
  private unregisterSettingsTabCallback: (() => void) | null = null;
  private eventUnsubscribers: (() => void)[] = [];
  private modApiRef: LiteChatModApi | null = null;

  private allRules: DbRule[] = [];
  private allTags: DbTag[] = [];
  private tagRuleLinks: { tagId: string; ruleId: string }[] = [];

  public transientActiveTagIds = new Set<string>();
  public transientActiveRuleIds = new Set<string>();
  public isStreaming = false;
  public hasRulesOrTags = false;
  public isLoadingRules = true;
  private notifyComponentUpdate: (() => void) | null = null;
  private notifySettingsComponentUpdate: (() => void) | null = null;

  async initialize(modApi: LiteChatModApi): Promise<void> {
    this.modApiRef = modApi;
    this.isStreaming = modApi.getContextSnapshot().isStreaming;

    modApi.emit(rulesEvent.loadRulesAndTagsRequest, undefined);

    const unsubStatus = modApi.on(interactionEvent.statusChanged, (payload) => {
      if (typeof payload === "object" && payload && "status" in payload) {
        if (this.isStreaming !== (payload.status === "streaming")) {
          this.isStreaming = payload.status === "streaming";
          this.notifyComponentUpdate?.();
        }
      }
    });
    const unsubRulesLoaded = modApi.on(rulesEvent.dataLoaded, (payload) => {
      if (payload) {
        this.allRules = payload.rules || [];
        this.allTags = payload.tags || [];
        this.tagRuleLinks = (payload.links || []).map((l) => ({
          tagId: l.tagId,
          ruleId: l.ruleId,
        }));
        // Auto-populate always-on rules
        this.populateAlwaysOnRules();
      }
      this.updateHasRulesOrTags();
      this.isLoadingRules = false;
      this.notifyComponentUpdate?.();
      this.notifySettingsComponentUpdate?.();
    });

    this.eventUnsubscribers.push(unsubStatus, unsubRulesLoaded);
  }

  private populateAlwaysOnRules() {
    // Auto-activate always-on rules
    const alwaysOnRuleIds = this.allRules
      .filter(rule => rule.alwaysOn)
      .map(rule => rule.id);
    
    if (alwaysOnRuleIds.length > 0) {
      this.transientActiveRuleIds = new Set([
        ...this.transientActiveRuleIds,
        ...alwaysOnRuleIds
      ]);
    }
  }

  private updateHasRulesOrTags() {
    const newHasRulesOrTags =
      this.allRules.length > 0 || this.allTags.length > 0;
    if (this.hasRulesOrTags !== newHasRulesOrTags) {
      this.hasRulesOrTags = newHasRulesOrTags;
    }
  }

  public getAllRules = (): DbRule[] => this.allRules;
  public getAllTags = (): DbTag[] => this.allTags;
  public getTagRuleLinks = (): { tagId: string; ruleId: string }[] =>
    this.tagRuleLinks;

  public getRulesForTag = (tagId: string): DbRule[] => {
    const ruleIds = new Set(
      this.tagRuleLinks
        .filter((link) => link.tagId === tagId)
        .map((link) => link.ruleId)
    );
    return this.allRules.filter((rule) => ruleIds.has(rule.id));
  };
  public getRuleById = (ruleId: string): DbRule | undefined => {
    return this.allRules.find((r) => r.id === ruleId);
  };
  public getTagById = (tagId: string): DbTag | undefined => {
    return this.allTags.find((t) => t.id === tagId);
  };
  public getRulesByIds = (ruleIds: string[]): DbRule[] => {
    const idSet = new Set(ruleIds);
    return this.allRules.filter((r) => idSet.has(r.id));
  };

  public addRule = (data: Omit<DbRule, "id" | "createdAt" | "updatedAt">) => {
    this.modApiRef?.emit(rulesEvent.addRuleRequest, data);
  };
  public updateRule = (
    id: string,
    updates: Partial<Omit<DbRule, "id" | "createdAt">>
  ) => {
    this.modApiRef?.emit(rulesEvent.updateRuleRequest, { id, updates });
  };
  public deleteRule = (id: string) => {
    this.modApiRef?.emit(rulesEvent.deleteRuleRequest, { id });
  };
  public addTag = (data: Omit<DbTag, "id" | "createdAt" | "updatedAt">) => {
    this.modApiRef?.emit(rulesEvent.addTagRequest, data);
  };
  public updateTag = (
    id: string,
    updates: Partial<Omit<DbTag, "id" | "createdAt">>
  ) => {
    this.modApiRef?.emit(rulesEvent.updateTagRequest, { id, updates });
  };
  public deleteTag = (id: string) => {
    this.modApiRef?.emit(rulesEvent.deleteTagRequest, { id });
  };
  public linkTagToRule = (tagId: string, ruleId: string) => {
    this.modApiRef?.emit(rulesEvent.linkTagToRuleRequest, { tagId, ruleId });
  };
  public unlinkTagFromRule = (tagId: string, ruleId: string) => {
    this.modApiRef?.emit(rulesEvent.unlinkTagFromRuleRequest, {
      tagId,
      ruleId,
    });
  };

  public handleTriggerClick = () => {
    if (!this.hasRulesOrTags && this.modApiRef) {
      this.modApiRef.emit(uiEvent.openModalRequest, {
        modalId: "settingsModal",
        initialTab: "rules-tags",
      });
      return true;
    }
    return false;
  };

  public getIsStreaming = (): boolean => this.isStreaming;
  public getHasRulesOrTags = (): boolean => this.hasRulesOrTags;
  public getIsLoadingRules = (): boolean => this.isLoadingRules;
  public getActiveTagIds = (): Set<string> => this.transientActiveTagIds;
  public getActiveRuleIds = (): Set<string> => this.transientActiveRuleIds;

  public setActiveTagIds = (updater: (prev: Set<string>) => Set<string>) => {
    this.transientActiveTagIds = updater(this.transientActiveTagIds);
    this.notifyComponentUpdate?.();
  };
  public setActiveRuleIds = (updater: (prev: Set<string>) => Set<string>) => {
    this.transientActiveRuleIds = updater(this.transientActiveRuleIds);
    this.notifyComponentUpdate?.();
  };

  public setNotifyCallback = (cb: (() => void) | null) => {
    this.notifyComponentUpdate = cb;
  };
  public setNotifySettingsCallback = (cb: (() => void) | null) => {
    this.notifySettingsComponentUpdate = cb;
  };

  register(modApi: LiteChatModApi): void {
    this.modApiRef = modApi;

    if (!this.unregisterPromptControlCallback) {
      this.unregisterPromptControlCallback = modApi.registerPromptControl({
        id: this.id,
        status: () => (this.isLoadingRules ? "loading" : "ready"),
        triggerRenderer: () =>
          React.createElement(RulesControlTrigger, { module: this }),
        getMetadata: () => {
          const activeTagIds = Array.from(this.transientActiveTagIds);
          const activeRuleIds = Array.from(this.transientActiveRuleIds);
          const effectiveRulesContent: ResolvedRuleContent[] = [];

          const allEffectiveRuleIds = new Set<string>(activeRuleIds);
          activeTagIds.forEach((tagId) => {
            this.getRulesForTag(tagId).forEach((rule) =>
              allEffectiveRuleIds.add(rule.id)
            );
          });

          allEffectiveRuleIds.forEach((ruleId) => {
            const rule = this.getRuleById(ruleId);
            if (rule) {
              effectiveRulesContent.push({
                type: rule.type,
                content: rule.content,
                sourceRuleId: rule.id,
              });
            }
          });

          if (
            activeTagIds.length > 0 ||
            activeRuleIds.length > 0 ||
            effectiveRulesContent.length > 0
          ) {
            return {
              activeTagIds,
              activeRuleIds,
              effectiveRulesContent,
            };
          }
          return undefined;
        },
        clearOnSubmit: () => {
          let changed = false;
          
          // Clear regular rules but preserve always-on rules
          const alwaysOnRuleIds = new Set(
            this.allRules
              .filter(rule => rule.alwaysOn)
              .map(rule => rule.id)
          );
          
          if (this.transientActiveTagIds.size > 0) {
            this.transientActiveTagIds = new Set<string>();
            changed = true;
          }
          
          // Only remove rules that are not always-on
          const newActiveRuleIds = new Set<string>();
          this.transientActiveRuleIds.forEach(ruleId => {
            if (alwaysOnRuleIds.has(ruleId)) {
              newActiveRuleIds.add(ruleId);
            } else {
              changed = true;
            }
          });
          
          if (newActiveRuleIds.size !== this.transientActiveRuleIds.size) {
            this.transientActiveRuleIds = newActiveRuleIds;
            changed = true;
          }
          
          if (changed) this.notifyComponentUpdate?.();
        },
      });
    }

    if (!this.unregisterSettingsTabCallback) {
      this.unregisterSettingsTabCallback = modApi.registerSettingsTab({
        id: "rules-tags",
        title: "Rules & Tags",
        component: () =>
          React.createElement(SettingsRulesAndTags, { module: this }),
        order: 50,
      });
    }
  }

  destroy(): void {
    this.eventUnsubscribers.forEach((unsub) => unsub());
    this.eventUnsubscribers = [];
    if (this.unregisterPromptControlCallback) {
      this.unregisterPromptControlCallback();
      this.unregisterPromptControlCallback = null;
    }
    if (this.unregisterSettingsTabCallback) {
      this.unregisterSettingsTabCallback();
      this.unregisterSettingsTabCallback = null;
    }
    this.notifyComponentUpdate = null;
    this.notifySettingsComponentUpdate = null;
    this.modApiRef = null;
    console.log(`[${this.id}] Destroyed.`);
  }
}
