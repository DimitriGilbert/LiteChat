# API Reference

This reference covers LiteChat's core APIs, including store methods, service interfaces, event emitter usage, and modding APIs. These APIs form the foundation for extending and customizing LiteChat.

## Store APIs

### Conversation Store

The conversation store manages conversations and interactions.

```typescript
import { useConversationStore } from '@/store/conversation.store'

// React component usage
const { conversations, selectedConversationId, loadConversations } = useConversationStore(
  useShallow(state => ({
    conversations: state.conversations,
    selectedConversationId: state.selectedConversationId,
    loadConversations: state.loadConversations
  }))
)

// Service usage
const conversationState = useConversationStore.getState()
```

#### Key Methods

```typescript
interface ConversationStore {
  // State
  conversations: Conversation[]
  selectedConversationId: string | null
  interactions: Record<string, Interaction[]>
  isLoading: boolean
  error: string | null

  // Actions
  loadConversations(): Promise<void>
  createConversation(conversation: Omit<Conversation, 'id'>): Promise<string>
  updateConversation(id: string, updates: Partial<Conversation>): Promise<void>
  deleteConversation(id: string): Promise<void>
  selectConversation(id: string | null): void
  
  loadInteractions(conversationId: string): Promise<void>
  addInteraction(interaction: Omit<Interaction, 'id'>): Promise<string>
  updateInteraction(id: string, updates: Partial<Interaction>): Promise<void>
  deleteInteraction(id: string): Promise<void>
  
  // Utility methods
  getConversationById(id: string): Conversation | undefined
  getInteractionsForConversation(conversationId: string): Interaction[]
}
```

### Project Store

The project store manages hierarchical project organization.

```typescript
interface ProjectStore {
  // State
  projects: Project[]
  selectedProjectId: string | null
  isLoading: boolean
  error: string | null

  // Actions
  loadProjects(): Promise<void>
  createProject(project: Omit<Project, 'id'>): Promise<string>
  updateProject(id: string, updates: Partial<Project>): Promise<void>
  deleteProject(id: string): Promise<void>
  selectProject(id: string | null): void
  
  // Utility methods
  getProjectById(id: string): Project | undefined
  getProjectsByParent(parentId: string | null): Project[]
  getProjectPath(id: string): string[]
  getEffectiveSettings(id: string): ProjectSettings
}
```

### VFS Store

The VFS store manages virtual file system operations.

```typescript
interface VfsStore {
  // State
  vfsKey: string | null
  nodes: Record<string, VfsNode>
  childrenMap: Record<string, string[]>
  selectedFileIds: string[]
  isLoading: boolean
  error: string | null

  // Actions
  initializeVFS(vfsKey: string, options?: { force?: boolean }): Promise<void>
  fetchNodes(parentId?: string | null): Promise<void>
  createDirectory(parentId: string | null, name: string): Promise<void>
  uploadFiles(parentId: string | null, files: FileList): Promise<void>
  deleteNodes(ids: string[]): Promise<void>
  renameNode(id: string, newName: string): Promise<void>
  
  // File operations
  readFile(path: string): Promise<string>
  writeFile(path: string, content: string): Promise<void>
  downloadFile(fileId: string): Promise<{ name: string; blob: Blob } | null>
  
  // Selection
  selectFile(fileId: string): void
  deselectFile(fileId: string): void
  clearSelection(): void
  
  // Utility methods
  findNodeByPath(path: string): VfsNode | undefined
  getNodeChildren(nodeId: string): VfsNode[]
}
```

### Provider Store

The provider store manages AI provider configurations and models.

```typescript
interface ProviderStore {
  // State
  providerConfigs: DbProviderConfig[]
  apiKeys: DbApiKey[]
  selectedModelId: string | null
  globalModelSortOrder: string[]
  enableApiKeyManagement: boolean

  // Actions
  loadInitialData(): Promise<void>
  addApiKey(name: string, providerId: string, value: string): Promise<void>
  deleteApiKey(id: string): Promise<void>
  addProviderConfig(config: Omit<DbProviderConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<void>
  updateProviderConfig(id: string, changes: Partial<DbProviderConfig>): Promise<void>
  deleteProviderConfig(id: string): Promise<void>
  selectModel(modelId: string | null): void
  fetchModels(providerConfigId: string): Promise<void>
  
  // Utility methods
  getProviderById(id: string): DbProviderConfig | undefined
  getApiKeysForProvider(providerId: string): DbApiKey[]
  getEnabledModels(): ModelListItem[]
}
```

### Prompt Template Store

