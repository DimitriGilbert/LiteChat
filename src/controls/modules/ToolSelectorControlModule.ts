// src/controls/modules/ToolSelectorControlModule.ts
// FULL FILE
import React from "react";
import { type ControlModule } from "@/types/litechat/control";
import {
  type LiteChatModApi,
  interactionEvent, // Updated import
  providerEvent, // Updated import
  uiEvent, // Updated import
  settingsEvent, // Updated import
} from "@/types/litechat/modding";
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

    const unsubStatus = modApi.on(interactionEvent.statusChanged, (payload) => {
      if (this.isStreaming !== (payload.status === "streaming")) {
        this.isStreaming = payload.status === "streaming";
        this.notifyComponentUpdate?.();
      }
    });
    const unsubModel = modApi.on(providerEvent.modelSelectionChanged, () => {
      this.updateVisibility();
      this.notifyComponentUpdate?.();
    });
    const unsubContext = modApi.on(uiEvent.contextChanged, (payload) => {
      this.selectedItemId = payload.selectedItemId;
      this.selectedItemType = payload.selectedItemType;
      this.notifyComponentUpdate?.();
    });
    const unsubSettings = modApi.on(
      settingsEvent.toolMaxStepsChanged,
      (payload) => {
        this.globalDefaultMaxSteps = payload.steps;
        this.notifyComponentUpdate?.();
      }
    );

    this.eventUnsubscribers.push(
      unsubStatus,
      unsubModel,
      unsubContext,
      unsubSettings
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
    const hasRegisteredTools =
      Object.keys(useControlRegistryStore.getState().tools).length > 0;
    const newVisibility =
      hasRegisteredTools &&
      (selectedModel?.metadata?.supported_parameters?.includes("tools") ??
        false);
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
      // show method removed, visibility handled by ToolSelectorTrigger
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
