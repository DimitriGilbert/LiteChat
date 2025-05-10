// src/controls/modules/ParameterControlModule.ts
// FULL FILE
import React from "react";
import { type ControlModule } from "@/types/litechat/control";

import { type LiteChatModApi } from "@/types/litechat/modding";
import { interactionEvent } from "@/types/litechat/events/interaction.events";
import { settingsEvent } from "@/types/litechat/events/settings.events";
import { providerEvent } from "@/types/litechat/events/provider.events";
import { promptEvent } from "@/types/litechat/events/prompt.events";
import { ParameterControlTrigger } from "@/controls/components/parameter/ParameterControlTrigger";
import { useSettingsStore } from "@/store/settings.store";
import { useInteractionStore } from "@/store/interaction.store";
import { useProviderStore } from "@/store/provider.store";
import { usePromptStateStore } from "@/store/prompt.store";
import {
  createAiModelConfig,
  splitModelId,
} from "@/lib/litechat/provider-helpers";

export class ParameterControlModule implements ControlModule {
  readonly id = "core-parameters";
  private unregisterCallback: (() => void) | null = null;
  private eventUnsubscribers: (() => void)[] = [];

  public temperature: number | null = null;
  public topP: number | null = null;
  public maxTokens: number | null = null;
  public topK: number | null = null;
  public presencePenalty: number | null = null;
  public frequencyPenalty: number | null = null;

  public defaultTemperature: number | null = null;
  public defaultTopP: number | null = null;
  public defaultMaxTokens: number | null = null;
  public defaultTopK: number | null = null;
  public defaultPresencePenalty: number | null = null;
  public defaultFrequencyPenalty: number | null = null;

  public isStreaming = false;
  public isVisible = true;
  public supportedParams = new Set<string>();
  private notifyComponentUpdate: (() => void) | null = null;

  async initialize(modApi: LiteChatModApi): Promise<void> {
    this.loadInitialState();
    this.updateSupportedParams();

    const unsubStatus = modApi.on(interactionEvent.statusChanged, (payload) => {
      if (this.isStreaming !== (payload.status === "streaming")) {
        this.isStreaming = payload.status === "streaming";
        this.notifyComponentUpdate?.();
      }
    });
    const unsubModel = modApi.on(providerEvent.modelSelectionChanged, () => {
      this.updateSupportedParams();
      this.updateVisibility();
      this.notifyComponentUpdate?.();
    });
    const unsubSettings = modApi.on(
      settingsEvent.enableAdvancedSettingsChanged,
      () => {
        this.updateVisibility();
        this.notifyComponentUpdate?.();
      }
    );
    const unsubPromptParams = modApi.on(
      promptEvent.paramsChanged,
      (payload) => {
        let changed = false;
        if (
          "temperature" in payload.params &&
          this.temperature !== payload.params.temperature
        ) {
          this.temperature = payload.params.temperature ?? null;
          changed = true;
        }
        if ("topP" in payload.params && this.topP !== payload.params.topP) {
          this.topP = payload.params.topP ?? null;
          changed = true;
        }
        if (
          "maxTokens" in payload.params &&
          this.maxTokens !== payload.params.maxTokens
        ) {
          this.maxTokens = payload.params.maxTokens ?? null;
          changed = true;
        }
        if ("topK" in payload.params && this.topK !== payload.params.topK) {
          this.topK = payload.params.topK ?? null;
          changed = true;
        }
        if (
          "presencePenalty" in payload.params &&
          this.presencePenalty !== payload.params.presencePenalty
        ) {
          this.presencePenalty = payload.params.presencePenalty ?? null;
          changed = true;
        }
        if (
          "frequencyPenalty" in payload.params &&
          this.frequencyPenalty !== payload.params.frequencyPenalty
        ) {
          this.frequencyPenalty = payload.params.frequencyPenalty ?? null;
          changed = true;
        }
        if (changed) this.notifyComponentUpdate?.();
      }
    );

    this.eventUnsubscribers.push(
      unsubStatus,
      unsubModel,
      unsubSettings,
      unsubPromptParams
    );
    console.log(`[${this.id}] Initialized.`);
  }

