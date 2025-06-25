import React from "react";
import { type ControlModule } from "@/types/litechat/control";
import type { LiteChatModApi } from "@/types/litechat/modding";
import type { CanvasControlRenderContext } from "@/types/litechat/canvas/control";
import { RepairEnhanceCodeBlockControl } from "@/controls/components/canvas/codeblock/RepairEnhanceCodeBlockControl";
import { useInteractionStore } from "@/store/interaction.store";

export class RepairEnhanceCodeBlockControlModule implements ControlModule {
  readonly id = "core-codeblock-repair-enhance";

  async initialize(_modApi: LiteChatModApi): Promise<void> {}

  register(modApi: LiteChatModApi): void {
    modApi.registerCanvasControl({
      id: this.id,
      type: "codeblock",
      targetSlot: "codeblock-header-actions",
      renderer: (context: CanvasControlRenderContext) => {
        if (!context.codeBlockContent || !context.interactionId) {
          return null;
        }

        const interactionStoreState = useInteractionStore.getState();
        const globalStreamingStatus = interactionStoreState.status;
        const currentInteraction = interactionStoreState.interactions.find(
          i => i.id === context.interactionId
        );
        
        // Only show for completed assistant responses with code blocks
        const canRepairEnhance = 
          currentInteraction &&
          currentInteraction.status === "COMPLETED" &&
          currentInteraction.response &&
          typeof currentInteraction.response === "string" &&
          globalStreamingStatus !== "streaming" &&
          (currentInteraction.type === "message.user_assistant" || 
           currentInteraction.type === "message.assistant_regen") &&
          context.codeBlockContent &&
          context.codeBlockContent.trim().length > 0;

        if (!canRepairEnhance) {
          return null;
        }

        return React.createElement(RepairEnhanceCodeBlockControl, {
          interactionId: context.interactionId,
          codeBlockId: context.blockId || context.codeBlockId,
          language: context.codeBlockLang,
          codeContent: context.codeBlockContent || "",
          filepath: context.codeBlockFilepath,
          disabled: !canRepairEnhance,
        });
      },
    });
  }
  
  destroy(_modApi: LiteChatModApi): void {}
} 