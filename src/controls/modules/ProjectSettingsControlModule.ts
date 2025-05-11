// src/controls/modules/ProjectSettingsControlModule.ts
// FULL FILE
import React from "react";
import { type ControlModule } from "@/types/litechat/control";
import { type LiteChatModApi } from "@/types/litechat/modding";
import { ProjectSettingsModal } from "@/controls/components/project-settings/ProjectSettingsModal";
import { uiEvent } from "@/types/litechat/events/ui.events";
import { rulesEvent } from "@/types/litechat/events/rules.events";
import type { DbRule, DbTag, DbTagRuleLink } from "@/types/litechat/rules";

export class ProjectSettingsControlModule implements ControlModule {
  readonly id = "core-project-settings";
  public readonly modalId = "projectSettingsModal"; // Unique ID for this modal
  private unregisterModalProviderCallback: (() => void) | null = null;
  private modApiRef: LiteChatModApi | null = null;
  private eventUnsubscribers: (() => void)[] = [];

  private allRules: DbRule[] = [];
  private allTags: DbTag[] = [];
  private tagRuleLinks: { tagId: string; ruleId: string }[] = [];

  async initialize(modApi: LiteChatModApi): Promise<void> {
    this.modApiRef = modApi;

    const unsubRules = modApi.on(rulesEvent.dataLoaded, (payload) => {
      if (payload) {
        this.allRules = payload.rules || [];
        this.allTags = payload.tags || [];
        this.tagRuleLinks = (payload.links || []).map((l: DbTagRuleLink) => ({
          tagId: l.tagId,
          ruleId: l.ruleId,
        }));
      }
    });
    this.eventUnsubscribers.push(unsubRules);
    modApi.emit(rulesEvent.loadRulesAndTagsRequest, undefined);
    console.log(`[${this.id}] Initialized.`);
  }

  public getAllRules = (): DbRule[] => this.allRules;
  public getAllTags = (): DbTag[] => this.allTags;
  public getRulesForTag = (tagId: string): DbRule[] => {
    const ruleIds = new Set(
      this.tagRuleLinks
        .filter((link) => link.tagId === tagId)
        .map((link) => link.ruleId)
    );
    return this.allRules.filter((rule) => ruleIds.has(rule.id));
  };

  public openModal = (projectId: string, initialTab?: string) => {
    this.modApiRef?.emit(uiEvent.openModalRequest, {
      modalId: this.modalId,
      targetId: projectId,
      initialTab: initialTab,
    });
  };

  public closeModal = () => {
    this.modApiRef?.emit(uiEvent.closeModalRequest, {
      modalId: this.modalId,
    });
  };

  register(modApi: LiteChatModApi): void {
    this.modApiRef = modApi;
    if (this.unregisterModalProviderCallback) {
      console.warn(`[${this.id}] Modal provider already registered. Skipping.`);
      return;
    }

    this.unregisterModalProviderCallback = modApi.registerModalProvider(
      this.modalId,
      (props) => {
        return React.createElement(ProjectSettingsModal, {
          isOpen: props.isOpen,
          onClose: props.onClose,
          projectId: props.targetId || null,
          module: this, // Pass the module instance
          // initialTab: props.initialTab, // If ProjectSettingsModal uses it
        });
      }
    );
    console.log(`[${this.id}] Modal provider registered for ${this.modalId}.`);
  }

  destroy(): void {
    this.eventUnsubscribers.forEach((unsub) => unsub());
    this.eventUnsubscribers = [];
    if (this.unregisterModalProviderCallback) {
      this.unregisterModalProviderCallback();
      this.unregisterModalProviderCallback = null;
    }
    this.modApiRef = null;
    console.log(`[${this.id}] Destroyed.`);
  }
}
