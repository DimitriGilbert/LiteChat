# Modding System

LiteChat provides a powerful and secure modding system that allows external extensions to safely interact with the application through a controlled API. The modding system is designed with security and stability as primary concerns.

## Architecture Overview

### Controlled API Design
The modding system uses a controlled API approach where:

- **No Direct Access**: Mods cannot directly access internal stores, components, or services
- **Event-Driven Integration**: All interactions happen through the event system
- **Controlled Interface**: `LiteChatModApi` provides a stable, versioned interface
- **Safe Execution**: Mods run in controlled environments with error boundaries

### Core Components

1. **ModApi Factory** ([`src/modding/api-factory.ts`](../src/modding/api-factory.ts)) - Creates API instances
2. **Mod Loader** ([`src/modding/loader.ts`](../src/modding/loader.ts)) - Loads and executes mods
3. **Mod Store** ([`src/store/mod.store.ts`](../src/store/mod.store.ts)) - Manages mod state
4. **Control Registry** - Registers mod-contributed components

## LiteChatModApi Interface

### Core API Structure
```typescript
interface LiteChatModApi {
  // Metadata
  readonly modId: string;
  readonly modName: string;
  
  // Component Registration
  registerPromptControl(control: ModPromptControl): () => void;
  registerChatControl(control: ModChatControl): () => void;
  registerCanvasControl(control: ModCanvasControl): () => void;
  registerSettingsTab(tab: CustomSettingTab): () => void;
  
  // Tool Registration
  registerTool<T extends z.ZodSchema>(
    name: string,
    tool: Tool<T>,
    implementation: ToolImplementation<T>
  ): () => void;
  
  // Middleware Registration
  registerMiddleware(
    hookName: ModMiddlewareHookName,
    middleware: ModMiddlewareHook
  ): () => void;
  
  // Event System
  on<K extends keyof ModEventPayloadMap>(
    eventName: K,
    handler: (payload: ModEventPayloadMap[K]) => void
  ): () => void;
  
  emit<K extends keyof ModEventPayloadMap>(
    eventName: K,
    payload: ModEventPayloadMap[K]
  ): void;
  
  // Utilities
  getContext(): ModApiContext;
  log(level: 'info' | 'warn' | 'error', message: string, ...args: any[]): void;
  toast(message: string, options?: ToastOptions): void;
}
```

### API Context
The mod API provides read-only context about the application state:

```typescript
interface ModApiContext {
  selectedConversationId: string | null;
  selectedProjectId: string | null;
  currentTheme: string;
  isStreaming: boolean;
  // Limited, read-only state snapshot
}
```

## Mod Types and Storage

### Database Mod Structure
```typescript
interface DbMod {
  id: string;
  name: string;
  sourceUrl: string | null;      // URL for remote mods
  scriptContent: string | null;   // Inline script content
  enabled: boolean;
  loadOrder: number;              // Execution order
  createdAt: Date;
}
```

### Mod Categories

#### Local Mods
- **Inline Scripts**: Code stored directly in the database
- **User Scripts**: Manually entered JavaScript code
- **Development Mods**: Local development and testing

#### Remote Mods
- **URL-Based**: Loaded from external URLs
- **GitHub Integration**: Direct loading from repositories
- **Version Management**: Automatic updates and versioning

## Creating Mods

### Basic Mod Structure
```typescript
// Example mod implementation
function createMyMod(modApi) {
  // Initialize mod state
  let internalState = {
    enabled: true,
    customData: {}
  };

  // Register a prompt control
  const unregisterPromptControl = modApi.registerPromptControl({
    id: 'my-custom-control',
    status: () => internalState.enabled ? 'ready' : 'disabled',
    triggerRenderer: () => {
      return React.createElement('button', {
        onClick: () => handleControlAction(),
        children: 'My Control'
      });
    },
    getMetadata: () => ({ customFlag: internalState.enabled }),
    clearOnSubmit: () => { /* Reset per-turn state */ }
  });

  // Register event handlers
  const unregisterEventHandler = modApi.on('conversation.selected.item.changed', (payload) => {
    modApi.log('info', 'Conversation changed to:', payload.itemId);
    internalState.customData.lastConversation = payload.itemId;
  });

  // Cleanup function
  return () => {
    unregisterPromptControl();
    unregisterEventHandler();
    modApi.log('info', 'Mod cleaned up');
  };
}

// Register the mod
if (typeof window !== 'undefined' && window.LiteChat) {
  window.LiteChat.registerMod('my-mod', createMyMod);
}
```

