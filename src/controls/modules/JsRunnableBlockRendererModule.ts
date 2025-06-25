import type { ControlModule } from "@/types/litechat/control";
import type { LiteChatModApi } from "@/types/litechat/modding";
import type { BlockRenderer, BlockRendererContext } from "@/types/litechat/canvas/block-renderer";
import { JsRunnableBlockRenderer } from "@/components/LiteChat/common/JsRunnableBlockRenderer";
import React from "react";

// Control rule prompt for JavaScript runnable blocks
const JS_RUNNABLE_CONTROL_PROMPT = `LiteChat supports runnable JavaScript code blocks. Use 'runjs' language identifier for JavaScript code that users can execute multiple times on demand.

For example:
\`\`\`runjs
console.log("Hello from JavaScript!");
const numbers = [1, 2, 3, 4, 5];
const sum = numbers.reduce((a, b) => a + b, 0);
console.log("Sum:", sum);

// Example with DOM manipulation
const div = document.createElement('div');
div.textContent = 'Dynamic content created!';
console.log("Created element:", div.textContent);
\`\`\`

Runnable JavaScript blocks provide:
- Multiple execution capability with Run button
- Console output capture and display  
- Error handling and display
- Code editing while preserving results
- Safe execution environment

Use 'runjs' for interactive JavaScript examples, calculations, demonstrations, and educational content.`;

export class JsRunnableBlockRendererModule implements ControlModule {
  readonly id = "core-block-renderer-runnable-js";
  private unregisterCallback?: () => void;
  private unregisterRuleCallback?: () => void;

  async initialize(): Promise<void> {
    // No initialization needed
  }

  register(modApi: LiteChatModApi): void {
    if (this.unregisterCallback) {
      console.warn(`[${this.id}] Already registered. Skipping.`);
      return;
    }

    const jsRunnableBlockRenderer: BlockRenderer = {
      id: this.id,
      supportedLanguages: ["runjs"], // Specifically handles runjs language
      priority: 15, // Higher priority than regular code renderer
      renderer: (context: BlockRendererContext) => {
        return React.createElement(JsRunnableBlockRenderer, {
          code: context.code,
          isStreaming: context.isStreaming,
          interactionId: context.interactionId,
          blockId: context.blockId,
        });
      },
    };

    this.unregisterCallback = modApi.registerBlockRenderer(jsRunnableBlockRenderer);

    this.unregisterRuleCallback = modApi.registerRule({
      id: `${this.id}-control-rule`,
      name: "JavaScript Runnable Block Control",
      content: JS_RUNNABLE_CONTROL_PROMPT,
      type: "control",
      alwaysOn: true,
      moduleId: this.id,
    });
  }

  destroy(): void {
    if (this.unregisterCallback) {
      this.unregisterCallback();
      this.unregisterCallback = undefined;
    }
    if (this.unregisterRuleCallback) {
      this.unregisterRuleCallback();
      this.unregisterRuleCallback = undefined;
    }
  }
} 