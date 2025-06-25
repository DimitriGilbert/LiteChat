import React from "react";
import { type ControlModule } from "@/types/litechat/control";
import type { LiteChatModApi } from "@/types/litechat/modding";

import { PythonRunnableBlockRenderer } from "@/components/LiteChat/common/PythonRunnableBlockRenderer";

const PYTHON_RUNNABLE_BLOCK_CONTROL_PROMPT = `LiteChat supports interactive runnable Python code blocks using the \`runnable-python\` language identifier, powered by Pyodide. This allows you to execute Python code directly in the browser, complete with a \`litechat\` object for application integration.

**Functionality:**
- The \`runnable-python\` block executes Python code in a Pyodide environment.
- It provides a global \`litechat\` object (accessible via \`from js import litechat\`) to interact with the LiteChat application.
- Supports popular Python packages like \`numpy\`, \`pandas\`, and \`matplotlib\`.

**\`litechat\` Object API:**
- \`litechat.context\`: A snapshot of the current application context.
- \`litechat.utils.log(level, *args)\`: Log messages to the console.
- \`litechat.utils.toast(type, message)\`: Display a toast notification.
- \`litechat.vfs.getInstance(vfsKey)\`: Get a VFS instance for file operations.
- \`litechat.preview.createTarget()\`: Create a target for rendering HTML or plots.

**Usage:**
To create a runnable Python block, use the \`runnable-python\` language identifier.

**Example: Using pandas and matplotlib**

\`\`\`runnable-python
import pandas as pd
import matplotlib.pyplot as plt
from js import litechat

# Create a simple DataFrame
data = {'City': ['London', 'Paris', 'New York', 'Tokyo'],
        'Population': [8900000, 2141000, 8399000, 13929000]}
df = pd.DataFrame(data)

# Create a plot
fig, ax = plt.subplots()
df.plot(kind='bar', x='City', y='Population', ax=ax, legend=False)
ax.set_title('City Populations')
ax.set_ylabel('Population (Millions)')
ax.set_xlabel('City')
plt.tight_layout()

# Display the plot in LiteChat
# Pyodide's plt.show() will automatically render in the output.
plt.show()

litechat.utils.toast('success', 'Chart has been generated!')
\`\`\`

Use \`runnable-python\` for data analysis, visualization, and scientific computing tasks directly within the chat.`;

export class PythonRunnableBlockModule implements ControlModule {
  readonly id = "core-python-runnable-block-renderer";
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
            : 'orphan';
        }
      },
      
      // Utilities for common operations
      utils: {
        log: (level: "log" | "warn" | "error" | "info" | "debug", ...args: any[]) => 
          this.modApiRef!.log(level, ...args),
        toast: (type: "success" | "info" | "warning" | "error", message: string) => 
          this.modApiRef!.showToast(type, message),
        generateId: () => `py-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        
        // Event system access
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
              this.modApiRef!.emit('canvas.preview.update', {
                previewId,
                content,
                type: 'html'
              });
            },
            clear: () => {
              this.modApiRef!.emit('canvas.preview.clear', { previewId });
            },
            remove: () => {
              this.modApiRef!.emit('canvas.preview.remove', { previewId });
            }
          };
        }
      },
      
      // Python-specific utilities
      python: {
        // Common Python packages interface for web environment
        packages: {
          matplotlib: "Use 'import matplotlib.pyplot as plt' for plotting",
          numpy: "Use 'import numpy as np' for numerical operations", 
          pandas: "Use 'import pandas as pd' for data manipulation",
          scipy: "Use 'import scipy' for scientific computing",
        },
        
        // Plot utilities that work in browser
        plot: {
          show: () => {
            // In Pyodide, matplotlib.pyplot.show() should work
            return "plt.show()  # This will display plots in the output";
          },
          savefig: (filename: string) => {
            return `plt.savefig('${filename}')  # Save plot to file`;
          }
        }
      }
    };
  }

  register(modApi: LiteChatModApi): void {
    const rendererUnregister = modApi.registerBlockRenderer({
      id: this.id,
      supportedLanguages: ["py", "python", "runnable-python"],
      priority: 5, // Higher than default code renderer but lower than specialized renderers
      renderer: (context) => {
        return React.createElement(PythonRunnableBlockRenderer, {
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
      name: "Runnable Python Control",
      content: PYTHON_RUNNABLE_BLOCK_CONTROL_PROMPT,
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