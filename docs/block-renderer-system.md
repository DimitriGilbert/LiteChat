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

## Creating a Custom Block Renderer

### Step 1: Define Your Renderer

```typescript
// src/controls/modules/MyCustomRendererModule.ts
import type { ControlModule } from "@/types/litechat/control";
import type { LiteChatModApi } from "@/types/litechat/modding";
import type { BlockRenderer, BlockRendererContext } from "@/types/litechat/canvas/block-renderer";
import React from "react";

export class MyCustomRendererModule implements ControlModule {
  readonly id = "my-custom-renderer";
  private unregisterCallback?: () => void;

  async initialize(): Promise<void> {
    // Setup if needed
  }

  register(modApi: LiteChatModApi): void {
    const customRenderer: BlockRenderer = {
      id: this.id,
      supportedLanguages: ["mylang", "custom"], // Languages this renderer handles
      priority: 10, // Higher priority = preferred over other renderers
      renderer: (context: BlockRendererContext) => {
        return React.createElement(MyCustomComponent, {
          code: context.code,
          lang: context.lang,
          filepath: context.filepath,
          isStreaming: context.isStreaming,
          blockId: context.blockId,
        });
      },
    };

    this.unregisterCallback = modApi.registerBlockRenderer(customRenderer);
  }

  destroy(): void {
    if (this.unregisterCallback) {
      this.unregisterCallback();
      this.unregisterCallback = undefined;
    }
  }
}
```

### Step 2: Create Your Renderer Component

```typescript
interface MyCustomComponentProps {
  code: string;
  lang?: string;
  filepath?: string;
  isStreaming?: boolean;
  blockId?: string;
}

const MyCustomComponent: React.FC<MyCustomComponentProps> = ({
  code,
  lang,
  filepath,
  isStreaming,
  blockId,
}) => {
  // Your custom rendering logic here
  return (
    <div className="code-block-container my-4 max-w-full">
      <div className="code-block-header">
        <div className="text-sm font-medium">
          {lang?.toUpperCase() || "CUSTOM"}
        </div>
        {filepath && (
          <div className="text-xs text-muted-foreground">{filepath}</div>
        )}
      </div>
      <div className="code-content">
        {/* Your custom rendering */}
        <pre>{code}</pre>
      </div>
    </div>
  );
};
```

### Step 3: Register Your Module

Add your module to `src/App.tsx`:

```typescript
import { MyCustomRendererModule } from "@/controls/modules/MyCustomRendererModule";

const controlModulesToRegister: ControlModuleConstructor[] = [
  // ... existing modules
  MyCustomRendererModule, // Add your module
  // ... rest of modules
];
```

## BlockRenderer Interface

```typescript
interface BlockRenderer {
  id: string;
  // Languages this renderer handles (e.g., ["mermaid"], ["typescript", "javascript"])
  // Empty array or undefined means it handles all languages (fallback renderer)
  supportedLanguages?: string[];
  // Priority for renderer selection (higher = more priority)
  priority?: number;
  // The actual renderer component
  renderer: (context: BlockRendererContext) => React.ReactNode;
  // Optional lifecycle hooks
  onMounted?: (context: BlockRendererContext & { element: HTMLElement }) => void;
  onUnmounted?: (context: BlockRendererContext) => void;
}
```

### BlockRendererContext

```typescript
interface BlockRendererContext {
  lang: string | undefined;
  code: string;
  filepath?: string;
  isStreaming?: boolean;
  blockId?: string;
}
```

## Renderer Selection Logic

The system selects renderers using the following priority:

1. **Specific Language Match**: Renderers that explicitly support the block's language
2. **Priority**: Among matching renderers, higher priority wins
3. **Fallback**: Renderers with no `supportedLanguages` (or empty array) serve as fallbacks
4. **Default**: If no renderers match, uses a simple pre/code fallback

### Example Priority Scenarios

```typescript
// Scenario: Rendering a "mermaid" block

// Renderer A: Mermaid-specific (priority 10)
{ supportedLanguages: ["mermaid"], priority: 10 }

// Renderer B: General fallback (priority 0)
{ supportedLanguages: undefined, priority: 0 }

// Result: Renderer A is selected (specific match + higher priority)
```

