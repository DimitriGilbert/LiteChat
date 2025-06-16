import React from "react";
import { type ControlModule } from "@/types/litechat/control";
import type { LiteChatModApi } from "@/types/litechat/modding";
import { ImprovePromptControl } from "@/controls/components/prompt/ImprovePromptControl";
import { providerEvent } from "@/types/litechat/events/provider.events";
import { promptEvent } from "@/types/litechat/events/prompt.events";
import type { ModelListItem } from "@/types/litechat/provider";
import { PromptEnhancementService } from "@/services/prompt-enhancement.service";
import { useProviderStore } from "@/store/provider.store";

export class ImprovePromptControlModule implements ControlModule {
  public readonly id = "improve-prompt-control";
  private eventUnsubscribers: (() => void)[] = [];
  // @ts-expect-error - Used in destroy method for cleanup
  private modApi: LiteChatModApi | null = null;
  private notifyComponentUpdate: (() => void) | null = null;

  // Provider state
  public globallyEnabledModels: ModelListItem[] = [];
  public isLoadingProviders = false;

  // Prompt state
  public currentPromptText = "";

  async initialize(modApi: LiteChatModApi): Promise<void> {
    this.modApi = modApi;

    // Initialize the enhancement service
    PromptEnhancementService.initialize();

    // Initialize state from provider store
    const initialProviderState = useProviderStore.getState();
    this.isLoadingProviders = initialProviderState.isLoading;
    this.globallyEnabledModels = initialProviderState.getGloballyEnabledModelDefinitions();

    // Subscribe to provider events to track enabled models
    const unsubGloballyEnabledModelsUpdated = modApi.on(
      providerEvent.globallyEnabledModelsUpdated,
      (payload: { models: ModelListItem[] }) => {
        let changed = false;
        if (
          JSON.stringify(this.globallyEnabledModels) !==
          JSON.stringify(payload.models)
        ) {
          this.globallyEnabledModels = payload.models;
          changed = true;
        }

        // Update loading state based on the provider store
        const newLoadingState = useProviderStore.getState().isLoading;
        if (this.isLoadingProviders !== newLoadingState) {
          this.isLoadingProviders = newLoadingState;
          changed = true;
        }

        if (changed) {
          this.notifyComponentUpdate?.();
        }
      }
    );

    // If the module initializes after the provider store has already loaded everything,
    // the globallyEnabledModelsUpdated event might have already fired.
    const unsubInitialDataLoaded = modApi.on(
      providerEvent.initialDataLoaded,
      () => {
        const providerState = useProviderStore.getState();
        let changed = false;
        if (this.isLoadingProviders !== providerState.isLoading) {
          this.isLoadingProviders = providerState.isLoading;
          changed = true;
        }
        const currentModels = providerState.getGloballyEnabledModelDefinitions();
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

    // Subscribe to prompt input changes to track current text
    const unsubInputTextChanged = modApi.on(
      promptEvent.inputTextStateChanged,
      (payload: { value: string }) => {
        this.currentPromptText = payload.value;
      }
    );

    // Subscribe to prompt input changes (legacy event)
    const unsubInputChanged = modApi.on(
      promptEvent.inputChanged,
      (payload: { value: string }) => {
        this.currentPromptText = payload.value;
      }
    );

    this.eventUnsubscribers.push(
      unsubGloballyEnabledModelsUpdated,
      unsubInitialDataLoaded,
      unsubInputTextChanged,
      unsubInputChanged
    );
  }

  destroy(): void {
    this.eventUnsubscribers.forEach((unsub) => unsub());
    this.eventUnsubscribers = [];
    this.notifyComponentUpdate = null;
    this.modApi = null; // Used for cleanup
  }

  setNotifyCallback(callback: (() => void) | null): void {
    this.notifyComponentUpdate = callback;
  }

  getCurrentPromptText(): string {
    return this.currentPromptText;
  }

  register(modApi: LiteChatModApi): void {
    modApi.registerPromptControl({
      id: this.id,
      status: () => "ready",
      triggerRenderer: () => {
        return React.createElement(ImprovePromptControl, {
          module: this,
        });
      },
    });
  }
} 