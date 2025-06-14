import type { ControlModule } from "@/types/litechat/control";
import type { LiteChatModApi } from "@/types/litechat/modding";
import type { BlockRenderer, BlockRendererContext } from "@/types/litechat/canvas/block-renderer";
import { MermaidBlockRenderer } from "@/components/LiteChat/common/MermaidBlockRenderer";
import React from "react";

export class MermaidBlockRendererModule implements ControlModule {
  readonly id = "core-block-renderer-mermaid";
  private unregisterCallback?: () => void;

  async initialize(): Promise<void> {
    // No initialization needed
  }

  register(modApi: LiteChatModApi): void {
    if (this.unregisterCallback) {
      console.warn(`[${this.id}] Already registered. Skipping.`);
      return;
    }

    const mermaidBlockRenderer: BlockRenderer = {
      id: this.id,
      supportedLanguages: ["mermaid"], // Specifically handles mermaid language
      priority: 10, // Higher priority than fallback renderer
      renderer: (context: BlockRendererContext) => {
        return React.createElement(MermaidBlockRenderer, {
          code: context.code,
          isStreaming: context.isStreaming,
        });
      },
    };

    this.unregisterCallback = modApi.registerBlockRenderer(mermaidBlockRenderer);
  }

  destroy(): void {
    if (this.unregisterCallback) {
      this.unregisterCallback();
      this.unregisterCallback = undefined;
    }
  }
} 