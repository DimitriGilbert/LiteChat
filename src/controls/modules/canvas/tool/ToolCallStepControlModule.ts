import React from "react";
import { type ControlModule } from "@/types/litechat/control";
import type { LiteChatModApi } from "@/types/litechat/modding";
import type { CanvasControlRenderContext } from "@/types/litechat/canvas/control";
import { ToolCallStepControl } from "@/controls/components/canvas/tool/ToolCallStepControl";

export class ToolCallStepControlModule implements ControlModule {
  readonly id = "core-tool-call-step-display";

  async initialize(_modApi: LiteChatModApi): Promise<void> {}

  register(modApi: LiteChatModApi): void {
    modApi.registerCanvasControl({
      id: this.id,
      type: "tool-call-step",
      targetSlot: "tool-call-content",
      renderer: (context: CanvasControlRenderContext) => {
        if (!context.interactionId || !context.toolCall) {
          console.warn(
            "[ToolCallStepControlModule] Missing interactionId or toolCall in context"
          );
          return null;
        }
        return React.createElement(ToolCallStepControl, {
          interactionId: context.interactionId,
          toolCall: context.toolCall,
          toolResult: context.toolResult, // This can be undefined if result is not yet available
        });
      },
    });
  }

  destroy(_modApi: LiteChatModApi): void {}
} 