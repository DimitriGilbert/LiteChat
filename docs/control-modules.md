# Control Module System

The Control Module System is the architectural backbone of LiteChat, providing a modular, extensible framework for UI features. Each UI feature is encapsulated as a `ControlModule` that manages its own state, components, and lifecycle.

## Core Concepts

### What is a Control Module?

A Control Module is a self-contained unit that:
- Implements a specific UI feature or functionality
- Manages its own internal state and business logic
- Registers UI components, tools, middleware, or settings tabs
- Communicates with other modules through events
- Follows a well-defined lifecycle

### Module Interface

All control modules implement the `ControlModule` interface defined in [`src/types/litechat/control.ts`](../src/types/litechat/control.ts):

```typescript
export interface ControlModule {
  readonly id: string;
  readonly dependencies?: string[];
  initialize(modApi: LiteChatModApi): Promise<void>;
  register(modApi: LiteChatModApi): void;
  destroy(modApi: LiteChatModApi): void;
}
```

## Module Lifecycle

The lifecycle is managed by [`src/lib/litechat/initialization.ts`](../src/lib/litechat/initialization.ts) in the following order:

### 1. Instantiation
All `ControlModuleConstructor`s listed in [`src/App.tsx`](../src/App.tsx) are instantiated:

```typescript
const controlModulesToRegister: ControlModuleConstructor[] = [
  UrlParameterControlModule,
  GeneralSettingsModule,
  ThemeSettingsControlModule,
  // ... more modules
];
```

### 2. Dependency Resolution
Modules are topologically sorted based on their `dependencies` array to ensure proper initialization order.

### 3. Initialization Phase
Each module's `initialize(modApi)` method is called in dependency order:

```typescript
// Example from AutoTitleControlModule
async initialize(modApi: LiteChatModApi): Promise<void> {
  this.modApiRef = modApi;
  
  // Subscribe to events
  this.eventUnsubscribers.push(
    modApi.on(settingsEvent.autoTitlePromptChanged, () => {
      this.notifyComponentUpdate?.();
    })
  );
}
```

**Purpose**: One-time setup, event subscriptions, data loading prerequisites.

### 4. Registration Phase
Each module's `register(modApi)` method is called after all modules are initialized:

```typescript
// Example from AutoTitleControlModule
register(modApi: LiteChatModApi): void {
  this.unregisterCallback = modApi.registerPromptControl({
    id: this.id,
    component: AutoTitleControlTrigger,
    moduleInstance: this,
    order: 20,
  });
}
```

**Purpose**: Register UI components, tools, middleware, and settings tabs.

### 5. Destruction Phase
Called on application shutdown for cleanup:

```typescript
destroy(): void {
  this.eventUnsubscribers.forEach(unsub => unsub());
  this.eventUnsubscribers = [];
  if (this.unregisterCallback) {
    this.unregisterCallback();
    this.unregisterCallback = null;
  }
}
```

## Types of Control Modules

### Settings Modules
Handle application configuration through settings tabs.

**Example**: [`src/controls/modules/GeneralSettingsModule.ts`](../src/controls/modules/GeneralSettingsModule.ts)

```typescript
export class GeneralSettingsModule implements ControlModule {
  readonly id = "core-settings-general";
  
  register(modApi: LiteChatModApi): void {
    this.unregisterCallback = modApi.registerSettingsTab({
      id: "general",
      title: "General",
      component: SettingsGeneral,
      order: 10,
    });
  }
}
```

### Prompt Control Modules
Add UI elements to the prompt input area.

**Example**: [`src/controls/modules/AutoTitleControlModule.ts`](../src/controls/modules/AutoTitleControlModule.ts)

```typescript
export class AutoTitleControlModule implements ControlModule {
  register(modApi: LiteChatModApi): void {
    this.unregisterCallback = modApi.registerPromptControl({
      id: this.id,
      component: AutoTitleControlTrigger,
      moduleInstance: this,
      order: 20,
    });
  }
  
  // Prompt controls can contribute metadata
  getMetadata(): Record<string, any> {
    return {
      autoTitleEnabled: this.getTurnEnabled(),
    };
  }
}
```

