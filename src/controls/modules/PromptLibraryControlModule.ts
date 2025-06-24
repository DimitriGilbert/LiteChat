import React from "react";
import { type ControlModule } from "@/types/litechat/control";
import { type LiteChatModApi } from "@/types/litechat/modding";
import { PromptLibraryControl } from "@/controls/components/prompt/PromptLibraryControl";
import { usePromptTemplateStore } from "@/store/prompt-template.store";
import { interactionEvent } from "@/types/litechat/events/interaction.events";
import { useInteractionStore } from "@/store/interaction.store";
import { promptEvent } from "@/types/litechat/events/prompt.events";
import type { PromptFormData, CompiledPrompt } from "@/types/litechat/prompt-template";

export class PromptLibraryControlModule implements ControlModule {
  readonly id = "core-prompt-library";
  private unregisterCallback: (() => void) | null = null;
  private eventUnsubscribers: (() => void)[] = [];
  private notifyComponentUpdate: (() => void) | null = null;
  private isStreaming = false;
  private modApiRef: LiteChatModApi | null = null;

  async initialize(modApi: LiteChatModApi): Promise<void> {
    this.modApiRef = modApi;
    this.isStreaming = useInteractionStore.getState().status === "streaming";

    const unsubStatus = modApi.on(interactionEvent.statusChanged, (payload) => {
      if (typeof payload === "object" && payload && "status" in payload) {
        if (this.isStreaming !== (payload.status === "streaming")) {
          this.isStreaming = payload.status === "streaming";
          this.notifyComponentUpdate?.();
        }
      }
    });

    this.eventUnsubscribers.push(unsubStatus);
  }

  public getIsStreaming = (): boolean => this.isStreaming;

  public getShortcutTemplates = () => {
    const { promptTemplates } = usePromptTemplateStore.getState();
    return promptTemplates.filter((template: any) => 
      (template.type === "prompt" || !template.type) && template.isShortcut === true
    );
  };

  public setNotifyCallback = (cb: (() => void) | null) => {
    this.notifyComponentUpdate = cb;
  };

  public compileTemplate = async (templateId: string, formData: PromptFormData): Promise<CompiledPrompt> => {
    const { compilePromptTemplate } = usePromptTemplateStore.getState();
    return await compilePromptTemplate(templateId, formData);
  };

  public applyTemplate = async (templateId: string, formData: PromptFormData): Promise<void> => {
    const compiled = await this.compileTemplate(templateId, formData);
    this.modApiRef?.emit(promptEvent.setInputTextRequest, { text: compiled.content });
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
      triggerRenderer: () => React.createElement(PromptLibraryControl, { module: this }),
    });
  }

  destroy(): void {
    this.eventUnsubscribers.forEach((unsub) => unsub());
    this.eventUnsubscribers = [];
    if (this.unregisterCallback) {
      this.unregisterCallback();
      this.unregisterCallback = null;
    }

    console.log(`[${this.id}] Destroyed.`);
  }
} 