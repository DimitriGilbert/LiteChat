import React from "react";
import { type ControlModule } from "@/types/litechat/control";
import { type LiteChatModApi } from "@/types/litechat/modding";
import { PromptLibraryControl } from "@/controls/components/prompt/PromptLibraryControl";
import { usePromptTemplateStore } from "@/store/prompt-template.store";
import { interactionEvent } from "@/types/litechat/events/interaction.events";
import { useInteractionStore } from "@/store/interaction.store";
import { promptEvent } from "@/types/litechat/events/prompt.events";
import type { PromptFormData, CompiledPrompt } from "@/types/litechat/prompt-template";
import { useControlRegistryStore } from "@/store/control.store";
import type { TriggerNamespace, TriggerExecutionContext } from "@/types/litechat/text-triggers";

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

    // Register text trigger namespaces
    const triggerNamespaces = this.getTextTriggerNamespaces();
    triggerNamespaces.forEach(namespace => {
      useControlRegistryStore.getState().registerTextTriggerNamespace(namespace);
    });

    this.unregisterCallback = modApi.registerPromptControl({
      id: this.id,
      status: () => "ready",
      triggerRenderer: () => React.createElement(PromptLibraryControl, { module: this }),
    });
  }

  getTextTriggerNamespaces(): TriggerNamespace[] {
    return [{
      id: 'template',
      name: 'Template',
      methods: {
        use: {
          id: 'use',
          name: 'Use Template',
          description: 'Load and use a specific template',
          argSchema: {
            minArgs: 1,
            maxArgs: 1,
            argTypes: ['string' as const]
          },
          handler: this.handleTemplateUse
        }
      },
      moduleId: this.id
    }];
  }

  private handleTemplateUse = async (args: string[], _context: TriggerExecutionContext) => {
    const templateId = args[0];
    const { promptTemplates } = usePromptTemplateStore.getState();
    const template = promptTemplates.find(t => t.id === templateId || t.name === templateId);
    
    if (template) {
      // Use the correct method to set the template for the turn (transient, not direct execution)
      await this.applyTemplate(template.id, {});
    }
  };

  destroy(): void {
    this.eventUnsubscribers.forEach((unsub) => unsub());
    this.eventUnsubscribers = [];
    if (this.unregisterCallback) {
      this.unregisterCallback();
      this.unregisterCallback = null;
    }

    // Unregister text trigger namespaces
    const triggerNamespaces = this.getTextTriggerNamespaces();
    triggerNamespaces.forEach(namespace => {
      useControlRegistryStore.getState().unregisterTextTriggerNamespace(namespace.id);
    });

    console.log(`[${this.id}] Destroyed.`);
  }
} 