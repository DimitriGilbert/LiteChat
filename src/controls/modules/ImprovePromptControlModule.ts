import React from "react";
import { type ControlModule } from "@/types/litechat/control";
import type { LiteChatModApi } from "@/types/litechat/modding";
import { ImprovePromptControl } from "@/controls/components/prompt/ImprovePromptControl";
import { useProviderStore } from "@/store/provider.store";
import { providerEvent } from "@/types/litechat/events/provider.events";
import { promptEvent } from "@/types/litechat/events/prompt.events";
import type { ModelListItem } from "@/types/litechat/provider";
import { PromptEnhancementService } from "@/services/prompt-enhancement.service";

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
  private currentPromptText = "";

  async initialize(modApi: LiteChatModApi): Promise<void> {
    this.modApi = modApi;

    // Initialize the enhancement service
    PromptEnhancementService.initialize();

    // Get initial provider state
    const providerState = useProviderStore.getState();
    this.globallyEnabledModels = providerState.getGloballyEnabledModelDefinitions();
    this.isLoadingProviders = providerState.isLoading;

    // Subscribe to provider events to track enabled models
    const unsubGloballyEnabledModelsUpdated = modApi.on(
      providerEvent.globallyEnabledModelsUpdated,
      (payload: { models: ModelListItem[] }) => {
        this.globallyEnabledModels = payload.models;
        this.notifyComponentUpdate?.();
      }
    );

    const unsubInitialDataLoaded = modApi.on(
      providerEvent.initialDataLoaded,
      (data: any) => {
        if (data.globallyEnabledModels) {
          this.globallyEnabledModels = data.globallyEnabledModels;
          this.isLoadingProviders = false;
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