### Prompt Library Module

The Prompt Library Control Module allows users to create, manage, and apply reusable prompt templates with dynamic variables.

**Implementation**: [`src/controls/modules/PromptLibraryControlModule.ts`](../src/controls/modules/PromptLibraryControlModule.ts)

```typescript
export class PromptLibraryControlModule implements ControlModule {
  readonly id = "core-prompt-library";
  private modApiRef: LiteChatModApi | null = null;

  public compileTemplate = async (templateId: string, formData: PromptFormData): Promise<CompiledPrompt> => {
    const { compilePromptTemplate } = usePromptTemplateStore.getState();
    return await compilePromptTemplate(templateId, formData);
  };

  public applyTemplate = async (templateId: string, formData: PromptFormData): Promise<void> => {
    const compiled = await this.compileTemplate(templateId, formData);
    
    // Emit event to set the input text
    this.modApiRef?.emit(promptEvent.setInputTextRequest, { text: compiled.content });
  };

  register(modApi: LiteChatModApi): void {
    this.modApiRef = modApi;
    this.unregisterCallback = modApi.registerPromptControl({
      id: this.id,
      status: () => "ready",
      triggerRenderer: () => React.createElement(PromptLibraryControl, { module: this }),
    });
  }
}
```

**Key Features**:
- **Template Management**: Create, edit, and organize prompt templates
- **Dynamic Variables**: Support for string, number, boolean, and array variables with validation
- **Template Compilation**: Process templates with user-provided variable values
- **Auto-Application**: Templates can auto-select specific tools and rules
- **Event-Driven Integration**: Uses the event system to fill the input area

**UI Components**:
- **PromptLibraryControl**: Main dialog for template selection and variable input
- **PromptTemplateSelector**: Browse and search available templates
- **PromptTemplateForm**: Dynamic form generation based on template variables
- **Template Preview**: Shows template structure and variables before application

**Template Structure**:
```typescript
interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  prompt: string;                    // Template with {{ variable }} syntax
  variables: PromptVariable[];       // Dynamic variable definitions
  tags: string[];                    // Organization tags
  tools?: string[];                  // Auto-selected tools
  rules?: string[];                  // Auto-selected rules
  isPublic: boolean;
}

interface PromptVariable {
  name: string;
  type: "string" | "number" | "boolean" | "array";
  description?: string;
  required: boolean;
  default?: string;
  instructions?: string;
}
```

**Event Integration**:
The module demonstrates the event-driven architecture by using `promptEvent.setInputTextRequest` to fill the input area, showing how control modules can interact with the UI through the event system rather than direct manipulation.

### Chat Control Modules
Add UI elements to chat areas (sidebar, header, modals).

**Example**: [`src/controls/modules/ConversationListControlModule.ts`](../src/controls/modules/ConversationListControlModule.ts)

```typescript
export class ConversationListControlModule implements ControlModule {
  register(modApi: LiteChatModApi): void {
    this.unregisterCallback = modApi.registerChatControl({
      id: this.id,
      panel: "sidebar",
      component: ConversationListComponent,
      moduleInstance: this,
    });
  }
}
```

### Tool Modules
Register AI tools and their implementations.

**Example**: [`src/controls/modules/VfsToolsModule.ts`](../src/controls/modules/VfsToolsModule.ts)

```typescript
export class VfsToolsModule implements ControlModule {
  register(modApi: LiteChatModApi): void {
    // Register multiple VFS-related tools
    this.unregisterCallbacks.push(
      modApi.registerTool("vfs_read_file", readFileToolDefinition, readFileImplementation),
      modApi.registerTool("vfs_write_file", writeFileToolDefinition, writeFileImplementation),
      // ... more tools
    );
  }
}
```

### Canvas Control Modules
Handle interactions within the chat canvas (message actions, code block controls).

