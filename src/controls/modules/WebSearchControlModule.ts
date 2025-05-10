// src/controls/modules/WebSearchControlModule.ts
// FULL FILE
import React from "react";
import { type ControlModule } from "@/types/litechat/control";
import { type LiteChatModApi } from "@/types/litechat/modding";
import { interactionEvent } from "@/types/litechat/events/interaction.events";
import { providerEvent } from "@/types/litechat/events/provider.events";
import { promptEvent } from "@/types/litechat/events/prompt.events";
import { WebSearchControlTrigger } from "@/controls/components/web-search/WebSearchControlTrigger";
import { useProviderStore } from "@/store/provider.store";
import { useInteractionStore } from "@/store/interaction.store";
import { usePromptStateStore } from "@/store/prompt.store";

export class WebSearchControlModule implements ControlModule {
  readonly id = "core-web-search";
  private unregisterCallback: (() => void) | null = null;
  private eventUnsubscribers: (() => void)[] = [];

  public webSearchEnabled: boolean | null = null;
  public isStreaming = false;
  public isVisible = true;
  private notifyComponentUpdate: (() => void) | null = null;

  async initialize(modApi: LiteChatModApi): Promise<void> {
    this.webSearchEnabled = usePromptStateStore.getState().webSearchEnabled;
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
          "webSearchEnabled" in payload.params &&
          this.webSearchEnabled !== payload.params.webSearchEnabled
        ) {
          this.webSearchEnabled = payload.params.webSearchEnabled ?? null;
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
    const supportedParams = selectedModel?.metadata?.supported_parameters ?? [];
    const newVisibility =
      supportedParams.includes("web_search") ||
      supportedParams.includes("web_search_options");
    if (this.isVisible !== newVisibility) {
      this.isVisible = newVisibility;
    }
  }

  public getWebSearchEnabled = (): boolean | null => this.webSearchEnabled;
  public getIsStreaming = (): boolean => this.isStreaming;
  public getIsVisible = (): boolean => this.isVisible;

  public setWebSearchEnabled = (enabled: boolean | null) => {
    this.webSearchEnabled = enabled;
    usePromptStateStore.getState().setWebSearchEnabled(enabled);
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
        React.createElement(WebSearchControlTrigger, { module: this }),
      getParameters: () => {
        return this.webSearchEnabled === true
          ? { web_search: true }
          : undefined;
      },
      clearOnSubmit: () => {
        usePromptStateStore.getState().setWebSearchEnabled(null);
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
