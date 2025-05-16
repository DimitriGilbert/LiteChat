// src/controls/modules/canvas/codeblock/CopyCodeBlockControlModule.ts
// FULL FILE
import React from "react";
import { type ControlModule } from "@/types/litechat/control";
import type { LiteChatModApi } from "@/types/litechat/modding";
import type { CanvasControlRenderContext } from "@/types/litechat/canvas/control";
import { CopyCodeBlockControl } from "@/controls/components/canvas/codeblock/CopyCodeBlockControl";

export class CopyCodeBlockControlModule implements ControlModule {
  readonly id = "core-codeblock-copy";

  async initialize(_modApi: LiteChatModApi): Promise<void> {}

  register(modApi: LiteChatModApi): void {
    modApi.registerCanvasControl({
      id: this.id,
      type: "codeblock",
      targetSlot: "codeblock-header-actions",
      renderer: (context: CanvasControlRenderContext) =>
        React.createElement(CopyCodeBlockControl, {
          interactionId: context.interactionId,
          codeBlockId: context.codeBlockId,
          language: context.codeBlockLang,
          codeToCopy: context.codeBlockContent ?? "",
          disabled: !context.codeBlockContent || context.codeBlockContent.trim() === "",
        }),
    });
  }
  destroy(_modApi: LiteChatModApi): void {}
}
