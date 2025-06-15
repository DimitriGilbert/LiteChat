import type { ControlModule } from "@/types/litechat/control";
import type { LiteChatModApi } from "@/types/litechat/modding";
import type { BlockRenderer, BlockRendererContext } from "@/types/litechat/canvas/block-renderer";
import { CodeBlockRenderer } from "@/components/LiteChat/common/CodeBlockRenderer";
import React from "react";

export class CodeBlockRendererModule implements ControlModule {
  readonly id = "core-block-renderer-code";
  private unregisterCallback?: () => void;

  async initialize(): Promise<void> {
    // No initialization needed
  }

  register(modApi: LiteChatModApi): void {
    if (this.unregisterCallback) {
      console.warn(`[${this.id}] Already registered. Skipping.`);
      return;
    }

    const codeBlockRenderer: BlockRenderer = {
      id: this.id,
      // This is the fallback renderer - handles all languages except those with specific renderers
      supportedLanguages: undefined, // undefined means it handles all languages as fallback
      priority: 0, // Low priority as fallback
      renderer: (context: BlockRendererContext) => {
        return React.createElement(CodeBlockRenderer, {
          lang: context.lang,
          code: context.code,
          filepath: context.filepath,
          isStreaming: context.isStreaming,
          interactionId: context.interactionId,
        });
      },
    };

    this.unregisterCallback = modApi.registerBlockRenderer(codeBlockRenderer);
  }

  destroy(): void {
    if (this.unregisterCallback) {
      this.unregisterCallback();
      this.unregisterCallback = undefined;
    }
  }
} 