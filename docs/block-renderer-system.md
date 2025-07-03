# Block Renderer System

The Block Renderer System provides an extensible way to add custom renderers for different code block languages in LiteChat. This system follows the same architectural patterns as other extensible controls in the application.

## Overview

The Block Renderer System allows you to:
- Register custom renderers for specific programming languages
- Override default rendering behavior for code blocks
- Create specialized visualizations for different content types
- Maintain consistent UI patterns across all block types

## Architecture

### Core Components

1. **BlockRenderer Interface** (`src/types/litechat/canvas/block-renderer.ts`)
2. **BlockRendererService** (`src/services/block-renderer.service.ts`)
3. **UniversalBlockRenderer** (`src/components/LiteChat/common/UniversalBlockRenderer.tsx`)
4. **Control Modules** for registering renderers

### How It Works

1. **Registration**: Control modules register block renderers with specific language support
2. **Selection**: When rendering a code block, the system finds the best matching renderer
3. **Rendering**: The selected renderer processes the code and returns React components
4. **Fallback**: If no specific renderer is found, falls back to the default code renderer

## How to Create a Custom Block Renderer: A Detailed Guide

This guide provides a comprehensive walkthrough for creating a new block renderer, from basic setup to advanced features, based on an analysis of all existing renderers in the project.

### Step 1: Create the Renderer Module

First, create a new TypeScript file for your control module in `src/controls/modules/`. The convention is to name it `[MyRenderer]BlockRendererModule.ts`.

This module is responsible for registering your renderer with the application.

**Example: `src/controls/modules/MyCustomBlockRendererModule.ts`**

```typescript
import type { ControlModule } from "@/types/litechat/control";
import type { LiteChatModApi } from "@/types/litechat/modding";
import type { BlockRenderer, BlockRendererContext } from "@/types/litechat/canvas/block-renderer";
import { MyCustomBlockRenderer } from "@/components/LiteChat/common/MyCustomBlockRenderer";
import React from "react";

export class MyCustomBlockRendererModule implements ControlModule {
  // A unique ID for your module
  readonly id = "my-custom-block-renderer";
  
  // Store the unregister function for cleanup
  private unregisterCallback?: () => void;

  // Optional: If your renderer needs a control rule for the AI
  private unregisterRuleCallback?: () => void;

  async initialize(modApi: LiteChatModApi): Promise<void> {
    // Perform any async setup here if needed.
    // Most renderers will not need this.
  }

  register(modApi: LiteChatModApi): void {
    // Define the renderer object
    const myCustomRenderer: BlockRenderer = {
      id: this.id,
      // The language identifiers this renderer will handle
      supportedLanguages: ["my-lang", "custom-data"],
      // Higher priority renderers are chosen over lower ones for the same language
      priority: 15, 
      // The function that returns the React component
      renderer: (context: BlockRendererContext) => {
        // Pass the context to your component
        return React.createElement(MyCustomBlockRenderer, {
          code: context.code,
          isStreaming: context.isStreaming ?? false,
          // Pass other context properties as needed
          interactionId: context.interactionId,
          blockId: context.blockId,
        });
      },
    };

    // Register the renderer and store the cleanup function
    this.unregisterCallback = modApi.registerBlockRenderer(myCustomRenderer);

    // (Optional) Register a control rule to guide the AI
    const controlRuleContent = `
      When you need to display data in a special format, use the 'my-lang' code block.
      ```my-lang
      { "key": "value" }
      ```
    `;
    this.unregisterRuleCallback = modApi.registerRule({
      id: `${this.id}-rule`,
      name: "My Custom Renderer Guide",
      content: controlRuleContent,
      type: "control",
      alwaysOn: true, // Or false if it should be user-configurable
      moduleId: this.id,
    });
  }

  destroy(): void {
    // Cleanup on module destruction
    this.unregisterCallback?.();
    this.unregisterRuleCallback?.();
  }
}
```

### Step 2: Create the Renderer React Component

Next, create the React component that will render your block. Place this file in `src/components/LiteChat/common/` with the name `[MyRenderer]BlockRenderer.tsx`.

