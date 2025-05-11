// src/controls/modules/AutoTitleControlModule.ts
// FULL FILE
import React from "react";
import { type ControlModule } from "@/types/litechat/control";
import { type LiteChatModApi } from "@/types/litechat/modding";
import { interactionEvent } from "@/types/litechat/events/interaction.events";
import { uiEvent } from "@/types/litechat/events/ui.events";
import { settingsEvent } from "@/types/litechat/events/settings.events";
import { AutoTitleControlTrigger } from "@/controls/components/auto-title/AutoTitleControlTrigger";
import { useInteractionStore } from "@/store/interaction.store";
import { useSettingsStore } from "@/store/settings.store";

export class AutoTitleControlModule implements ControlModule {
  readonly id = "core-auto-title";
  private unregisterCallback: (() => void) | null = null;
  private eventUnsubscribers: (() => void)[] = [];

  private turnAutoTitleEnabled = false;
  private isStreaming = false;
  private isFirstInteraction = false;
  private globalAutoTitleEnabled = true;
  private notifyComponentUpdate: (() => void) | null = null;

  async initialize(modApi: LiteChatModApi): Promise<void> {
    this.turnAutoTitleEnabled = false;
    this.isStreaming = useInteractionStore.getState().status === "streaming";
    this.globalAutoTitleEnabled = useSettingsStore.getState().autoTitleEnabled;
    this.checkFirstInteraction();
    this.notifyComponentUpdate?.();

    const unsubStatus = modApi.on(interactionEvent.statusChanged, (payload) => {
      if (typeof payload === "object" && payload && "status" in payload) {
        if (this.isStreaming !== (payload.status === "streaming")) {
          this.isStreaming = payload.status === "streaming";
          this.notifyComponentUpdate?.();
        }
      }
    });
    const unsubContext = modApi.on(uiEvent.contextChanged, () => {
      const oldIsFirst = this.isFirstInteraction;
      this.checkFirstInteraction();
      if (oldIsFirst !== this.isFirstInteraction) {
        this.notifyComponentUpdate?.();
      }
    });
    const unsubComplete = modApi.on(interactionEvent.completed, () => {
      const oldIsFirst = this.isFirstInteraction;
      this.checkFirstInteraction();
      if (oldIsFirst !== this.isFirstInteraction) {
        this.notifyComponentUpdate?.();
      }
    });
    const unsubSettings = modApi.on(
      settingsEvent.autoTitleEnabledChanged,
      (payload) => {
        if (typeof payload === "object" && payload && "enabled" in payload) {
          if (this.globalAutoTitleEnabled !== payload.enabled) {
            this.globalAutoTitleEnabled = payload.enabled;
            this.notifyComponentUpdate?.();
          }
        }
      }
    );

    this.eventUnsubscribers.push(
      unsubStatus,
      unsubContext,
      unsubComplete,
      unsubSettings
    );
    // console.log(`[${this.id}] Initialized.`);
  }

  private checkFirstInteraction() {
    const interactionState = useInteractionStore.getState();
    const isFirst =
      // if no conversation selected, it is a new conversation !
      interactionState.currentConversationId === null ||
      interactionState.interactions.filter(
        (i) => i.conversationId === interactionState.currentConversationId
      ).length === 0;

    if (this.isFirstInteraction !== isFirst) {
      this.isFirstInteraction = isFirst;
      if (!isFirst && this.turnAutoTitleEnabled) {
        this.turnAutoTitleEnabled = false;
      }
    }
  }

  public getTurnEnabled = (): boolean => this.turnAutoTitleEnabled;
  public getIsStreaming = (): boolean => this.isStreaming;
  public getIsFirstInteraction = (): boolean => this.isFirstInteraction;
  public getGlobalAutoTitleEnabled = (): boolean => this.globalAutoTitleEnabled;

  public setTurnEnabled = (enabled: boolean) => {
    if (this.turnAutoTitleEnabled !== enabled) {
      this.turnAutoTitleEnabled = enabled;
      this.notifyComponentUpdate?.();
    }
  };

  public setNotifyCallback = (cb: (() => void) | null) => {
    this.notifyComponentUpdate = cb;
  };

  register(modApi: LiteChatModApi): void {
    if (this.unregisterCallback) {
      console.warn(`[${this.id}] Already registered. Skipping.`);
      return;
    }

    const triggerRenderer = () => {
      return React.createElement(AutoTitleControlTrigger, { module: this });
    };

    this.unregisterCallback = modApi.registerPromptControl({
      id: this.id,
      status: () => "ready",
      triggerRenderer: triggerRenderer,
      getMetadata: () => {
        return this.turnAutoTitleEnabled
          ? { autoTitleEnabledForTurn: true }
          : undefined;
      },
      clearOnSubmit: () => {
        if (this.turnAutoTitleEnabled) {
          this.turnAutoTitleEnabled = false;
          this.notifyComponentUpdate?.();
        }
      },
    });
    // console.log(`[${this.id}] Registered.`);
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
