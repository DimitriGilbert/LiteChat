// src/controls/modules/UsageDisplayControlModule.ts
// FULL FILE
import React from "react";
import { type ControlModule } from "@/types/litechat/control";
import {
  type LiteChatModApi,
  promptEvent, // Updated import
  inputEvent, // Updated import
  providerEvent, // Updated import
  interactionEvent, // Updated import
  uiEvent, // Updated import
} from "@/types/litechat/modding";
import { UsageDisplayControl } from "@/controls/components/usage-display/UsageDisplayControl";
import { useProviderStore } from "@/store/provider.store";
import { useInputStore } from "@/store/input.store";
import { useInteractionStore } from "@/store/interaction.store";
import type { Interaction } from "@/types/litechat/interaction";
import type { AttachedFileMetadata } from "@/store/input.store";
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
  private notifyComponentUpdate: (() => void) | null = null;

  async initialize(modApi: LiteChatModApi): Promise<void> {
    this.loadInitialState();
    this.updateContextLength();

    const unsubInput = modApi.on(promptEvent.inputChanged, (payload) => {
      this.currentInputText = payload.value;
      this.notifyComponentUpdate?.();
    });
    const unsubFiles = modApi.on(inputEvent.attachedFilesChanged, (payload) => {
      this.attachedFiles = payload.files;
      this.notifyComponentUpdate?.();
    });
    const unsubModel = modApi.on(
      providerEvent.modelSelectionChanged,
      (payload) => {
        this.selectedModelId = payload.modelId;
        this.updateContextLength();
        this.notifyComponentUpdate?.();
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
      // show method removed, visibility handled by UsageDisplayControl
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
