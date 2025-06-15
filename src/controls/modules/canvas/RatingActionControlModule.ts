// src/controls/modules/canvas/RatingActionControlModule.ts
// FULL FILE
import React from "react";
import { type ControlModule } from "@/types/litechat/control";
import type {
  LiteChatModApi,
  CanvasControlRenderContext,
} from "@/types/litechat/modding";
import { CompactInteractionRating } from "@/components/LiteChat/canvas/interaction/CompactInteractionRating";

export class RatingActionControlModule implements ControlModule {
  readonly id = "core-canvas-rating-action";

  async initialize(_modApi: LiteChatModApi): Promise<void> {}

  register(modApi: LiteChatModApi): void {
    modApi.registerCanvasControl({
      id: this.id,
      type: "interaction",
      targetSlot: "actions",
      renderer: (context: CanvasControlRenderContext) => {
        if (!context.interactionId || !context.interaction) {
          return null;
        }
        return React.createElement(CompactInteractionRating, {
          interactionId: context.interactionId,
          currentRating: context.interaction.rating,
        });
      },
    });
  }
  destroy(_modApi: LiteChatModApi): void {}
}