This component receives props from the module and handles the actual rendering logic.

**Key UI/UX Patterns to Follow:**

- **Main Container:** Wrap your component in a `div` with `className="code-block-container group/codeblock my-4 max-w-full"`.
- **Header:** Implement a consistent header that is visible on hover.
- **Actions:** Provide actions like "view code" or "download" in the header.
- **Folding:** Support a folded state, especially for streaming or large content.
- **Loading/Error States:** Display clear loading indicators and user-friendly error messages.

**Example: `src/components/LiteChat/common/MyCustomBlockRenderer.tsx`**

```typescript
import React, { useState, useMemo, useCallback, memo } from "react";
import { useTranslation } from "react-i18next";
import { useSettingsStore } from "@/store/settings.store";
import { useShallow } from "zustand/react/shallow";
import { CodeBlockRenderer } from "./CodeBlockRenderer";
import { AlertCircleIcon, Loader2Icon, CodeIcon, ImageIcon } from "lucide-react";

interface MyCustomBlockRendererProps {
  code: string;
  isStreaming: boolean;
}

const MyCustomBlockRendererComponent: React.FC<MyCustomBlockRendererProps> = ({ code, isStreaming }) => {
  const { t } = useTranslation('renderers');
  const { foldStreamingCodeBlocks } = useSettingsStore(
    useShallow((state) => ({ foldStreamingCodeBlocks: state.foldStreamingCodeBlocks }))
  );

  // State Management
  const [isFolded, setIsFolded] = useState(isStreaming ? foldStreamingCodeBlocks : false);
  const [showCode, setShowCode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<any>(null);

  // Parsing Logic (runs when code changes and is not folded/streaming)
  const parseData = useCallback(() => {
    if (!code.trim() || isFolded || isStreaming) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = JSON.parse(code);
      setParsedData(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid data format");
    } finally {
      setIsLoading(false);
    }
  }, [code, isFolded, isStreaming]);

  useEffect(() => {
    parseData();
  }, [parseData]);

  // Event Handlers
  const toggleFold = () => setIsFolded(p => !p);
  const toggleView = () => setShowCode(p => !p);

  // Memoized preview for folded state
  const foldedPreviewText = useMemo(() => code.split('\n').slice(0, 3).join('\n'), [code]);

  return (
    <div className="code-block-container group/codeblock my-4 max-w-full">
      {/* Consistent Header */}
      <div className="code-block-header sticky top-0 z-10 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <div className="text-sm font-medium">{t('myCustomBlock.header')}</div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover/codeblock:opacity-100 focus-within:opacity-100 transition-opacity">
          <button onClick={toggleView} className="p-1.5 rounded-md hover:bg-muted/50" title={showCode ? "Show Visual" : "Show Code"}>
            {showCode ? <ImageIcon className="h-4 w-4" /> : <CodeIcon className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Content Area */}
      {!isFolded && (
        <div className="overflow-hidden w-full">
          {showCode ? (
            <CodeBlockRenderer lang="json" code={code} isStreaming={isStreaming} />
          ) : (
            <>
              {isLoading && <div className="p-8 flex justify-center"><Loader2Icon className="animate-spin" /></div>}
              {error && (
                <div className="p-4 border border-destructive/20 bg-destructive/10 rounded-md text-destructive flex items-center gap-2">
                  <AlertCircleIcon className="h-5 w-5" />
                  <div>{error}</div>
                </div>
              )}
              {parsedData && !isLoading && !error && (
                <div className="p-4 border rounded-md bg-background">
                  {/* Your custom visualization here */}
                  <pre>{JSON.stringify(parsedData, null, 2)}</pre>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Folded State */}
      {isFolded && (
        <div className="folded-content-preview p-4 cursor-pointer" onClick={toggleFold}>
          <pre className="whitespace-pre-wrap text-muted-foreground font-mono text-sm">{foldedPreviewText}</pre>
        </div>
      )}
    </div>
  );
};

export const MyCustomBlockRenderer = memo(MyCustomBlockRendererComponent);
```

### Step 3: Register Your Module in `App.tsx`

