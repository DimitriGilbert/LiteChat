// src/controls/modules/ToolSelectorControlModule.ts
// FULL FILE
import React from "react";
import { type ControlModule } from "@/types/litechat/control";
import { type LiteChatModApi } from "@/types/litechat/modding";
import { interactionEvent } from "@/types/litechat/events/interaction.events";
import { providerEvent } from "@/types/litechat/events/provider.events";
import { uiEvent } from "@/types/litechat/events/ui.events";
import { settingsEvent } from "@/types/litechat/events/settings.events";
import { ToolSelectorTrigger } from "@/controls/components/tool-selector/ToolSelectorTrigger";
import { useInteractionStore } from "@/store/interaction.store";
import { useProviderStore } from "@/store/provider.store";
import { useConversationStore } from "@/store/conversation.store";
import { useControlRegistryStore } from "@/store/control.store";
import { useSettingsStore } from "@/store/settings.store";
import type { SidebarItemType } from "@/types/litechat/chat";

export class ToolSelectorControlModule implements ControlModule {
  readonly id = "core-tool-selector";
  private unregisterCallback: (() => void) | null = null;
  private eventUnsubscribers: (() => void)[] = [];

  public transientEnabledTools = new Set<string>();
  public transientMaxStepsOverride: number | null = null;

  public isStreaming = false;
  public isVisible = true;
  public selectedItemType: SidebarItemType | null = null;
  public selectedItemId: string | null = null;
  public allToolsCount = 0;
  public globalDefaultMaxSteps = 5;

  private notifyComponentUpdate: (() => void) | null = null;

  async initialize(modApi: LiteChatModApi): Promise<void> {
    this.loadInitialState();
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
    const unsubContext = modApi.on(uiEvent.contextChanged, (payload) => {
      this.selectedItemId = payload.selectedItemId;
      this.selectedItemType = payload.selectedItemType;
      this.updateVisibility();
      this.notifyComponentUpdate?.();
    });
    const unsubSettings = modApi.on(
      settingsEvent.toolMaxStepsChanged,
      (payload) => {
        if (typeof payload === "object" && payload && "steps" in payload) {
          this.globalDefaultMaxSteps = payload.steps;
          this.notifyComponentUpdate?.();
        }
      }
    );

    const controlStoreUnsubscribe = useControlRegistryStore.subscribe(
      (currentState, previousState) => {
        const currentTools = currentState.tools;
        const previousTools = previousState.tools;

        if (
          Object.keys(currentTools).length !==
            Object.keys(previousTools).length ||
          JSON.stringify(currentTools) !== JSON.stringify(previousTools)
        ) {
          this.allToolsCount = Object.keys(currentTools).length;
          this.updateVisibility();
          this.notifyComponentUpdate?.();
        }
      }
    );

    this.eventUnsubscribers.push(
      unsubStatus,
      unsubModel,
      unsubContext,
      unsubSettings,
      controlStoreUnsubscribe
    );
    console.log(`[${this.id}] Initialized.`);
  }

  private loadInitialState() {
    this.isStreaming = useInteractionStore.getState().status === "streaming";
    this.selectedItemId = useConversationStore.getState().selectedItemId;
    this.selectedItemType = useConversationStore.getState().selectedItemType;
    this.allToolsCount = Object.keys(
      useControlRegistryStore.getState().tools
    ).length;
    this.globalDefaultMaxSteps = useSettingsStore.getState().toolMaxSteps;
  }

  private updateVisibility() {
    const { getSelectedModel } = useProviderStore.getState();
    const selectedModel = getSelectedModel();
    const hasRegisteredTools = this.allToolsCount > 0;

    const modelSupportsTools =
      selectedModel?.metadata?.supported_parameters?.includes("tools") ?? false;

    const newVisibility =
      hasRegisteredTools &&
      modelSupportsTools &&
      this.selectedItemType === "conversation";

    if (this.isVisible !== newVisibility) {
      this.isVisible = newVisibility;
    }
  }

  public getEnabledTools = (): Set<string> => this.transientEnabledTools;
  public getMaxStepsOverride = (): number | null =>
    this.transientMaxStepsOverride;
  public getIsStreaming = (): boolean => this.isStreaming;
  public getIsVisible = (): boolean => this.isVisible;
  public getSelectedItemType = (): SidebarItemType | null =>
    this.selectedItemType;
  public getSelectedItemId = (): string | null => this.selectedItemId;
  public getAllToolsCount = (): number => this.allToolsCount;
  public getGlobalDefaultMaxSteps = (): number => this.globalDefaultMaxSteps;

  public setEnabledTools = (updater: (prev: Set<string>) => Set<string>) => {
    this.transientEnabledTools = updater(this.transientEnabledTools);
    this.notifyComponentUpdate?.();
  };
  public setMaxStepsOverride = (steps: number | null) => {
    this.transientMaxStepsOverride = steps;
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
      triggerRenderer: () =>
        React.createElement(ToolSelectorTrigger, { module: this }),
      getMetadata: () => {
        if (
          this.transientEnabledTools.size > 0 ||
          this.transientMaxStepsOverride !== null
        ) {
          return {
            enabledTools: Array.from(this.transientEnabledTools),
            ...(this.transientMaxStepsOverride !== null && {
              maxSteps: this.transientMaxStepsOverride,
            }),
          };
        }
        return undefined;
      },
      clearOnSubmit: () => {
        let changed = false;
        if (this.transientEnabledTools.size > 0) {
          this.transientEnabledTools = new Set<string>();
          changed = true;
        }
        if (this.transientMaxStepsOverride !== null) {
          this.transientMaxStepsOverride = null;
          changed = true;
        }
        if (changed) this.notifyComponentUpdate?.();
      },
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
