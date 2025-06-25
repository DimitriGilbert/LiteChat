import type { ControlModule } from "@/types/litechat/control";
import type { LiteChatModApi } from "@/types/litechat/modding";
import type { BlockRenderer, BlockRendererContext } from "@/types/litechat/canvas/block-renderer";
import { JsRunnableBlockRenderer } from "@/components/LiteChat/common/JsRunnableBlockRenderer";
import React from "react";

// Control rule prompt for JavaScript runnable blocks
const JS_RUNNABLE_CONTROL_PROMPT = `# JavaScript Runnable Block Environment

You have access to a full JavaScript execution environment with the following context:

## Available Context
- \`litechat\` — The full LiteChat API object (modApi) for VFS, project, event, and utility operations.
- \`target\` — A DOM element you can manipulate directly for visualizations or UI output.

## LiteChat API (modApi) Reference
You can use the following methods on \`litechat\` (the modApi object):

### Event System
- emit(eventName, payload)

### Context and Utilities
- showToast(type, message)
- log(level, ...args)

### VFS (File System)
- getVfsInstance(vfsKey) # 'orphan' is the default, nodejs api compatible fs object. always use async interaction when using.

## Example: Reading a File
\`\`\`js
const vfs = await litechat.getVfsInstance('project-123');
const content = await vfs.promises.readFile('/data.txt', 'utf8');
console.log(content);
\`\`\`

## Example: Emitting an Event
\`\`\`js
litechat.emit('myCustomEvent', { foo: 42 });
\`\`\`

You are encouraged to use the full browser environment (DOM, Canvas, WebGL, etc.) and the LiteChat API for simple chat interactions, data processing, and interactive visualizations. Focus on workflows that leverage these capabilities.
`;

export class JsRunnableBlockRendererModule implements ControlModule {
  readonly id = "core-block-renderer-runnable-js";
  private unregisterCallback?: () => void;
  private unregisterRuleCallback?: () => void;
  private modApiRef?: LiteChatModApi;

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
          module: this, // Pass module reference for enhanced context
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

    this.modApiRef = modApi;
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

  // Public method to get enhanced context for runnable functions
  public getEnhancedContext() {
    if (!this.modApiRef) {
      throw new Error("Module not initialized with modApi");
    }
    // Expose the real modApi as the litechat API object
    return {
      litechat: this.modApiRef,
      // The renderer will add the 'target' property (DOM element) at runtime
    };
  }
} 