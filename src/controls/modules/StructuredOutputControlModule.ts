// src/controls/modules/StructuredOutputControlModule.ts
// FULL FILE
import React from "react";
import { type ControlModule } from "@/types/litechat/control";
import {
  type LiteChatModApi,
  providerEvent, // Updated import
  promptEvent, // Updated import
} from "@/types/litechat/modding";
import { VisibleStructuredOutputControl } from "@/controls/components/structured-output/VisibleStructuredOutputControl";
import { useProviderStore } from "@/store/provider.store";
import { usePromptStateStore } from "@/store/prompt.store";

export class StructuredOutputControlModule implements ControlModule {
  readonly id = "core-structured-output";
  private unregisterCallback: (() => void) | null = null;
  private eventUnsubscribers: (() => void)[] = [];

  public structuredOutputJson: string | null = null;
  public isVisible = true;
  private notifyComponentUpdate: (() => void) | null = null;

  async initialize(modApi: LiteChatModApi): Promise<void> {
    this.structuredOutputJson =
      usePromptStateStore.getState().structuredOutputJson;
    this.updateVisibility();

    const unsubModel = modApi.on(providerEvent.modelSelectionChanged, () => {
      this.updateVisibility();
      this.notifyComponentUpdate?.();
    });
    const unsubPromptParams = modApi.on(
      promptEvent.paramsChanged,
      (payload) => {
        if (
          "structuredOutputJson" in payload.params &&
          this.structuredOutputJson !==
            (payload.params.structuredOutputJson ?? null)
        ) {
          this.structuredOutputJson =
            payload.params.structuredOutputJson ?? null;
          this.notifyComponentUpdate?.();
        }
      }
    );

    this.eventUnsubscribers.push(unsubModel, unsubPromptParams);
    console.log(`[${this.id}] Initialized.`);
  }

  private updateVisibility() {
    const { getSelectedModel } = useProviderStore.getState();
    const selectedModel = getSelectedModel();
    const supportedParams = selectedModel?.metadata?.supported_parameters;
    const newVisibility =
      Array.isArray(supportedParams) &&
      supportedParams.includes("structured_output");
    if (this.isVisible !== newVisibility) {
      this.isVisible = newVisibility;
    }
  }

  public getStructuredOutputJson = (): string | null =>
    this.structuredOutputJson;
  public getIsVisible = (): boolean => this.isVisible;

  public setStructuredOutputJson = (json: string | null) => {
    this.structuredOutputJson = json;
    usePromptStateStore.getState().setStructuredOutputJson(json);
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
        React.createElement(VisibleStructuredOutputControl, { module: this }),
      getParameters: () => {
        if (this.structuredOutputJson) {
          try {
            const parsed = JSON.parse(this.structuredOutputJson);
            return { structured_output: parsed };
          } catch (e) {
            console.error("Invalid JSON in structured output state:", e);
            return undefined;
          }
        }
        return undefined;
      },
      clearOnSubmit: () => {
        usePromptStateStore.getState().setStructuredOutputJson(null);
      },
      // show method removed, visibility handled by VisibleStructuredOutputControl
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
