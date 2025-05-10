// src/controls/modules/ReasoningControlModule.ts
// FULL FILE
import React from "react";
import { type ControlModule } from "@/types/litechat/control";
import { type LiteChatModApi } from "@/types/litechat/modding";
import { interactionEvent } from "@/types/litechat/events/interaction.events";
import { providerEvent } from "@/types/litechat/events/provider.events";
import { promptEvent } from "@/types/litechat/events/prompt.events";
import { ReasoningControlTrigger } from "@/controls/components/reasoning/ReasoningControlTrigger";
import { useProviderStore } from "@/store/provider.store";
import { useInteractionStore } from "@/store/interaction.store";
import { usePromptStateStore } from "@/store/prompt.store";

export class ReasoningControlModule implements ControlModule {
  readonly id = "core-reasoning";
  private unregisterCallback: (() => void) | null = null;
  private eventUnsubscribers: (() => void)[] = [];

  public reasoningEnabled: boolean | null = null;
  public isStreaming = false;
  public isVisible = true;
  private notifyComponentUpdate: (() => void) | null = null;

  async initialize(modApi: LiteChatModApi): Promise<void> {
    this.reasoningEnabled = usePromptStateStore.getState().reasoningEnabled;
    this.isStreaming = useInteractionStore.getState().status === "streaming";
    this.updateVisibility();
    this.notifyComponentUpdate?.(); // Notify after initial visibility update

    const unsubStatus = modApi.on(interactionEvent.statusChanged, (payload) => {
      if (this.isStreaming !== (payload.status === "streaming")) {
        this.isStreaming = payload.status === "streaming";
        this.notifyComponentUpdate?.();
      }
    });
    const unsubModel = modApi.on(providerEvent.modelSelectionChanged, () => {
      this.updateVisibility();
      this.notifyComponentUpdate?.();
    });
    const unsubPromptParams = modApi.on(
      promptEvent.paramsChanged,
      (payload) => {
        if (
          "reasoningEnabled" in payload.params &&
          this.reasoningEnabled !== payload.params.reasoningEnabled
        ) {
          this.reasoningEnabled = payload.params.reasoningEnabled ?? null;
          this.notifyComponentUpdate?.();
        }
      }
    );

    this.eventUnsubscribers.push(unsubStatus, unsubModel, unsubPromptParams);
    console.log(`[${this.id}] Initialized.`);
  }

  private updateVisibility() {
    const { getSelectedModel } = useProviderStore.getState();
    const selectedModel = getSelectedModel();
    const newVisibility =
      selectedModel?.metadata?.supported_parameters?.includes("reasoning") ??
      false;
    if (this.isVisible !== newVisibility) {
      this.isVisible = newVisibility;
    }
  }

  public getReasoningEnabled = (): boolean | null => this.reasoningEnabled;
  public getIsStreaming = (): boolean => this.isStreaming;
  public getIsVisible = (): boolean => this.isVisible;

  public setReasoningEnabled = (enabled: boolean | null) => {
    this.reasoningEnabled = enabled;
    usePromptStateStore.getState().setReasoningEnabled(enabled);
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
        React.createElement(ReasoningControlTrigger, { module: this }),
      getMetadata: () => {
        return this.reasoningEnabled === true
          ? { reasoningEnabled: true }
          : undefined;
      },
      clearOnSubmit: () => {
        usePromptStateStore.getState().setReasoningEnabled(null);
      },
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
