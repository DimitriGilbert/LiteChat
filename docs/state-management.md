# State Management

LiteChat uses Zustand for state management with a modular, event-driven architecture. Each domain has its own store that manages a specific slice of application state, providing clean separation of concerns and maintainable state updates.

## Architecture Overview

### Core Principles
- **Domain-Specific Stores**: Each store manages one area of functionality
- **Event-Driven Actions**: State changes are triggered by events, not direct calls
- **Immutable Updates**: Immer middleware ensures safe state mutations
- **Type Safety**: Full TypeScript coverage with strict typing
- **Persistence Integration**: Automatic persistence through PersistenceService

### Store Structure
All stores follow a consistent pattern defined in [`src/store/`](../src/store/):

```typescript
// Basic store structure
export const useMyStore = create(
  immer<StateInterface & ActionsInterface>((set, get) => ({
    // State properties
    data: [],
    isLoading: false,
    error: null,
    
    // Action methods
    loadData: async () => { /* implementation */ },
    updateItem: (id, changes) => { /* implementation */ },
    
    // Event integration
    getRegisteredActionHandlers: () => { /* event handlers */ }
  }))
);
```

## Store Catalog

### ConversationStore
[`src/store/conversation.store.ts`](../src/store/conversation.store.ts)

**Purpose**: Manages conversations, projects, selection state, and Git sync repositories.

**State**:
```typescript
interface ConversationState {
  conversations: Conversation[];
  selectedItemId: string | null;
  selectedItemType: SidebarItemType | null;
  syncRepos: SyncRepo[];
  conversationSyncStatus: Record<string, SyncStatus>;
  repoInitializationStatus: Record<string, SyncStatus>;
  isLoading: boolean;
  error: string | null;
}
```

**Key Actions**:
- `loadConversations()`: Load all conversations from persistence
- `addConversation()`: Create new conversation with automatic ID generation
- `selectItem()`: Change selected conversation/project and update interactions
- `linkConversationToRepo()`: Associate conversation with Git sync repository
- `syncConversation()`: Perform Git sync for a conversation

**Event Integration**:
```typescript
// Emits when selection changes
emitter.emit(conversationEvent.selectedItemChanged, { itemId, itemType });

// Triggers interaction loading
emitter.emit(interactionEvent.setCurrentConversationIdRequest, { id });
```

### InteractionStore  
[`src/store/interaction.store.ts`](../src/store/interaction.store.ts)

**Purpose**: Manages messages/interactions for the currently selected conversation and streaming state.

**State**:
```typescript
interface InteractionState {
  interactions: Interaction[];
  currentConversationId: string | null;
  streamingInteractionIds: string[];
  activeStreamBuffers: Record<string, string>;
  activeReasoningBuffers: Record<string, string>;
  error: string | null;
  status: "idle" | "loading" | "streaming" | "error";
}
```

**Key Actions**:
- `setCurrentConversationId()`: Switch context to different conversation
- `loadInteractions()`: Load interactions for current conversation
- `appendInteractionResponseChunk()`: Handle streaming AI response chunks
- `_addInteractionToState()`: Add new interaction with sorting by index

**Streaming Integration**:
```typescript
// Manages active streams
_addStreamingId: (id: string) => void;
_removeStreamingId: (id: string) => void;
appendInteractionResponseChunk: (id: string, chunk: string) => void;
```

### ProviderStore
[`src/store/provider.store.ts`](../src/store/provider.store.ts)

**Purpose**: Manages AI provider configurations, API keys, and model selection.

**State**:
```typescript
interface ProviderState {
  apiKeys: DbApiKey[];
  providerConfigs: DbProviderConfig[];
  selectedModelId: string;
  enableApiKeyManagement: boolean;
  globalModelSortOrder: string[];
  selectedModelForDetails: string | null;
  // ... loading and error states
}
```

