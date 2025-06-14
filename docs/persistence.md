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
  promptTemplates!: Table<DbPromptTemplate>;

  constructor() {
    super('LiteChatDB');
    this.version(9).stores({
      conversations: '++id, title, projectId, syncRepoId, createdAt, updatedAt',
      interactions: '++id, conversationId, index, createdAt, startedAt, endedAt, rating',
      projects: '++id, name, parentId, createdAt, updatedAt',
      mods: '&name, enabled, loadOrder',
      appState: '&key',
      providerConfigs: '++id, &name, type, isEnabled, apiKeyId',
      apiKeys: '++id, &name',
      syncRepos: '++id, &name, remoteUrl, username',
      rules: '++id, &name, type, createdAt, updatedAt',
      tags: '++id, &name, createdAt, updatedAt',
      tagRuleLinks: '++id, tagId, ruleId, &[tagId+ruleId]',
      promptTemplates: '++id, &name, createdAt, updatedAt, isPublic, type, parentId',
    });
    this.version(8).stores({
      conversations: '++id, title, projectId, syncRepoId, createdAt, updatedAt',
      interactions: '++id, conversationId, index, createdAt, startedAt, endedAt, rating',
      mods: '&name, enabled, loadOrder',
      appState: '&key',
      providerConfigs: '++id, &name, type, isEnabled, apiKeyId',
      apiKeys: '++id, &name',
      syncRepos: '++id, &name, remoteUrl, username',
      projects: '++id, name, parentId, createdAt, updatedAt',
      rules: '++id, &name, type, createdAt, updatedAt',
      tags: '++id, &name, createdAt, updatedAt',
      tagRuleLinks: '++id, tagId, ruleId, &[tagId+ruleId]',
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

#### Prompt Templates (including Agents and Tasks)
```typescript
// Load all prompt templates
static async loadPromptTemplates(): Promise<PromptTemplate[]>

// Save or update a prompt template
static async savePromptTemplate(template: PromptTemplate): Promise<string>

// Delete a prompt template
static async deletePromptTemplate(id: string): Promise<void>
```

### Settings Management
Application settings are stored in the `appState` table with key-value pairs. This includes MCP server configurations:

```typescript
// Save any setting with automatic persistence
static async saveSetting(key: string, value: any): Promise<string>

// Load setting with default fallback
static async loadSetting<T>(key: string, defaultValue: T): Promise<T>

// Example usage
await PersistenceService.saveSetting('theme', 'dark');
const theme = await PersistenceService.loadSetting('theme', 'light');

// MCP Server configuration example
const mcpServers = await PersistenceService.loadSetting('mcpServers', []);
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

LiteChat provides robust data import and export capabilities via the `ImportExportService`, accessible through the **Settings → Data Management** tab. This allows you to backup and restore your entire LiteChat configuration or specific data categories.

### Full Application Configuration Backup

This option allows you to export all supported data types into a single JSON file. When importing, you can selectively choose which categories to restore.

```typescript
interface FullExportData {
  version: number;
  exportedAt: string;
  settings?: Record<string, any>;
  apiKeys?: DbApiKey[];
  providerConfigs?: DbProviderConfig[];
  projects?: Project[];
  conversations?: Conversation[];
  interactions?: Interaction[];
  rules?: DbRule[];
  tags?: DbTag[];
  tagRuleLinks?: DbTagRuleLink[];
  mods?: DbMod[];
  syncRepos?: SyncRepo[];
  mcpServers?: any[];
  promptTemplates?: DbPromptTemplate[];
  agents?: DbPromptTemplate[];
}

// Export entire application state
static async exportFullConfiguration(options: FullExportOptions): Promise<void>

// Import with selective options
static async importFullConfiguration(file: File, options: FullImportOptions): Promise<void>

interface FullImportOptions {
  importSettings: boolean;
  importApiKeys: boolean;
  importProviderConfigs: boolean;
  importProjects: boolean;
  importConversations: boolean;
  importRulesAndTags: boolean;
  importMods: boolean;
  importSyncRepos: boolean;
  importMcpServers: boolean;
  importPromptTemplates: boolean;
  importAgents: boolean;
}

type FullExportOptions = FullImportOptions;
```

**Usage:**
- Navigate to `Settings` -> `Data Management`.
- Under `Full Configuration Backup`, select the data types you wish to include or restore.
- Click `Export Configuration` to save a backup file, or `Select Backup File...` to import.

### Individual Category Export/Import

For more granular control, you can export and import specific data categories independently. This is useful for sharing a subset of your configurations or for managing specific components of your LiteChat environment.

#### MCP Servers

Export or import your configured Model Context Protocol (MCP) server connections. This includes their names, URLs, and authentication headers.

```typescript
static async exportMcpServers(): Promise<void>
static async importMcpServers(file: File): Promise<void>
```

**Usage:**
- Go to `Settings` -> `Data Management`.
- In the `Individual Categories` section, find `MCP Servers`.
- Click `Export` to save your MCP server configurations, or `Import` to load them from a file.

#### Prompt Templates

Export or import your standard prompt templates. This includes templates of type "prompt" and their associated variables, descriptions, tags, and content. Agents and tasks are handled separately.

```typescript
static async exportPromptTemplates(): Promise<void>
static async importPromptTemplates(file: File): Promise<void>
```

**Usage:**
- Go to `Settings` -> `Data Management`.
- In the `Individual Categories` section, find `Prompt Templates`.
- Click `Export` to save your prompt templates, or `Import` to load them from a file.

#### Agents

Export or import your AI agents along with all their associated tasks. This ensures that your agents are fully functional when imported into another LiteChat instance.

```typescript
static async exportAgents(): Promise<void>
static async importAgents(file: File): Promise<void>
```

**Usage:**
- Go to `Settings` -> `Data Management`.
- In the `Individual Categories` section, find `Agents`.
- Click `Export` to save your agents (and their tasks), or `Import` to load them from a file.

### Individual Entity Export

These functions are used internally by the `ImportExportService` for specific scenarios and are not directly exposed in the UI for general import/export operations.

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

## Data Cleaning

### Clear All Local Data

This action will permanently delete ALL conversations, messages, mods, settings, providers, API keys, projects, rules, tags, sync repositories, and all prompt templates (including agents and tasks) from your browser's local storage. This action cannot be undone.

```typescript
static async clearAllData(): Promise<void>
```

**Usage:**
- Navigate to `Settings` -> `Data Management`.
- In the `Danger Zone` section, click `Clear All Local Data`.
- Confirm the action twice to proceed. Use with extreme caution.

The persistence layer provides a robust foundation for LiteChat's data management, ensuring reliability, performance, and data integrity while maintaining the privacy-first, client-side architecture. 