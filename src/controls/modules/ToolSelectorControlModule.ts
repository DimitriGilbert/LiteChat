// src/controls/modules/ToolSelectorControlModule.ts
// FULL FILE
import React from "react";
import { type ControlModule } from "@/types/litechat/control";
import { type LiteChatModApi } from "@/types/litechat/modding";
import { interactionEvent } from "@/types/litechat/events/interaction.events";
import { providerEvent } from "@/types/litechat/events/provider.events";
import { uiEvent } from "@/types/litechat/events/ui.events";
import { settingsEvent } from "@/types/litechat/events/settings.events";
import { controlRegistryEvent } from "@/types/litechat/events/control.registry.events";
import { ToolSelectorTrigger } from "@/controls/components/tool-selector/ToolSelectorTrigger";
import { useInteractionStore } from "@/store/interaction.store";
import { useProviderStore } from "@/store/provider.store";
import { useConversationStore } from "@/store/conversation.store";
import { useControlRegistryStore } from "@/store/control.store";
import { useSettingsStore } from "@/store/settings.store";
import type { SidebarItemType } from "@/types/litechat/chat";
import { AIService } from "@/services/ai.service";
import { splitModelId, instantiateModelInstance } from "@/lib/litechat/provider-helpers";
import type { TriggerNamespace, TriggerExecutionContext } from "@/types/litechat/text-triggers";

export class ToolSelectorControlModule implements ControlModule {
  readonly id = "core-tool-selector";
  private unregisterCallback: (() => void) | null = null;
  private eventUnsubscribers: (() => void)[] = [];

  public transientEnabledTools = new Set<string>();
  public transientMaxStepsOverride: number | null = null;

  public isStreaming = false;
  public isVisible = true;
  public selectedItemId: string | null = null;
  public selectedItemType: SidebarItemType | null = null; // Added property
  public allToolsCount = 0;
  public globalDefaultMaxSteps = 5;

  private notifyComponentUpdate: (() => void) | null = null;

  async initialize(modApi: LiteChatModApi): Promise<void> {
    this.modApiRef = modApi;
    this.loadInitialState();
    this.updateVisibility();
    this.notifyComponentUpdate?.();

    const unsubStatus = modApi.on(interactionEvent.statusChanged, (payload) => {
      if (typeof payload === "object" && payload && "status" in payload) {
        if (this.isStreaming !== (payload.status === "streaming")) {
          this.isStreaming = payload.status === "streaming";
          this.notifyComponentUpdate?.();
        }
      }
    });
    const unsubModel = modApi.on(providerEvent.selectedModelChanged, () => {
      this.updateVisibility();
      this.notifyComponentUpdate?.();
    });
    const unsubContext = modApi.on(uiEvent.contextChanged, (payload) => {
      this.selectedItemId = payload.selectedItemId;
      this.selectedItemType = payload.selectedItemType; // Update selectedItemType
      this.updateVisibility();
      this.notifyComponentUpdate?.();
    });
    const unsubSettings = modApi.on(
      settingsEvent.toolMaxStepsChanged,
      (payload) => {
        if (typeof payload === "object" && payload && "steps" in payload) {
          this.globalDefaultMaxSteps = payload.steps;
          this.notifyComponentUpdate?.();
        }
      }
    );

    const unsubToolsChanged = modApi.on(
      controlRegistryEvent.toolsChanged,
      (payload) => {
        if (payload && typeof payload.tools === "object") {
          const newToolCount = Object.keys(payload.tools).length;
          if (this.allToolsCount !== newToolCount) {
            this.allToolsCount = newToolCount;
            this.updateVisibility();
            this.notifyComponentUpdate?.();
          }
        }
      }
    );

    this.eventUnsubscribers.push(
      unsubStatus,
      unsubModel,
      unsubContext,
      unsubSettings,
      unsubToolsChanged
    );
  }

  private loadInitialState() {
    this.isStreaming = useInteractionStore.getState().status === "streaming";
    this.selectedItemId = useConversationStore.getState().selectedItemId;
    this.selectedItemType = useConversationStore.getState().selectedItemType; // Initialize selectedItemType
    this.allToolsCount = Object.keys(
      useControlRegistryStore.getState().tools
    ).length;
    this.globalDefaultMaxSteps = useSettingsStore.getState().toolMaxSteps;
  }