### Advanced Mod Example
```typescript
function createAdvancedMod(modApi) {
  // Custom settings state
  let settings = {
    autoSave: true,
    customPrompts: [],
    theme: 'custom'
  };

  // Register a settings tab
  const unregisterSettingsTab = modApi.registerSettingsTab({
    id: 'advanced-mod-settings',
    title: 'Advanced Mod',
    component: React.createElement(AdvancedModSettings, {
      settings,
      onSettingsChange: (newSettings) => {
        settings = { ...settings, ...newSettings };
        // Persist settings through events
        modApi.emit('mod.settings.changed', { 
          modId: modApi.modId, 
          settings 
        });
      }
    }),
    order: 100
  });

  // Register a custom tool
  const customToolSchema = z.object({
    input: z.string(),
    format: z.enum(['json', 'text', 'markdown'])
  });

  const unregisterTool = modApi.registerTool(
    'advanced-processor',
    {
      description: 'Process input with advanced formatting',
      parameters: customToolSchema
    },
    async ({ input, format }, context) => {
      try {
        // Custom processing logic
        const processed = await processInput(input, format);
        return { success: true, result: processed };
      } catch (error) {
        modApi.log('error', 'Tool execution failed:', error);
        return { success: false, error: error.message };
      }
    }
  );

  // Register middleware for response processing
  const unregisterMiddleware = modApi.registerMiddleware(
    'middleware:interaction:processChunk',
    async (chunk, context, next) => {
      // Custom chunk processing
      if (settings.autoSave && chunk.includes('SAVE_TRIGGER')) {
        modApi.emit('conversation.auto.save.request', {
          conversationId: context.conversationId
        });
      }
      
      // Continue middleware chain
      return next(chunk, context);
    }
  );

  // Event handlers for coordination
  const unregisterHandlers = [
    modApi.on('settings.theme.changed', (payload) => {
      if (settings.theme === 'custom') {
        // Apply custom theme modifications
        applyCustomTheme(payload.theme);
      }
    }),

    modApi.on('conversation.added', (payload) => {
      if (settings.autoSave) {
        // Auto-tag new conversations
        modApi.emit('conversation.update.conversation.request', {
          id: payload.conversation.id,
          updates: { tags: ['auto-managed'] }
        });
      }
    })
  ];

  // Cleanup
  return () => {
    unregisterSettingsTab();
    unregisterTool();
    unregisterMiddleware();
    unregisterHandlers.forEach(unsub => unsub());
  };
}
```

## Component Registration

### Prompt Controls
Add UI elements to the prompt input area:

```typescript
interface ModPromptControl {
  id: string;
  status?: () => "ready" | "loading" | "error";
  triggerRenderer?: () => React.ReactNode;
  renderer?: () => React.ReactNode;
  getParameters?: () => Record<string, any> | Promise<Record<string, any>>;
  getMetadata?: () => Record<string, any> | Promise<Record<string, any>>;
  clearOnSubmit?: () => void;
}

// Example: Custom parameter control
modApi.registerPromptControl({
  id: 'custom-params',
  triggerRenderer: () => React.createElement(CustomParamTrigger),
  getParameters: () => ({ customParam: getCurrentValue() }),
  clearOnSubmit: () => resetCustomParam()
});
```

### Chat Controls
Add UI elements to the chat interface:

```typescript
interface ModChatControl {
  id: string;
  panel?: "sidebar" | "sidebar-footer" | "header" | "drawer_right" | "main";
  renderer?: () => React.ReactElement | null;
  iconRenderer?: () => React.ReactElement | null;
  settingsRenderer?: () => React.ReactElement | null;
  show?: () => boolean;
}

// Example: Custom sidebar panel
modApi.registerChatControl({
  id: 'custom-panel',
  panel: 'sidebar',
  renderer: () => React.createElement(CustomPanel),
  show: () => getCurrentContext().hasPermission('custom-panel')
});
```

### Settings Tabs
Add custom settings pages:

```typescript
interface CustomSettingTab {
  id: string;
  title: string;
  component: React.ComponentType<any>;
  order?: number;
}

// Example: Plugin settings tab
modApi.registerSettingsTab({
  id: 'plugin-settings',
  title: 'Plugin Settings',
  component: PluginSettingsComponent,
  order: 50
});
```

## Tool Registration

### Custom AI Tools
Register tools that can be called by AI models:

