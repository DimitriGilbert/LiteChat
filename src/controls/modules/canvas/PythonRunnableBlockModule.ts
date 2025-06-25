import React from "react";
import { type ControlModule } from "@/types/litechat/control";
import type { LiteChatModApi } from "@/types/litechat/modding";

import { PythonRunnableBlockRenderer } from "@/components/LiteChat/common/PythonRunnableBlockRenderer";

export class PythonRunnableBlockModule implements ControlModule {
  readonly id = "core-python-runnable-block-renderer";
  private modApiRef: LiteChatModApi | null = null;

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
        getInstance: (vfsKey: string) => this.modApiRef!.getVfsInstance(vfsKey),
        getCurrentVfsKey: () => {
          const context = this.modApiRef!.getContextSnapshot();
          // Use selected conversation's project if available, otherwise 'orphan'
          return context.selectedConversationId ? 
            `project-${context.selectedConversationId}` : 'orphan';
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
    modApi.registerBlockRenderer({
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
  }

  destroy(_modApi: LiteChatModApi): void {
    this.modApiRef = null;
    console.log(`[${this.id}] Destroyed.`);
  }
} 