**Key Actions**:
- `addProviderConfig()`: Create new provider configuration
- `fetchModels()`: Retrieve available models from provider API
- `selectModel()`: Change globally selected model
- `setGlobalModelSortOrder()`: Update model display order

**Model Management**:
```typescript
// Get enabled models across all providers
const enabledModels = useProviderStore.getState().getEnabledModels();

// Select model and persist preference
emitter.emit(providerEvent.selectModelRequest, { modelId: "gpt-4" });
```

### SettingsStore
[`src/store/settings.store.ts`](../src/store/settings.store.ts)

**Purpose**: Global application settings including theme, AI parameters, and Git configuration.

**State**:
```typescript
interface SettingsState {
  // UI Settings
  theme: string;
  customThemeColors: Record<string, string>;
  chatMaxWidth: number;
  
  // AI Settings  
  globalSystemPrompt: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  
  // Git Settings
  gitUserName: string;
  gitUserEmail: string;
  
  // Auto-generation
  autoTitlePrompt: string;
  enableAutoTitle: boolean;
}
```

**Configuration Methods**:
```typescript
// Load/save settings with persistence
loadSettings: async () => Promise<void>;
setTheme: (theme: string) => void;
setTemperature: (temperature: number) => void;
resetGeneralSettings: () => void;
```

### ProjectStore
[`src/store/project.store.ts`](../src/store/project.store.ts)

**Purpose**: Manages project hierarchy and settings inheritance.

**State**:
```typescript
interface ProjectState {
  projects: Project[];
  isLoading: boolean;
  error: string | null;
}
```

**Key Features**:
- Hierarchical project structure with parent/child relationships
- Settings inheritance from parent to child projects
- Path-based project organization

**Settings Inheritance**:
```typescript
// Get effective settings considering inheritance
getEffectiveProjectSettings: (projectId: string | null) => EffectiveProjectSettings;

// Settings cascade: Global → Parent Project → Child Project → Conversation
```

### VfsStore
[`src/store/vfs.store.ts`](../src/store/vfs.store.ts)

**Purpose**: Manages Virtual File System state for the currently active VFS context.

**State**:
```typescript
interface VfsState {
  nodes: Record<string, VfsNode>;
  childrenMap: Record<string, string[]>;
  rootId: string | null;
  currentParentId: string | null;
  selectedFileIds: Set<string>;
  fs: typeof fs | null;
  vfsKey: string | null;
  configuredVfsKey: string | null;
  // ... loading states
}
```

**Context Switching**:
```typescript
// Switch VFS context (project-specific or orphan)
setVfsKey: (key: string | null) => void;

// Initialize filesystem for specific context
initializeVFS: (vfsKey: string, options?: { force?: boolean }) => Promise<typeof fs>;
```

**File Operations**:
```typescript
createDirectory: (parentId: string | null, name: string) => Promise<void>;
uploadFiles: (parentId: string | null, files: FileList) => Promise<void>;
deleteNodes: (ids: string[]) => Promise<void>;
renameNode: (id: string, newName: string) => Promise<void>;
```

### PromptStateStore
[`src/store/prompt.store.ts`](../src/store/prompt.store.ts)

**Purpose**: Manages transient state for the next prompt submission.

**State**:
```typescript
interface PromptState {
  modelId: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  enabledTools: string[];
  // ... other AI parameters
}
```

**Context Initialization**:
```typescript
// Initialize from effective project settings
initializePromptState: (effectiveSettings: EffectiveProjectSettings) => void;

// Reset after prompt submission
resetToDefaults: () => void;
```

### InputStore
[`src/store/input.store.ts`](../src/store/input.store.ts)

**Purpose**: Manages input data for the next prompt (files, content).

**State**:
```typescript
interface InputState {
  attachedFiles: AttachedFileMetadata[];
  filesWithContent: AttachedFileWithContent[];
  enabledTools: string[];
  toolMaxStepsOverride: number | null;
}
```

