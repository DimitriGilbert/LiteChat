// src/controls/modules/GlobalModelSelectorModule.ts
// FULL FILE
import React from "react";
import { type ControlModule } from "@/types/litechat/control";
import { type LiteChatModApi } from "@/types/litechat/modding";
import type { ModelListItem } from "@/types/litechat/provider";
import { interactionEvent } from "@/types/litechat/events/interaction.events";
import { providerEvent } from "@/types/litechat/events/provider.events";
import { GlobalModelSelector } from "@/controls/components/global-model-selector/GlobalModelSelector";
import { useProviderStore } from "@/store/provider.store"; // For getState in event handlers
import { useInteractionStore } from "@/store/interaction.store"; // For getState in event handlers
import { promptEvent as promptStateEvent } from "@/types/litechat/events/prompt.events";

export class GlobalModelSelectorModule implements ControlModule {
  readonly id = "core-global-model-selector";
  private unregisterCallback: (() => void) | null = null;
  private eventUnsubscribers: (() => void)[] = [];
  private modApiRef: LiteChatModApi | null = null;

  public selectedModelId: string | null = null;
  public isStreaming = false;
  public isLoadingProviders = true; // Start as true
  public globallyEnabledModels: ModelListItem[] = []; // Start empty
  private notifyComponentUpdate: (() => void) | null = null;

  async initialize(modApi: LiteChatModApi): Promise<void> {
    this.modApiRef = modApi;

    // Set initial loading and selected model (which might be null)
    // The definitive model list comes from the globallyEnabledModelsUpdated event.
    const initialProviderState = useProviderStore.getState();
    this.isLoadingProviders = initialProviderState.isLoading;
    this.selectedModelId = initialProviderState.selectedModelId;
    this.isStreaming = useInteractionStore.getState().status === "streaming";
    // If the store is already loaded, try to get the models, otherwise it will be updated by the event
    if (!this.isLoadingProviders) {
      this.globallyEnabledModels =
        initialProviderState.getGloballyEnabledModelDefinitions();
    }

    const unsubStatus = modApi.on(interactionEvent.statusChanged, (payload) => {
      if (typeof payload === "object" && payload && "status" in payload) {
        const newStreamingState = payload.status === "streaming";
        if (this.isStreaming !== newStreamingState) {
          this.isStreaming = newStreamingState;
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
            this.modApiRef?.emit(promptStateEvent.setModelIdRequest, {
              id: payload.modelId,
            });
            this.notifyComponentUpdate?.();
          }
        }
      }
    );

    // This is THE event that provides the correctly sorted list of enabled models.
    const unsubGloballyEnabledModelsUpdated = modApi.on(
      providerEvent.globallyEnabledModelsUpdated,
      (payload) => {
        let changed = false;
        if (
          JSON.stringify(this.globallyEnabledModels) !==
          JSON.stringify(payload.models)
        ) {
          this.globallyEnabledModels = payload.models; // This list IS ALREADY SORTED
          changed = true;
        }

        // Update loading state based on the provider store
        const newLoadingState = useProviderStore.getState().isLoading;
        if (this.isLoadingProviders !== newLoadingState) {
          this.isLoadingProviders = newLoadingState;
          changed = true;
        }

        // Ensure selectedModelId is current, as the available models might have changed
        const currentSelectedModelId =
          useProviderStore.getState().selectedModelId;
        if (this.selectedModelId !== currentSelectedModelId) {
          this.selectedModelId = currentSelectedModelId;
          this.modApiRef?.emit(promptStateEvent.setModelIdRequest, {
            id: this.selectedModelId,
          });
          changed = true;
        }

        if (changed) {
          this.notifyComponentUpdate?.();
        }
      }
    );

    // If the module initializes *after* the provider store has already loaded everything,
    // the globallyEnabledModelsUpdated event might have already fired.
    // So, we also check on initialDataLoaded.
    const unsubInitialDataLoaded = modApi.on(
      providerEvent.initialDataLoaded,
      () => {
        const providerState = useProviderStore.getState();
        let changed = false;
        if (this.isLoadingProviders !== providerState.isLoading) {
          this.isLoadingProviders = providerState.isLoading;
          changed = true;
        }
        if (this.selectedModelId !== providerState.selectedModelId) {
          this.selectedModelId = providerState.selectedModelId;
          this.modApiRef?.emit(promptStateEvent.setModelIdRequest, {
            id: this.selectedModelId,
          });
          changed = true;
        }
        const currentModels =
          providerState.getGloballyEnabledModelDefinitions();
        if (
          JSON.stringify(this.globallyEnabledModels) !==
          JSON.stringify(currentModels)
        ) {
          this.globallyEnabledModels = currentModels;
          changed = true;
        }
        if (changed) {
          this.notifyComponentUpdate?.();
        }
      }
    );

    this.eventUnsubscribers.push(
      unsubStatus,
      unsubModelChange,
      unsubGloballyEnabledModelsUpdated,
      unsubInitialDataLoaded
    );
  }

  public handleSelectionChange = (newModelId: string | null) => {
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
      status: () => (this.isLoadingProviders ? "loading" : "ready"),
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