The prompt template store manages reusable prompt templates with dynamic variables.

```typescript
interface PromptTemplateStore {
  // State
  promptTemplates: PromptTemplate[]
  isLoading: boolean
  error: string | null

  // Actions
  loadPromptTemplates(): Promise<void>
  addPromptTemplate(template: Omit<PromptTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<string>
  updatePromptTemplate(id: string, updates: Partial<PromptTemplate>): Promise<void>
  deletePromptTemplate(id: string): Promise<void>
  compilePromptTemplate(templateId: string, formData: PromptFormData): Promise<CompiledPrompt>
  
  // Utility methods
  getTemplateById(id: string): PromptTemplate | undefined
  getTemplatesByTag(tag: string): PromptTemplate[]
  searchTemplates(query: string): PromptTemplate[]
}

// Template types
interface PromptTemplate {
  id: string
  name: string
  description: string
  prompt: string                    // Template with {{ variable }} syntax
  variables: PromptVariable[]       // Dynamic variable definitions
  tags: string[]                    // Organization tags
  tools?: string[]                  // Auto-selected tools
  rules?: string[]                  // Auto-selected rules
  isPublic: boolean
  createdAt: Date
  updatedAt: Date
}

interface PromptVariable {
  name: string
  type: "string" | "number" | "boolean" | "array"
  description?: string
  required: boolean
  default?: string
  instructions?: string
}

interface CompiledPrompt {
  content: string
  selectedTools?: string[]
  selectedRules?: string[]
}

interface PromptFormData {
  [variableName: string]: string | number | boolean | string[]
}
```

**Usage Example**:
```typescript
// Load and compile a template
const { promptTemplates, compilePromptTemplate } = usePromptTemplateStore(
  useShallow(state => ({
    promptTemplates: state.promptTemplates,
    compilePromptTemplate: state.compilePromptTemplate
  }))
)

// Compile template with user input
const formData = { projectName: "MyApp", language: "TypeScript" }
const compiled = await compilePromptTemplate("code-review-template", formData)
console.log(compiled.content) // Template with variables replaced
```

## Event Emitter API

### Core Event System

```typescript
import { eventEmitter } from '@/lib/event-emitter'

// Emit events
eventEmitter.emit('conversation.selectRequest', { conversationId: 'conv-123' })

// Listen to events
const handler = (payload: { conversationId: string }) => {
  console.log('Conversation selected:', payload.conversationId)
}
eventEmitter.on('conversation.selected', handler)

// Remove listeners
eventEmitter.off('conversation.selected', handler)

// One-time listeners
eventEmitter.once('provider.modelsLoaded', (payload) => {
  console.log('Models loaded:', payload.models)
})
```

### Event Naming Convention

Events follow the pattern: `domain.action[Request]`

- **Request Events**: Trigger actions (e.g., `conversation.createRequest`)
- **State Events**: Notify of state changes (e.g., `conversation.created`)
- **Status Events**: Indicate process status (e.g., `provider.loadingStateChanged`)

#### Common Event Patterns

```typescript
// Request/Response pattern
eventEmitter.emit('conversation.createRequest', { 
  conversation: newConversationData 
})
// Listen for the result
eventEmitter.on('conversation.created', ({ conversation }) => {
  // Handle successful creation
})
eventEmitter.on('conversation.createFailed', ({ error }) => {
  // Handle creation error
})

// Loading state pattern
eventEmitter.on('provider.loadingStateChanged', ({ isLoading, error }) => {
  if (isLoading) {
    showSpinner()
  } else if (error) {
    showError(error)
  } else {
    hideSpinner()
  }
})
```

### Event Types Reference

#### Conversation Events
```typescript
'conversation.loadRequest' // Request to load conversations
'conversation.conversationsLoaded' // Conversations loaded successfully
'conversation.loadFailed' // Failed to load conversations
'conversation.createRequest' // Request to create conversation
'conversation.created' // Conversation created successfully
'conversation.selectRequest' // Request to select conversation
'conversation.selected' // Conversation selected
```

#### Provider Events
```typescript
'provider.loadInitialDataRequest' // Load provider data
'provider.configsChanged' // Provider configs updated
'provider.apiKeysChanged' // API keys updated
'provider.selectedModelChanged' // Selected model changed
'provider.fetchModelsRequest' // Request to fetch models
'provider.fetchStatusChanged' // Model fetch status update
```

