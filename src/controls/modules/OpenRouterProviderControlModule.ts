// src/controls/modules/OpenRouterProviderControlModule.ts
import React from "react";
import { type ControlModule, type ControlModuleConstructor } from "@/types/litechat/control";
import { type LiteChatModApi } from "@/types/litechat/modding";
import { providerEvent } from "@/types/litechat/events/provider.events";
import { conversationEvent } from "@/types/litechat/events/conversation.events";
import { interactionEvent } from "@/types/litechat/events/interaction.events";
import { OpenRouterProviderControlTrigger } from "@/controls/components/openrouter/OpenRouterProviderControlTrigger";
import { useProviderStore } from "@/store/provider.store";
import { splitModelId } from "@/lib/litechat/provider-helpers";
import { toast } from "sonner";

interface OpenRouterEndpointsResponse {
  data: {
    endpoints: Array<{
      name: string;
      provider_name: string;
      // Add other endpoint fields as needed
    }>;
  };
}

export class OpenRouterProviderControlModule implements ControlModule {
  readonly id = "openrouter-provider-control";
  private unregisterPromptControlCallback: (() => void) | null = null;
  private eventUnsubscribers: (() => void)[] = [];

  private selectedProviders = new Set<string>();
  private availableProviders: string[] = [];
  private isLoading = false;
  private hasFetched = false;
  private currentConversationId: string | null = null;
  private isStreaming = false;
  private shouldShowControl = false;
  private notifyComponentUpdate: (() => void) | null = null;

  async initialize(modApi: LiteChatModApi): Promise<void> {
    const context = modApi.getContextSnapshot();
    this.isStreaming = context.isStreaming;
    
    // Check initial provider
    this.updateShouldShowControl();

    // Listen to provider changes to show/hide control and reset fetch state
    const unsubProviderChanged = modApi.on(providerEvent.selectedModelChanged, () => {
      this.hasFetched = false;
      this.availableProviders = [];
      this.selectedProviders.clear();
      this.updateShouldShowControl();
      this.notifyComponentUpdate?.();
    });

    // Listen to conversation changes to reset fetch state
    const unsubConversationChanged = modApi.on(conversationEvent.selectedItemChanged, (payload) => {
      if (payload.itemType === "conversation" && payload.itemId !== this.currentConversationId) {
        this.currentConversationId = payload.itemId;
        this.hasFetched = false;
        this.availableProviders = [];
        this.selectedProviders.clear();
        this.notifyComponentUpdate?.();
      }
    });


    // Listen to streaming status changes
    const unsubStatus = modApi.on(interactionEvent.statusChanged, (payload) => {
      if (typeof payload === "object" && payload && "status" in payload) {
        if (this.isStreaming !== (payload.status === "streaming")) {
          this.isStreaming = payload.status === "streaming";
          this.notifyComponentUpdate?.();
        }
      }
    });

    this.eventUnsubscribers.push(unsubProviderChanged, unsubConversationChanged, unsubStatus);
  }

  private updateShouldShowControl(): void {
    const selectedModel = useProviderStore.getState().getSelectedModel();
    
    if (!selectedModel) {
      this.shouldShowControl = false;
      return;
    }

    const { providerId } = splitModelId(selectedModel.id);
    
    if (!providerId) {
      this.shouldShowControl = false;
      return;
    }

    const providerConfig = useProviderStore.getState().dbProviderConfigs.find(p => p.id === providerId);
    
    this.shouldShowControl = providerConfig?.type === "openrouter";
  }

  public getShouldShowControl = (): boolean => this.shouldShowControl;
  public getIsLoading = (): boolean => this.isLoading;
  public getAvailableProviders = (): string[] => this.availableProviders;
  public getSelectedProviders = (): Set<string> => this.selectedProviders;
  public getIsStreaming = (): boolean => this.isStreaming;

  public setSelectedProviders = (updater: (prev: Set<string>) => Set<string>) => {
    this.selectedProviders = updater(this.selectedProviders);
    this.notifyComponentUpdate?.();
  };

  public setNotifyCallback = (cb: (() => void) | null) => {
    this.notifyComponentUpdate = cb;
  };

  public fetchEndpoints = async (): Promise<void> => {
    if (this.hasFetched || this.isLoading) {
      return;
    }

    const selectedModel = useProviderStore.getState().getSelectedModel();
    if (!selectedModel) {
      toast.error("No model selected");
      return;
    }

    const { modelId } = splitModelId(selectedModel.id);
    if (!modelId) {
      toast.error("Invalid model ID format");
      return;
    }

    this.isLoading = true;
    this.notifyComponentUpdate?.();

    try {
      const url = `https://openrouter.ai/api/v1/models/${modelId}/endpoints`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: OpenRouterEndpointsResponse = await response.json();
      
      // Extract provider names from endpoints
      const providers = data.data.endpoints.map(endpoint => endpoint.provider_name);
      // Remove duplicates
      const uniqueProviders = Array.from(new Set(providers));
      
      this.availableProviders = uniqueProviders;
      // Set all providers as selected by default
      this.selectedProviders = new Set(uniqueProviders);
      this.hasFetched = true;
      
      if (uniqueProviders.length === 0) {
        toast.info("No inference providers found for this model");
      }
    } catch (error) {
      console.error("Failed to fetch OpenRouter endpoints:", error);
      toast.error(`Failed to fetch inference providers: ${error instanceof Error ? error.message : String(error)}`);
      this.availableProviders = [];
    } finally {
      this.isLoading = false;
      this.notifyComponentUpdate?.();
    }
  };

  register(modApi: LiteChatModApi): void {

    if (!this.unregisterPromptControlCallback) {
      this.unregisterPromptControlCallback = modApi.registerPromptControl({
        id: this.id,
        status: () => (this.isLoading ? "loading" : "ready"),
        triggerRenderer: () =>
          React.createElement(OpenRouterProviderControlTrigger, { module: this }),
        getParameters: () => {
          const hasSelected = this.selectedProviders.size > 0;
          const hasAll = this.selectedProviders.size >= this.availableProviders.length;
          const shouldInclude = hasSelected && !hasAll;
          
          // Only include provider options if not all providers are selected
          if (shouldInclude) {
            return {
              providerOptions: {
                openrouter: {
                  provider: {
                    only: Array.from(this.selectedProviders)
                  }
                }
              }
            };
          }
          
          return undefined;
        },
        clearOnSubmit: () => {
          // Don't clear providers on submit - they should persist across turns
          // as requested by user
        },
      });
    }
  }

  destroy(): void {
    this.eventUnsubscribers.forEach((unsub) => unsub());
    this.eventUnsubscribers = [];
    if (this.unregisterPromptControlCallback) {
      this.unregisterPromptControlCallback();
      this.unregisterPromptControlCallback = null;
    }
    this.notifyComponentUpdate = null;
    console.log(`[${this.id}] Destroyed.`);
  }
}

(OpenRouterProviderControlModule as ControlModuleConstructor).translations = {
  en: {
    controls: {
      openRouterProvider: "Provider Selection",
      inferenceProviders: "Inference Providers",
    },
  },
  fr: {
    controls: {
      openRouterProvider: "Sélection de Fournisseur",
      inferenceProviders: "Fournisseurs d'Inférence",
    },
  },
};