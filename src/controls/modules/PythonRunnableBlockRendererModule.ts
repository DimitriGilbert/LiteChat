import type { ControlModule } from "@/types/litechat/control";
import type { LiteChatModApi } from "@/types/litechat/modding";
import type { BlockRenderer, BlockRendererContext } from "@/types/litechat/canvas/block-renderer";
import { PythonRunnableBlockRenderer } from "@/components/LiteChat/common/PythonRunnableBlockRenderer";
import React from "react";

// Control rule prompt for Python runnable blocks
const PYTHON_RUNNABLE_CONTROL_PROMPT = `# Python Scientific Computing Environment

You have access to an enhanced Pyodide environment with numpy, pandas, matplotlib, and the full LiteChat API.

## Available Context
- \`litechat\` — The LiteChat API object with utilities and VFS operations.
- \`litechat.target\` — **THE DOM ELEMENT ITSELF** - Use direct DOM manipulation for visualizations, UI output, etc.
- Scientific Python stack: numpy, pandas, matplotlib, scipy, sklearn, etc.
- \`js\` module — For DOM and browser interop (e.g., \`
from js import document\`).

## LiteChat API Reference
You can use the following methods on \`litechat\`:

### Utilities
- \`litechat.utils.log(level, *args)\` — Log messages that will be captured in the console output (level: 'info', 'warn', 'error')
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
\`\`\`runpy
from js import document
target.replaceChildren()

# Create and append elements
heading = document.createElement('h3')
heading.textContent = 'Hello from DOM!'
heading.className = 'text-blue-500'
target.appendChild(heading)

# Create interactive elements
button = document.createElement('button')
button.textContent = 'Click me!'
def on_click(event):
    litechat.utils.log('info', 'Button clicked!')
    # You can use alert from js if needed
button.addEventListener('click', on_click)
target.appendChild(button)

litechat.utils.log('info', 'DOM elements created and appended')
\`\`\`
### Complex DOM Structures
\`\`\`runpy
from js import document
target.replaceChildren()

container = document.createElement('div')
container.className = 'p-5 bg-gray-100 rounded-lg m-2'

title = document.createElement('h3')
title.textContent = 'Interactive Demo'
container.appendChild(title)

input = document.createElement('input')
input.type = 'text'
input.placeholder = 'Type something...'
input.className = 'p-2 m-2 border border-gray-300 rounded'
container.appendChild(input)

button = document.createElement('button')
button.textContent = 'Process Input'
button.className = 'p-2 bg-blue-500 text-white border-none rounded cursor-pointer'
def on_click(event):
    output = document.createElement('div')
    output.textContent = f'You typed: {input.value}'
    output.className = 'mt-2 p-2 bg-gray-200 rounded'
    container.appendChild(output)
button.addEventListener('click', on_click)
container.appendChild(button)

target.appendChild(container)
litechat.utils.log('info', 'Complex DOM structure created')
\`\`\`

### Canvas/WebGL Example
\`\`\`runpy
from js import document
target.replaceChildren()

canvas = document.createElement('canvas')
canvas.width = 400
canvas.height = 300
canvas.className = 'border border-gray-300'
target.appendChild(canvas)

ctx = canvas.getContext('2d')
ctx.fillStyle = '#ff6b6b'
ctx.fillRect(50, 50, 100, 100)
ctx.fillStyle = '#4ecdc4'
ctx.beginPath()
ctx.arc(300, 150, 50, 0, 2 * 3.14159)
ctx.fill()
litechat.utils.log('info', 'Canvas with shapes created')
\`\`\`

### Data Visualization Example
\`\`\`runpy
from js import document
target.replaceChildren()

data = [10, 25, 15, 40, 30]
max_val = max(data)

chart = document.createElement('div')
chart.className = 'flex items-end gap-1 h-52 p-5'

for value in data:
    bar = document.createElement('div')
    height = (value / max_val) * 150
    bar.className = f'w-10 h-[{height}px] bg-gradient-to-t from-indigo-400 to-purple-800 rounded-t relative transition-all duration-300 ease-in-out'
    label = document.createElement('span')
    label.textContent = str(value)
    label.className = 'absolute top-[-25px] left-1/2 -translate-x-1/2 text-xs font-bold'
    bar.appendChild(label)
    chart.appendChild(bar)
target.appendChild(chart)
litechat.utils.log('info', 'Interactive bar chart created')
\`\`\`

### Reading Files and DOM Display
\`\`\`runpy
import asyncio
from js import document

target.replaceChildren()

async def main():
    vfs = await litechat.getVfsInstance('project-123')
    content = await vfs.promises.readFile('/data.txt', 'utf8')

    pre = document.createElement('pre')
    pre.className = 'bg-gray-50 p-3 rounded-lg overflow-auto font-mono'
    pre.textContent = content
    target.appendChild(pre)
    litechat.utils.log('info', 'File content displayed in DOM')

asyncio.run(main())
\`\`\`

## IMPORTANT PRINCIPLES:
1. **ALWAYS use \`target.appendChild()\`, \`target.replaceChildren()\`, etc.**
2. **Create elements with \`document.createElement()\`**
3. **Use \`element.style.cssText\` for efficient styling**
4. **Add event listeners directly: \`element.addEventListener()\`**
5. **Avoid innerHTML/outerHTML - use DOM methods for performance**
6. **Use \`target.replaceChildren()\` to clear content before adding new content**

You are encouraged to use the full scientific Python stack, the LiteChat API for chat interactions, and DOM interop for visualizations. Focus on workflows that leverage these capabilities.`;

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
          this.modApiRef?.log(level, ...args);
        },
        toast: (type: 'success' | 'error' | 'info' | 'warning', message: string) => {
          this.modApiRef?.showToast(type, message);
        }
      },
      emit: (eventName: string, payload: any) => {
        this.modApiRef?.emit(eventName as any, payload);
      },
      getVfsInstance: (vfsKey?: string) => {
        return this.modApiRef?.getVfsInstance(vfsKey || 'orphan');
      },
      target: previewElement
    };
    return {
      litechat: customLitechatApi,
      target: previewElement
    };
  }
} 