**File Attachment**:
```typescript
// Attach files with content reading
attachFiles: (files: File[]) => Promise<void>;

// Clear after successful submission
clearFiles: () => void;
```

### UIStateStore
[`src/store/ui.store.ts`](../src/store/ui.store.ts)

**Purpose**: Manages transient UI state (modals, panels, focus).

**State**:
```typescript
interface UIState {
  isChatControlPanelOpen: Record<string, boolean>;
  isPromptControlPanelOpen: Record<string, boolean>;
  isSidebarCollapsed: boolean;
  globalLoading: boolean;
  globalError: string | null;
  focusInputOnNextRender: boolean;
}
```

**Modal Management**:
```typescript
// Control modal visibility
openModal: (modalId: string, props?: any) => void;
closeModal: (modalId: string) => void;
```

## Event-Driven Actions

### Action Registration Pattern
Each store registers action handlers that respond to events:

```typescript
// In store definition
getRegisteredActionHandlers: (): RegisteredActionHandler[] => {
  const actions = get();
  return [
    {
      eventName: myEvent.loadDataRequest,
      handler: actions.loadData,
      storeId: "myStore",
    },
    {
      eventName: myEvent.updateItemRequest,
      handler: (payload) => actions.updateItem(payload.id, payload.changes),
      storeId: "myStore",
    }
  ];
}
```

### Event Coordination
The [`EventActionCoordinatorService`](../src/services/event-action-coordinator.service.ts) automatically wires events to store actions:

```typescript
// Automatically called during app initialization
EventActionCoordinatorService.initialize();

// Discovers and registers all store action handlers
storesWithActionHandlers.forEach((storeHook) => {
  const handlers = storeHook.getState().getRegisteredActionHandlers();
  handlers.forEach((handler) => {
    emitter.on(handler.eventName, handler.handler);
  });
});
```

### Request/Response Flow
1. Component emits request event
2. EventActionCoordinator routes to store action
3. Store updates state with Immer
4. Store emits change notification event
5. Subscribed components react to changes

```typescript
// 1. Component requests data
emitter.emit(conversationEvent.loadConversationsRequest, undefined);

// 2. Store action processes request
loadConversations: async () => {
  set({ isLoading: true });
  const conversations = await PersistenceService.loadConversations();
  set({ conversations, isLoading: false });
  
  // 3. Emit change notification
  emitter.emit(conversationEvent.loaded, { conversations });
}
```

## Store Usage Patterns

### Component Access
React components access stores using hooks with `useShallow` for optimization:

```typescript
// Good: Use useShallow for multiple fields
const { conversations, isLoading, selectedItemId } = useConversationStore(
  useShallow((state) => ({
    conversations: state.conversations,
    isLoading: state.isLoading,
    selectedItemId: state.selectedItemId,
  }))
);

// Avoid: Multiple separate hooks
const conversations = useConversationStore(state => state.conversations);
const isLoading = useConversationStore(state => state.isLoading);
const selectedItemId = useConversationStore(state => state.selectedItemId);
```

### Service/Module Access
Non-React code accesses stores via `getState()`:

```typescript
// In services or control modules
const conversationState = useConversationStore.getState();
const currentConversation = conversationState.getConversationById(id);

// Emit events for state changes
emitter.emit(conversationEvent.selectItemRequest, { id, type: "conversation" });
```

### Computed Values
Stores expose computed/derived values through methods:

```typescript
// Store method for computed data
getEnabledModels: (): ModelInfo[] => {
  return get().providerConfigs
    .filter(config => config.isEnabled)
    .flatMap(config => config.enabledModels || []);
}

// Usage
const enabledModels = useProviderStore(state => state.getEnabledModels());
```

## Persistence Integration

### Automatic Persistence
Stores automatically persist changes through [`PersistenceService`](../src/services/persistence.service.ts):

