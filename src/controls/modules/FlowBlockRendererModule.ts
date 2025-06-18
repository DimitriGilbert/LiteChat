import type { ControlModule } from "@/types/litechat/control";
import type { LiteChatModApi } from "@/types/litechat/modding";
import type { BlockRenderer, BlockRendererContext } from "@/types/litechat/canvas/block-renderer";
import { FlowBlockRenderer } from "@/components/LiteChat/common/FlowBlockRenderer";
import React from "react";

export class FlowBlockRendererModule implements ControlModule {
  readonly id = "core-block-renderer-flow";
  private unregisterCallback?: () => void;

  async initialize(): Promise<void> {
    // No initialization needed
  }

  register(modApi: LiteChatModApi): void {
    if (this.unregisterCallback) {
      console.warn(`[${this.id}] Already registered. Skipping.`);
      return;
    }

    const flowBlockRenderer: BlockRenderer = {
      id: this.id,
      supportedLanguages: ["flow", "workflow", "reactflow"], // Multiple language aliases
      priority: 10, // Higher priority than fallback renderer
      renderer: (context: BlockRendererContext) => {
        return React.createElement(FlowBlockRenderer, {
          code: context.code,
          isStreaming: context.isStreaming,
        });
      },
    };

    console.log(`[FlowBlockRendererModule] Registering flow block renderer with supported languages:`, flowBlockRenderer.supportedLanguages);
    this.unregisterCallback = modApi.registerBlockRenderer(flowBlockRenderer);
    console.log(`[FlowBlockRendererModule] Flow block renderer registered successfully`);
  }

  destroy(): void {
    if (this.unregisterCallback) {
      this.unregisterCallback();
      this.unregisterCallback = undefined;
    }
  }
} 