// src/controls/modules/ConversationListControlModule.ts
// FULL FILE
import React from "react";
import { type ControlModule } from "@/types/litechat/control";
import { type LiteChatModApi } from "@/types/litechat/modding";
import { ConversationListControlComponent } from "@/controls/components/conversation-list/ConversationListControlComponent";
import { ConversationListIconRenderer } from "@/controls/components/conversation-list/IconRenderer";
import { useConversationStore } from "@/store/conversation.store";
import { useProjectStore } from "@/store/project.store";

export class ConversationListControlModule implements ControlModule {
  readonly id = "core-conversation-list";
  private unregisterCallback: (() => void) | null = null;
  private eventUnsubscribers: (() => void)[] = [];

  public isLoading = true;
  private notifyComponentUpdate: (() => void) | null = null;

  async initialize(_modApi: LiteChatModApi): Promise<void> {
    this.isLoading =
      useConversationStore.getState().isLoading ||
      useProjectStore.getState().isLoading;
    console.log(
      `[${this.id}] Initialized. Initial loading state: ${this.isLoading}`
    );
  }

  public updateLoadingState() {
    const newLoadingState =
      useConversationStore.getState().isLoading ||
      useProjectStore.getState().isLoading;
    if (this.isLoading !== newLoadingState) {
      this.isLoading = newLoadingState;
      this.notifyComponentUpdate?.();
    }
  }

  public setIsLoading = (loading: boolean) => {
    if (this.isLoading !== loading) {
      this.isLoading = loading;
      this.notifyComponentUpdate?.();
    }
  };

  public setNotifyCallback = (cb: (() => void) | null) => {
    this.notifyComponentUpdate = cb;
  };

  register(modApi: LiteChatModApi): void {
    if (this.unregisterCallback) {
      console.warn(
        `[${this.id}] Module "${this.id}" already registered. Skipping.`
      );
      return;
    }

    this.unregisterCallback = modApi.registerChatControl({
      id: this.id,
      panel: "sidebar",
      status: () => (this.isLoading ? "loading" : "ready"),
      renderer: () =>
        React.createElement(ConversationListControlComponent, {
          module: this,
        }),
      iconRenderer: () =>
        React.createElement(ConversationListIconRenderer, { module: this }),
      show: () => true,
    });
    console.log(`[Init] Module "${this.id}" registered.`);
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
