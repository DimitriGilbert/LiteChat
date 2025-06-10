import React from "react";
import { type ControlModule } from "@/types/litechat/control";
import type { LiteChatModApi } from "@/types/litechat/modding";
import type { CanvasControlRenderContext } from "@/types/litechat/canvas/control";
import { ZipDownloadControl } from "@/controls/components/canvas/interaction/ZipDownloadControl";

export class ZipDownloadControlModule implements ControlModule {
  readonly id = "core-interaction-zip-download";

  async initialize(_modApi: LiteChatModApi): Promise<void> {}

  register(modApi: LiteChatModApi): void {
    modApi.registerCanvasControl({
      id: this.id,
      type: "interaction",
      targetSlot: "header-actions",
      renderer: (context: CanvasControlRenderContext) => {
        if (!context.interactionId || !context.responseContent) {
          return null;
        }
        return React.createElement(ZipDownloadControl, {
          context,
        });
      },
    });
  }
  
  destroy(_modApi: LiteChatModApi): void {}
} 