// src/controls/modules/RulesControlModule.ts
// FULL FILE
import React from "react";
import { type ControlModule } from "@/types/litechat/control";
import { type LiteChatModApi } from "@/types/litechat/modding";
import { interactionEvent } from "@/types/litechat/events/interaction.events";
import { rulesEvent } from "@/types/litechat/events/rules.events";
import { controlRegistryEvent } from "@/types/litechat/events/control.registry.events";
import { uiEvent } from "@/types/litechat/events/ui.events";
import { RulesControlTrigger } from "@/controls/components/rules/RulesControlTrigger";
import { SettingsRulesAndTags } from "@/controls/components/rules/SettingsRulesAndTags";
import type { DbRule, DbTag } from "@/types/litechat/rules";
import type { ResolvedRuleContent } from "@/types/litechat/prompt";
import type { ModControlRule } from "@/types/litechat/modding";
import { useControlRegistryStore } from "@/store/control.store";
import { useSettingsStore } from "../../store/settings.store";
import { emitter } from "@/lib/litechat/event-emitter";
import { useInputStore } from "@/store/input.store";
import { toast } from "sonner";
import { usePromptStateStore } from "@/store/prompt.store";
import { InteractionService } from "@/services/interaction.service";
import { nanoid } from "nanoid";
import type { CoreMessage } from "ai";

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

    const unsubControlRules = modApi.on(controlRegistryEvent.controlRulesChanged, (payload) => {
      if (payload) {
        // Auto-populate always-on control rules
        this.populateAlwaysOnRules();
        this.updateHasRulesOrTags();
        
        // Notify only the prompt trigger component, not the settings component
        // (settings component listens to events directly to avoid feedback loops)
        this.notifyComponentUpdate?.();
      }
    });

    this.eventUnsubscribers.push(unsubStatus, unsubRulesLoaded, unsubControlRules);
  }

  private populateAlwaysOnRules() {
    // Auto-activate always-on rules from both database and control rules
    const dbAlwaysOnRuleIds = this.allRules
      .filter(rule => rule.alwaysOn)
      .map(rule => rule.id);
    
    const controlRules = this.getControlRulesFromStore();
    const settings = useSettingsStore.getState();
    
    // For control rules, use settings preferences instead of module defaults
    const controlAlwaysOnRuleIds = Object.values(controlRules)
      .filter(rule => settings.controlRuleAlwaysOn[rule.id] ?? true) // Use DB setting or default to true
      .map(rule => rule.id);
    
    // Debug logging to track the issue
    console.log('[RulesControlModule] Control rules evaluation:', {
      controlRuleIds: Object.keys(controlRules),
      settings: settings.controlRuleAlwaysOn,
      filteredControlRuleIds: controlAlwaysOnRuleIds,
      dbAlwaysOnRuleIds
    });
    
    const allAlwaysOnRuleIds = [...dbAlwaysOnRuleIds, ...controlAlwaysOnRuleIds];
    
    if (allAlwaysOnRuleIds.length > 0) {
      this.transientActiveRuleIds = new Set([
        ...this.transientActiveRuleIds,
        ...allAlwaysOnRuleIds
      ]);
    }
    
    console.log('[RulesControlModule] Final transientActiveRuleIds:', Array.from(this.transientActiveRuleIds));
  }

  private getControlRulesFromStore(): Record<string, ModControlRule> {
    // Access control rules from the store directly
    return useControlRegistryStore.getState().getControlRules();
  }

  private updateHasRulesOrTags() {
    const controlRules = this.getControlRulesFromStore();
    const newHasRulesOrTags =
      this.allRules.length > 0 || Object.keys(controlRules).length > 0 || this.allTags.length > 0;
    if (this.hasRulesOrTags !== newHasRulesOrTags) {
      this.hasRulesOrTags = newHasRulesOrTags;
    }
  }

  public getAllRules = (): DbRule[] => {
    // Merge database rules and control rules, converting control rules to DbRule format
    const dbRules = this.allRules;
    const controlRules = this.getControlRulesFromStore();
    const settings = useSettingsStore.getState();
    
    // Convert control rules to DbRule format with settings override for alwaysOn
    const defaultDate = new Date(); // Create once and reuse
    const controlRulesAsDbRules: DbRule[] = Object.values(controlRules).map(controlRule => ({
      id: controlRule.id,
      name: controlRule.name,
      content: controlRule.content,
      type: controlRule.type,
      alwaysOn: settings.controlRuleAlwaysOn[controlRule.id] ?? true, // Use DB setting or default to true
      createdAt: defaultDate,
      updatedAt: defaultDate,
    }));
    
    const allRules = [...dbRules, ...controlRulesAsDbRules];
    
    return allRules;
  };

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
    // First check database rules
    const dbRule = this.allRules.find((r) => r.id === ruleId);
    if (dbRule) return dbRule;
    
    // Then check control rules
    const controlRules = this.getControlRulesFromStore();
    const controlRule = controlRules[ruleId];
    if (controlRule) {
      const settings = useSettingsStore.getState();
      return {
        id: controlRule.id,
        name: controlRule.name,
        content: controlRule.content,
        type: controlRule.type,
        alwaysOn: settings.controlRuleAlwaysOn[controlRule.id] ?? true, // Use DB setting or default to true
        createdAt: new Date(), // Default date for control rules
        updatedAt: new Date(), // Default date for control rules
      };
    }
    
    return undefined;
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
    // For control rules, only allow alwaysOn updates via settings
    // For control rules, only allow alwaysOn updates via settings
    if (this.isControlRule(id)) {
      // Only allow toggling alwaysOn for control rules
      if (Object.keys(updates).length === 1 && 'alwaysOn' in updates) {
        // Update via settings store instead of in-memory control rules
        useSettingsStore.getState().setControlRuleAlwaysOn(id, updates.alwaysOn!);
        
        // Update active rules based on the new alwaysOn setting
        if (updates.alwaysOn) {
          // Add to active rules if turned on
          this.transientActiveRuleIds.add(id);
        } else {
          // Remove from active rules if turned off
          this.transientActiveRuleIds.delete(id);
        }
        
        // Emit control rules changed event so trigger components can refresh
        emitter.emit(controlRegistryEvent.controlRulesChanged, {
          controlRules: this.getControlRulesFromStore(),
        });
        
        // Single notification after state is updated
        this.notifyComponentUpdate?.();
        this.notifySettingsComponentUpdate?.();
        
        return;
      } else {
        console.warn(`Attempted to update control rule "${id}" with non-alwaysOn properties. Only alwaysOn can be modified for control rules.`);
        return;
      }
    }
    // For database rules, use the rules event system
    this.modApiRef?.emit(rulesEvent.updateRuleRequest, { id, updates });
  };
  public deleteRule = (id: string) => {
    // Prevent deleting control rules - they are managed automatically by modules
    if (this.isControlRule(id)) {
      console.warn(`Attempted to delete control rule "${id}". Control rules are managed automatically by modules.`);
      // Silently ignore the delete request for control rules
      return;
    }
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

          // Debug logging to track what's being sent to system prompt
          console.log('[RulesControlModule] getMetadata - Sending to system prompt:', {
            activeRuleIds,
            allEffectiveRuleIds: Array.from(allEffectiveRuleIds),
            effectiveRulesContent: effectiveRulesContent.map(r => ({ 
              sourceRuleId: r.sourceRuleId, 
              type: r.type, 
              contentPreview: r.content.substring(0, 100) + '...' 
            }))
          });
          
          // Enhanced debug: Show actual rule names and settings
          const controlRules = this.getControlRulesFromStore();
          const settings = useSettingsStore.getState();
          console.log('[RulesControlModule] getMetadata - Detailed rule analysis:', {
            allControlRuleIds: Object.keys(controlRules),
            controlRuleSettings: settings.controlRuleAlwaysOn,
            activeRuleIdsWithNames: activeRuleIds.map(id => {
              const rule = this.getRuleById(id);
              return { id, name: rule?.name || 'Unknown', type: rule?.type, isControl: this.isControlRule(id) };
            }),
            currentTransientActiveRuleIds: Array.from(this.transientActiveRuleIds)
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
          
          // Clear regular rules but preserve always-on rules from both database and control rules
          const dbAlwaysOnRuleIds = new Set(
            this.allRules
              .filter(rule => rule.alwaysOn)
              .map(rule => rule.id)
          );
          
          const controlRules = this.getControlRulesFromStore();
          const settings = useSettingsStore.getState();
          
          // For control rules, use settings preferences instead of module defaults
          const controlAlwaysOnRuleIds = new Set(
            Object.values(controlRules)
              .filter(rule => settings.controlRuleAlwaysOn[rule.id] ?? true) // Use DB setting or default to true
              .map(rule => rule.id)
          );
          
          const allAlwaysOnRuleIds = new Set([...dbAlwaysOnRuleIds, ...controlAlwaysOnRuleIds]);
          
          if (this.transientActiveTagIds.size > 0) {
            this.transientActiveTagIds = new Set<string>();
            changed = true;
          }
          
          // Only remove rules that are not always-on
          const newActiveRuleIds = new Set<string>();
          this.transientActiveRuleIds.forEach(ruleId => {
            if (allAlwaysOnRuleIds.has(ruleId)) {
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

  // Helper method to check if a rule is a control rule
  public isControlRule = (ruleId: string): boolean => {
    const controlRules = this.getControlRulesFromStore();
    return controlRules.hasOwnProperty(ruleId);
  };

  public async autoSelectRules() {
    const settings = useSettingsStore.getState();
    if (!settings.autoRuleSelectionEnabled) {
      toast.info("Auto-rule selection is disabled in settings.");
      return;
    }
    // Get the current user prompt from the input area (same as auto-title gets turnData.content)
    let userPrompt = "";
    try {
      const inputEl = document.querySelector("textarea[aria-label='Chat input']") as HTMLTextAreaElement | null;
      userPrompt = inputEl?.value || "";
    } catch {}
    if (!userPrompt) {
      toast.error("No user prompt found.");
      return;
    }
    const rules = this.getAllRules ? this.getAllRules() : [];
    if (!rules.length) {
      toast.error("No rules available for selection.");
      return;
    }
    // Format rules for the prompt
    const rulesString = rules.map(r => `- ${r.name} (id: ${r.id})${r.content ? `: ${r.content}` : ""}`).join("\n");
    let promptTemplate = settings.autoRuleSelectionPrompt || "";
    const filledPrompt = promptTemplate.replace("{{prompt}}", userPrompt).replace("{{rules}}", rulesString);

    // Build PromptObject (like auto-title)
    const promptObject = {
      system: "Given the user prompt and the list of available rules, select the most relevant rules for this conversation. Return ONLY a JSON array of rule IDs.",
      messages: [
        { role: "user", content: filledPrompt } as CoreMessage
      ],
      parameters: {
        temperature: 0.2,
        max_tokens: 256,
      },
      metadata: {
        modelId: settings.autoRuleSelectionModelId || undefined,
        isRuleSelection: true,
      },
      tools: undefined,
      toolChoice: 'none' as const,
    };
    const turnData = {
      id: nanoid(),
      content: `[Auto-select rules for: ${userPrompt.substring(0, 50)}...]`,
      parameters: promptObject.parameters,
      metadata: {
        ...promptObject.metadata,
        originalPrompt: userPrompt,
      },
    };
    // Use a fake conversationId (null) since this is not tied to a conversation, or use a real one if available
    let conversationId = null;
    try {
      // Try to get the current conversationId if possible
      const interactionStore = require("@/store/interaction.store");
      conversationId = interactionStore.useInteractionStore.getState().currentConversationId || null;
    } catch {}
    try {
      const result = await InteractionService.startInteraction(
        promptObject,
        conversationId,
        turnData,
        'rules.auto_selection'
      );
      if (!result || !result.response) {
        toast.error("No response from AI for rule selection.");
        return;
      }
      let ruleIds: string[] = [];
      try {
        ruleIds = JSON.parse(result.response.trim());
        if (!Array.isArray(ruleIds)) throw new Error("Not an array");
      } catch (err) {
        toast.error("AI response was not a valid JSON array of rule IDs.");
        return;
      }
      if (this.setActiveRuleIds) {
        this.setActiveRuleIds(() => new Set(ruleIds));
        toast.success("Auto-selected rules applied.");
      } else {
        toast.error("setActiveRuleIds method not available.");
      }
    } catch (error) {
      toast.error("Failed to auto-select rules.");
      console.error("Auto-select rules error:", error);
    }
  }
}