Finally, import and add your new module to the `controlModulesToRegister` array in `src/App.tsx`. The order matters for dependencies, but for most block renderers, the order is not critical. It's good practice to group them together.

```typescript
// src/App.tsx
import { MyCustomBlockRendererModule } from "@/controls/modules/MyCustomBlockRendererModule";

const controlModulesToRegister: ControlModuleConstructor[] = [
  // ... other modules
  CodeBlockRendererModule,
  MermaidBlockRendererModule,
  ChartBlockRendererModule,
  FlowBlockRendererModule,
  FormedibleBlockRendererModule,
  OrchestrationBlockRendererModule,
  JsRunnableBlockRendererModule,
  PythonRunnableBlockRendererModule,
  MyCustomBlockRendererModule, // Add your new module here
  // ... rest of modules
];
```

### Advanced Concepts and Best Practices

#### Handling Streaming Content

If `isStreaming` is true, your renderer should be careful about parsing. The code is likely incomplete.
- **Fold by default:** Set `useState(isStreaming ? foldStreamingCodeBlocks : false)`.
- **Debounce parsing:** Use a `setTimeout` in an effect to avoid parsing on every single character change.
- **Validate structure:** Before parsing, check if the code has a chance of being valid (e.g., starts with `{` and ends with `}`).

```typescript
// From ChartBlockRenderer.tsx
const parseChart = useCallback(async () => {
  if (isStreaming) {
    const trimmedCode = code.trim();
    if (!(trimmedCode.startsWith('{') && trimmedCode.endsWith('}'))) {
      return; // Incomplete, don't attempt to parse
    }
  }
  // ... parsing logic
}, [code, isStreaming]);

useEffect(() => {
  const handle = setTimeout(parseChart, isStreaming ? 300 : 0);
  return () => clearTimeout(handle);
}, [code, isStreaming, parseChart]);
```

#### Integrating with Canvas Controls

Your renderer can and should integrate with other canvas controls, like "Copy" or "Edit". This is done by rendering slots.

```typescript
// From CodeBlockRenderer.tsx
const canvasControls = useControlRegistryStore(
  useShallow((state) => Object.values(state.canvasControls))
);

const renderSlotForCodeBlock = useCallback((targetSlotName, ...) => {
  return canvasControls
    .filter(c => c.type === "codeblock" && c.targetSlot === targetSlotName)
    .map(control => {
      const context: CanvasControlRenderContext = { ... };
      return <React.Fragment key={control.id}>{control.renderer!(context)}</React.Fragment>;
    });
}, [canvasControls]);

// In your JSX:
<div className="opacity-0 group-hover/codeblock:opacity-100">
  {renderSlotForCodeBlock("codeblock-header-actions", ...)}
</div>
```

#### Creating Interactive Renderers (e.g., Runnable Code)

For renderers that execute code (`runjs`, `runpy`):
- **Security First:** Implement a security check (`CodeSecurityService`) and a multi-click confirmation for risky code.
- **Execution Modes:** Offer a "safe mode" (sandboxed, e.g., QuickJS) and an "unsafe mode" (direct `eval`).
- **DOM Target:** Provide a `litechat.target` DOM element for the code to manipulate. This is crucial for visualizations.
- **Output Capture:** Capture `stdout`, `stderr`, and logs to display in a console view.
- **Global Manager:** Use a singleton pattern (e.g., `GlobalPythonManager`) to manage the runtime environment (Pyodide, QuickJS) across all blocks, preventing redundant loading.

#### Parsing Complex or Unsafe Code

For renderers that parse complex data structures (like `FormedibleBlockRenderer` or `FlowBlockRenderer`), implement a safe parser class.
- **Sanitize Input:** Remove comments and potentially malicious code before parsing.
- **Validate Structure:** Recursively validate the parsed object against an allowlist of keys and types.
- **Graceful Errors:** Provide specific error messages to help the user (or AI) correct the input.

## Conclusion

The Block Renderer System provides a powerful, extensible foundation for handling diverse code block types in LiteChat. By following the established patterns and best practices, you can create rich, interactive renderers that enhance the user experience while maintaining consistency with the application's architecture.