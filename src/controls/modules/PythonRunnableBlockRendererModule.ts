import type { ControlModule } from "@/types/litechat/control";
import type { LiteChatModApi } from "@/types/litechat/modding";
import type { BlockRenderer, BlockRendererContext } from "@/types/litechat/canvas/block-renderer";
import { PythonRunnableBlockRenderer } from "@/components/LiteChat/common/PythonRunnableBlockRenderer";
import React from "react";

// Control rule prompt for Python runnable blocks
const PYTHON_RUNNABLE_CONTROL_PROMPT = `LiteChat supports runnable Python code blocks using Pyodide. Use 'runpy' language identifier for Python code that users can execute multiple times on demand.

For example:
\`\`\`runpy
print("Hello from Python!")
numbers = [1, 2, 3, 4, 5]
total = sum(numbers)
print(f"Sum: {total}")

# Example with data processing
import math
result = math.sqrt(16)
print(f"Square root of 16: {result}")

# Example with list comprehension
squares = [x**2 for x in range(1, 6)]
print("Squares:", squares)
\`\`\`

Runnable Python blocks provide:
- Multiple execution capability with Run button
- Full Python standard library via Pyodide
- Console output capture and display
- Error handling and display  
- Code editing while preserving results
- Safe execution environment in browser

Use 'runpy' for interactive Python examples, data analysis, calculations, demonstrations, and educational content.`;

export class PythonRunnableBlockRendererModule implements ControlModule {
  readonly id = "core-block-renderer-runnable-python";
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

    const pythonRunnableBlockRenderer: BlockRenderer = {
      id: this.id,
      supportedLanguages: ["runpy"], // Specifically handles runpy language
      priority: 15, // Higher priority than regular code renderer
      renderer: (context: BlockRendererContext) => {
        return React.createElement(PythonRunnableBlockRenderer, {
          code: context.code,
          isStreaming: context.isStreaming,
          interactionId: context.interactionId,
          blockId: context.blockId,
        });
      },
    };

    this.unregisterCallback = modApi.registerBlockRenderer(pythonRunnableBlockRenderer);

    this.unregisterRuleCallback = modApi.registerRule({
      id: `${this.id}-control-rule`,
      name: "Python Runnable Block Control",
      content: PYTHON_RUNNABLE_CONTROL_PROMPT,
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