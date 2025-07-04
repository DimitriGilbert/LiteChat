import React from "react";
import { type ControlModule } from "@/types/litechat/control";
import type { LiteChatModApi } from "@/types/litechat/modding";
import type { CanvasControlRenderContext } from "@/types/litechat/canvas/control";
import { ForkCompactActionControl } from "@/controls/components/canvas/ForkCompactActionControl";
import { useInteractionStore } from "@/store/interaction.store";
import { useProviderStore } from "@/store/provider.store";
import { providerEvent } from "@/types/litechat/events/provider.events";
import { interactionEvent } from "@/types/litechat/events/interaction.events";
import type { ModelListItem } from "@/types/litechat/provider";

export class ForkCompactActionControlModule implements ControlModule {
  readonly id = "core-canvas-fork-compact-action";

  private eventUnsubscribers: (() => void)[] = [];
  private notifyComponentUpdate: (() => void) | null = null;

  // State managed by the module
  public globallyEnabledModels: ModelListItem[] = [];
  public isLoadingProviders = true;

  async initialize(modApi: LiteChatModApi): Promise<void> {

    // Initialize state from provider store
    const initialProviderState = useProviderStore.getState();
    this.isLoadingProviders = initialProviderState.isLoading;
    this.globallyEnabledModels = initialProviderState.getGloballyEnabledModelDefinitions();

    // Listen to provider events to keep state in sync
    const unsubGloballyEnabledModelsUpdated = modApi.on(
      providerEvent.globallyEnabledModelsUpdated,
      (payload) => {
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

    // Listen to interaction status changes to re-evaluate button state
    const unsubInteractionStatusChanged = modApi.on(
      interactionEvent.statusChanged,
      () => {
        // Force re-render when interaction status changes
        // This ensures the button becomes enabled again after fork completes
        this.notifyComponentUpdate?.();
      }
    );

    this.eventUnsubscribers.push(
      unsubGloballyEnabledModelsUpdated,
      unsubInitialDataLoaded,
      unsubInteractionStatusChanged
    );
  }

  setNotifyCallback(callback: (() => void) | null): void {
    this.notifyComponentUpdate = callback;
  }

  register(modApi: LiteChatModApi): void {
    modApi.registerCanvasControl({
      id: this.id,
      type: "interaction",
      targetSlot: "actions", // Appears in the footer actions
      renderer: (context: CanvasControlRenderContext) => {
        if (!context.interactionId || !context.interaction) {
          // Safety check
          return null;
        }

        const currentInteraction = context.interaction;
        const interactionStoreState = useInteractionStore.getState();
        const globalStreamingStatus = interactionStoreState.status;
        
        // Fork compact is now available on all interactions, including the last one
        
        const canFork = 
          (currentInteraction.status === "COMPLETED" || currentInteraction.status === "ERROR") &&
          globalStreamingStatus !== "streaming";

        return React.createElement(ForkCompactActionControl, {
          module: this,
          interactionId: currentInteraction.id,
          disabled: !canFork,
        });
      },
    });
  }

  async cleanup(): Promise<void> {
    this.eventUnsubscribers.forEach(unsub => unsub());
    this.eventUnsubscribers = [];
    this.notifyComponentUpdate = null;
  }

  async destroy(): Promise<void> {
    await this.cleanup();
  }
} 