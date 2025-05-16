// src/controls/modules/canvas/codeblock/FoldCodeBlockControlModule.ts
// NEW FILE
import React from "react";
import { type ControlModule } from "@/types/litechat/control";
import type { LiteChatModApi } from "@/types/litechat/modding";
import type { CanvasControlRenderContext } from "@/types/litechat/canvas/control";
import { FoldCodeBlockControl } from "@/controls/components/canvas/codeblock/FoldCodeBlockControl";

export class FoldCodeBlockControlModule implements ControlModule {
  readonly id = "core-codeblock-fold";

  async initialize(_modApi: LiteChatModApi): Promise<void> {}

  register(modApi: LiteChatModApi): void {
    modApi.registerCanvasControl({
      id: this.id,
      type: "codeblock",
      targetSlot: "codeblock-header-actions",
      renderer: (context: CanvasControlRenderContext) => {
        if (
          context.toggleFold === undefined ||
          context.isFolded === undefined
        ) {
          return null;
        }
        return React.createElement(FoldCodeBlockControl, {
          isFolded: context.isFolded,
          toggleFold: context.toggleFold,
        });
      },
    });
  }
  destroy(_modApi: LiteChatModApi): void {}
}
