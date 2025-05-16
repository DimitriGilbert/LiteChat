// src/controls/modules/canvas/CopyActionControlModule.ts
// FULL FILE
import React from "react";
import { type ControlModule } from "@/types/litechat/control";
import type { LiteChatModApi } from "@/types/litechat/modding";
import type { CanvasControlRenderContext } from "@/types/litechat/canvas/control";
import { CopyActionControl } from "@/controls/components/canvas/CopyActionControl";

export class CopyActionControlModule implements ControlModule {
  readonly id = "core-canvas-copy-action";

  async initialize(_modApi: LiteChatModApi): Promise<void> {}

  register(modApi: LiteChatModApi): void {
    modApi.registerCanvasControl({
      id: this.id,
      type: "interaction",
      targetSlot: "header-actions",
      renderer: (context: CanvasControlRenderContext) => {
        // console.log("copy action render call")
        if (!context.interactionId) {
          console.warn(
            "CopyActionControlModule: interactionId is missing in context for an interaction control."
          );
          return null;
        }
        return React.createElement(CopyActionControl, {
          interactionId: context.interactionId,
          contentToCopy: context.responseContent ?? "",
          disabled: !context.responseContent || context.responseContent.trim() === "",
        });
      },
    });
  }

  destroy(_modApi: LiteChatModApi): void {}
}
