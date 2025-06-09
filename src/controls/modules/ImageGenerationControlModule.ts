import React from "react";
import { type ControlModule } from "@/types/litechat/control";
import type { LiteChatModApi } from "@/types/litechat/modding";
import { ImageGenerationTrigger } from "@/controls/components/image-generation/ImageGenerationTrigger";
import { promptEvent } from "@/types/litechat/events/prompt.events";
import { providerEvent } from "@/types/litechat/events/provider.events";
import { interactionEvent } from "@/types/litechat/events/interaction.events";
import { useProviderStore } from "@/store/provider.store";
import { useInteractionStore } from "@/store/interaction.store";

export class ImageGenerationControlModule implements ControlModule {
  readonly id = "core-image-generation";

  private modApiRef: LiteChatModApi | null = null;
  private isImageGenerationEnabled: boolean | null = null;
  private unregisterCallback: (() => void) | null = null;
  private notifyComponentUpdate: (() => void) | null = null;
  private eventUnsubscribers: (() => void)[] = [];
  private isVisible = false;
  private isStreaming = false;

  async initialize(modApi: LiteChatModApi): Promise<void> {
    this.modApiRef = modApi;
    this.isImageGenerationEnabled = null; // Default to null (not set)
    this.isStreaming = useInteractionStore.getState().status === "streaming";
    this.updateVisibility();

    // Listen for model changes to update visibility
    const unsubModel = modApi.on(providerEvent.selectedModelChanged, () => {
      this.updateVisibility();
      this.notifyComponentUpdate?.();
    });

    // Listen for streaming status changes
    const unsubStatus = modApi.on(interactionEvent.statusChanged, (payload) => {
      if (typeof payload === "object" && payload && "status" in payload) {
        if (this.isStreaming !== (payload.status === "streaming")) {
          this.isStreaming = payload.status === "streaming";
          this.notifyComponentUpdate?.();
        }
      }
    });

    this.eventUnsubscribers.push(unsubModel, unsubStatus);
    console.log(`[${this.id}] Initialized.`);
  }

  private updateVisibility() {
    const { getSelectedModel } = useProviderStore.getState();
    const selectedModel = getSelectedModel();
    const outputModalities = selectedModel?.metadata?.architecture?.output_modalities ?? [];
    const newVisibility = outputModalities.includes("image");
    if (this.isVisible !== newVisibility) {
      this.isVisible = newVisibility;
    }
  }

  // Getters for UI components
  public getImageGenerationEnabled = (): boolean | null => this.isImageGenerationEnabled;
  public getIsVisible = (): boolean => this.isVisible;
  public getIsStreaming = (): boolean => this.isStreaming;

  // Setters for UI components  
  public setImageGenerationEnabled = (enabled: boolean | null) => {
    this.isImageGenerationEnabled = enabled;
    this.modApiRef?.emit(promptEvent.setImageGenerationEnabledRequest, {
      enabled,
    });
    this.notifyComponentUpdate?.();
  };

  public setNotifyCallback = (cb: (() => void) | null) => {
    this.notifyComponentUpdate = cb;
  };

  // private hasImageGenerationModels(): boolean {
  //   const { getAvailableModelListItems } = useProviderStore.getState();
  //   const allModels = getAvailableModelListItems();
    
  //   return allModels.some(model => {
  //     // Check if this model outputs images (text->image generation)
  //     // const architecture = model.metadataSummary.input_modalities;
  //     // For now, we'll use a simple heuristic - if model name contains image generation keywords
  //     const modelName = model.name.toLowerCase();
  //     return modelName.includes("dall-e") || modelName.includes("imagen") || 
  //            modelName.includes("flux") || modelName.includes("stable-diffusion");
  //   });
  // }

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
        React.createElement(ImageGenerationTrigger, { module: this }),
      getMetadata: () => {
        return this.isImageGenerationEnabled === true
          ? { imageGenerationEnabled: true }
          : undefined;
      },
      clearOnSubmit: () => {
        this.modApiRef?.emit(promptEvent.setImageGenerationEnabledRequest, {
          enabled: null,
        });
      },
    });

    // Register event listeners
    const imageGenerationEnabledHandler = (payload: { enabled: boolean | null }) => {
      if (payload.enabled !== this.isImageGenerationEnabled) {
        this.isImageGenerationEnabled = payload.enabled;
        this.notifyComponentUpdate?.();
      }
    };

    const unsubImageGeneration = this.modApiRef.on(promptEvent.setImageGenerationEnabledRequest, imageGenerationEnabledHandler);
    this.eventUnsubscribers.push(unsubImageGeneration);

    console.log(`[${this.id}] Registered successfully`);
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