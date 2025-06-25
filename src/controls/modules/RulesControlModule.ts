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
import { toast } from "sonner";
import { AIService } from "@/services/ai.service";
import {
  splitModelId,
  instantiateModelInstance,
} from "@/lib/litechat/provider-helpers";
import { useProviderStore } from "@/store/provider.store";
import { useInteractionStore } from "@/store/interaction.store";
import { PersistenceService } from "@/services/persistence.service";
import { nanoid } from "nanoid";
import type { Interaction } from "@/types/litechat/interaction";
import type { PromptTurnObject } from "@/types/litechat/prompt";

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

  private getEffectiveControlRuleAlwaysOn(controlRule: ModControlRule): boolean {
    const userSetting = useSettingsStore.getState().controlRuleAlwaysOn[controlRule.id];
    
    // If the user has explicitly set a value (true or false), we must respect it.
    if (typeof userSetting === 'boolean') {
      return userSetting;
    }
    
    // Otherwise, if no user setting exists for this rule, fall back to the 
    // default value specified in the control rule's module definition.
    return controlRule.alwaysOn;
  }

  private populateAlwaysOnRules() {
    // Auto-activate always-on rules from both database and control rules
    const dbAlwaysOnRuleIds = this.allRules
      .filter(rule => rule.alwaysOn)
      .map(rule => rule.id);
    
    const controlRules = this.getControlRulesFromStore();
    
    // For control rules, use settings preferences instead of module defaults
    const controlAlwaysOnRuleIds = Object.values(controlRules)
      .filter(rule => this.getEffectiveControlRuleAlwaysOn(rule)) // Use setting or fall back to rule's default
      .map(rule => rule.id);
    
    const allAlwaysOnRuleIds = new Set([...dbAlwaysOnRuleIds, ...controlAlwaysOnRuleIds]);
    
    // FIXED: Properly sync transientActiveRuleIds with the current always-on state
    // Add rules that should be always-on but aren't active
    for (const ruleId of allAlwaysOnRuleIds) {
      this.transientActiveRuleIds.add(ruleId);
    }
    
    // Remove rules that are no longer always-on (user turned them off)
    for (const ruleId of this.transientActiveRuleIds) {
      // Check if this is a control rule that's no longer always-on
      const controlRule = controlRules[ruleId];
      if (controlRule && !this.getEffectiveControlRuleAlwaysOn(controlRule)) {
        this.transientActiveRuleIds.delete(ruleId);
      }
      // Check if this is a DB rule that's no longer always-on
      const dbRule = this.allRules.find(r => r.id === ruleId);
      if (dbRule && !dbRule.alwaysOn) {
        this.transientActiveRuleIds.delete(ruleId);
      }
    }
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
    
    // Convert control rules to DbRule format with settings override for alwaysOn
    const defaultDate = new Date(); // Create once and reuse
    const controlRulesAsDbRules: DbRule[] = Object.values(controlRules).map(controlRule => ({
      id: controlRule.id,
      name: controlRule.name,
      content: controlRule.content,
      type: controlRule.type,
      alwaysOn: this.getEffectiveControlRuleAlwaysOn(controlRule), // Use setting or fall back to rule's default
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
      return {
        id: controlRule.id,
        name: controlRule.name,
        content: controlRule.content,
        type: controlRule.type,
        alwaysOn: this.getEffectiveControlRuleAlwaysOn(controlRule), // Use setting or fall back to rule's default
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
                    
          // For control rules, use settings preferences instead of module defaults
          const controlAlwaysOnRuleIds = new Set(
            Object.values(controlRules)
              .filter(rule => this.getEffectiveControlRuleAlwaysOn(rule)) // Use setting or fall back to rule's default
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

  public autoSelectRules = async (promptOverride?: string) => {
    const settings = useSettingsStore.getState();
    if (!settings.autoRuleSelectionEnabled) {
      toast.info("Auto-rule selection is disabled in settings.");
      return;
    }
    // Always get the current prompt value directly
    let userPrompt = promptOverride ?? this.modApiRef?.getContextSnapshot().promptInputValue ?? "";
    if (typeof userPrompt !== "string") userPrompt = String(userPrompt ?? "");
    if (!userPrompt) {
      toast.error("No user prompt found to base selection on.");
      return;
    }
    const rules = this.getAllRules();
    if (!rules.length) {
      toast.error("No rules available for selection.");
      return;
    }
    const modelId = settings.autoRuleSelectionModelId;
    if (!modelId) {
      toast.error("No model selected for auto-rule selection in settings.");
      return;
    }

    toast.loading("AI is selecting relevant rules...");

    const conversationId =
      useInteractionStore.getState().currentConversationId || "unassigned";
    const interactionId = nanoid();
    let interaction: Interaction | null = null;

    try {
      const { providerId, modelId: specificModelId } = splitModelId(modelId);
      
      if (!providerId) {
        throw new Error(`Could not determine provider from model ID: ${modelId}`);
      }

      const providerConfig = useProviderStore
        .getState()
        .dbProviderConfigs.find((p) => p.id === providerId);
      const apiKey = useProviderStore.getState().getApiKeyForProvider(providerId);

      if (!providerConfig || !specificModelId) {
        throw new Error(
          `Invalid model ID or provider not found for ${modelId}`,
        );
      }

      const modelInstance = instantiateModelInstance(
        providerConfig,
        specificModelId,
        apiKey === null ? undefined : apiKey,
      );

      if (!modelInstance) {
        throw new Error(`Failed to instantiate model: ${modelId}`);
      }

      const rulesString = rules
        .map(
          (r) =>
            `- ${r.name} (id: ${r.id})${
              r.content ? `: ${r.content.substring(0, 200)}...` : ""
            }`,
        )
        .join("\n");

      const systemPrompt =
        "You are a helpful assistant that selects contextual rules based on a user's prompt. You only respond with a valid JSON array of strings.";
      const promptTemplate =
        settings.autoRuleSelectionPrompt ||
        'Analyze the following user prompt and the list of available rules. Your task is to select the most relevant rules that should be applied. The user\'s goal is to get a better response from the AI. Respond with ONLY a JSON string array of the selected rule IDs, for example: ["rule-id-1", "rule-id-2"]. Do not include any other text, explanation, or markdown formatting.\n\nUSER PROMPT:\n{{prompt}}\n\nAVAILABLE RULES:\n{{rules}}';

      const filledPrompt = promptTemplate
        .replace("{{prompt}}", userPrompt)
        .replace("{{rules}}", rulesString);

      const turnData: PromptTurnObject = {
        id: nanoid(),
        content: `[Auto-select rules for: ${userPrompt.substring(0, 50)}...]`,
        parameters: { temperature: 0.1, maxTokens: 512 },
        metadata: {
          modelId: modelId,
          isRuleSelection: true,
          originalPrompt: userPrompt,
          systemPrompt: systemPrompt,
        },
      };

      interaction = {
        id: interactionId,
        conversationId: conversationId,
        startedAt: new Date(),
        endedAt: null,
        type: "rules.auto_selection",
        status: "STREAMING", // Indicates in-progress
        prompt: turnData,
        response: null,
        index: -1,
        parentId: null,
        metadata: { ...turnData.metadata },
      };

      await PersistenceService.saveInteraction(interaction);

      const result = await AIService.generateCompletion({
        model: modelInstance,
        system: systemPrompt,
        messages: [{ role: "user", content: filledPrompt }],
        temperature: 0.1,
        maxTokens: 512,
      });

      if (!result) {
        throw new Error("AI returned an empty response.");
      }

      let ruleIds: string[] = [];
      try {
        // Remove markdown code block wrappers and whitespace
        let cleaned = result.trim();
        // Remove ```json ... ``` or ``` ... ``` wrappers
        cleaned = cleaned.replace(/^```json[\r\n]+|^```[\r\n]+|```$/gim, "").trim();
        // Find the first JSON array in the cleaned string
        const jsonMatch = cleaned.match(/\[.*?\]/s);
        if (!jsonMatch) {
          throw new Error("No JSON array found in the AI response.");
        }
        ruleIds = JSON.parse(jsonMatch[0]);
        if (
          !Array.isArray(ruleIds) ||
          !ruleIds.every((id) => typeof id === "string")
        ) {
          throw new Error(
            "AI response was not a valid JSON array of rule IDs.",
          );
        }
      } catch (err) {
        console.error(
          "Failed to parse AI response for rule selection:",
          err,
          "Raw response:",
          result,
        );
        throw new Error(
          `AI response was not valid JSON. ${
            err instanceof Error ? err.message : ""
          }`,
        );
      }
      
      const finalInteraction: Interaction = {
        ...interaction,
        status: "COMPLETED",
        endedAt: new Date(),
        response: result,
        metadata: {
          ...interaction.metadata,
          selectedRuleIds: ruleIds,
        },
      };
      await PersistenceService.saveInteraction(finalInteraction);

      this.setActiveRuleIds(() => new Set(ruleIds));
      toast.dismiss();
      toast.success(`AI selected ${ruleIds.length} rules.`);
      
    } catch (error) {
      toast.dismiss();
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      toast.error(`Failed to auto-select rules: ${errorMessage}`);
      console.error("Auto-select rules error:", error);

      if (interaction) {
        const finalInteraction: Interaction = {
          ...interaction,
          status: "ERROR",
          endedAt: new Date(),
          response: null,
          metadata: {
            ...interaction.metadata,
            error: errorMessage,
          },
        };
        await PersistenceService.saveInteraction(finalInteraction);
      }
    }
  };
}
