// src/controls/modules/WebSearchControlModule.ts
// FULL FILE
import React from "react";
import { type ControlModule } from "@/types/litechat/control";
import { type LiteChatModApi } from "@/types/litechat/modding";
import { interactionEvent } from "@/types/litechat/events/interaction.events";
import { providerEvent } from "@/types/litechat/events/provider.events";
import { promptEvent as promptStateEvent } from "@/types/litechat/events/prompt.events";
import { WebSearchControlTrigger } from "@/controls/components/web-search/WebSearchControlTrigger";
import { useProviderStore } from "@/store/provider.store";
import { useInteractionStore } from "@/store/interaction.store";
import { usePromptStateStore } from "@/store/prompt.store";

export class WebSearchControlModule implements ControlModule {
  readonly id = "core-web-search";
  private unregisterCallback: (() => void) | null = null;
  private eventUnsubscribers: (() => void)[] = [];
  private modApiRef: LiteChatModApi | null = null;

  public webSearchEnabled: boolean | null = null;
  public isStreaming = false;
  public isVisible = true;
  private notifyComponentUpdate: (() => void) | null = null;

  async initialize(modApi: LiteChatModApi): Promise<void> {
    this.modApiRef = modApi;
    this.webSearchEnabled = usePromptStateStore.getState().webSearchEnabled;
    this.isStreaming = useInteractionStore.getState().status === "streaming";
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
    const unsubPromptParams = modApi.on(
      promptStateEvent.parameterChanged,
      (payload) => {
        if (typeof payload === "object" && payload && "params" in payload) {
          const params = payload.params;
          if (
            "webSearchEnabled" in params &&
            this.webSearchEnabled !== params.webSearchEnabled
          ) {
            this.webSearchEnabled = params.webSearchEnabled ?? null;
            this.notifyComponentUpdate?.();
          }
        }
      }
    );

    this.eventUnsubscribers.push(unsubStatus, unsubModel, unsubPromptParams);
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
    this.modApiRef?.emit(promptStateEvent.setWebSearchEnabledRequest, {
      enabled,
    });
    this.notifyComponentUpdate?.();
  };

  public setNotifyCallback = (cb: (() => void) | null) => {
    this.notifyComponentUpdate = cb;
  };

  register(modApi: LiteChatModApi): void {
    this.modApiRef = modApi;
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
        this.modApiRef?.emit(promptStateEvent.setWebSearchEnabledRequest, {
          enabled: null,
        });
      },
    });
  }

  destroy(): void {
    this.eventUnsubscribers.forEach((unsub) => unsub());
    this.eventUnsubscribers = [];
    if (this.unregisterCallback) {
      this.unregisterCallback();
      this.unregisterCallback = null;
    }
    this.notifyComponentUpdate = null;
    this.modApiRef = null;
    console.log(`[${this.id}] Destroyed.`);
  }
}