```typescript
// Define tool schema
const weatherToolSchema = z.object({
  location: z.string(),
  units: z.enum(['celsius', 'fahrenheit']).optional()
});

// Register the tool
modApi.registerTool(
  'get-weather',
  {
    description: 'Get current weather for a location',
    parameters: weatherToolSchema
  },
  async ({ location, units = 'celsius' }, context) => {
    try {
      const weather = await fetchWeather(location, units);
      return {
        success: true,
        location,
        temperature: weather.temp,
        conditions: weather.conditions,
        units
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get weather for ${location}: ${error.message}`
      };
    }
  }
);
```

### Tool Context
Tools receive context about the current execution environment:

```typescript
interface ToolContext {
  conversationId: string;
  interactionId: string;
  fsInstance?: typeof fs;  // VFS access if available
  projectId?: string;
  metadata?: Record<string, any>;
}
```

## Middleware System

### Middleware Hooks
Intercept and modify data at key points:

```typescript
type ModMiddlewareHookName = 
  | 'middleware:prompt:preSubmit'
  | 'middleware:interaction:processChunk'
  | 'middleware:interaction:postComplete'
  | 'middleware:vfs:fileRead'
  | 'middleware:export:preProcess';

// Example: Response processing middleware
modApi.registerMiddleware(
  'middleware:interaction:processChunk',
  async (chunk, context, next) => {
    // Custom processing
    const processedChunk = await customProcessing(chunk);
    
    // Continue chain with modified chunk
    return next(processedChunk, context);
  }
);
```

### Middleware Execution
Middleware functions run in sequence based on registration order:

```typescript
// Middleware chain execution
const runMiddleware = async (hookName, initialData, context) => {
  const middlewares = getRegisteredMiddleware(hookName);
  
  let currentData = initialData;
  for (const middleware of middlewares) {
    try {
      currentData = await middleware(currentData, context, (data, ctx) => data);
    } catch (error) {
      console.error(`Middleware error in ${hookName}:`, error);
      // Continue with unmodified data
    }
  }
  
  return currentData;
};
```

## Event System Integration

### Available Events
Mods can listen to and emit events through the central event system:

```typescript
// Listen to application events
modApi.on('conversation.selected.item.changed', (payload) => {
  // React to conversation changes
});

modApi.on('settings.theme.changed', (payload) => {
  // Adapt to theme changes
});

modApi.on('interaction.stream.chunk', (payload) => {
  // Process streaming responses
});

// Emit events to trigger actions
modApi.emit('conversation.add.conversation.request', {
  title: 'Generated Conversation',
  projectId: currentProjectId
});

modApi.emit('settings.set.theme.request', {
  theme: 'custom-mod-theme'
});
```

### Custom Events
Mods can define and use custom events for inter-mod communication:

```typescript
// Define custom event types (in mod)
const MOD_EVENTS = {
  customDataChanged: 'mod.mymod.data.changed',
  customAction: 'mod.mymod.action.triggered'
} as const;

// Emit custom events
modApi.emit(MOD_EVENTS.customDataChanged, {
  modId: modApi.modId,
  data: newData
});

// Listen to custom events from other mods
modApi.on(MOD_EVENTS.customAction, (payload) => {
  handleCustomAction(payload);
});
```

## Mod Management

### Mod Store Integration
The [`ModStore`](../src/store/mod.store.ts) manages mod lifecycle:

```typescript
interface ModState {
  dbMods: DbMod[];                    // Stored mod configurations
  loadedMods: ModInstance[];          // Currently loaded mod instances
  modSettingsTabs: CustomSettingTab[];  // Registered settings tabs
  isLoading: boolean;
  error: string | null;
}

// Mod lifecycle actions
const modActions = {
  loadDbMods: async () => { /* Load from database */ },
  addDbMod: async (mod: Partial<DbMod>) => { /* Add new mod */ },
  updateDbMod: async (id: string, changes: Partial<DbMod>) => { /* Update mod */ },
  deleteDbMod: async (id: string) => { /* Remove mod */ },
  reloadMods: async () => { /* Reload all mods */ }
};
```

### Mod Loading Process
1. **Database Load**: Retrieve mod configurations from IndexedDB
2. **Dependency Resolution**: Sort mods by load order
3. **Script Execution**: Execute mod scripts in controlled environment
4. **API Creation**: Create unique ModApi instance for each mod
5. **Registration**: Register mod components and handlers
6. **Initialization**: Call mod initialization functions
7. **Error Handling**: Isolate and report mod errors

### Error Isolation
```typescript
// Mod execution with error boundaries
const loadMod = async (dbMod: DbMod) => {
  try {
    const modApi = createModApi(dbMod);
    const cleanup = await executeMod(dbMod.scriptContent, modApi);
    
    return {
      id: dbMod.id,
      name: dbMod.name,
      api: modApi,
      cleanup,
      status: 'loaded'
    };
  } catch (error) {
    console.error(`Failed to load mod ${dbMod.name}:`, error);
    emitter.emit(modEvent.modError, {
      id: dbMod.id,
      name: dbMod.name,
      error
    });
    
    return {
      id: dbMod.id,
      name: dbMod.name,
      status: 'error',
      error: error.message
    };
  }
};
```

## Security Considerations

### Sandboxing
- **No Direct DOM Access**: Mods cannot directly manipulate the DOM
- **Controlled React Access**: Limited to provided React createElement
- **Event System Only**: All interactions go through the event system
- **No Network Access**: Mods cannot make direct network requests

### API Limitations
```typescript
// What mods CAN do:
- Register UI components through ModApi
- Listen to and emit approved events
- Register tools and middleware
- Access read-only context
- Use logging and toast utilities