  private updateVisibility() {
    const { getSelectedModel } = useProviderStore.getState();
    const selectedModel = getSelectedModel();
    const hasRegisteredTools = this.allToolsCount > 0;

    const modelSupportsTools =
      selectedModel?.metadata?.supported_parameters?.includes("tools") ?? false;

    const newVisibility = hasRegisteredTools && modelSupportsTools;

    if (this.isVisible !== newVisibility) {
      this.isVisible = newVisibility;
    }
  }

  public getEnabledTools = (): Set<string> => this.transientEnabledTools;
  public getMaxStepsOverride = (): number | null =>
    this.transientMaxStepsOverride;
  public getIsStreaming = (): boolean => this.isStreaming;
  public getIsVisible = (): boolean => this.isVisible;
  public getSelectedItemId = (): string | null => this.selectedItemId;
  public getSelectedItemType = (): SidebarItemType | null =>
    this.selectedItemType; // Getter for selectedItemType
  public getAllToolsCount = (): number => this.allToolsCount;
  public getGlobalDefaultMaxSteps = (): number => this.globalDefaultMaxSteps;

  public setEnabledTools = (updater: (prev: Set<string>) => Set<string>) => {
    this.transientEnabledTools = updater(this.transientEnabledTools);
    this.notifyComponentUpdate?.();
  };
  public setMaxStepsOverride = (steps: number | null) => {
    this.transientMaxStepsOverride = steps;
    this.notifyComponentUpdate?.();
  };

  public setNotifyCallback = (cb: (() => void) | null) => {
    this.notifyComponentUpdate = cb;
  };

  public autoSelectTools = async (promptOverride?: string) => {
    const settings = useSettingsStore.getState();
    if (!settings.autoToolSelectionEnabled) {
      console.info("Auto tool selection is disabled in settings");
      return;
    }
    
    // Get current prompt value from context
    let userPrompt = promptOverride ?? "";
    if (!userPrompt) {
      // Try to get from context snapshot if available
      try {
        const context = this.modApiRef?.getContextSnapshot();
        userPrompt = context?.promptInputValue ?? "";
      } catch (error) {
        console.warn("Could not get prompt from context:", error);
      }
    }
    
    if (!userPrompt) {
      console.error("No prompt text available for tool selection");
      return;
    }
    
    const availableTools = useControlRegistryStore.getState().tools;
    const toolsList = Object.entries(availableTools);
    
    if (toolsList.length === 0) {
      console.error("No tools available for selection");
      return;
    }
    
    const modelId = settings.autoToolSelectionModelId;
    if (!modelId) {
      console.error("No model configured for auto tool selection");
      return;
    }
    
    console.log("Selecting relevant tools...");
    
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
        throw new Error(`Invalid model ID or provider not found for ${modelId}`);
      }
      
      const modelInstance = instantiateModelInstance(
        providerConfig,
        specificModelId,
        apiKey === null ? undefined : apiKey,
      );
      
      if (!modelInstance) {
        throw new Error(`Failed to instantiate model: ${modelId}`);
      }
      
      const toolsString = toolsList
        .map(([toolName, toolData]) => 
          `- ${toolName}: ${toolData.definition.description || 'No description available'}`
        )
        .join("\n");
      
      const systemPrompt = "You are a helpful assistant that selects relevant tools based on a user's prompt. You only respond with a valid JSON array of strings.";
      
      const promptTemplate = settings.autoToolSelectionPrompt || 
        'Analyze the following user prompt and the list of available tools. Select the most relevant tools that would help accomplish the user\'s task. Respond with ONLY a JSON string array of the selected tool names, for example: ["tool1", "tool2"]. Do not include any other text, explanation, or markdown formatting.\n\nUSER PROMPT:\n{{prompt}}\n\nAVAILABLE TOOLS:\n{{tools}}';
      
      const filledPrompt = promptTemplate
        .replace("{{prompt}}", userPrompt)
        .replace("{{tools}}", toolsString);
      
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
      