**Example**: [`src/controls/modules/canvas/CopyActionControlModule.ts`](../src/controls/modules/canvas/CopyActionControlModule.ts)

```typescript
export class CopyActionControlModule implements ControlModule {
  register(modApi: LiteChatModApi): void {
    this.unregisterCallback = modApi.registerCanvasControl({
      id: this.id,
      type: "interaction",
      placement: "header",
      component: CopyActionComponent,
      moduleInstance: this,
    });
  }
}
```

## Module State Management

### Internal State
Modules manage their own state and expose getters/setters for UI components:

```typescript
export class ParameterControlModule implements ControlModule {
  private turnEnabled = false;
  private temperature: number | null = null;
  
  // Getters for UI components
  getTurnEnabled(): boolean {
    return this.turnEnabled;
  }
  
  getTemperature(): number | null {
    return this.temperature;
  }
  
  // Setters that trigger updates
  setTurnEnabled(enabled: boolean): void {
    this.turnEnabled = enabled;
    this.notifyComponentUpdate?.();
  }
}
```

### Component Reactivity
UI components register update callbacks to re-render when module state changes:

```typescript
// Component receives module instance as prop
export const ParameterControlTrigger: React.FC<{
  module: ParameterControlModule;
}> = ({ module }) => {
  const [, forceUpdate] = useReducer(x => x + 1, 0);
  
  useEffect(() => {
    module.setNotifyCallback(forceUpdate);
    return () => module.setNotifyCallback(null);
  }, [module]);
  
  const enabled = module.getTurnEnabled();
  // ... rest of component
};
```

### Global State Integration
Modules interact with global state through events, not direct store access:

```typescript
// Instead of: useSettingsStore.getState().setTemperature(value)
// Modules emit events:
this.modApiRef?.emit(settingsEvent.setTemperatureRequest, { temperature: value });
```

## Module Registration

### Registration in App.tsx
Modules are registered in [`src/App.tsx`](../src/App.tsx) in the order they should be initialized:

```typescript
const controlModulesToRegister: ControlModuleConstructor[] = [
  // Core settings first
  UrlParameterControlModule,
  GeneralSettingsModule,
  ThemeSettingsControlModule,
  
  // Provider and model management
  ProviderSettingsModule,
  GlobalModelSelectorModule,
  
  // Prompt controls (order affects UI appearance)
  AutoTitleControlModule,
  UsageDisplayControlModule,
  FileControlModule,
  SystemPromptControlModule,
  
  // Canvas controls
  CopyActionControlModule,
  RegenerateActionControlModule,
  // ...
];
```

### UI Rendering
Registered controls are rendered by wrapper components:

- **Prompt Controls**: [`src/components/LiteChat/prompt/PromptControlWrapper.tsx`](../src/components/LiteChat/prompt/PromptControlWrapper.tsx)
- **Chat Controls**: [`src/components/LiteChat/chat/ChatControlWrapper.tsx`](../src/components/LiteChat/chat/ChatControlWrapper.tsx)
- **Canvas Controls**: [`src/components/LiteChat/canvas/InteractionCard.tsx`](../src/components/LiteChat/canvas/InteractionCard.tsx)

## Dependencies

### Declaring Dependencies
Modules can declare dependencies on other modules:

```typescript
export class DependentModule implements ControlModule {
  readonly id = "dependent-module";
  readonly dependencies = ["core-settings-general", "core-provider-settings"];
  
  async initialize(modApi: LiteChatModApi): Promise<void> {
    // This module initializes after its dependencies
  }
}
```

### Dependency Resolution
The initialization system uses topological sorting to resolve dependencies:

```typescript
// From src/lib/litechat/initialization.ts
function resolveDependencyOrder(modules: ControlModule[]): ControlModule[] | null {
  // Implements topological sort with cycle detection
  // Returns null if circular dependencies are detected
}
```

## Best Practices

### 1. Single Responsibility
Each module should handle one specific feature or UI area:

