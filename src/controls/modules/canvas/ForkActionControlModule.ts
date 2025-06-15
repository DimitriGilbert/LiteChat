import React from "react";
import { type ControlModule } from "@/types/litechat/control";
import type { LiteChatModApi } from "@/types/litechat/modding";
import type { CanvasControlRenderContext } from "@/types/litechat/canvas/control";
import { ForkActionControl } from "@/controls/components/canvas/ForkActionControl";
import { useInteractionStore } from "@/store/interaction.store";

export class ForkActionControlModule implements ControlModule {
  readonly id = "core-canvas-fork-action";

  async initialize(_modApi: LiteChatModApi): Promise<void> {}

  register(modApi: LiteChatModApi): void {
    modApi.registerCanvasControl({
      id: this.id,
      type: "interaction",
      targetSlot: "actions", // Appears in the footer actions
      renderer: (context: CanvasControlRenderContext) => {
        if (!context.interactionId || !context.interaction) {
          // Safety check
          return null;
        }

        const currentInteraction = context.interaction;
        const interactionStoreState = useInteractionStore.getState();
        const globalStreamingStatus = interactionStoreState.status;
        
        // Find interactions that are on the main spine (parentId === null)
        // and are either user_assistant or assistant_regen types
        const conversationInteractions = interactionStoreState.interactions.filter(
          (i) => i.conversationId === currentInteraction.conversationId && 
                 i.parentId === null && // Only main spine interactions
                 (i.type === "message.user_assistant" || i.type === "message.assistant_regen")
        );
        
        // Sort by index to find the last one
        conversationInteractions.sort((a, b) => a.index - b.index);
        const lastInteractionOnSpine = conversationInteractions.length > 0 
          ? conversationInteractions[conversationInteractions.length - 1] 
          : null;

        const isLastTurn = lastInteractionOnSpine?.id === currentInteraction.id;
        
        // Only show fork button if it's NOT the last turn
        if (isLastTurn) {
          return null;
        }
        
        const canFork = 
          (currentInteraction.status === "COMPLETED" || currentInteraction.status === "ERROR") &&
          globalStreamingStatus !== "streaming";

        return React.createElement(ForkActionControl, {
          interactionId: currentInteraction.id,
          disabled: !canFork,
        });
      },
    });
  }
  destroy(_modApi: LiteChatModApi): void {}
} 