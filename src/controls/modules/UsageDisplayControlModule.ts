// src/controls/modules/UsageDisplayControlModule.ts
// FULL FILE
import React from "react";
import { type ControlModule } from "@/types/litechat/control";
import { type LiteChatModApi } from "@/types/litechat/modding";
import { promptEvent } from "@/types/litechat/events/prompt.events";
import { inputEvent } from "@/types/litechat/events/input.events";
import { providerEvent } from "@/types/litechat/events/provider.events";
import { interactionEvent } from "@/types/litechat/events/interaction.events";
import { uiEvent } from "@/types/litechat/events/ui.events";
import { UsageDisplayControl } from "@/controls/components/usage-display/UsageDisplayControl";
import { useProviderStore } from "@/store/provider.store";
import { useInputStore } from "@/store/input.store";
import { useInteractionStore } from "@/store/interaction.store";
import type { Interaction } from "@/types/litechat/interaction";
import type { AttachedFileMetadata } from "@/store/input.store";
import type { PromptTurnObject } from "@/types/litechat/prompt";
import { PromptCompilationService } from "@/services/prompt-compilation.service";
import {
  createAiModelConfig,
  splitModelId,
} from "@/lib/litechat/provider-helpers";

const BYTES_PER_TOKEN_ESTIMATE = 4;

const estimateHistoryTokens = (interactions: Interaction[]): number => {
  let totalBytes = 0;
  interactions.forEach((i) => {
    if (i.prompt?.content) {
      totalBytes += new TextEncoder().encode(i.prompt.content).length;
    }
    i.prompt?.metadata?.attachedFiles?.forEach((f) => {
      totalBytes += f.size;
    });
    if (i.response && typeof i.response === "string") {
      totalBytes += new TextEncoder().encode(i.response).length;
    }
  });
  return Math.ceil(totalBytes / BYTES_PER_TOKEN_ESTIMATE);
};

export class UsageDisplayControlModule implements ControlModule {
  readonly id = "core-usage-display";
  private unregisterCallback: (() => void) | null = null;
  private eventUnsubscribers: (() => void)[] = [];

  public currentInputText = "";
  public historyTokens = 0;
  public attachedFiles: AttachedFileMetadata[] = [];
  public selectedModelId: string | null = null;
  public contextLength = 0;
  public estimatedPromptCost = 0;
  public estimatedPromptTokens = 0;
  private estimationDebounceTimer: NodeJS.Timeout | null = null;
  private notifyComponentUpdate: (() => void) | null = null;

  async initialize(modApi: LiteChatModApi): Promise<void> {
    this.loadInitialState();
    this.updateContextLength();

    const unsubInput = modApi.on(promptEvent.inputChanged, (payload) => {
      if (typeof payload === "object" && payload && "value" in payload) {
        this.currentInputText = payload.value;
        this._debouncedUpdateEstimation();
        this.notifyComponentUpdate?.();
      }
    });
    const unsubFiles = modApi.on(inputEvent.attachedFilesChanged, (payload) => {
      if (typeof payload === "object" && payload && "files" in payload) {
        this.attachedFiles = payload.files;
        this._debouncedUpdateEstimation();
        this.notifyComponentUpdate?.();
      }
    });
    const unsubModel = modApi.on(
      providerEvent.selectedModelChanged,
      (payload) => {
        if (typeof payload === "object" && payload && "modelId" in payload) {
          this.selectedModelId = payload.modelId;
          this.updateContextLength();
          this.notifyComponentUpdate?.();
        }
      }
    );
    const unsubInteractionComplete = modApi.on(
      interactionEvent.completed,
      () => {
        this.updateHistoryTokens();
        this.notifyComponentUpdate?.();
      }
    );
    const unsubContextChange = modApi.on(uiEvent.contextChanged, () => {
      this.updateHistoryTokens();
      this.notifyComponentUpdate?.();
    });

    this.eventUnsubscribers.push(
      unsubInput,
      unsubFiles,
      unsubModel,
      unsubInteractionComplete,
      unsubContextChange
    );
    console.log(`[${this.id}] Initialized.`);
  }

  private loadInitialState() {
    const inputState = useInputStore.getState();
    const providerState = useProviderStore.getState();
    this.attachedFiles = inputState.attachedFilesMetadata;
    this.selectedModelId = providerState.selectedModelId;
    this.updateHistoryTokens();
  }

  private updateHistoryTokens() {
    const interactionState = useInteractionStore.getState();
    if (interactionState.currentConversationId) {
      const staticInteractions = interactionState.interactions.filter(
        (i) => i.status === "COMPLETED"
      );
      this.historyTokens = estimateHistoryTokens(staticInteractions);
    } else {
      this.historyTokens = 0;
    }
  }

  private updateContextLength() {
    if (!this.selectedModelId) {
      this.contextLength = 0;
      return;
    }
    const { dbProviderConfigs, dbApiKeys } = useProviderStore.getState();
    const { providerId, modelId: specificModelId } = splitModelId(
      this.selectedModelId
    );
    if (!providerId || !specificModelId) {
      this.contextLength = 0;
      return;
    }
    const config = dbProviderConfigs.find((p) => p.id === providerId);
    if (!config) {
      this.contextLength = 0;
      return;
    }
    const apiKeyRecord = dbApiKeys.find((k) => k.id === config.apiKeyId);
    const model = createAiModelConfig(
      config,
      specificModelId,
      apiKeyRecord?.value
    );
    const meta = model?.metadata;
    this.contextLength =
      meta?.top_provider?.context_length ?? meta?.context_length ?? 0;
  }

