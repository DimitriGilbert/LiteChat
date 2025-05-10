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

  // isLoading now primarily reflects the *initial* load state.
  // Add/delete operations should feel instant due to optimistic UI updates in stores.
  public isLoading = true;
  private notifyComponentUpdate: (() => void) | null = null;

  async initialize(_modApi: LiteChatModApi): Promise<void> {
    this.isLoading =
      useConversationStore.getState().isLoading ||
      useProjectStore.getState().isLoading;
    // Subscribe to store loading state changes if they exist and are granular
    // For now, we assume initial load is handled by the main app sequence.
    // This module's isLoading will primarily be true until the first data is available.
    console.log(
      `[${this.id}] Initialized. Initial loading state: ${this.isLoading}`
    );

    // If stores have a way to notify when their initial load is done, subscribe here.
    // Example (conceptual - depends on store implementation):
    // const unsubConvLoad = useConversationStore.subscribe(
    //   (state) => state.isLoading,
    //   (loading) => this.updateLoadingState()
    // );
    // const unsubProjLoad = useProjectStore.subscribe(
    //   (state) => state.isLoading,
    //   (loading) => this.updateLoadingState()
    // );
    // this.eventUnsubscribers.push(unsubConvLoad, unsubProjLoad);
    // For now, we'll rely on the component to re-read this.isLoading if the module re-renders.
  }

  // Call this if stores provide fine-grained loading state updates
  public updateLoadingState() {
    const newLoadingState =
      useConversationStore.getState().isLoading ||
      useProjectStore.getState().isLoading;
    if (this.isLoading !== newLoadingState) {
      this.isLoading = newLoadingState;
      this.notifyComponentUpdate?.();
    }
  }

  // This method is now primarily for actions *within the component* that might need
  // to show a temporary loading state (e.g., if an action was complex and not optimistic).
  // For simple add/delete, the stores handle optimistic updates.
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
