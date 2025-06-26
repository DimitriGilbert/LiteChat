// src/controls/modules/AutoTitleControlModule.ts
// FULL FILE
import React from "react";
import { type ControlModule } from "@/types/litechat/control";
import { type LiteChatModApi } from "@/types/litechat/modding";
import {
  interactionEvent,
  InteractionEventPayloads,
} from "@/types/litechat/events/interaction.events";
import { uiEvent } from "@/types/litechat/events/ui.events";
import { settingsEvent } from "@/types/litechat/events/settings.events";
import { AutoTitleControlTrigger } from "@/controls/components/auto-title/AutoTitleControlTrigger";
import { useInteractionStore } from "@/store/interaction.store";
import { useSettingsStore } from "@/store/settings.store";
import { useConversationStore } from "@/store/conversation.store";
import { InteractionService } from "@/services/interaction.service";
import { nanoid } from "nanoid";
import type { PromptObject, PromptTurnObject } from "@/types/litechat/prompt";
import { toast } from "sonner";

export class AutoTitleControlModule implements ControlModule {
  readonly id = "core-auto-title";
  private unregisterCallback: (() => void) | null = null;
  private eventUnsubscribers: (() => void)[] = [];

  private turnAutoTitleEnabled = false;
  private isStreaming = false;
  private isFirstInteraction = false;
  private isMultipleInteractions = false;
  private globalAutoTitleEnabled = true;
  private autoTitleAlwaysOn = false;
  private isUpdatingTitle = false;
  private notifyComponentUpdate: (() => void) | null = null;

