// src/controls/modules/canvas/codeblock/DownloadCodeBlockControlModule.ts
import React from "react";
import { type ControlModule } from "@/types/litechat/control";
import type { LiteChatModApi } from "@/types/litechat/modding";
import type { CanvasControlRenderContext } from "@/types/litechat/canvas/control";
import { DownloadCodeBlockControl } from "@/controls/components/canvas/codeblock/DownloadCodeBlockControl";

export class DownloadCodeBlockControlModule implements ControlModule {
  readonly id = "core-codeblock-download";

  async initialize(_modApi: LiteChatModApi): Promise<void> {}

  register(modApi: LiteChatModApi): void {
    modApi.registerCanvasControl({
      id: this.id,
      type: "codeblock",
      targetSlot: "codeblock-header-actions",
      renderer: (context: CanvasControlRenderContext) =>
        React.createElement(DownloadCodeBlockControl, {
          interactionId: context.interactionId,
          codeBlockId: context.codeBlockId,
          language: context.codeBlockLang,
          codeToDownload: context.codeBlockContent ?? "",
          filepath: context.codeBlockFilepath,
          disabled: !context.codeBlockContent || context.codeBlockContent.trim() === "",
        }),
    });
  }
  
  destroy(_modApi: LiteChatModApi): void {}
} 