```typescript
// Store action with persistence
addConversation: async (conversationData) => {
  const newConversation = { /* ... */ };
  
  // Persist first
  await PersistenceService.saveConversation(newConversation);
  
  // Then update state
  set((state) => {
    state.conversations.unshift(newConversation);
  });
  
  // Emit event
  emitter.emit(conversationEvent.conversationAdded, { conversation: newConversation });
  
  return newConversation.id;
}
```

### Settings Persistence
Settings are automatically persisted on change:

```typescript
setTheme: (theme: string) => {
  set((state) => { state.theme = theme; });
  emitter.emit(settingsEvent.themeChanged, { theme });
  PersistenceService.saveSetting("theme", theme); // Auto-persist
}
```

### Loading Data
Stores load data during initialization:

```typescript
loadConversations: async () => {
  set({ isLoading: true, error: null });
  try {
    const conversations = await PersistenceService.loadConversations();
    set({ conversations, isLoading: false });
    emitter.emit(conversationEvent.loaded, { conversations });
  } catch (error) {
    set({ error: error.message, isLoading: false });
  }
}
```

## Advanced Patterns

### Cross-Store Communication
Stores communicate through events, not direct references:

```typescript
// ConversationStore triggers InteractionStore updates
selectItem: async (id, type) => {
  set({ selectedItemId: id, selectedItemType: type });
  
  // Trigger interaction loading via event
  const conversationId = type === "conversation" ? id : null;
  emitter.emit(interactionEvent.setCurrentConversationIdRequest, { id: conversationId });
  
  emitter.emit(conversationEvent.selectedItemChanged, { itemId: id, itemType: type });
}
```

### Conditional State Updates
Prevent unnecessary updates and ensure consistency:

```typescript
setCurrentConversationId: async (id) => {
  const currentId = get().currentConversationId;
  
  // Only update if different
  if (currentId === id) return;
  
  set({ currentConversationId: id });
  emitter.emit(interactionEvent.currentConversationIdChanged, { conversationId: id });
  
  // Load interactions for new conversation
  if (id) {
    await get().loadInteractions(id);
  } else {
    get().clearInteractions();
  }
}
```

### Error Handling
Consistent error handling across stores:

```typescript
someAsyncAction: async (params) => {
  const { _setLoading, _setError } = get();
  
  _setLoading(true);
  try {
    const result = await someApiCall(params);
    set((state) => { state.data = result; });
    emitter.emit(myEvent.dataLoaded, { data: result });
  } catch (error) {
    console.error("Action failed:", error);
    _setError(error.message);
    toast.error("Operation failed: " + error.message);
  } finally {
    _setLoading(false);
  }
}
```

### Optimistic Updates
Update UI immediately, then handle errors:

```typescript
updateItem: async (id, changes) => {
  // Optimistic update
  const originalItem = get().items.find(item => item.id === id);
  set((state) => {
    const item = state.items.find(item => item.id === id);
    if (item) Object.assign(item, changes);
  });
  
  try {
    await PersistenceService.updateItem(id, changes);
    emitter.emit(myEvent.itemUpdated, { id, changes });
  } catch (error) {
    // Revert on error
    if (originalItem) {
      set((state) => {
        const item = state.items.find(item => item.id === id);
        if (item) Object.assign(item, originalItem);
      });
    }
    throw error;
  }
}
```

## Creating New Stores

### 1. Define Interfaces
```typescript
// State interface
interface MyFeatureState {
  items: MyItem[];
  selectedId: string | null;
  isLoading: boolean;
  error: string | null;
}

// Actions interface  
interface MyFeatureActions {
  loadItems: () => Promise<void>;
  selectItem: (id: string) => void;
  addItem: (item: Omit<MyItem, 'id'>) => Promise<string>;
  updateItem: (id: string, changes: Partial<MyItem>) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  getRegisteredActionHandlers: () => RegisteredActionHandler[];
}
```

