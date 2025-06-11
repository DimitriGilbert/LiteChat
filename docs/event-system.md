# Event System

LiteChat uses a sophisticated event-driven architecture for decoupled communication between components, modules, and services. This system is built on the `mitt` event emitter and provides type-safe, predictable interaction patterns throughout the application.

## Core Concepts

### Event Emitter
The central event bus is defined in [`src/lib/litechat/event-emitter.ts`](../src/lib/litechat/event-emitter.ts):

```typescript
import mitt, { type Emitter, type EventType } from "mitt";
import type { ModEventPayloadMap } from "@/types/litechat/modding";

export const emitter: Emitter<ModEventPayloadMap & Record<EventType, any>> = 
  mitt<ModEventPayloadMap & Record<EventType, any>>();
```

### Event Types
All events are strongly typed through the `ModEventPayloadMap` interface, which aggregates event payloads from all domains:

```typescript
// From src/types/litechat/modding.ts
export interface ModEventPayloadMap extends 
  SettingsEventPayloads,
  ProviderEventPayloads,
  ConversationEventPayloads,
  InteractionEventPayloads,
  ProjectEventPayloads,
  VfsEventPayloads,
  UiEventPayloads,
  // ... other event payload maps
{}
```

## Event Patterns

### Request/Response Pattern
LiteChat uses a consistent request/response pattern for state modifications:

1. **Request Event**: Component emits a request to change state
2. **State Change**: Store processes the request and updates state  
3. **Change Event**: Store emits notification of the state change

```typescript
// 1. Component requests theme change
emitter.emit(settingsEvent.setThemeRequest, { theme: "dark" });

// 2. SettingsStore processes request and updates state
// (handled by EventActionCoordinatorService)

// 3. Store emits change notification
emitter.emit(settingsEvent.themeChanged, { theme: "dark" });
```

### Event Categories

#### State Change Events
Notify listeners that state has changed:

```typescript
// Examples from various event files
export const settingsEvent = {
  themeChanged: "settings.theme.changed",
  temperatureChanged: "settings.temperature.changed",
  // ...
};

export const conversationEvent = {
  selectedItemChanged: "conversation.selected.item.changed",
  conversationAdded: "conversation.added",
  // ...
};
```

#### Action Request Events  
Request that an action be performed:

```typescript
export const settingsEvent = {
  setThemeRequest: "settings.set.theme.request",
  setTemperatureRequest: "settings.set.temperature.request",
  loadSettingsRequest: "settings.load.settings.request",
  // ...
};
```

#### Lifecycle Events
Signal application lifecycle phases:

```typescript
export const appEvent = {
  initializationPhaseCompleted: "app.initialization.phase.completed",
  // ...
};
```

## Event Definitions

Event definitions are organized by domain in [`src/types/litechat/events/`](../src/types/litechat/events/):

### Settings Events
[`src/types/litechat/events/settings.events.ts`](../src/types/litechat/events/settings.events.ts)

```typescript
export const settingsEvent = {
  // State Change Events
  loaded: "settings.loaded",
  themeChanged: "settings.theme.changed",
  temperatureChanged: "settings.temperature.changed",
  
  // Action Request Events  
  loadSettingsRequest: "settings.load.settings.request",
  setThemeRequest: "settings.set.theme.request",
  setTemperatureRequest: "settings.set.temperature.request",
} as const;

export interface SettingsEventPayloads {
  [settingsEvent.loaded]: { settings: SettingsState };
  [settingsEvent.themeChanged]: { theme: string };
  [settingsEvent.setThemeRequest]: { theme: string };
  // ... all event payloads
}
```

### Conversation Events  
[`src/types/litechat/events/conversation.events.ts`](../src/types/litechat/events/conversation.events.ts)

```typescript
export const conversationEvent = {
  // State Change Events
  selectedItemChanged: "conversation.selected.item.changed", 
  conversationAdded: "conversation.added",
  conversationUpdated: "conversation.updated",
  
  // Action Request Events
  selectItemRequest: "conversation.select.item.request",
  addConversationRequest: "conversation.add.conversation.request",
  updateConversationRequest: "conversation.update.conversation.request",
} as const;
```

### VFS Events
[`src/types/litechat/events/vfs.events.ts`](../src/types/litechat/events/vfs.events.ts)

