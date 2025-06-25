import type { ControlModule } from "@/types/litechat/control";
import type { LiteChatModApi } from "@/types/litechat/modding";
import type { BlockRenderer, BlockRendererContext } from "@/types/litechat/canvas/block-renderer";
import { JsRunnableBlockRenderer } from "@/components/LiteChat/common/JsRunnableBlockRenderer";
import React from "react";

// Control rule prompt for JavaScript runnable blocks  
const JS_RUNNABLE_CONTROL_PROMPT = `# JavaScript Runnable Block Environment

You have access to a full JavaScript execution environment with the following context:

## Available Context
- \`litechat\` — The LiteChat API object with utilities and VFS operations.
- \`litechat.target\` — **THE DOM ELEMENT ITSELF** - Use direct DOM manipulation for performance and versatility.

## LiteChat API Reference
You can use the following methods on \`litechat\`:

### Utilities
- \`litechat.utils.log(level, ...args)\` — Log messages that will be captured in the console output (level: 'info', 'warn', 'error')
- \`litechat.utils.toast(type, message)\` — Show toast notifications (type: 'success', 'error', 'info', 'warning')

### Event System
- \`litechat.emit(eventName, payload)\` — Emit events to the LiteChat system

### VFS (File System)
- \`litechat.getVfsInstance(vfsKey)\` — Get VFS instance ('orphan' is the default)

### DOM Target
- \`litechat.target\` — The DOM element for rendering content and UI

## DOM Manipulation - USE THIS APPROACH!
**ALWAYS use direct DOM operations on the \`litechat.target\` element. This is THE PRIMARY METHOD for rendering content.**

### Basic DOM Operations
\`\`\`runjs
// Clear the target
litechat.target.replaceChildren();

// Create and append elements
const heading = document.createElement('h3');
heading.textContent = 'Hello from DOM!';
heading.style.color = 'blue';
litechat.target.appendChild(heading);

// Create interactive elements
const button = document.createElement('button');
button.textContent = 'Click me!';
button.onclick = () => alert('DOM manipulation rocks!');
litechat.target.appendChild(button);

litechat.utils.log('info', 'DOM elements created and appended');
\`\`\`

### Complex DOM Structures
\`\`\`runjs
// Clear target first
litechat.target.replaceChildren();

// Create a container
const container = document.createElement('div');
container.style.cssText = 'padding: 20px; background: #f0f0f0; border-radius: 8px; margin: 10px 0;';

// Add title
const title = document.createElement('h3');
title.textContent = 'Interactive Demo';
container.appendChild(title);

// Add input field
const input = document.createElement('input');
input.type = 'text';
input.placeholder = 'Type something...';
input.style.cssText = 'padding: 8px; margin: 10px 0; border: 1px solid #ccc; border-radius: 4px;';
container.appendChild(input);

// Add interactive button
const button = document.createElement('button');
button.textContent = 'Process Input';
button.style.cssText = 'padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;';
button.onclick = () => {
  const output = document.createElement('div');
  output.textContent = \`You typed: \${input.value}\`;
  output.style.cssText = 'margin-top: 10px; padding: 10px; background: #e9ecef; border-radius: 4px;';
  container.appendChild(output);
};
container.appendChild(button);

// Append to target
litechat.target.appendChild(container);

litechat.utils.log('info', 'Complex DOM structure created');
\`\`\`

### Canvas/WebGL Example
\`\`\`runjs
// Clear target
litechat.target.replaceChildren();

// Create canvas
const canvas = document.createElement('canvas');
canvas.width = 400;
canvas.height = 300;
canvas.style.border = '1px solid #ccc';
litechat.target.appendChild(canvas);

// Draw on canvas
const ctx = canvas.getContext('2d');
ctx.fillStyle = '#ff6b6b';
ctx.fillRect(50, 50, 100, 100);
ctx.fillStyle = '#4ecdc4';
ctx.beginPath();
ctx.arc(300, 150, 50, 0, Math.PI * 2);
ctx.fill();

litechat.utils.log('info', 'Canvas with shapes created');
\`\`\`

### Data Visualization Example
\`\`\`runjs
// Clear target
litechat.target.replaceChildren();

const data = [10, 25, 15, 40, 30];
const maxVal = Math.max(...data);

// Create chart container
const chart = document.createElement('div');
chart.style.cssText = 'display: flex; align-items: end; gap: 5px; height: 200px; padding: 20px;';

data.forEach((value, index) => {
  const bar = document.createElement('div');
  const height = (value / maxVal) * 150;
  bar.style.cssText = \`
    width: 40px;
    height: \${height}px;
    background: linear-gradient(to top, #667eea, #764ba2);
    border-radius: 4px 4px 0 0;
    position: relative;
    transition: all 0.3s ease;
  \`;
  
  // Add value label
  const label = document.createElement('span');
  label.textContent = value;
  label.style.cssText = 'position: absolute; top: -25px; left: 50%; transform: translateX(-50%); font-size: 12px; font-weight: bold;';
  bar.appendChild(label);
  
  // Add hover effect
  bar.onmouseenter = () => bar.style.transform = 'scaleY(1.1)';
  bar.onmouseleave = () => bar.style.transform = 'scaleY(1)';
  
  chart.appendChild(bar);
});

litechat.target.appendChild(chart);
litechat.utils.log('info', 'Interactive bar chart created');
\`\`\`

### Reading Files and DOM Display
\`\`\`runjs
const vfs = await litechat.getVfsInstance('project-123');
const content = await vfs.promises.readFile('/data.txt', 'utf8');

// Clear target
litechat.target.replaceChildren();

// Create code display
const pre = document.createElement('pre');
pre.style.cssText = 'background: #f8f9fa; padding: 15px; border-radius: 8px; overflow: auto; font-family: monospace;';
pre.textContent = content;
litechat.target.appendChild(pre);

litechat.utils.log('info', 'File content displayed in DOM');
\`\`\`

## IMPORTANT PRINCIPLES:
1. **ALWAYS use \`litechat.target.appendChild()\`, \`litechat.target.replaceChildren()\`, etc.**
2. **Create elements with \`document.createElement()\`**
3. **Use \`element.style.cssText\` for efficient styling**
4. **Add event listeners directly: \`element.onclick = () => {...}\`**
5. **Avoid innerHTML/outerHTML - use DOM methods for performance**
6. **Use \`litechat.target.replaceChildren()\` to clear content before adding new content**

You are encouraged to use the full browser environment (DOM, Canvas, WebGL, Web APIs) with direct DOM manipulation for maximum performance and versatility. Focus on creating interactive, performant visualizations and UI components.
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
      alwaysOn: false, // Disabled by default, user must opt-in via settings
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
  public getEnhancedContext(capturedLogs: string[], previewElement: HTMLElement | null) {
    if (!this.modApiRef) {
      throw new Error("Module not initialized with modApi");
    }

         // Create a custom litechat API that matches the control rule prompt
     const customLitechatApi = {
       // Utilities with log capture
       utils: {
         log: (level: 'info' | 'warn' | 'error', ...args: any[]) => {
           const formatted = args.map(arg => {
             if (typeof arg === 'object') {
               try {
                 return JSON.stringify(arg, null, 2);
               } catch {
                 return String(arg);
               }
             }
             return String(arg);
           }).join(' ');
           
           const logEntry = level === 'info' ? formatted : `${level.charAt(0).toUpperCase() + level.slice(1)}: ${formatted}`;
           capturedLogs.push(logEntry);
           
           // Also log to browser console with prefix for debugging
           this.modApiRef?.log(level, ...args);
         },
         toast: (type: 'success' | 'error' | 'info' | 'warning', message: string) => {
           this.modApiRef?.showToast(type, message);
         }
       },

       // Event system
       emit: (eventName: string, payload: any) => {
         this.modApiRef?.emit(eventName as any, payload);
       },

       // VFS access
       getVfsInstance: (vfsKey?: string) => {
         return this.modApiRef?.getVfsInstance(vfsKey || 'orphan');
       },

       // DOM target element
       target: previewElement
     };

    return {
      litechat: customLitechatApi,
      target: previewElement // Keep backward compatibility
    };
  }
} 