// src/controls/modules/canvas/RegenerateActionControlModule.ts
// FULL FILE
import React from "react";
import { type ControlModule } from "@/types/litechat/control";
import type { LiteChatModApi } from "@/types/litechat/modding";
import type { CanvasControlRenderContext } from "@/types/litechat/canvas/control";
import { RegenerateActionControl } from "@/controls/components/canvas/RegenerateActionControl";
// import { ConversationService } from "@/services/conversation.service"; // No longer directly calling this
// import { toast } from "sonner"; // Feedback handled by service or component event listeners
import { useInteractionStore } from "@/store/interaction.store"; // To check global streaming status

export class RegenerateActionControlModule implements ControlModule {
  readonly id = "core-canvas-regenerate-action";

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
        const conversationInteractions = interactionStoreState.interactions.filter(
          (i) => i.conversationId === currentInteraction.conversationId && 
                 i.type === "message.user_assistant" // Only consider actual conversational turns
        );
        
        // Sort by index to find the last one
        conversationInteractions.sort((a, b) => a.index - b.index);
        const lastUserAssistantInteraction = conversationInteractions.length > 0 
          ? conversationInteractions[conversationInteractions.length - 1] 
          : null;

        const isLastTurn = lastUserAssistantInteraction?.id === currentInteraction.id;
        
        const canRegenerate = 
          isLastTurn &&
          (currentInteraction.status === "COMPLETED" || currentInteraction.status === "ERROR") &&
          globalStreamingStatus !== "streaming";

        return React.createElement(RegenerateActionControl, {
          interactionId: currentInteraction.id,
          disabled: !canRegenerate,
        });
      },
    });
  }
  destroy(_modApi: LiteChatModApi): void {}
}
