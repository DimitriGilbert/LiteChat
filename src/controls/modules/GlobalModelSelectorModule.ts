// src/controls/modules/GlobalModelSelectorModule.ts
// FULL FILE
import React from "react";
import { type ControlModule } from "@/types/litechat/control";
import { type LiteChatModApi } from "@/types/litechat/modding";
import { interactionEvent } from "@/types/litechat/events/interaction.events";
import { providerEvent } from "@/types/litechat/events/provider.events";
import { GlobalModelSelector } from "@/controls/components/global-model-selector/GlobalModelSelector";
import { useProviderStore } from "@/store/provider.store";
import { useInteractionStore } from "@/store/interaction.store";
import { promptEvent as promptStateEvent } from "@/types/litechat/events/prompt.events";

export class GlobalModelSelectorModule implements ControlModule {
  readonly id = "core-global-model-selector";
  private unregisterCallback: (() => void) | null = null;
  private eventUnsubscribers: (() => void)[] = [];
  private modApiRef: LiteChatModApi | null = null;

  public selectedModelId: string | null = null;
  public isStreaming = false;
  public isLoadingProviders = true;
  private notifyComponentUpdate: (() => void) | null = null;

  async initialize(modApi: LiteChatModApi): Promise<void> {
    this.modApiRef = modApi;
    this.loadInitialState();

    const unsubStatus = modApi.on(interactionEvent.statusChanged, (payload) => {
      if (typeof payload === "object" && payload && "status" in payload) {
        if (this.isStreaming !== (payload.status === "streaming")) {
          this.isStreaming = payload.status === "streaming";
          this.notifyComponentUpdate?.();
        }
      }
    });
    const unsubModelChange = modApi.on(
      providerEvent.selectedModelChanged,
      (payload) => {
        if (typeof payload === "object" && payload && "modelId" in payload) {
          if (this.selectedModelId !== payload.modelId) {
            this.selectedModelId = payload.modelId;
            // Emit request instead of direct call
            this.modApiRef?.emit(promptStateEvent.setModelIdRequest, {
              id: payload.modelId,
            });
            this.notifyComponentUpdate?.();
          }
        }
      }
    );
    const unsubProviderLoading = modApi.on(providerEvent.configsChanged, () => {
      const newLoadingState = useProviderStore.getState().isLoading;
      if (this.isLoadingProviders !== newLoadingState) {
        this.isLoadingProviders = newLoadingState;
        this.notifyComponentUpdate?.();
      }
    });

    this.eventUnsubscribers.push(
      unsubStatus,
      unsubModelChange,
      unsubProviderLoading
    );
  }

  private loadInitialState() {
    const providerState = useProviderStore.getState();
    this.selectedModelId = providerState.selectedModelId;
    this.isLoadingProviders = providerState.isLoading;
    this.isStreaming = useInteractionStore.getState().status === "streaming";
    // Emit request instead of direct call
    this.modApiRef?.emit(promptStateEvent.setModelIdRequest, {
      id: this.selectedModelId,
    });
  }

  public handleSelectionChange = (newModelId: string | null) => {
    // Emit requests instead of direct store calls
    this.modApiRef?.emit(providerEvent.selectModelRequest, {
      modelId: newModelId,
    });
    this.modApiRef?.emit(promptStateEvent.setModelIdRequest, {
      id: newModelId,
    });
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
      status: () =>
        useProviderStore.getState().isLoading ? "loading" : "ready",
      triggerRenderer: () =>
        React.createElement(GlobalModelSelector, { module: this }),
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