  public getEstimatedInputTokens = (): number => {
    const inputTextBytes = new TextEncoder().encode(
      this.currentInputText
    ).length;
    const fileBytes = this.attachedFiles.reduce(
      (sum, file) => sum + file.size,
      0
    );
    return Math.ceil((inputTextBytes + fileBytes) / BYTES_PER_TOKEN_ESTIMATE);
  };

  public getTotalEstimatedTokens = (): number => {
    return this.historyTokens + this.getEstimatedInputTokens();
  };

  public getContextPercentage = (): number => {
    return this.contextLength
      ? Math.min(
          100,
          Math.round(
            (this.getTotalEstimatedTokens() / this.contextLength) * 100
          )
        )
      : 0;
  };

  public setNotifyCallback = (cb: (() => void) | null) => {
    this.notifyComponentUpdate = cb;
  };

  private _debouncedUpdateEstimation = () => {
    if (this.estimationDebounceTimer) {
      clearTimeout(this.estimationDebounceTimer);
    }
    this.estimationDebounceTimer = setTimeout(() => {
      this._updateEstimation().catch(error => {
        console.error("[UsageDisplayControlModule] Estimation error:", error);
      });
    }, 300); // 300ms debounce
  };

  private async _updateEstimation(): Promise<void> {
    const interactionStore = useInteractionStore.getState();
    const conversationId = interactionStore.currentConversationId;
    
    if (!conversationId || !this.selectedModelId) {
      this.estimatedPromptCost = 0;
      this.estimatedPromptTokens = 0;
      return;
    }

    try {
      // Construct a draft PromptTurnObject from current UI state
      const draftTurnData: PromptTurnObject = {
        id: "estimation",
        content: this.currentInputText,
        parameters: {},
        metadata: {
          attachedFiles: this.attachedFiles,
        },
      };

      // Use centralized prompt compilation service
      const promptObject = await PromptCompilationService.compilePrompt(
        draftTurnData,
        conversationId
      );

      // Count tokens for system prompt and all messages
      let totalBytes = 0;
      if (promptObject.system) {
        totalBytes += new TextEncoder().encode(promptObject.system).length;
      }
      if (Array.isArray(promptObject.messages)) {
        for (const msg of promptObject.messages) {
          if (Array.isArray(msg.content)) {
            for (const part of msg.content) {
              if (part.type === "text" && part.text) {
                totalBytes += new TextEncoder().encode(part.text).length;
              }
              // If part.type === "image", skip or count as 0 for now
            }
          } else if (typeof msg.content === "string") {
            totalBytes += new TextEncoder().encode(msg.content).length;
          }
        }
      }
      this.estimatedPromptTokens = Math.ceil(totalBytes / BYTES_PER_TOKEN_ESTIMATE);

      // Calculate cost using model pricing
      const { providerId, modelId: specificModelId } = splitModelId(this.selectedModelId);
      const { dbProviderConfigs } = useProviderStore.getState();
      const config = dbProviderConfigs.find((p) => p.id === providerId);
      
      if (config?.fetchedModels) {
        const modelDef = config.fetchedModels.find((m) => m.id === specificModelId);
        if (modelDef?.pricing) {
          const promptTokens = this.estimatedPromptTokens; // This is an approximation
          const completionTokens = 0; // Not tracked separately here
          let cost = 0;
          let formula = '';
          const promptPrice = parseFloat(modelDef.pricing.prompt || '0');
          const completionPrice = parseFloat(modelDef.pricing.completion || '0');
          if (promptPrice < 0.01 || completionPrice < 0.01) {
            // Per-token pricing
            cost = promptTokens * promptPrice + completionTokens * completionPrice;
            formula = 'per-token';
          } else {
            // Per-million pricing
            cost = (promptTokens / 1_000_000) * promptPrice + (completionTokens / 1_000_000) * completionPrice;
            formula = 'per-million';
          }
          this.estimatedPromptCost = cost;
          if (cost > 0) {
            console.debug(`[USAGE DISPLAY MODULE] Model: ${specificModelId}, PromptTokens: ${promptTokens}, PricePrompt: ${promptPrice}, PriceCompletion: ${completionPrice}, Cost: ${cost}, Formula: ${formula}`);
          }
        }
      }

      this.notifyComponentUpdate?.();
    } catch (error) {
      console.error("[UsageDisplayControlModule] Error updating estimation:", error);
      this.estimatedPromptCost = 0;
      this.estimatedPromptTokens = 0;
    }
  };

  register(modApi: LiteChatModApi): void {
    if (this.unregisterCallback) {
      console.warn(`[${this.id}] Already registered. Skipping.`);
      return;
    }
    this.unregisterCallback = modApi.registerPromptControl({
      id: this.id,
      status: () => "ready",
      triggerRenderer: () =>
        React.createElement(UsageDisplayControl, { module: this }),
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
    if (this.estimationDebounceTimer) {
      clearTimeout(this.estimationDebounceTimer);
      this.estimationDebounceTimer = null;
    }
    this.notifyComponentUpdate = null;
    console.log(`[${this.id}] Destroyed.`);
  }
}
