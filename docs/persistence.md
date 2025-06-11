# Persistence Layer

LiteChat uses a robust client-side persistence system built on IndexedDB with Dexie.js as the database wrapper. All data is stored locally in the browser, ensuring privacy and offline functionality.

## Database Architecture

### Dexie.js Wrapper
The database schema is defined in [`src/lib/litechat/db.ts`](../src/lib/litechat/db.ts):

```typescript
class LiteChatDatabase extends Dexie {
  conversations!: Table<Conversation>;
  interactions!: Table<Interaction>;
  projects!: Table<Project>;
  mods!: Table<DbMod>;
  appState!: Table<AppState>;
  providerConfigs!: Table<DbProviderConfig>;
  apiKeys!: Table<DbApiKey>;
  syncRepos!: Table<SyncRepo>;
  rules!: Table<DbRule>;
  tags!: Table<DbTag>;
  tagRuleLinks!: Table<DbTagRuleLink>;

  constructor() {
    super('LiteChatDB');
    this.version(1).stores({
      conversations: '++id, title, projectId, syncRepoId, createdAt, updatedAt',
      interactions: '++id, conversationId, index, createdAt, startedAt, endedAt',
      projects: '++id, name, parentId, createdAt, updatedAt',
      // ... other table definitions
    });
  }
}

export const db = new LiteChatDatabase();
```

### Schema Versioning
The database supports schema migrations through Dexie's versioning system:

```typescript
// Future schema updates
this.version(2).stores({
  // Modified schema
}).upgrade(trans => {
  // Migration logic
});
```

## PersistenceService

The [`PersistenceService`](../src/services/persistence.service.ts) provides a centralized interface for all database operations:

### Core Design Principles

1. **Static Methods**: All methods are static for easy access throughout the app
2. **Error Handling**: Comprehensive try/catch with logging and user feedback
3. **Type Safety**: Strongly typed parameters and return values
4. **Transaction Safety**: Uses Dexie transactions for data consistency
5. **Date Field Handling**: Automatic conversion between strings and Date objects

### CRUD Operations

#### Conversations
```typescript
// Load all conversations ordered by update time
static async loadConversations(): Promise<Conversation[]>

// Save or update a conversation
static async saveConversation(conversation: Conversation): Promise<string>

// Delete conversation and optionally its interactions
static async deleteConversation(id: string): Promise<void>
```

#### Interactions
```typescript
// Load interactions for a specific conversation
static async loadInteractionsForConversation(conversationId: string): Promise<Interaction[]>

// Save or update an interaction
static async saveInteraction(interaction: Interaction): Promise<string>

// Delete all interactions for a conversation
static async deleteInteractionsForConversation(conversationId: string): Promise<void>
```

#### Projects
```typescript
// Load all projects with hierarchical structure
static async loadProjects(): Promise<Project[]>

// Save or update a project
static async saveProject(project: Project): Promise<string>

// Delete project and all child projects recursively
static async deleteProject(id: string): Promise<void>
```

### Settings Management
Application settings are stored in the `appState` table with key-value pairs:

```typescript
// Save any setting with automatic persistence
static async saveSetting(key: string, value: any): Promise<string>

// Load setting with default fallback
static async loadSetting<T>(key: string, defaultValue: T): Promise<T>

// Example usage
await PersistenceService.saveSetting('theme', 'dark');
const theme = await PersistenceService.loadSetting('theme', 'light');
```

### Provider Configuration
Manages AI provider configurations and API keys:

```typescript
// Provider configs with model lists and settings
static async loadProviderConfigs(): Promise<DbProviderConfig[]>
static async saveProviderConfig(config: DbProviderConfig): Promise<string>
static async deleteProviderConfig(id: string): Promise<void>

// API key management with automatic unlinking
static async loadApiKeys(): Promise<DbApiKey[]>
static async saveApiKey(key: DbApiKey): Promise<string>
static async deleteApiKey(id: string): Promise<void> // Unlinks from configs
```

### Rules and Tags System
Supports the rules/tags system for prompt engineering:

```typescript
// Rules (reusable prompt snippets)
static async loadRules(): Promise<DbRule[]>
static async saveRule(rule: DbRule): Promise<string>
static async deleteRule(id: string): Promise<void> // Deletes links too

// Tags for organizing rules
static async loadTags(): Promise<DbTag[]>
static async saveTag(tag: DbTag): Promise<string>
static async deleteTag(id: string): Promise<void> // Deletes links too

// Many-to-many relationships
static async loadTagRuleLinks(): Promise<DbTagRuleLink[]>
static async saveTagRuleLink(link: DbTagRuleLink): Promise<string>
static async deleteTagRuleLink(id: string): Promise<void>
```

