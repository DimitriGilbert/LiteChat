// src/controls/modules/canvas/interaction/FoldInteractionControlModule.ts
// NEW FILE
import React from "react";
import { type ControlModule } from "@/types/litechat/control";
import type { LiteChatModApi } from "@/types/litechat/modding";
import type { CanvasControlRenderContext } from "@/types/litechat/canvas/control";
import { FoldInteractionControl } from "@/controls/components/canvas/interaction/FoldInteractionControl";

export class FoldInteractionControlModule implements ControlModule {
  readonly id = "core-canvas-fold-interaction";

  async initialize(_modApi: LiteChatModApi): Promise<void> {}

  register(modApi: LiteChatModApi): void {
    modApi.registerCanvasControl({
      id: this.id,
      type: "interaction",
      targetSlot: "header-actions",
      renderer: (context: CanvasControlRenderContext) => {
        // The actual isFolded state and toggleFold function are managed by InteractionCard/StreamingInteractionCard
        // and passed via context if this control needs to interact with them.
        // For now, this control just renders the button, and the parent card handles the state.
        // If the control needed to *manage* the fold state, it would be more complex.
        if (!context.toggleFold || context.isFolded === undefined) {
          return null; // Don't render if fold functionality isn't provided by parent
        }
        return React.createElement(FoldInteractionControl, {
          isFolded: context.isFolded,
          toggleFold: context.toggleFold,
          canFold: true, // Assuming if it's rendered, it can be folded
        });
      },
    });
  }

  destroy(_modApi: LiteChatModApi): void {}
}
