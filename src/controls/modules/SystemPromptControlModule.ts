// src/controls/modules/SystemPromptControlModule.ts
// FULL FILE
import React from "react";
import { type ControlModule } from "@/types/litechat/control";
import {
  type LiteChatModApi,
  InteractionEvent,
  UiEvent,
  ProjectEvent,
  SettingsEvent,
} from "@/types/litechat/modding";
import { SystemPromptControlTrigger } from "@/controls/components/system-prompt/SystemPromptControlTrigger";
import { useInteractionStore } from "@/store/interaction.store";
import { useProjectStore } from "@/store/project.store";
import { useConversationStore } from "@/store/conversation.store";
import { useSettingsStore } from "@/store/settings.store";

export class SystemPromptControlModule implements ControlModule {
  readonly id = "core-system-prompt";
  private unregisterCallback: (() => void) | null = null;
  private eventUnsubscribers: (() => void)[] = [];

  public turnSystemPromptValue = "";
  public effectiveSystemPrompt: string | null | undefined = null;
  public isStreaming = false;
  private notifyComponentUpdate: (() => void) | null = null;

  async initialize(modApi: LiteChatModApi): Promise<void> {
    // modApi parameter is used here for subscriptions
    this.isStreaming = useInteractionStore.getState().status === "streaming";
    this.updateEffectivePrompt();

    const unsubStatus = modApi.on(
      InteractionEvent.STATUS_CHANGED,
      (payload) => {
        if (this.isStreaming !== (payload.status === "streaming")) {
          this.isStreaming = payload.status === "streaming";
          this.notifyComponentUpdate?.();
        }
      }
    );
    const unsubContext = modApi.on(UiEvent.CONTEXT_CHANGED, () => {
      this.updateEffectivePrompt();
      this.notifyComponentUpdate?.();
    });
    const unsubProject = modApi.on(ProjectEvent.UPDATED, () => {
      this.updateEffectivePrompt();
      this.notifyComponentUpdate?.();
    });
    const unsubSettings = modApi.on(
      SettingsEvent.GLOBAL_SYSTEM_PROMPT_CHANGED,
      () => {
        this.updateEffectivePrompt();
        this.notifyComponentUpdate?.();
      }
    );

    this.eventUnsubscribers.push(
      unsubStatus,
      unsubContext,
      unsubProject,
      unsubSettings
    );
    console.log(`[${this.id}] Initialized.`);
  }

  private updateEffectivePrompt() {
    const convState = useConversationStore.getState();
    const projState = useProjectStore.getState();
    const settingsState = useSettingsStore.getState();

    const currentProjectId =
      convState.selectedItemType === "project"
        ? convState.selectedItemId
        : convState.selectedItemType === "conversation"
        ? convState.getConversationById(convState.selectedItemId)?.projectId ??
          null
        : null;
    const newEffective =
      projState.getEffectiveProjectSettings(currentProjectId).systemPrompt ??
      settingsState.globalSystemPrompt;

    if (this.effectiveSystemPrompt !== newEffective) {
      this.effectiveSystemPrompt = newEffective;
    }
  }

  public getTurnSystemPrompt = (): string => this.turnSystemPromptValue;
  public getEffectiveSystemPrompt = (): string | null | undefined =>
    this.effectiveSystemPrompt;
  public getIsStreaming = (): boolean => this.isStreaming;

  public setTurnSystemPrompt = (prompt: string) => {
    if (this.turnSystemPromptValue !== prompt) {
      this.turnSystemPromptValue = prompt;
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
    this.unregisterCallback = modApi.registerPromptControl({
      id: this.id,
      status: () => "ready",
      triggerRenderer: () =>
        React.createElement(SystemPromptControlTrigger, { module: this }),
      getMetadata: () => {
        const prompt = this.turnSystemPromptValue.trim();
        return prompt ? { turnSystemPrompt: prompt } : undefined;
      },
      clearOnSubmit: () => {
        if (this.turnSystemPromptValue !== "") {
          this.turnSystemPromptValue = "";
          this.notifyComponentUpdate?.();
        }
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