```typescript
export const vfsEvent = {
  // State Change Events
  vfsKeyChanged: "vfs.key.changed",
  nodesUpdated: "vfs.nodes.updated", 
  fsInstanceChanged: "vfs.instance.changed",
  
  // Action Request Events
  setVfsKeyRequest: "vfs.set.vfs.key.request",
  createDirectoryRequest: "vfs.create.directory.request",
  uploadFilesRequest: "vfs.upload.files.request",
} as const;
```

### Prompt Events
[`src/types/litechat/events/prompt.events.ts`](../src/types/litechat/events/prompt.events.ts)

```typescript
export const promptEvent = {
  // State Change Events
  initialized: "prompt.state.initialized",
  inputTextStateChanged: "prompt.state.input.text.changed", 
  parameterChanged: "prompt.state.parameter.changed",
  submitted: "prompt.state.submitted",
  
  // Action Request Events
  setInputTextRequest: "prompt.input.set.text.request",
  setModelIdRequest: "prompt.state.set.model.id.request",
  setTemperatureRequest: "prompt.state.set.temperature.request",
  setMaxTokensRequest: "prompt.state.set.max.tokens.request",
  
  // Input Events (for direct input area interaction)
  inputChanged: "prompt.inputChanged",
} as const;

export interface PromptEventPayloads {
  [promptEvent.inputChanged]: { value: string };
  [promptEvent.setInputTextRequest]: { text: string };
  [promptEvent.setModelIdRequest]: { modelId: string | null };
  [promptEvent.setTemperatureRequest]: { temperature: number | null };
  // ... all prompt event payloads
}
```

**Special Use Case - Template Application**:
The `setInputTextRequest` event demonstrates a powerful pattern for control modules to interact with the UI:

```typescript
// From PromptLibraryControlModule
public applyTemplate = async (templateId: string, formData: PromptFormData): Promise<void> => {
  const compiled = await this.compileTemplate(templateId, formData);
  
  // Emit event to set the input text - demonstrates event-driven UI interaction
  this.modApiRef?.emit(promptEvent.setInputTextRequest, { text: compiled.content });
};

// InputArea component listens for this event
useEffect(() => {
  const handleSetInputText = (payload: { text: string }) => {
    setInternalValue(payload.text);
    if (onValueChange) {
      onValueChange(payload.text);
    }
    emitter.emit(promptEvent.inputChanged, { value: payload.text });
  };

  const unsubscribe = emitter.on(promptEvent.setInputTextRequest, handleSetInputText);
  return unsubscribe;
}, []);
```

This pattern allows control modules to programmatically fill the input area without direct DOM manipulation or component references.

## Event Action Coordinator

The [`EventActionCoordinatorService`](../src/services/event-action-coordinator.service.ts) bridges events to store actions:

### Automatic Store Registration
The service automatically discovers and registers action handlers from all stores:

```typescript
export class EventActionCoordinatorService {
  public static initialize(): void {
    const storesWithActionHandlers = [
      useSettingsStore,
      useProviderStore, 
      useConversationStore,
      useInteractionStore,
      useProjectStore,
      // ... all stores
    ];

    storesWithActionHandlers.forEach((storeHook) => {
      const handlers = storeHook.getState().getRegisteredActionHandlers();
      handlers.forEach((handler) => {
        emitter.on(handler.eventName, handler.handler);
      });
    });
  }
}
```

### Store Action Handlers
Each store exposes action handlers through `getRegisteredActionHandlers()`:

```typescript
// Example from ConversationStore
getRegisteredActionHandlers: (): RegisteredActionHandler[] => {
  const actions = get();
  return [
    {
      eventName: conversationEvent.addConversationRequest,
      handler: (payload) => actions.addConversation(payload),
      storeId: "conversationStore",
    },
    {
      eventName: conversationEvent.selectItemRequest, 
      handler: (payload) => actions.selectItem(payload.id, payload.type),
      storeId: "conversationStore",
    },
    // ... more handlers
  ];
}
```

## Event Usage Patterns

### Component Event Emission
Components emit events instead of calling store methods directly:

```typescript
// React component
const handleThemeChange = (theme: string) => {
  emitter.emit(settingsEvent.setThemeRequest, { theme });
};

// Control Module
this.modApiRef?.emit(settingsEvent.setTemperatureRequest, { 
  temperature: newValue 
});
```

