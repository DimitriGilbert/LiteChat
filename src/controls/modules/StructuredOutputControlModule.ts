// src/controls/modules/StructuredOutputControlModule.ts
// FULL FILE
import React from "react";
import { type ControlModule } from "@/types/litechat/control";
import { type LiteChatModApi } from "@/types/litechat/modding";
import { providerEvent } from "@/types/litechat/events/provider.events";
import { promptEvent as promptStateEvent } from "@/types/litechat/events/prompt.events";
import { VisibleStructuredOutputControl } from "@/controls/components/structured-output/VisibleStructuredOutputControl";
import { useProviderStore } from "@/store/provider.store";
import { usePromptStateStore } from "@/store/prompt.store";

export class StructuredOutputControlModule implements ControlModule {
  readonly id = "core-structured-output";
  private unregisterCallback: (() => void) | null = null;
  private eventUnsubscribers: (() => void)[] = [];
  private modApiRef: LiteChatModApi | null = null;

  public structuredOutputJson: string | null = null;
  public isVisible = true;
  private notifyComponentUpdate: (() => void) | null = null;

  async initialize(modApi: LiteChatModApi): Promise<void> {
    this.modApiRef = modApi;
    this.structuredOutputJson =
      usePromptStateStore.getState().structuredOutputJson;
    this.updateVisibility();
    this.notifyComponentUpdate?.();

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
            "structuredOutputJson" in params &&
            this.structuredOutputJson !== (params.structuredOutputJson ?? null)
          ) {
            this.structuredOutputJson = params.structuredOutputJson ?? null;
            this.notifyComponentUpdate?.();
          }
        }
      }
    );

    this.eventUnsubscribers.push(unsubModel, unsubPromptParams);
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
    this.modApiRef?.emit(promptStateEvent.setStructuredOutputJsonRequest, {
      json,
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
        this.modApiRef?.emit(promptStateEvent.setStructuredOutputJsonRequest, {
          json: null,
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