## Built-in Renderers

### CodeBlockRendererModule
- **Languages**: All (fallback)
- **Priority**: 0
- **Features**: Syntax highlighting, copy/fold actions, file path display

### MermaidBlockRendererModule
- **Languages**: `["mermaid"]`
- **Priority**: 10
- **Features**: Diagram rendering, error handling, loading states

## Advanced Features

### Dynamic Language Support

You can create renderers that handle multiple related languages:

```typescript
const multiLangRenderer: BlockRenderer = {
  id: "web-languages",
  supportedLanguages: ["html", "css", "javascript", "typescript"],
  priority: 5,
  renderer: (context) => {
    // Handle different web languages with specialized rendering
    switch (context.lang) {
      case "html":
        return renderHtml(context);
      case "css":
        return renderCss(context);
      default:
        return renderJavaScript(context);
    }
  },
};
```

### Conditional Registration

Register renderers based on settings or conditions:

```typescript
register(modApi: LiteChatModApi): void {
  const enableAdvancedRendering = this.getAdvancedRenderingSetting();
  
  if (enableAdvancedRendering) {
    this.unregisterCallback = modApi.registerBlockRenderer(advancedRenderer);
  }
}
```

### Interactive Renderers

Create renderers with interactive features:

```typescript
const interactiveRenderer: BlockRenderer = {
  id: "interactive-sql",
  supportedLanguages: ["sql"],
  priority: 8,
  renderer: (context) => {
    return React.createElement(InteractiveSqlRenderer, {
      query: context.code,
      onExecute: (query) => {
        // Handle SQL execution
      },
    });
  },
};
```

## Best Practices

### 1. Follow UI Patterns
- Use consistent CSS classes (`code-block-container`, `code-block-header`)
- Support the existing action system (copy, fold, download)
- Maintain responsive design

### 2. Handle Edge Cases
- Empty code blocks
- Invalid syntax
- Streaming content
- Large content

### 3. Performance Considerations
- Use React.memo for expensive renderers
- Implement lazy loading for heavy visualizations
- Debounce updates during streaming

### 4. Error Handling
- Gracefully handle rendering errors
- Provide fallback rendering
- Log errors for debugging

### Example Error Handling

```typescript
renderer: (context) => {
  try {
    return renderComplexVisualization(context);
  } catch (error) {
    console.error(`[${this.id}] Rendering error:`, error);
    // Fallback to simple rendering
    return React.createElement("pre", {}, context.code);
  }
},
```

## Integration with Canvas Controls

Block renderers work seamlessly with existing canvas controls:

- **Copy Actions**: Automatically available in block headers
- **Fold Controls**: Integrated with streaming settings
- **Download Actions**: Support file export functionality

## Event System Integration

Block renderers can interact with the event system:

```typescript
// Listen for theme changes
modApi.on(settingsEvent.themeChanged, (payload) => {
  // Update renderer styling
  this.updateTheme(payload.theme);
});

// Emit custom events
modApi.emit("blockRenderer.customEvent", {
  rendererId: this.id,
  data: customData,
});
```

## Testing Your Renderer

1. **Create test content** with your target language
2. **Verify selection logic** - ensure your renderer is chosen
3. **Test edge cases** - empty blocks, invalid syntax, streaming
4. **Check responsiveness** - test on different screen sizes
5. **Validate accessibility** - ensure proper ARIA labels and keyboard navigation

## Migration from Direct Renderers

If you have existing direct renderer usage, migrate to the new system:

### Before (Direct Usage)
```typescript
// Old way - direct component usage
<CodeBlockRenderer lang="javascript" code={code} />
```

### After (Universal System)
```typescript
// New way - universal renderer with registered modules
<UniversalBlockRenderer lang="javascript" code={code} />
```

The Universal Block Renderer automatically selects the appropriate registered renderer based on the language and priority system.

## Conclusion

The Block Renderer System provides a powerful, extensible foundation for handling diverse code block types in LiteChat. By following the established patterns and best practices, you can create rich, interactive renderers that enhance the user experience while maintaining consistency with the application's architecture. 