      let toolNames: string[] = [];
      try {
        // Parse JSON response
        let cleaned = result.trim();
        cleaned = cleaned.replace(/^```json[\r\n]+|^```[\r\n]+|```$/gim, "").trim();
        const jsonMatch = cleaned.match(/\[.*?\]/s);
        if (!jsonMatch) {
          throw new Error("No JSON array found in the AI response.");
        }
        toolNames = JSON.parse(jsonMatch[0]);
        if (!Array.isArray(toolNames) || !toolNames.every((name) => typeof name === "string")) {
          throw new Error("AI response was not a valid JSON array of tool names.");
        }
      } catch (err) {
        console.error("Failed to parse AI response for tool selection:", err, "Raw response:", result);
        throw new Error(`AI response was not valid JSON. ${err instanceof Error ? err.message : ""}`);
      }
      
      // Validate tool names exist
      const validToolNames = toolNames.filter(name => availableTools[name]);
      const invalidToolNames = toolNames.filter(name => !availableTools[name]);
      
      if (invalidToolNames.length > 0) {
        console.warn("AI selected non-existent tools:", invalidToolNames);
      }
      
      this.setEnabledTools(() => new Set(validToolNames));
      console.log(`Selected ${validToolNames.length} tools: ${validToolNames.join(", ")}`);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Auto tool selection failed: ${errorMessage}`);
    }
  };

  private modApiRef: LiteChatModApi | null = null;

  register(modApi: LiteChatModApi): void {
    if (this.unregisterCallback) {
      console.warn(`[${this.id}] Already registered. Skipping.`);
      return;
    }

    // Register text trigger namespaces with the control registry
    const triggerNamespaces = this.getTextTriggerNamespaces();
    triggerNamespaces.forEach(namespace => {
      useControlRegistryStore.getState().registerTextTriggerNamespace(namespace);
    });
    this.unregisterCallback = modApi.registerPromptControl({
      id: this.id,
      triggerRenderer: () =>
        React.createElement(ToolSelectorTrigger, { module: this }),
      getMetadata: () => {
        if (
          this.transientEnabledTools.size > 0 ||
          this.transientMaxStepsOverride !== null
        ) {
          return {
            enabledTools: Array.from(this.transientEnabledTools),
            ...(this.transientMaxStepsOverride !== null && {
              maxSteps: this.transientMaxStepsOverride,
            }),
          };
        }
        return undefined;
      },
      clearOnSubmit: () => {
        let changed = false;
        if (this.transientEnabledTools.size > 0) {
          this.transientEnabledTools = new Set<string>();
          changed = true;
        }
        if (this.transientMaxStepsOverride !== null) {
          this.transientMaxStepsOverride = null;
          changed = true;
        }
        if (changed) this.notifyComponentUpdate?.();
      },
    });
  }

  getTextTriggerNamespaces(): TriggerNamespace[] {
    return [{
      id: 'tools',
      name: 'Tools',
      methods: {
        activate: {
          id: 'activate',
          name: 'Activate Tools',
          description: 'Activate specific tools for this prompt',
          argSchema: {
            minArgs: 1,
            maxArgs: 10,
            argTypes: ['tool-id' as const]
          },
          handler: this.handleToolsActivate
        },
        auto: {
          id: 'auto',
          name: 'Auto Select Tools',
          description: 'Automatically select relevant tools',
          argSchema: { minArgs: 0, maxArgs: 0, argTypes: [] as const },
          handler: this.handleToolsAuto
        }
      },
      moduleId: this.id
    }];
  }

  private handleToolsActivate = async (args: string[], context: TriggerExecutionContext) => {
    if (!context.turnData.metadata.enabledTools) {
      context.turnData.metadata.enabledTools = [];
    }
    context.turnData.metadata.enabledTools.push(...args);
  };

  private handleToolsAuto = async (_args: string[], context: TriggerExecutionContext) => {
    context.turnData.metadata.autoSelectTools = true;
  };

  destroy(): void {
    this.eventUnsubscribers.forEach((unsub) => unsub());
    this.eventUnsubscribers = [];
    if (this.unregisterCallback) {
      this.unregisterCallback();
      this.unregisterCallback = null;
    }
    
    // Unregister text trigger namespaces
    const triggerNamespaces = this.getTextTriggerNamespaces();
    triggerNamespaces.forEach(namespace => {
      useControlRegistryStore.getState().unregisterTextTriggerNamespace(namespace.id);
    });
    
    this.notifyComponentUpdate = null;
    this.modApiRef = null;
    console.log(`[${this.id}] Destroyed.`);
  }
}
