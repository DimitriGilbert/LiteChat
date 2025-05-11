// src/controls/modules/ToolSelectorControlModule.ts
// FULL FILE
import React from "react";
import { type ControlModule } from "@/types/litechat/control";
import { type LiteChatModApi } from "@/types/litechat/modding";
import { interactionEvent } from "@/types/litechat/events/interaction.events";
import { providerEvent } from "@/types/litechat/events/provider.events";
import { uiEvent } from "@/types/litechat/events/ui.events";
import { settingsEvent } from "@/types/litechat/events/settings.events";
import { controlRegistryEvent } from "@/types/litechat/events/control.registry.events";
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
  public selectedItemId: string | null = null;
  public selectedItemType: SidebarItemType | null = null; // Added property
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
      this.selectedItemType = payload.selectedItemType; // Update selectedItemType
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

    const unsubToolsChanged = modApi.on(
      controlRegistryEvent.toolsChanged,
      (payload) => {
        if (payload && typeof payload.tools === "object") {
          const newToolCount = Object.keys(payload.tools).length;
          if (this.allToolsCount !== newToolCount) {
            this.allToolsCount = newToolCount;
            this.updateVisibility();
            this.notifyComponentUpdate?.();
          }
        }
      }
    );

    this.eventUnsubscribers.push(
      unsubStatus,
      unsubModel,
      unsubContext,
      unsubSettings,
      unsubToolsChanged
    );
  }

  private loadInitialState() {
    this.isStreaming = useInteractionStore.getState().status === "streaming";
    this.selectedItemId = useConversationStore.getState().selectedItemId;
    this.selectedItemType = useConversationStore.getState().selectedItemType; // Initialize selectedItemType
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

    const newVisibility = hasRegisteredTools && modelSupportsTools;

    if (this.isVisible !== newVisibility) {
      this.isVisible = newVisibility;
    }
  }

  public getEnabledTools = (): Set<string> => this.transientEnabledTools;
  public getMaxStepsOverride = (): number | null =>
    this.transientMaxStepsOverride;
  public getIsStreaming = (): boolean => this.isStreaming;
  public getIsVisible = (): boolean => this.isVisible;
  public getSelectedItemId = (): string | null => this.selectedItemId;
  public getSelectedItemType = (): SidebarItemType | null =>
    this.selectedItemType; // Getter for selectedItemType
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
