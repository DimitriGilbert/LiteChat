import React from "react";
import { type ControlModule } from "@/types/litechat/control";
import type { LiteChatModApi } from "@/types/litechat/modding";

import { JsRunnableBlockRenderer } from "@/components/LiteChat/common/JsRunnableBlockRenderer";

const JS_RUNNABLE_BLOCK_CONTROL_PROMPT = `LiteChat supports interactive runnable JavaScript code blocks using the \`runnable-js\` language identifier. This allows you to write and execute code directly within the chat interface, with access to a special \`litechat\` global object for advanced integrations.

**Functionality:**
- The \`runnable-js\` block executes sandboxed JavaScript code in the browser.
- It provides a global \`litechat\` object to interact with the LiteChat application.
- Supports asynchronous operations, logging, and rendering previews.

**\`litechat\` Object API:**
- \`litechat.context\`: A snapshot of the current application context (e.g., selected conversation).
- \`litechat.utils.log(level, ...args)\`: Log messages to the console.
- \`litechat.utils.toast(type, message)\`: Display a toast notification.
- \`litechat.vfs.getInstance(vfsKey)\`: Get a VFS instance for file operations.
- \`litechat.preview.createTarget()\`: Create a target for rendering HTML or React components.

**Usage:**
To create a runnable JavaScript block, use the \`runnable-js\` language identifier.

**Example: Reading a file and displaying its content**

\`\`\`runnable-js
async function showFileContent() {
  try {
    const vfs = litechat.vfs.getInstance(litechat.vfs.getCurrentVfsKey());
    const content = await vfs.readFile('/welcome.txt', 'utf8');

    const preview = litechat.preview.createTarget();
    preview.render(\`<pre>\${content}</pre>\`);

    litechat.utils.toast('success', 'File content displayed!');
  } catch (error) {
    litechat.utils.log('error', 'Failed to read file:', error.message);
    litechat.utils.toast('error', \`Error: \${error.message}\`);
  }
}

showFileContent();
\`\`\`

Use \`runnable-js\` for tasks like data processing, API calls, interactive demos, or file manipulation within the LiteChat environment.`;

export class JsRunnableBlockModule implements ControlModule {
  readonly id = "core-js-runnable-block-renderer";
  private modApiRef: LiteChatModApi | null = null;
  private unregisterCallbacks: (() => void)[] = [];

  async initialize(modApi: LiteChatModApi): Promise<void> {
    this.modApiRef = modApi;
    console.log(`[${this.id}] Initialized with modApi access.`);
  }

  // Public method to get enhanced context for runnable functions
  public getEnhancedContext() {
    if (!this.modApiRef) {
      throw new Error("Module not initialized with modApi");
    }

    return {
      // ModApi access for full LiteChat integration
      modApi: this.modApiRef,

      // Context snapshot for current state
      context: this.modApiRef.getContextSnapshot(),

      // VFS access for file operations
      vfs: {
        getInstance: (vfsKey: string) => {
          if (!this.modApiRef) throw new Error("modApi not available");
          return this.modApiRef.getVfsInstance(vfsKey);
        },
        getCurrentVfsKey: () => {
          if (!this.modApiRef) throw new Error("modApi not available");
          const context = this.modApiRef.getContextSnapshot();
          // Use selected conversation's project if available, otherwise 'orphan'
          return context.selectedConversationId
            ? `project-${context.selectedConversationId}`
            : "orphan";
        },
      },

      // Utilities for common operations
      utils: {
        log: (
          level: "log" | "warn" | "error" | "info" | "debug",
          ...args: any[]
        ) => this.modApiRef!.log(level, ...args),
        toast: (
          type: "success" | "info" | "warning" | "error",
          message: string
        ) => this.modApiRef!.showToast(type, message),
        generateId: () =>
          `js-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,

        // Event system access
        // I do not like the any 
        // TODO fix at some point but not critical
        emit: (eventName: string, payload: any) =>
          this.modApiRef!.emit(eventName as any, payload),
        on: (eventName: string, callback: (payload: any) => void) =>
          this.modApiRef!.on(eventName as any, callback),
      },

      // Preview management for graphical output
      preview: {
        createTarget: (id?: string) => {
          const previewId = id || `preview-${Date.now()}`;
          return {
            id: previewId,
            render: (content: string | React.ReactElement) => {
              // Emit event to create/update preview block
              this.modApiRef!.emit("canvas.preview.update", {
                previewId,
                content,
                type: "html",
              });
            },
            clear: () => {
              this.modApiRef!.emit("canvas.preview.clear", { previewId });
            },
            remove: () => {
              this.modApiRef!.emit("canvas.preview.remove", { previewId });
            },
          };
        },
      },
    };
  }

  register(modApi: LiteChatModApi): void {
    const rendererUnregister = modApi.registerBlockRenderer({
      id: this.id,
      supportedLanguages: ["js", "javascript", "runnable-js"],
      priority: 5, // Higher than default code renderer but lower than specialized renderers
      renderer: (context) => {
        return React.createElement(JsRunnableBlockRenderer, {
          code: context.code,
          isStreaming: context.isStreaming,
          interactionId: context.interactionId,
          blockId: context.blockId,
          // Pass the module instance for enhanced context access
          module: this,
        });
      },
    });
    this.unregisterCallbacks.push(rendererUnregister);

    const ruleUnregister = modApi.registerRule({
      id: `${this.id}-control-rule`,
      name: "Runnable JS Control",
      content: JS_RUNNABLE_BLOCK_CONTROL_PROMPT,
      type: "control",
      alwaysOn: false, // Disabled by default, user must opt-in via settings
      moduleId: this.id,
    });
    this.unregisterCallbacks.push(ruleUnregister);
  }

  destroy(_modApi: LiteChatModApi): void {
    this.unregisterCallbacks.forEach(cb => cb());
    this.unregisterCallbacks = [];
    this.modApiRef = null;
    console.log(`[${this.id}] Destroyed.`);
  }
}