### Event Subscription
Components and modules subscribe to state change events:

```typescript
// In a Control Module's initialize() method
async initialize(modApi: LiteChatModApi): Promise<void> {
  this.eventUnsubscribers.push(
    modApi.on(settingsEvent.themeChanged, (payload) => {
      this.handleThemeChange(payload.theme);
      this.notifyComponentUpdate?.();
    }),
    
    modApi.on(conversationEvent.selectedItemChanged, (payload) => {
      this.handleSelectionChange(payload.itemId, payload.itemType);
    })
  );
}
```

### React Hook Integration
React components can subscribe to events using custom hooks:

```typescript
// Custom hook for event subscription
function useEventListener<K extends keyof ModEventPayloadMap>(
  eventName: K,
  handler: (payload: ModEventPayloadMap[K]) => void,
  deps: React.DependencyList = []
) {
  useEffect(() => {
    emitter.on(eventName, handler);
    return () => emitter.off(eventName, handler);
  }, deps);
}

// Usage in component
function MyComponent() {
  const [theme, setTheme] = useState("light");
  
  useEventListener(settingsEvent.themeChanged, (payload) => {
    setTheme(payload.theme);
  });
  
  return <div className={`theme-${theme}`}>...</div>;
}
```

### Store Event Emission
Stores emit events after state changes:

```typescript
// Inside a Zustand store action
setTheme: (theme: string) => {
  set((state) => {
    state.theme = theme;
  });
  
  // Emit change event
  emitter.emit(settingsEvent.themeChanged, { theme });
  
  // Persist change
  PersistenceService.saveSetting("theme", theme);
}
```

## Event Flow Examples

### User Changes Theme
1. User clicks theme selector in UI
2. Component emits `settingsEvent.setThemeRequest`
3. EventActionCoordinator routes to SettingsStore
4. SettingsStore updates state and emits `settingsEvent.themeChanged`
5. All subscribed components receive the change event
6. UI updates reflect new theme

```typescript
// 1. UI Component
<button onClick={() => emitter.emit(settingsEvent.setThemeRequest, { theme: "dark" })}>
  Dark Theme
</button>

// 2. Event flows to SettingsStore via EventActionCoordinator

// 3. SettingsStore action
setTheme: (theme: string) => {
  set((state) => { state.theme = theme; });
  emitter.emit(settingsEvent.themeChanged, { theme });
}

// 4. Components update
useEventListener(settingsEvent.themeChanged, (payload) => {
  updateUITheme(payload.theme);
});
```

### Conversation Selection
1. User clicks conversation in sidebar
2. ConversationListComponent emits `conversationEvent.selectItemRequest`
3. ConversationStore updates selection state
4. ConversationStore emits `conversationEvent.selectedItemChanged`
5. ConversationStore emits `interactionEvent.setCurrentConversationIdRequest`
6. InteractionStore loads interactions for selected conversation
7. Multiple UI areas update to reflect selection

```typescript
// Flow diagram:
ConversationList → selectItemRequest 
                → ConversationStore.selectItem()
                → selectedItemChanged
                → setCurrentConversationIdRequest
                → InteractionStore.setCurrentConversationId()
                → UI updates across app
```

## Event Debugging

### Event Logging
Add logging to track event flow:

```typescript
// Development helper
if (process.env.NODE_ENV === 'development') {
  emitter.on('*', (eventName, payload) => {
    console.log(`[Event] ${eventName}:`, payload);
  });
}
```

### Event Inspection
Use browser dev tools to inspect event flow:

```typescript
// Add to window for debugging
if (process.env.NODE_ENV === 'development') {
  (window as any).liteChatEmitter = emitter;
  (window as any).emitEvent = (eventName: string, payload: any) => {
    emitter.emit(eventName as any, payload);
  };
}
```

## Best Practices

### 1. Consistent Naming
Follow established naming patterns:

```typescript
// Good: Clear, consistent naming
export const featureEvent = {
  // State changes use past tense
  dataLoaded: "feature.data.loaded",
  itemSelected: "feature.item.selected",
  
  // Requests use "Request" suffix
  loadDataRequest: "feature.load.data.request", 
  selectItemRequest: "feature.select.item.request",
};

// Avoid: Inconsistent or unclear names
export const badEvent = {
  load: "feature.load", // Unclear if request or completion
  selecting: "feature.selecting", // Present tense for state change
};
```

