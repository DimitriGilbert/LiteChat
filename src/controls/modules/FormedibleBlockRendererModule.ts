import type { ControlModule } from "@/types/litechat/control";
import type { LiteChatModApi } from "@/types/litechat/modding";
import type { BlockRenderer, BlockRendererContext } from "@/types/litechat/canvas/block-renderer";
import { FormedibleBlockRenderer } from "@/components/LiteChat/common/FormedibleBlockRenderer";
import React from "react";

export class FormedibleBlockRendererModule implements ControlModule {
  readonly id = "core-block-renderer-formedible";
  private unregisterCallback?: () => void;

  async initialize(): Promise<void> {
    // No initialization needed
  }

  register(modApi: LiteChatModApi): void {
    if (this.unregisterCallback) {
      console.warn(`[${this.id}] Already registered. Skipping.`);
      return;
    }

    const formedibleBlockRenderer: BlockRenderer = {
      id: this.id,
      supportedLanguages: ["formedible"], // Specifically handles formedible language
      priority: 10, // Higher priority than fallback renderer
      renderer: (context: BlockRendererContext) => {
        return React.createElement(FormedibleBlockRenderer, {
          code: context.code,
          isStreaming: context.isStreaming,
        });
      },
    };

    this.unregisterCallback = modApi.registerBlockRenderer(formedibleBlockRenderer);
  }

  destroy(): void {
    if (this.unregisterCallback) {
      this.unregisterCallback();
      this.unregisterCallback = undefined;
    }
  }
} 