### 2. Create Store
```typescript
export const useMyFeatureStore = create(
  immer<MyFeatureState & MyFeatureActions>((set, get) => ({
    // Initial state
    items: [],
    selectedId: null,
    isLoading: false,
    error: null,
    
    // Actions
    loadItems: async () => {
      set({ isLoading: true, error: null });
      try {
        const items = await PersistenceService.loadMyItems();
        set({ items, isLoading: false });
        emitter.emit(myFeatureEvent.itemsLoaded, { items });
      } catch (error) {
        set({ error: error.message, isLoading: false });
      }
    },
    
    selectItem: (id) => {
      set({ selectedId: id });
      emitter.emit(myFeatureEvent.itemSelected, { itemId: id });
    },
    
    // Event handlers registration
    getRegisteredActionHandlers: () => [
      {
        eventName: myFeatureEvent.loadItemsRequest,
        handler: get().loadItems,
        storeId: "myFeatureStore",
      },
      {
        eventName: myFeatureEvent.selectItemRequest,
        handler: (payload) => get().selectItem(payload.itemId),
        storeId: "myFeatureStore",
      },
    ],
  }))
);
```

### 3. Register with EventActionCoordinator
Add store to the list in [`EventActionCoordinatorService`](../src/services/event-action-coordinator.service.ts):

```typescript
const storesWithActionHandlers = [
  useSettingsStore,
  useConversationStore,
  useMyFeatureStore, // Add your store
  // ... other stores
];
```

### 4. Define Events
Create event definitions in [`src/types/litechat/events/`](../src/types/litechat/events/):

```typescript
// my-feature.events.ts
export const myFeatureEvent = {
  itemsLoaded: "myFeature.items.loaded",
  itemSelected: "myFeature.item.selected",
  loadItemsRequest: "myFeature.load.items.request",
  selectItemRequest: "myFeature.select.item.request",
} as const;

export interface MyFeatureEventPayloads {
  [myFeatureEvent.itemsLoaded]: { items: MyItem[] };
  [myFeatureEvent.itemSelected]: { itemId: string };
  [myFeatureEvent.loadItemsRequest]: undefined;
  [myFeatureEvent.selectItemRequest]: { itemId: string };
}
```

## Best Practices

### 1. Single Responsibility
Each store should manage one domain:

```typescript
// Good: Focused store
export const useConversationStore = /* manages conversations only */;
export const useInteractionStore = /* manages interactions only */;

// Avoid: Mixed responsibilities  
export const useChatStore = /* manages conversations, interactions, UI state, etc. */;
```

### 2. Immutable Updates
Always use Immer for state updates:

```typescript
// Good: Immer syntax
set((state) => {
  state.items.push(newItem);
  state.selectedId = newItem.id;
});

// Avoid: Direct mutation
set({ 
  items: [...get().items, newItem],
  selectedId: newItem.id 
});
```

### 3. Event-Driven Actions
Use events instead of direct store calls:

```typescript
// Good: Event-driven
emitter.emit(conversationEvent.selectItemRequest, { id, type });

// Avoid: Direct calls
useConversationStore.getState().selectItem(id, type);
```

### 4. Error Boundaries
Handle errors consistently:

```typescript
someAction: async () => {
  try {
    await performOperation();
  } catch (error) {
    console.error("Operation failed:", error);
    set({ error: error.message });
    toast.error("Failed to perform operation");
  }
}
```

### 5. Type Safety
Use strong typing throughout:

```typescript
// Define clear interfaces
interface StrictState {
  status: "idle" | "loading" | "success" | "error";
  data: MyDataType | null;
}

// Type action parameters
updateItem: (id: string, changes: Partial<MyItem>) => Promise<void>;
```

The state management system provides a robust foundation for LiteChat's modular architecture. By following these patterns and leveraging the event-driven approach, you can build maintainable, scalable features that integrate seamlessly with the existing application state. 