#### VFS Events
```typescript
'vfs.initializeVFSRequest' // Initialize VFS for project
'vfs.nodesUpdated' // VFS nodes updated
'vfs.selectionChanged' // File selection changed
'vfs.createDirectoryRequest' // Create directory request
'vfs.uploadFilesRequest' // Upload files request
'vfs.fileWritten' // File written to VFS
```

#### Prompt Events
```typescript
'prompt.inputChanged' // Input text changed
'prompt.input.set.text.request' // Request to set input text (used by template application)
'prompt.state.submitted' // Prompt submitted for processing
'prompt.state.parameter.changed' // Prompt parameters updated
'prompt.state.set.model.id.request' // Request to set model ID
'prompt.state.set.temperature.request' // Request to set temperature
'prompt.state.set.structured.output.json.request' // Request to set structured output
```

**Prompt Input Text Setting**:
```typescript
// Apply template content to input area
eventEmitter.emit('prompt.input.set.text.request', { 
  text: 'Compiled template content here...' 
})

// Listen for input changes
eventEmitter.on('prompt.inputChanged', ({ value }) => {
  console.log('Input text updated:', value)
})
```

## Service APIs

### Persistence Service

The persistence service provides database operations.

```typescript
import { PersistenceService } from '@/services/persistence.service'

// Conversation operations
const conversations = await PersistenceService.loadConversations()
const conversationId = await PersistenceService.saveConversation(conversation)
await PersistenceService.deleteConversation(conversationId)

// Project operations  
const projects = await PersistenceService.loadProjects()
const projectId = await PersistenceService.saveProject(project)

// Export/Import
const exportData = await PersistenceService.exportAllData()
await PersistenceService.importAllData(importData, options)
```

### AI Service

The AI service handles AI provider interactions.

```typescript
import { AIService } from '@/services/ai.service'

// Streaming chat completion
await AIService.streamChatCompletion(
  {
    messages: [{ role: 'user', content: 'Hello' }],
    model: 'gpt-3.5-turbo'
  },
  {
    onTextChunk: (chunk) => console.log(chunk),
    onToolCall: async (toolCall) => {
      return await executeToolCall(toolCall)
    },
    onError: (error) => console.error(error),
    onComplete: () => console.log('Stream complete')
  }
)

// Non-streaming completion
const response = await AIService.generateCompletion({
  messages: [{ role: 'user', content: 'Hello' }],
  model: 'gpt-3.5-turbo'
})
```

### Conversation Service

The conversation service orchestrates conversation workflows.

```typescript
import { ConversationService } from '@/services/conversation.service'

// Submit a new prompt
const interactionId = await ConversationService.submitPrompt({
  prompt: 'Explain React hooks',
  projectId: 'project-123',
  conversationId: existingConversationId, // optional
  attachments: selectedFiles, // optional
  ruleIds: ['rule-1', 'rule-2'], // optional
  modelOverride: 'gpt-4' // optional
})

// Generate conversation title
await ConversationService.generateConversationTitle('conversation-123')

// Process prompt with rules
const processedPrompt = await ConversationService.processPrompt(
  'Original prompt',
  {
    ruleIds: ['rule-1'],
    includeVfsContext: true,
    attachments: files
  }
)
```

## Modding API

### LiteChatModApi Interface

The modding API provides controlled access to LiteChat's functionality.

```typescript
interface LiteChatModApi {
  // Event system access
  eventEmitter: EventEmitter<ModEventPayloadMap>
  
  // Store access (read-only)
  stores: {
    conversation: ConversationStore
    project: ProjectStore
    provider: ProviderStore
    settings: SettingsStore
    vfs: VfsStore
    rules: RulesStore
    interaction: InteractionStore
    mod: ModStore
    controlRegistry: ControlRegistryStore
    uiState: UiStateStore
    input: InputStore
    promptState: PromptStateStore
  }
  
  // Control registration
  registerChatControl(control: ChatControl): void
  unregisterChatControl(controlId: string): void
  registerPromptControl(control: PromptControl): void
  unregisterPromptControl(controlId: string): void
  
  // Settings extension
  addSettingsTab(tab: CustomSettingTab): void
  removeSettingsTab(tabId: string): void
  
  // Middleware system
  addMiddleware<T extends ModMiddlewareHookName>(
    hookName: T,
    middleware: ModMiddleware<T>
  ): void
}
```

### Mod Development Example