  private loadInitialState() {
    const settings = useSettingsStore.getState();
    const promptState = usePromptStateStore.getState();
    this.isStreaming = useInteractionStore.getState().status === "streaming";

    this.temperature = promptState.temperature;
    this.topP = promptState.topP;
    this.maxTokens = promptState.maxTokens;
    this.topK = promptState.topK;
    this.presencePenalty = promptState.presencePenalty;
    this.frequencyPenalty = promptState.frequencyPenalty;

    this.defaultTemperature = settings.temperature;
    this.defaultTopP = settings.topP;
    this.defaultMaxTokens = settings.maxTokens;
    this.defaultTopK = settings.topK;
    this.defaultPresencePenalty = settings.presencePenalty;
    this.defaultFrequencyPenalty = settings.frequencyPenalty;

    this.updateVisibility();
  }

  private updateSupportedParams() {
    const providerState = useProviderStore.getState();
    if (!providerState.selectedModelId) {
      this.supportedParams = new Set();
      return;
    }
    const { providerId, modelId: specificModelId } = splitModelId(
      providerState.selectedModelId
    );
    if (!providerId || !specificModelId) {
      this.supportedParams = new Set();
      return;
    }
    const config = providerState.dbProviderConfigs.find(
      (p) => p.id === providerId
    );
    if (!config) {
      this.supportedParams = new Set();
      return;
    }
    const apiKeyRecord = providerState.dbApiKeys.find(
      (k) => k.id === config.apiKeyId
    );
    const model = createAiModelConfig(
      config,
      specificModelId,
      apiKeyRecord?.value
    );
    this.supportedParams = new Set(model?.metadata?.supported_parameters ?? []);
  }

  private updateVisibility() {
    const showAdvanced = useSettingsStore.getState().enableAdvancedSettings;
    const controlledParams = [
      "temperature",
      "top_p",
      "max_tokens",
      "top_k",
      "presence_penalty",
      "frequency_penalty",
    ];
    const newVisibility =
      showAdvanced && controlledParams.some((p) => this.supportedParams.has(p));
    if (this.isVisible !== newVisibility) {
      this.isVisible = newVisibility;
    }
  }

  public getIsStreaming = (): boolean => this.isStreaming;
  public getIsVisible = (): boolean => this.isVisible;

  public setTemperature = (value: number | null) => {
    this.temperature = value;
    usePromptStateStore.getState().setTemperature(value);
    this.notifyComponentUpdate?.();
  };
  public setTopP = (value: number | null) => {
    this.topP = value;
    usePromptStateStore.getState().setTopP(value);
    this.notifyComponentUpdate?.();
  };
  public setMaxTokens = (value: number | null) => {
    this.maxTokens = value;
    usePromptStateStore.getState().setMaxTokens(value);
    this.notifyComponentUpdate?.();
  };
  public setTopK = (value: number | null) => {
    this.topK = value;
    usePromptStateStore.getState().setTopK(value);
    this.notifyComponentUpdate?.();
  };
  public setPresencePenalty = (value: number | null) => {
    this.presencePenalty = value;
    usePromptStateStore.getState().setPresencePenalty(value);
    this.notifyComponentUpdate?.();
  };
  public setFrequencyPenalty = (value: number | null) => {
    this.frequencyPenalty = value;
    usePromptStateStore.getState().setFrequencyPenalty(value);
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
      status: () => "ready",
      triggerRenderer: () =>
        React.createElement(ParameterControlTrigger, { module: this }),
      getParameters: () => {
        const params: Record<string, any> = {};
        const addParam = (key: string, value: any) => {
          if (value !== null) params[key] = value;
        };
        addParam("temperature", this.temperature);
        addParam("top_p", this.topP);
        addParam("max_tokens", this.maxTokens);
        addParam("top_k", this.topK);
        addParam("presence_penalty", this.presencePenalty);
        addParam("frequency_penalty", this.frequencyPenalty);
        return Object.keys(params).length > 0 ? params : undefined;
      },
      // show method removed, visibility handled by ParameterControlTrigger
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
