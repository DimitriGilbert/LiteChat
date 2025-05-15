// src/controls/modules/ConversationListControlModule.ts
// FULL FILE
import React from "react";
import { type ControlModule } from "@/types/litechat/control";
import { type LiteChatModApi } from "@/types/litechat/modding";
import { ConversationListControlComponent } from "@/controls/components/conversation-list/ConversationListControlComponent";
import { ConversationListIconRenderer } from "@/controls/components/conversation-list/IconRenderer";
import { useConversationStore } from "@/store/conversation.store";
import { useProjectStore } from "@/store/project.store";
import { conversationEvent } from "@/types/litechat/events/conversation.events";
import { projectEvent } from "@/types/litechat/events/project.events";

export class ConversationListControlModule implements ControlModule {
  readonly id = "core-conversation-list";
  private unregisterCallback: (() => void) | null = null;
  private eventUnsubscribers: (() => void)[] = [];

  public isLoading = true;
  private conversationsLoading = true;
  private projectsLoading = true;
  private notifyComponentUpdate: (() => void) | null = null;

  async initialize(modApi: LiteChatModApi): Promise<void> {
    this.conversationsLoading = useConversationStore.getState().isLoading;
    this.projectsLoading = useProjectStore.getState().isLoading;
    this.updateCombinedLoadingState();

    modApi.emit(conversationEvent.loadConversationsRequest, undefined);
    modApi.emit(projectEvent.loadProjectsRequest, undefined);

    const unsubConversations = modApi.on(
      conversationEvent.conversationsLoaded,
      () => {
        this.conversationsLoading = false;
        this.updateCombinedLoadingState();
      }
    );
    const unsubProjects = modApi.on(projectEvent.loaded, () => {
      this.projectsLoading = false;
      this.updateCombinedLoadingState();
    });
    const unsubConvLoading = modApi.on(
      conversationEvent.loadingStateChanged,
      (payload) => {
        if (payload.isLoading !== this.conversationsLoading) {
          this.conversationsLoading = payload.isLoading;
          this.updateCombinedLoadingState();
        }
      }
    );
    const unsubProjLoading = modApi.on(
      projectEvent.loadingStateChanged,
      (payload) => {
        if (payload.isLoading !== this.projectsLoading) {
          this.projectsLoading = payload.isLoading;
          this.updateCombinedLoadingState();
        }
      }
    );

    this.eventUnsubscribers.push(
      unsubConversations,
      unsubProjects,
      unsubConvLoading,
      unsubProjLoading
    );
  }

  private updateCombinedLoadingState() {
    const newLoadingState = this.conversationsLoading || this.projectsLoading;
    if (this.isLoading !== newLoadingState) {
      this.isLoading = newLoadingState;
      this.notifyComponentUpdate?.();
    }
  }

  public setIsLoading = (loading: boolean) => {
    // This might be called externally, but internal state is driven by store events
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