  async initialize(modApi: LiteChatModApi): Promise<void> {
    this.turnAutoTitleEnabled = false;
    this.isStreaming = useInteractionStore.getState().status === "streaming";
    this.globalAutoTitleEnabled = useSettingsStore.getState().autoTitleEnabled;
    this.autoTitleAlwaysOn = useSettingsStore.getState().autoTitleAlwaysOn;
    this.checkInteractionState();
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
      const oldIsMultiple = this.isMultipleInteractions;
      this.checkInteractionState();
      if (oldIsFirst !== this.isFirstInteraction || oldIsMultiple !== this.isMultipleInteractions) {
        this.notifyComponentUpdate?.();
      }
    });
    const unsubComplete = modApi.on(interactionEvent.completed, () => {
      const oldIsFirst = this.isFirstInteraction;
      const oldIsMultiple = this.isMultipleInteractions;
      this.checkInteractionState();
      if (oldIsFirst !== this.isFirstInteraction || oldIsMultiple !== this.isMultipleInteractions) {
        this.notifyComponentUpdate?.();
      }
    });
    const unsubLoaded = modApi.on(interactionEvent.loaded, () => {
      const oldIsFirst = this.isFirstInteraction;
      const oldIsMultiple = this.isMultipleInteractions;
      this.checkInteractionState();
      if (
        oldIsFirst !== this.isFirstInteraction ||
        oldIsMultiple !== this.isMultipleInteractions
      ) {
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
    const unsubAlwaysOnSettings = modApi.on(
      settingsEvent.autoTitleAlwaysOnChanged,
      (payload) => {
        if (typeof payload === "object" && payload && "enabled" in payload) {
          if (this.autoTitleAlwaysOn !== payload.enabled) {
            this.autoTitleAlwaysOn = payload.enabled;
            this.notifyComponentUpdate?.();
          }
        }
      }
    );

    this.eventUnsubscribers.push(
      unsubStatus,
      unsubContext,
      unsubComplete,
      unsubLoaded,
      unsubSettings,
      unsubAlwaysOnSettings
    );
    // console.log(`[${this.id}] Initialized.`);
  }

  private checkInteractionState() {
    const interactionState = useInteractionStore.getState();
    const conversationId = interactionState.currentConversationId;
    
    if (!conversationId) {
      this.isFirstInteraction = true;
      this.isMultipleInteractions = false;
      return;
    }

    const conversationInteractions = interactionState.interactions.filter(
      (i) => i.conversationId === conversationId && 
      (i.type === "message.user_assistant" || i.type === "message.assistant_regen") &&
      i.prompt // Ensures there's a prompt, meaning the user has sent something
    );

    const isFirst = conversationInteractions.length < 1;
    const isMultiple = conversationInteractions.length > 0;

    if (this.isFirstInteraction !== isFirst) {
      this.isFirstInteraction = isFirst;
      if (!isFirst && this.turnAutoTitleEnabled) {
        this.turnAutoTitleEnabled = false;
      }
    }

    this.isMultipleInteractions = isMultiple;
  }

  public getTurnEnabled = (): boolean => this.turnAutoTitleEnabled;
  public getIsStreaming = (): boolean => this.isStreaming;
  public getIsFirstInteraction = (): boolean => this.isFirstInteraction;
  public getIsMultipleInteractions = (): boolean => this.isMultipleInteractions;
  public getGlobalAutoTitleEnabled = (): boolean => this.globalAutoTitleEnabled;
  public getAutoTitleAlwaysOn = (): boolean => this.autoTitleAlwaysOn;
  public getIsUpdatingTitle = (): boolean => this.isUpdatingTitle;

  public setTurnEnabled = (enabled: boolean) => {
    if (this.turnAutoTitleEnabled !== enabled) {
      this.turnAutoTitleEnabled = enabled;
      this.notifyComponentUpdate?.();
    }
  };

  public setNotifyCallback = (cb: (() => void) | null) => {
    this.notifyComponentUpdate = cb;
  };

  public updateConversationTitle = async (): Promise<void> => {
    const settings = useSettingsStore.getState();
    const interactionState = useInteractionStore.getState();
    const conversationState = useConversationStore.getState();
    
    if (!settings.autoTitleModelId) {
      toast.error("No auto-title model configured in settings");
      return;
    }

    const conversationId = interactionState.currentConversationId;
    if (!conversationId) {
      toast.error("No conversation selected");
      return;
    }

    const conversation = conversationState.getConversationById(conversationId);
    if (!conversation) {
      toast.error("Conversation not found");
      return;
    }

    // Get the last user message sent to AI
    const conversationInteractions = interactionState.interactions
      .filter((i) => 
        i.conversationId === conversationId && 
        (i.type === "message.user_assistant" || i.type === "message.assistant_regen") &&
        i.status === "COMPLETED" &&
        i.prompt?.content
      )
      .sort((a, b) => a.index - b.index);

    if (conversationInteractions.length === 0) {
      toast.error("No user messages found to generate title from");
      return;
    }

    const lastInteraction = conversationInteractions[conversationInteractions.length - 1];
    if (!lastInteraction.prompt?.content) {
      toast.error("Last message has no content");
      return;
    }

    this.isUpdatingTitle = true;
    this.notifyComponentUpdate?.();

    try {
      let titlePromptContent = lastInteraction.prompt.content;

      // Truncate if too long
      if (titlePromptContent.length > settings.autoTitlePromptMaxLength) {
        titlePromptContent = titlePromptContent.substring(0, settings.autoTitlePromptMaxLength) + "...";
      }

      // Include attached files if configured
      if (settings.autoTitleIncludeFiles && lastInteraction.prompt.metadata?.attachedFiles?.length) {
        const fileNames = lastInteraction.prompt.metadata.attachedFiles
          .map((f: any) => f.name)
          .join(", ");
        titlePromptContent += `\n\n[Attached files: ${fileNames}]`;
      }

      const titlePromptObject: PromptObject = {
        system: "Generate a concise, descriptive title (max 8-10 words) for the following user prompt. Output ONLY the title text, nothing else.",
        messages: [{ role: "user", content: titlePromptContent }],
        parameters: {
          temperature: 0.5,
          max_tokens: 20,
        },
        metadata: {
          modelId: settings.autoTitleModelId,
          isTitleGeneration: true,
        },
        tools: undefined,
        toolChoice: "none",
      };

      const titleTurnData: PromptTurnObject = {
        id: nanoid(),
        content: `[Update title based on: ${lastInteraction.prompt.content.substring(0, 50)}...]`,
        parameters: titlePromptObject.parameters,
        metadata: {
          ...titlePromptObject.metadata,
          originalTurnId: lastInteraction.id,
          isManualTitleUpdate: true,
        },
      };

      await InteractionService.startInteraction(
        titlePromptObject,
        conversationId,
        titleTurnData,
        "conversation.title_generation"
      );

      toast.success("Title update started...");
    } catch (error) {
      console.error("[AutoTitleControlModule] Error updating title:", error);
      toast.error(`Failed to update title: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.isUpdatingTitle = false;
      this.notifyComponentUpdate?.();
    }
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
        // When always-on is enabled, always return metadata regardless of turn setting
        // When not always-on, respect the turn setting
        const shouldIncludeMetadata = this.autoTitleAlwaysOn || this.turnAutoTitleEnabled;
        return shouldIncludeMetadata
          ? { autoTitleEnabledForTurn: true }
          : undefined;
      },
      clearOnSubmit: () => {
        // Only clear if not always-on
        if (!this.autoTitleAlwaysOn && this.turnAutoTitleEnabled) {
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
