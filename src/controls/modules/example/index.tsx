// src/controls/modules/example/index.tsx
// FULL FILE
import React from "react";
import { type ControlModule } from "@/types/litechat/control";
import { type LiteChatModApi } from "@/types/litechat/modding";
import type { CanvasControlRenderContext } from "@/types/litechat/canvas/control"; // Corrected import
import { ExampleCanvasControlComponent } from "./example-canvas-control";

export class ExampleCanvasControlModule implements ControlModule {
  readonly id = "example-canvas-control-module";

  async initialize(_modApi: LiteChatModApi): Promise<void> {
    // Initialization logic if needed
  }

  register(modApi: LiteChatModApi): void {
    modApi.registerCanvasControl({
      id: "example-canvas-action",
      type: "interaction",
      targetSlot: "actions",
      renderer: (
        context: CanvasControlRenderContext // Added type for context
      ) => React.createElement(ExampleCanvasControlComponent, { context }),
    });
  }

  destroy(_modApi: LiteChatModApi): void {
    // Cleanup logic if needed
  }
}
