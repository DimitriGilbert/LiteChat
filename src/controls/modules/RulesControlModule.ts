// src/controls/modules/RulesControlModule.ts
// FULL FILE
import React from "react";
import { type ControlModule } from "@/types/litechat/control";
import {
  type LiteChatModApi,
  interactionEvent, // Updated import
  rulesEvent, // Updated import
} from "@/types/litechat/modding";
import { RulesControlTrigger } from "@/controls/components/rules/RulesControlTrigger";
import { useRulesStore } from "@/store/rules.store";
import { useInteractionStore } from "@/store/interaction.store";

export class RulesControlModule implements ControlModule {
  readonly id = "core-rules-tags";
  private unregisterCallback: (() => void) | null = null;
  private eventUnsubscribers: (() => void)[] = [];

  public transientActiveTagIds = new Set<string>();
  public transientActiveRuleIds = new Set<string>();
  public isStreaming = false;
  public hasRulesOrTags = false;
  public isLoadingRules = true;
  private notifyComponentUpdate: (() => void) | null = null;

  async initialize(modApi: LiteChatModApi): Promise<void> {
    this.loadInitialState();

    const unsubStatus = modApi.on(interactionEvent.statusChanged, (payload) => {
      if (this.isStreaming !== (payload.status === "streaming")) {
        this.isStreaming = payload.status === "streaming";
        this.notifyComponentUpdate?.();
      }
    });
    const unsubRulesLoaded = modApi.on(rulesEvent.rulesLoaded, () => {
      this.updateHasRulesOrTags();
      this.isLoadingRules = false;
      this.notifyComponentUpdate?.();
    });
    const unsubTagsLoaded = modApi.on(rulesEvent.tagsLoaded, () => {
      this.updateHasRulesOrTags();
      this.isLoadingRules = false;
      this.notifyComponentUpdate?.();
    });

    this.eventUnsubscribers.push(
      unsubStatus,
      unsubRulesLoaded,
      unsubTagsLoaded
    );
    console.log(`[${this.id}] Initialized.`);
  }

  private loadInitialState() {
    const rulesState = useRulesStore.getState();
    this.isStreaming = useInteractionStore.getState().status === "streaming";
    this.hasRulesOrTags =
      rulesState.rules.length > 0 || rulesState.tags.length > 0;
    this.isLoadingRules = rulesState.isLoading;
  }

  private updateHasRulesOrTags() {
    const rulesState = useRulesStore.getState();
    const newHasRulesOrTags =
      rulesState.rules.length > 0 || rulesState.tags.length > 0;
    if (this.hasRulesOrTags !== newHasRulesOrTags) {
      this.hasRulesOrTags = newHasRulesOrTags;
    }
  }

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

  register(modApi: LiteChatModApi): void {
    if (this.unregisterCallback) {
      console.warn(`[${this.id}] Already registered. Skipping.`);
      return;
    }
    this.unregisterCallback = modApi.registerPromptControl({
      id: this.id,
      status: () => (this.isLoadingRules ? "loading" : "ready"),
      triggerRenderer: () =>
        React.createElement(RulesControlTrigger, { module: this }),
      getMetadata: () => {
        const tags = Array.from(this.transientActiveTagIds);
        const rules = Array.from(this.transientActiveRuleIds);
        if (tags.length > 0 || rules.length > 0) {
          return { activeTagIds: tags, activeRuleIds: rules };
        }
        return undefined;
      },
      clearOnSubmit: () => {
        let changed = false;
        if (this.transientActiveTagIds.size > 0) {
          this.transientActiveTagIds = new Set<string>();
          changed = true;
        }
        if (this.transientActiveRuleIds.size > 0) {
          this.transientActiveRuleIds = new Set<string>();
          changed = true;
        }
        if (changed) this.notifyComponentUpdate?.();
      },
      // show method removed, visibility handled by RulesControlTrigger
    });
    console.log(`[${this.id}] Registered.`);
  }

  destroy(): void {
    this.eventUnsubscribers.forEach((unsub) => unsub());
    this.eventUnsubscribers = [];
    if (this.unregisterCallback) {
      this.unregisterCallback();
      this.unregisterCallback = null;
    }
    this.notifyComponentUpdate = null;
    console.log(`[${this.id}] Destroyed.`);
  }
}