```typescript
// Good: Focused on auto-title functionality
export class AutoTitleControlModule implements ControlModule {
  readonly id = "core-auto-title";
  // Handles only auto-title related logic
}

// Avoid: Multiple unrelated responsibilities
export class MixedModule implements ControlModule {
  // Don't mix auto-title, file handling, and settings in one module
}
```

### 2. Event-Driven Communication
Use events for inter-module communication:

```typescript
// Good: Event-based communication
this.modApiRef?.emit(settingsEvent.setAutoTitlePromptRequest, { prompt });

// Avoid: Direct store access from modules
useSettingsStore.getState().setAutoTitlePrompt(prompt);
```

### 3. Proper Cleanup
Always clean up subscriptions and registrations:

```typescript
destroy(): void {
  // Unsubscribe from events
  this.eventUnsubscribers.forEach(unsub => unsub());
  this.eventUnsubscribers = [];
  
  // Unregister UI components
  if (this.unregisterCallback) {
    this.unregisterCallback();
    this.unregisterCallback = null;
  }
}
```

### 4. Type Safety
Use strong typing for module interfaces:

```typescript
// Define clear interfaces for module state
interface ModuleState {
  enabled: boolean;
  value: string | null;
}

// Type module methods
setEnabled(enabled: boolean): void {
  this.state.enabled = enabled;
  this.notifyComponentUpdate?.();
}
```

## Creating a New Control Module

### 1. Create Module Class
```typescript
// src/controls/modules/MyFeatureModule.ts
import { type ControlModule } from "@/types/litechat/control";
import { type LiteChatModApi } from "@/types/litechat/modding";

export class MyFeatureModule implements ControlModule {
  readonly id = "core-my-feature";
  private unregisterCallback: (() => void) | null = null;
  private modApiRef: LiteChatModApi | null = null;
  private notifyComponentUpdate: (() => void) | null = null;

  async initialize(modApi: LiteChatModApi): Promise<void> {
    this.modApiRef = modApi;
    // Subscribe to relevant events
  }

  register(modApi: LiteChatModApi): void {
    // Register UI components, tools, etc.
  }

  destroy(): void {
    // Cleanup
  }
  
  // Module-specific methods
  setNotifyCallback(callback: (() => void) | null): void {
    this.notifyComponentUpdate = callback;
  }
}
```

### 2. Create UI Components
```typescript
// src/controls/components/my-feature/MyFeatureComponent.tsx
import React from "react";
import type { MyFeatureModule } from "@/controls/modules/MyFeatureModule";

export const MyFeatureComponent: React.FC<{
  module: MyFeatureModule;
}> = ({ module }) => {
  // Component implementation
};
```

### 3. Register Module
Add to [`src/App.tsx`](../src/App.tsx):

```typescript
import { MyFeatureModule } from "@/controls/modules/MyFeatureModule";

const controlModulesToRegister: ControlModuleConstructor[] = [
  // ... existing modules
  MyFeatureModule,
];
```

## Advanced Topics

### Conditional Registration
Modules can conditionally register components based on state:

```typescript
register(modApi: LiteChatModApi): void {
  const shouldRegister = this.checkCondition();
  if (shouldRegister) {
    this.unregisterCallback = modApi.registerPromptControl(/* ... */);
  }
}
```

### Dynamic Re-registration
Some modules may need to re-register components based on changing conditions:

```typescript
private reregisterTab(): void {
  if (this.unregisterCallback) {
    this.unregisterCallback();
    this.unregisterCallback = null;
  }
  if (this.modApiRef) {
    this.register(this.modApiRef);
  }
}
```

### Cross-Module Communication
Modules communicate through the event system:

```typescript
// Module A emits an event
this.modApiRef?.emit("myFeature.stateChanged", { newState: "active" });

// Module B listens for the event
modApi.on("myFeature.stateChanged", (payload) => {
  this.handleStateChange(payload.newState);
});
```

The Control Module System provides a powerful, flexible foundation for building modular UI features in LiteChat. By following the established patterns and lifecycle, developers can create cohesive, maintainable features that integrate seamlessly with the application's architecture. 