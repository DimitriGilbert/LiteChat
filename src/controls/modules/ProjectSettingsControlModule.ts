// src/controls/modules/ProjectSettingsControlModule.ts
// FULL FILE
import React from "react";
import { type ControlModule } from "@/types/litechat/control";
import { type LiteChatModApi } from "@/types/litechat/modding";
import { ProjectSettingsModal } from "@/controls/components/project-settings/ProjectSettingsModal";
import { uiEvent } from "@/types/litechat/events/ui.events";
import { rulesEvent } from "@/types/litechat/events/rules.events"; // Import rulesEvent
import type { DbRule, DbTag } from "@/types/litechat/rules"; // Import DbRule and DbTag

export class ProjectSettingsControlModule implements ControlModule {
  readonly id = "core-project-settings";
  public readonly modalId = "projectSettingsModal";
  private unregisterModalProviderCallback: (() => void) | null = null;
  private modApiRef: LiteChatModApi | null = null;
  private eventUnsubscribers: (() => void)[] = []; // For cleaning up event listeners

  // Internal state for rules and tags
  private allRules: DbRule[] = [];
  private allTags: DbTag[] = [];
  private tagRuleLinks: { tagId: string; ruleId: string }[] = []; // Simplified link structure

  async initialize(modApi: LiteChatModApi): Promise<void> {
    this.modApiRef = modApi;

    // Subscribe to rules data loaded event
    const unsubRules = modApi.on(rulesEvent.dataLoaded, (payload) => {
      if (payload) {
        this.allRules = payload.rules || [];
        this.allTags = payload.tags || [];
        this.tagRuleLinks = (payload.links || []).map((l) => ({
          tagId: l.tagId,
          ruleId: l.ruleId,
        }));
        // Potentially notify if modal is open and needs re-render, though modal usually re-fetches on open
      }
    });
    this.eventUnsubscribers.push(unsubRules);

    // Request initial load of rules and tags if not already loaded
    // This assumes stores might load data independently, so a request ensures it happens
    // or that the module gets the data if already loaded.
    modApi.emit(rulesEvent.loadRulesAndTagsRequest, undefined);

    console.log(`[${this.id}] Initialized.`);
  }

  // Getter methods for UI
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
          // Pass down the data getters from this module instance
          module: this,
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