### 2. Type Safety
Always define strongly typed payloads:

```typescript
// Good: Typed payloads
export interface MyEventPayloads {
  [myEvent.dataLoaded]: { data: MyData[]; timestamp: number };
  [myEvent.loadDataRequest]: { filters?: DataFilters };
}

// Avoid: Untyped payloads
export interface BadEventPayloads {
  [badEvent.something]: any; // No type safety
}
```

### 3. Payload Design
Design payloads to be self-contained:

```typescript
// Good: Complete information
export interface GoodPayloads {
  [event.conversationSelected]: { 
    conversationId: string;
    previousConversationId: string | null;
    timestamp: number;
  };
}

// Avoid: Requiring additional lookups
export interface BadPayloads {
  [event.conversationSelected]: { id: string }; // Need to lookup conversation elsewhere
}
```

### 4. Event Granularity
Balance between too many and too few events:

```typescript
// Good: Appropriate granularity
export const settingsEvent = {
  themeChanged: "settings.theme.changed",
  temperatureChanged: "settings.temperature.changed",
  maxTokensChanged: "settings.max.tokens.changed",
};

// Avoid: Too granular
export const tooGranularEvent = {
  themeColorChanged: "settings.theme.color.changed",
  themeFontChanged: "settings.theme.font.changed", 
  // Theme is one concept, don't split unnecessarily
};

// Avoid: Too broad  
export const tooBroadEvent = {
  anythingChanged: "settings.anything.changed", // Too vague
};
```

### 5. Error Handling
Handle event errors gracefully:

```typescript
// Event handlers should not throw
emitter.on(myEvent.dataRequest, async (payload) => {
  try {
    const data = await fetchData(payload.filters);
    emitter.emit(myEvent.dataLoaded, { data });
  } catch (error) {
    emitter.emit(myEvent.dataLoadFailed, { 
      error: error.message, 
      filters: payload.filters 
    });
  }
});
```

### 6. Cleanup
Always clean up event subscriptions:

```typescript
// In Control Modules
destroy(): void {
  this.eventUnsubscribers.forEach(unsub => unsub());
  this.eventUnsubscribers = [];
}

// In React components
useEffect(() => {
  const unsubscribe = emitter.on(eventName, handler);
  return unsubscribe; // Cleanup on unmount
}, []);
```

## Adding New Events

### 1. Define Event Names and Payloads
Create or update event definition file:

```typescript
// src/types/litechat/events/my-feature.events.ts
export const myFeatureEvent = {
  // State change events
  dataLoaded: "myFeature.data.loaded",
  itemSelected: "myFeature.item.selected",
  
  // Action request events
  loadDataRequest: "myFeature.load.data.request",
  selectItemRequest: "myFeature.select.item.request",
} as const;

export interface MyFeatureEventPayloads {
  [myFeatureEvent.dataLoaded]: { data: MyData[] };
  [myFeatureEvent.itemSelected]: { itemId: string };
  [myFeatureEvent.loadDataRequest]: { force?: boolean };
  [myFeatureEvent.selectItemRequest]: { itemId: string };
}
```

### 2. Update ModEventPayloadMap
Add to the main event payload map:

```typescript
// src/types/litechat/modding.ts
export interface ModEventPayloadMap extends 
  SettingsEventPayloads,
  ConversationEventPayloads,
  MyFeatureEventPayloads, // Add your events
  // ... other event payloads
{}
```

### 3. Implement Store Handlers
Add action handlers to relevant store:

```typescript
// In your store's getRegisteredActionHandlers()
{
  eventName: myFeatureEvent.loadDataRequest,
  handler: (payload) => actions.loadData(payload.force),
  storeId: "myFeatureStore",
}
```

### 4. Emit Events from Components
Use events in components and modules:

```typescript
// Emit request
emitter.emit(myFeatureEvent.loadDataRequest, { force: true });

// Listen for changes  
modApi.on(myFeatureEvent.dataLoaded, (payload) => {
  this.handleDataLoad(payload.data);
});
```

The event system provides the foundation for LiteChat's modular, decoupled architecture. By following these patterns and best practices, you can build robust, maintainable features that integrate seamlessly with the existing codebase. 