// What mods CANNOT do:
- Access internal Zustand stores directly
- Manipulate React components directly
- Make direct API calls
- Access browser APIs (localStorage, fetch, etc.)
- Modify other mods or core functionality
```

### Content Security
```typescript
// Script execution with restrictions
const executeMod = (scriptContent: string, modApi: LiteChatModApi) => {
  // Create isolated execution context
  const modContext = {
    React: { createElement: React.createElement },
    modApi,
    console: modApi,  // Redirected logging
    // No access to window, document, etc.
  };
  
  // Execute with restricted context
  const modFunction = new Function('modApi', 'React', scriptContent);
  return modFunction(modApi, { createElement: React.createElement });
};
```

## Best Practices for Mod Development

### 1. Error Handling
```typescript
// Always wrap mod operations in try-catch
function createMyMod(modApi) {
  try {
    // Mod initialization
    const cleanup = setupMod();
    
    return () => {
      try {
        cleanup();
      } catch (error) {
        modApi.log('error', 'Cleanup failed:', error);
      }
    };
  } catch (error) {
    modApi.log('error', 'Mod initialization failed:', error);
    return () => {}; // Return no-op cleanup
  }
}
```

### 2. Resource Management
```typescript
// Always return cleanup functions
function createMyMod(modApi) {
  const unsubscribers = [];
  
  // Register components and store unsubscribers
  unsubscribers.push(modApi.registerPromptControl(/* ... */));
  unsubscribers.push(modApi.on('some.event', handler));
  
  // Return comprehensive cleanup
  return () => {
    unsubscribers.forEach(unsub => {
      try {
        unsub();
      } catch (error) {
        modApi.log('warn', 'Cleanup error:', error);
      }
    });
  };
}
```

### 3. Performance Considerations
```typescript
// Debounce expensive operations
let debounceTimer = null;
modApi.on('rapid.fire.event', (payload) => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    expensiveOperation(payload);
  }, 300);
});

// Cache computed values
const cache = new Map();
const expensiveComputation = (input) => {
  if (cache.has(input)) {
    return cache.get(input);
  }
  
  const result = doExpensiveWork(input);
  cache.set(input, result);
  return result;
};
```

### 4. User Experience
```typescript
// Provide feedback for long operations
modApi.registerTool('long-operation', schema, async (params, context) => {
  modApi.toast('Processing...', { type: 'info' });
  
  try {
    const result = await longRunningOperation(params);
    modApi.toast('Operation completed successfully!', { type: 'success' });
    return { success: true, result };
  } catch (error) {
    modApi.toast('Operation failed', { type: 'error' });
    return { success: false, error: error.message };
  }
});
```

## Future Extensibility

### Planned Features
- **Mod Marketplace**: Centralized mod distribution
- **Mod Updates**: Automatic version management
- **Mod Dependencies**: Inter-mod dependency resolution
- **Enhanced Permissions**: Granular capability control
- **Mod Testing**: Built-in testing framework

### API Versioning
```typescript
// Future API versioning support
interface ModApiV2 extends LiteChatModApi {
  readonly apiVersion: '2.0';
  
  // New capabilities
  registerModal(modal: ModModalProvider): () => void;
  requestPermission(permission: string): Promise<boolean>;
  
  // Enhanced context
  getEnhancedContext(): EnhancedModApiContext;
}
```

The modding system provides a secure, powerful way to extend LiteChat while maintaining stability and security. By following the controlled API pattern and best practices, developers can create rich extensions that enhance the user experience without compromising the application's integrity. 