## Data Flow Patterns

### Store Integration
Zustand stores interact with PersistenceService following consistent patterns:

```typescript
// In a Zustand store action
addConversation: async (conversation: Partial<Conversation>) => {
  const newConversation: Conversation = {
    id: nanoid(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...conversation,
  };
  
  // 1. Update local state
  set((state) => {
    state.conversations.push(newConversation);
  });
  
  // 2. Persist to database
  try {
    await PersistenceService.saveConversation(newConversation);
  } catch (error) {
    // 3. Rollback on error
    set((state) => {
      state.conversations = state.conversations.filter(c => c.id !== newConversation.id);
    });
    throw error;
  }
  
  // 4. Emit success event
  emitter.emit(conversationEvent.conversationAdded, { conversation: newConversation });
}
```

### Event-Driven Persistence
Many persistence operations are triggered by events:

```typescript
// Store registers action handlers for persistence events
getRegisteredActionHandlers: (): RegisteredActionHandler[] => [
  {
    eventName: conversationEvent.addConversationRequest,
    handler: (payload) => actions.addConversation(payload),
    storeId: "conversationStore",
  },
  {
    eventName: conversationEvent.updateConversationRequest,
    handler: (payload) => actions.updateConversation(payload.id, payload.updates),
    storeId: "conversationStore",
  },
]
```

## Data Import/Export

### Full Application Export
```typescript
interface FullExportData {
  version: number;
  exportedAt: string;
  settings: Record<string, any>;
  apiKeys: DbApiKey[];
  providerConfigs: DbProviderConfig[];
  projects: Project[];
  conversations: Conversation[];
  interactions: Interaction[];
  rules: DbRule[];
  tags: DbTag[];
  tagRuleLinks: DbTagRuleLink[];
  mods: DbMod[];
  syncRepos: SyncRepo[];
}

// Export entire application state
static async exportAllData(): Promise<FullExportData>

// Import with selective options
static async importAllData(data: FullExportData, options: {
  importSettings?: boolean;
  importApiKeys?: boolean;
  importProviderConfigs?: boolean;
  // ... other selective import flags
}): Promise<void>
```

### Individual Entity Export
```typescript
// Export single conversation with interactions
static async exportConversationData(conversationId: string): Promise<{
  conversation: Conversation;
  interactions: Interaction[];
}>

// Export project with all conversations
static async exportProjectData(projectId: string): Promise<{
  project: Project;
  conversations: Conversation[];
  interactions: Interaction[];
}>
```

## Transaction Management

### Atomic Operations
Critical operations use Dexie transactions for data consistency:

```typescript
// Example: Deleting API key and unlinking from provider configs
static async deleteApiKey(id: string): Promise<void> {
  try {
    await db.transaction("rw", [db.apiKeys, db.providerConfigs], async () => {
      // 1. Find affected provider configs
      const configsToUpdate = await db.providerConfigs
        .where("apiKeyId")
        .equals(id)
        .toArray();

      // 2. Unlink API key from configs
      if (configsToUpdate.length > 0) {
        const updates = configsToUpdate.map((config) =>
          db.providerConfigs.update(config.id, { apiKeyId: null })
        );
        await Promise.all(updates);
      }

      // 3. Delete the API key
      await db.apiKeys.delete(id);
    });
  } catch (error) {
    console.error("PersistenceService: Error deleting API key:", error);
    throw error;
  }
}
```

### Cascading Deletes
Related data is automatically cleaned up:

```typescript
// Deleting a project recursively removes child projects
static async deleteProject(id: string): Promise<void> {
  const deleteRecursive = async (projectId: string) => {
    // Find child projects
    const childProjects = await db.projects
      .where("parentId")
      .equals(projectId)
      .toArray();
    
    // Recursively delete children first
    for (const child of childProjects) {
      await deleteRecursive(child.id);
    }
    
    // Delete the project itself
    await db.projects.delete(projectId);
  };

  await db.transaction("rw", [db.projects], async () => {
    await deleteRecursive(id);
  });
}
```

## Data Validation and Migration