```typescript
// Example mod implementation
class ExampleMod {
  constructor(private api: LiteChatModApi) {}
  
  async initialize() {
    // Register a chat control
    this.api.registerChatControl({
      id: 'example-control',
      status: () => 'ready',
      renderer: () => React.createElement('div', null, 'Example Control'),
      show: () => true
    })
    
    // Listen to events
    this.api.eventEmitter.on('conversation.selected', (payload) => {
      console.log('Mod detected conversation selection:', payload.conversationId)
    })
    
    // Add settings tab
    this.api.addSettingsTab({
      id: 'example-settings',
      title: 'Example Mod',
      component: ExampleSettingsComponent,
      order: 100
    })
    
    // Add middleware
    this.api.addMiddleware('beforeSubmitPrompt', async (payload) => {
      // Modify prompt before submission
      return {
        ...payload,
        prompt: `[Mod Enhanced] ${payload.prompt}`
      }
    })
  }
}

// Mod registration
export default function createMod(api: LiteChatModApi) {
  return new ExampleMod(api)
}
```

### Chat Control API

```typescript
interface ChatControl {
  id: string
  status(): ChatControlStatus
  renderer?(): React.ReactElement | null
  iconRenderer?(): React.ReactElement | null
  panel?: string // 'left' | 'right' | 'bottom'
  show?(): boolean
  
  // Settings integration
  settingsConfig?: {
    tabId: string
    title: string
    icon?: React.ReactElement
    order?: number
  }
  settingsRenderer?(): React.ReactElement | null
  onSettingSubmit?(settingsData: any): void | Promise<void>
  
  // AI interaction middleware
  aiInteractionMiddleware?: {
    before?(payload: AIPayload): AIPayload | Promise<AIPayload> | false
    after?(response: AIResponse): AIResponse | Promise<AIResponse> | false
  }
}
```

### Prompt Control API

```typescript
interface PromptControl {
  id: string
  show?(): boolean
  status?(): ChatControlStatus
  
  // UI rendering
  renderer?(): React.ReactNode
  triggerRenderer?(): React.ReactNode
  
  // Data providers
  getParameters?(): Record<string, any> | Promise<Record<string, any> | undefined> | undefined
  getMetadata?(): Record<string, any> | Promise<Record<string, any> | undefined> | undefined
  
  // Lifecycle
  clearOnSubmit?(): void
  onRegister?(): void
  onUnregister?(): void
}
```

## Utility APIs

### Date Utilities

```typescript
import { ensureDateFields } from '@/lib/utils'

// Ensure Date objects are properly typed after database operations
const conversation = ensureDateFields(rawConversation, ['createdAt', 'updatedAt'])
```

### ID Generation

```typescript
import { generateId } from '@/lib/utils'

// Generate unique IDs for entities
const conversationId = generateId('conversation')
const projectId = generateId('project')
```

### Type Guards

```typescript
import { isVfsFile, isVfsDirectory } from '@/types/litechat/vfs'

// VFS node type checking
if (isVfsFile(node)) {
  // TypeScript knows this is a VfsFile
  console.log('File size:', node.size)
} else if (isVfsDirectory(node)) {
  // TypeScript knows this is a VfsDirectory
  console.log('Directory:', node.name)
}
```

## Error Handling

### Service Error Patterns

```typescript
// Services should catch errors and emit events
try {
  const result = await someOperation()
  eventEmitter.emit('operation.completed', { result })
} catch (error) {
  eventEmitter.emit('operation.failed', { 
    error: error instanceof Error ? error.message : String(error) 
  })
}
```

### Component Error Handling

```typescript
// Components should handle loading and error states
function MyComponent() {
  const { data, isLoading, error } = useConversationStore(useShallow(state => ({
    data: state.conversations,
    isLoading: state.isLoading,
    error: state.error
  })))
  
  if (isLoading) return <Skeleton />
  if (error) return <Alert variant="destructive">{error}</Alert>
  if (!data.length) return <EmptyState />
  
  return <ConversationList conversations={data} />
}
```

## Performance Considerations

### Store Optimization

```typescript
// Use useShallow for multi-field selections to prevent unnecessary re-renders
const { conversations, selectedId } = useConversationStore(
  useShallow(state => ({
    conversations: state.conversations,
    selectedId: state.selectedConversationId
  }))
)

// Avoid selecting entire state when only specific fields are needed
// Bad: const state = useConversationStore()
// Good: const conversations = useConversationStore(state => state.conversations)
```

### Event Listener Cleanup

```typescript
// Always clean up event listeners
useEffect(() => {
  const handler = (payload: EventPayload) => {
    // Handle event
  }
  
  eventEmitter.on('some.event', handler)
  
  return () => {
    eventEmitter.off('some.event', handler)
  }
}, [])
```

This API reference provides the essential interfaces for working with LiteChat's systems, whether you're extending the core application or developing mods. 