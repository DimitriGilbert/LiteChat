import type { ControlModule } from "@/types/litechat/control";
import type { LiteChatModApi } from "@/types/litechat/modding";
import type { BlockRenderer, BlockRendererContext } from "@/types/litechat/canvas/block-renderer";
import { PythonRunnableBlockRenderer } from "@/components/LiteChat/common/PythonRunnableBlockRenderer";
import React from "react";

// Control rule prompt for Python runnable blocks
const PYTHON_RUNNABLE_CONTROL_PROMPT = `# Python Scientific Computing Environment

You have access to an enhanced Pyodide environment with numpy, pandas, matplotlib, and the full LiteChat API.

## Available Context
- \`litechat\` — The full LiteChat API object (modApi) for VFS, project, event, and utility operations.
- \`target\` — A DOM element for direct manipulation (for visualizations, UI output, etc.).
- Scientific Python stack: numpy, pandas, matplotlib, scipy, sklearn, etc.
- \`js\` module — For DOM and browser interop (e.g., \`from js import document\`).

## LiteChat API (modApi) Reference
You can use the following methods on \`litechat\` (the modApi object):

### Context and Utilities
- showToast(type, message)
- log(level, ...args)

### Event System
- emit(eventName, payload)

### VFS (File System)
- getVfsInstance(vfsKey) # 'orphan' is the default, nodejs api compatible fs object. always use async interaction when using.

## Example: Reading a File
\`\`\`python
vfs = await litechat.getVfsInstance('project-123')
content = await vfs.promises.readFile('/data.txt', 'utf8')
print(content)
\`\`\`

## Example: Emitting an Event
\`\`\`python
litechat.emit('myCustomEvent', { 'foo': 42 })
\`\`\`

You are encouraged to use the full scientific Python stack, the LiteChat API for simple chat interactions, and DOM interop for visualizations. Focus on workflows that leverage these capabilities.
`;

export class PythonRunnableBlockRendererModule implements ControlModule {
  readonly id = "core-block-renderer-runnable-python";
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
          module: this, // Pass module reference for enhanced context
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