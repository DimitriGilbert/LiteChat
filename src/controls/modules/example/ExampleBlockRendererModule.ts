// src/controls/modules/example/ExampleBlockRendererModule.ts
// Example of how to create a custom block renderer

import type { ControlModule } from "@/types/litechat/control";
import type { LiteChatModApi } from "@/types/litechat/modding";
import type { BlockRenderer, BlockRendererContext } from "@/types/litechat/canvas/block-renderer";
import React from "react";

export class ExampleBlockRendererModule implements ControlModule {
  readonly id = "example-block-renderer-json";
  private unregisterCallback?: () => void;

  async initialize(): Promise<void> {
    // No initialization needed for this example
  }

  register(modApi: LiteChatModApi): void {
    if (this.unregisterCallback) {
      console.warn(`[${this.id}] Already registered. Skipping.`);
      return;
    }

    // Example: Custom JSON renderer with syntax highlighting and collapsible sections
    const jsonBlockRenderer: BlockRenderer = {
      id: this.id,
      supportedLanguages: ["json"], // Only handles JSON blocks
      priority: 5, // Higher priority than fallback, lower than specialized renderers
      renderer: (context: BlockRendererContext) => {
        return React.createElement(CustomJsonRenderer, {
          code: context.code,
          isStreaming: context.isStreaming,
          blockId: context.blockId,
        });
      },
    };

    this.unregisterCallback = modApi.registerBlockRenderer(jsonBlockRenderer);
  }

  destroy(): void {
    if (this.unregisterCallback) {
      this.unregisterCallback();
      this.unregisterCallback = undefined;
    }
  }
}

// Example custom JSON renderer component
interface CustomJsonRendererProps {
  code: string;
  isStreaming?: boolean;
  blockId?: string;
}

const CustomJsonRenderer: React.FC<CustomJsonRendererProps> = ({
  code,
  isStreaming = false,
  blockId,
}) => {
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [isValidJson, setIsValidJson] = React.useState(true);
  const [parsedJson, setParsedJson] = React.useState<any>(null);

  React.useEffect(() => {
    try {
      const parsed = JSON.parse(code);
      setParsedJson(parsed);
      setIsValidJson(true);
    } catch (error) {
      setIsValidJson(false);
      setParsedJson(null);
    }
  }, [code]);

  const toggleCollapse = () => setIsCollapsed(!isCollapsed);

  return React.createElement(
    "div",
    {
      className: "code-block-container group/codeblock my-4 max-w-full border border-border rounded-lg",
      "data-block-id": blockId,
    },
    // Header
    React.createElement(
      "div",
      {
        className: "code-block-header flex items-center justify-between px-3 py-2 border-b border-border bg-muted/50",
      },
      React.createElement(
        "div",
        { className: "flex items-center gap-2" },
        React.createElement(
          "div",
          { className: "text-sm font-medium" },
          "JSON"
        ),
        isValidJson
          ? React.createElement(
              "span",
              { className: "text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded" },
              "Valid"
            )
          : React.createElement(
              "span",
              { className: "text-xs text-red-600 bg-red-100 px-2 py-0.5 rounded" },
              "Invalid"
            ),
        isStreaming &&
          React.createElement(
            "span",
            { className: "text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded animate-pulse" },
            "Streaming..."
          )
      ),
      React.createElement(
        "button",
        {
          onClick: toggleCollapse,
          className: "text-xs text-muted-foreground hover:text-foreground transition-colors",
        },
        isCollapsed ? "Expand" : "Collapse"
      )
    ),
    // Content
    !isCollapsed &&
      React.createElement(
        "div",
        { className: "p-4" },
        isValidJson
          ? React.createElement(
              "pre",
              { className: "text-sm font-mono whitespace-pre-wrap break-words" },
              JSON.stringify(parsedJson, null, 2)
            )
          : React.createElement(
              "div",
              null,
              React.createElement(
                "div",
                { className: "text-sm text-red-600 mb-2" },
                "Invalid JSON syntax"
              ),
              React.createElement(
                "pre",
                { className: "text-sm font-mono whitespace-pre-wrap break-words text-muted-foreground" },
                code
              )
            )
      )
  );
};

// To use this example renderer, add ExampleBlockRendererModule to the controlModulesToRegister array in App.tsx
// import { ExampleBlockRendererModule } from "@/controls/modules/example/ExampleBlockRendererModule";
// 
// const controlModulesToRegister: ControlModuleConstructor[] = [
//   // ... other modules
//   ExampleBlockRendererModule, // Add this line
//   // ... rest of modules
// ]; 