### Type Enforcement
```typescript
// Helper function ensures proper date field handling
function ensureDateFields<T extends Record<string, any>>(
  obj: T,
  dateFields: string[] = ['createdAt', 'updatedAt']
): T {
  const result = { ...obj };
  for (const field of dateFields) {
    if (result[field] && typeof result[field] === 'string') {
      result[field] = new Date(result[field]);
    }
  }
  return result;
}

// Applied automatically when loading data
const conversations = await db.conversations.toArray();
return conversations.map(c => ensureDateFields(c, ['lastSyncedAt']));
```

### Schema Evolution
Future schema changes are handled through versioning:

```typescript
// Example migration for version 2
this.version(2)
  .stores({
    conversations: '++id, title, projectId, syncRepoId, createdAt, updatedAt, archivedAt',
    // Added archivedAt field
  })
  .upgrade(trans => {
    // Add default archivedAt value for existing conversations
    return trans.conversations.toCollection().modify(conversation => {
      conversation.archivedAt = null;
    });
  });
```

## Performance Considerations

### Indexing Strategy
Database indices are carefully chosen for common query patterns:

```typescript
// Conversations indexed by project and sync repo for fast filtering
conversations: '++id, title, projectId, syncRepoId, createdAt, updatedAt'

// Interactions indexed by conversation and creation order
interactions: '++id, conversationId, index, createdAt, startedAt, endedAt'

// Projects indexed by parent for hierarchy traversal
projects: '++id, name, parentId, createdAt, updatedAt'
```

### Batch Operations
Large operations are batched for performance:

```typescript
// Example: Bulk saving interactions
const interactions = generateManyInteractions();
await db.interactions.bulkAdd(interactions);

// Transaction batching for related operations
await db.transaction("rw", [db.conversations, db.interactions], async () => {
  await db.conversations.bulkAdd(conversations);
  await db.interactions.bulkAdd(interactions);
});
```

### Memory Management
Large query results are streamed when possible:

```typescript
// For very large datasets, use Dexie's streaming
await db.interactions
  .where('conversationId')
  .equals(id)
  .each(interaction => {
    // Process one at a time instead of loading all into memory
    processInteraction(interaction);
  });
```

## Error Handling

### Robust Error Recovery
```typescript
static async saveConversation(conversation: Conversation): Promise<string> {
  try {
    return await db.conversations.put(conversation);
  } catch (error) {
    // Log detailed error information
    console.error("PersistenceService: Error saving conversation:", error);
    
    // Provide user-friendly error messages
    if (error.name === 'QuotaExceededError') {
      toast.error("Storage quota exceeded. Please free up space.");
    } else {
      toast.error("Failed to save conversation. Please try again.");
    }
    
    // Re-throw for calling code to handle
    throw error;
  }
}
```

### Connection State Management
```typescript
// Handle database connection issues
db.on('ready', () => {
  console.log("Database initialized successfully");
});

db.on('error', (error) => {
  console.error("Database error:", error);
  // Emit global error for UI handling
  emitter.emit(uiEvent.globalErrorChanged, { 
    error: "Database connection failed" 
  });
});
```

## Best Practices

### 1. Always Use Transactions for Related Operations
```typescript
// Good: Atomic operation
await db.transaction("rw", [db.conversations, db.interactions], async () => {
  await db.conversations.delete(conversationId);
  await db.interactions.where({ conversationId }).delete();
});

// Avoid: Separate operations that could leave inconsistent state
await db.conversations.delete(conversationId);
await db.interactions.where({ conversationId }).delete(); // Could fail
```

### 2. Handle Date Fields Consistently
```typescript
// Always use the helper for date field conversion
return conversations.map(c => ensureDateFields(c, ['lastSyncedAt']));

// Be explicit about which fields contain dates
static async loadSyncRepos(): Promise<SyncRepo[]> {
  const repos = await db.syncRepos.toArray();
  return repos.map(r => ensureDateFields(r, ['lastPulledAt', 'lastPushedAt']));
}
```

### 3. Provide Meaningful Error Messages
```typescript
try {
  await PersistenceService.saveProject(project);
} catch (error) {
  if (error.message.includes('unique constraint')) {
    toast.error("A project with this name already exists");
  } else {
    toast.error("Failed to save project");
  }
  throw error;
}
```

### 4. Use Indices Effectively
```typescript
// Good: Uses index for fast lookup
const projectConversations = await db.conversations
  .where('projectId')
  .equals(projectId)
  .toArray();

// Avoid: Full table scan
const projectConversations = await db.conversations
  .filter(c => c.projectId === projectId)
  .toArray();
```

The persistence layer provides a robust foundation for LiteChat's data management, ensuring reliability, performance, and data integrity while maintaining the privacy-first, client-side architecture. 