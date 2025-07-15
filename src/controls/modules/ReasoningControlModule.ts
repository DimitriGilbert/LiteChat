// src/controls/modules/ReasoningControlModule.ts
// FULL FILE
import React from "react";
import { type ControlModule } from "@/types/litechat/control";
import { type LiteChatModApi } from "@/types/litechat/modding";
import { interactionEvent } from "@/types/litechat/events/interaction.events";
import { providerEvent } from "@/types/litechat/events/provider.events";
import { promptEvent as promptStateEvent } from "@/types/litechat/events/prompt.events";
import { ReasoningControlTrigger } from "@/controls/components/reasoning/ReasoningControlTrigger";
import { useProviderStore } from "@/store/provider.store";
import { useInteractionStore } from "@/store/interaction.store";
import { usePromptStateStore } from "@/store/prompt.store";
import { useControlRegistryStore } from "@/store/control.store";
import type { TriggerNamespace, TriggerExecutionContext } from "@/types/litechat/text-triggers";

export class ReasoningControlModule implements ControlModule {
  readonly id = "core-reasoning";
  private unregisterCallback: (() => void) | null = null;
  private eventUnsubscribers: (() => void)[] = [];
  private modApiRef: LiteChatModApi | null = null;

  public reasoningEnabled: boolean | null = null;
  public isStreaming = false;
  public isVisible = true;
  private notifyComponentUpdate: (() => void) | null = null;

  async initialize(modApi: LiteChatModApi): Promise<void> {
    this.modApiRef = modApi;
    this.reasoningEnabled = usePromptStateStore.getState().reasoningEnabled;
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
            "reasoningEnabled" in params &&
            this.reasoningEnabled !== params.reasoningEnabled
          ) {
            this.reasoningEnabled = params.reasoningEnabled ?? null;
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
    this.modApiRef?.emit(promptStateEvent.setReasoningEnabledRequest, {
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

    // Register text trigger namespaces
    const triggerNamespaces = this.getTextTriggerNamespaces();
    triggerNamespaces.forEach(namespace => {
      useControlRegistryStore.getState().registerTextTriggerNamespace(namespace);
    });
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
        this.modApiRef?.emit(promptStateEvent.setReasoningEnabledRequest, {
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
    
    // Unregister text trigger namespaces
    const triggerNamespaces = this.getTextTriggerNamespaces();
    triggerNamespaces.forEach(namespace => {
      useControlRegistryStore.getState().unregisterTextTriggerNamespace(namespace.id);
    });
    
    this.notifyComponentUpdate = null;
    this.modApiRef = null;
    console.log(`[${this.id}] Destroyed.`);
  }

  getTextTriggerNamespaces(): TriggerNamespace[] {
    return [{
      id: 'reasoning',
      name: 'Reasoning',
      methods: {
        on: {
          id: 'on',
          name: 'Enable Reasoning',
          description: 'Enable reasoning mode for this prompt',
          argSchema: { minArgs: 0, maxArgs: 0, argTypes: [] as const },
          handler: this.handleReasoningOn
        },
        off: {
          id: 'off',
          name: 'Disable Reasoning',
          description: 'Disable reasoning mode for this prompt',
          argSchema: { minArgs: 0, maxArgs: 0, argTypes: [] as const },
          handler: this.handleReasoningOff
        }
      },
      moduleId: this.id
    }];
  }

  private handleReasoningOn = async (_args: string[], _context: TriggerExecutionContext) => {
    this.setReasoningEnabled(true);
  };

  private handleReasoningOff = async (_args: string[], _context: TriggerExecutionContext) => {
    this.setReasoningEnabled(false);
  };
}
