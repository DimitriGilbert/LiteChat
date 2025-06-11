# TypeScript Type Definitions

This reference covers LiteChat's key TypeScript interfaces, types, and data structures. Understanding these types is essential for working with LiteChat's codebase and extending its functionality.

## Core Domain Types

### 1. Conversation & Interaction Types

#### Conversation
```typescript
interface Conversation {
  id: string
  projectId: string
  title: string | null
  createdAt: Date
  updatedAt: Date
  metadata?: Record<string, any>
}
```

#### Interaction
```typescript
interface Interaction {
  id: string
  conversationId: string
  role: "user" | "assistant"
  content: string
  toolCalls?: ToolCall[]
  toolResults?: ToolResult[]
  metadata?: Record<string, any>
  createdAt: Date
  updatedAt: Date
  status: "streaming" | "complete" | "error"
}
```

#### Tool Definitions
```typescript
interface ToolCall {
  id: string
  name: string
  parameters: Record<string, any>
}

interface ToolResult {
  id: string
  content: string
  success: boolean
  error?: string
}
```

### 2. Project & Organization Types

#### Project
```typescript
interface Project {
  id: string
  path: string
  name: string
  parentId: string | null
  createdAt: Date
  updatedAt: Date
  
  // AI Settings (can be null to inherit)
  systemPrompt: string | null
  modelId: string | null
  temperature: number | null
  maxTokens: number | null
  topP: number | null
  topK: number | null
  presencePenalty: number | null
  frequencyPenalty: number | null
  
  // Rules & Tags
  defaultTagIds: string[] | null
  defaultRuleIds: string[] | null
  
  metadata?: Record<string, any>
}
```

### 3. AI Provider Types

#### Provider Configuration
```typescript
interface DbProviderConfig {
  id: string
  providerId: string
  name: string
  enabled: boolean
  baseUrl: string | null
  apiKey: string | null
  settings: Record<string, any>
  models: ModelListItem[]
  modelsLastFetchedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

interface ModelListItem {
  id: string
  name: string
  description?: string
  contextWindow?: number
  maxOutputTokens?: number
  inputTokenPrice?: number
  outputTokenPrice?: number
  supportsTools?: boolean
  supportsStreaming?: boolean
  supportsReasoning?: boolean
  supportsImageGeneration?: boolean
}
```

#### API Keys
```typescript
interface DbApiKey {
  id: string
  name: string
  providerId: string
  value: string
  createdAt: Date
}
```

### 4. Rules & Tags Types

#### Rule System
```typescript
interface DbRule {
  id: string
  name: string
  content: string
  type: RuleType
  createdAt: Date
  updatedAt: Date
}

type RuleType = "system" | "user" | "assistant" | "prefix" | "suffix"

interface DbTag {
  id: string
  name: string
  description?: string | null
  createdAt: Date
  updatedAt: Date
}

interface DbTagRuleLink {
  id: string
  tagId: string
  ruleId: string
  createdAt: Date
}
```

### 5. Virtual File System Types

#### VFS Nodes
```typescript
interface VfsNodeBase {
  id: string
  parentId: string | null
  name: string
  path: string
  createdAt: number
  lastModified: number
}

interface VfsDirectory extends VfsNodeBase {
  type: "folder"
}

interface VfsFile extends VfsNodeBase {
  type: "file"
  size: number
  content?: string
}

type VfsNode = VfsDirectory | VfsFile
```

## Event System Types

### 1. Event Payload Definitions

#### Provider Events
```typescript
interface ProviderEventPayloads {
  [providerEvent.configsChanged]: { providerConfigs: DbProviderConfig[] }
  [providerEvent.apiKeysChanged]: { apiKeys: DbApiKey[] }
  [providerEvent.selectedModelChanged]: { modelId: string | null }
  [providerEvent.fetchStatusChanged]: {
    providerId: string
    status: "idle" | "fetching" | "error" | "success"
  }
  [providerEvent.addApiKeyRequest]: {
    name: string
    providerId: string
    value: string
  }
  // ... more event payloads
}
```

#### VFS Events
```typescript
interface VfsEventPayloads {
  [vfsEvent.nodesUpdated]: {
    vfsKey: string | null
    nodes: Record<string, VfsNode>
    childrenMap: Record<string, string[]>
  }
  [vfsEvent.selectionChanged]: { selectedFileIds: string[] }
  [vfsEvent.loadingStateChanged]: {
    isLoading: boolean
    operationLoading: boolean
    error: string | null
  }
  [vfsEvent.createDirectoryRequest]: { parentId: string | null; name: string }
  [vfsEvent.uploadFilesRequest]: { parentId: string | null; files: FileList }
  // ... more VFS events
}
```

### 2. Event Emitter Types

#### ModEventPayloadMap
```typescript
type ModEventPayloadMap = 
  & ProviderEventPayloads
  & ConversationEventPayloads
  & InteractionEventPayloads
  & VfsEventPayloads
  & RulesEventPayloads
  & ProjectEventPayloads
  & SettingsEventPayloads
  & ModEventPayloads
  & UiEventPayloads
  & SyncEventPayloads
  & InputEventPayloads
  & PromptEventPayloads
  & ControlRegistryEventPayloads
```

## Control Module System Types

### 1. Control Module Interface

```typescript
interface ControlModule {
  readonly id: string
  readonly dependencies?: string[]
  initialize(modApi: LiteChatModApi): Promise<void>
  register(modApi: LiteChatModApi): void
  destroy(modApi: LiteChatModApi): void
}
```

### 2. Chat Controls

#### Chat Control
```typescript
interface ChatControl {
  id: string
  status: () => ChatControlStatus
  renderer?: () => React.ReactElement | null
  iconRenderer?: () => React.ReactElement | null
  panel?: string
  show?: () => boolean
  settingsConfig?: {
    tabId: string
    title: string
    icon?: React.ReactElement
    order?: number
  }
  settingsRenderer?: () => React.ReactElement | null
  onSettingSubmit?: (settingsData: any) => void | Promise<void>
  aiInteractionMiddleware?: {
    before?: (payload: AIPayload) => AIPayload | Promise<AIPayload> | false
    after?: (response: AIResponse) => AIResponse | Promise<AIResponse> | false
  }
}

type ChatControlStatus = "ready" | "loading" | "error"
```

#### Prompt Control
```typescript
interface PromptControl {
  id: string
  show?: () => boolean
  status?: () => ChatControlStatus
  renderer?: () => React.ReactNode
  triggerRenderer?: () => React.ReactNode
  getParameters?: () =>
    | Record<string, any>
    | Promise<Record<string, any> | undefined>
    | undefined
  getMetadata?: () =>
    | Record<string, any>
    | Promise<Record<string, any> | undefined>
    | undefined
  clearOnSubmit?: () => void
  onRegister?: () => void
  onUnregister?: () => void
}
```

## Modding System Types

### 1. Mod Definition

```typescript
interface DbMod {
  id: string
  name: string
  sourceUrl: string | null
  scriptContent: string | null
  enabled: boolean
  loadOrder: number
  createdAt: Date
}

interface ModInstance {
  id: string
  name: string
  api: LiteChatModApi
  error?: Error | string | null
}
```

### 2. Mod API

```typescript
interface LiteChatModApi {
  // Event system
  eventEmitter: EventEmitter<ModEventPayloadMap>
  
  // Store access
  stores: {
    conversation: ConversationStore
    project: ProjectStore
    provider: ProviderStore
    settings: SettingsStore
    vfs: VfsStore
    // ... other stores
  }
  
  // Control registration
  registerChatControl: (control: ChatControl) => void
  unregisterChatControl: (controlId: string) => void
  registerPromptControl: (control: PromptControl) => void
  unregisterPromptControl: (controlId: string) => void
  
  // Settings
  addSettingsTab: (tab: CustomSettingTab) => void
  removeSettingsTab: (tabId: string) => void
  
  // Middleware
  addMiddleware: <T extends ModMiddlewareHookName>(
    hookName: T,
    middleware: ModMiddleware<T>
  ) => void
}
```

### 3. Custom Settings

```typescript
interface CustomSettingTab {
  id: string
  title: string
  component: React.ComponentType<any>
  order?: number
}
```

## Store Types

### 1. Store State Interfaces

```typescript
// Conversation Store
interface ConversationState {
  conversations: Conversation[]
  selectedConversationId: string | null
  interactions: Record<string, Interaction[]>
  isLoading: boolean
  error: string | null
}

// Project Store
interface ProjectState {
  projects: Project[]
  selectedProjectId: string | null
  isLoading: boolean
  error: string | null
}

// VFS Store
interface VfsState {
  vfsKey: string | null
  configuredVfsKey: string | null
  nodes: Record<string, VfsNode>
  childrenMap: Record<string, string[]>
  selectedFileIds: string[]
  isLoading: boolean
  operationLoading: boolean
  error: string | null
  fsInstance: typeof fs | null
  enabled: boolean
}
```

### 2. Store Action Handlers

```typescript
interface RegisteredActionHandler {
  eventName: string
  handler: (payload: any) => Promise<void> | void
}
```

## AI Integration Types

### 1. AI Payload & Response

```typescript
interface AIPayload {
  messages: Message[]
  model: string
  temperature?: number
  maxTokens?: number
  topP?: number
  topK?: number
  presencePenalty?: number
  frequencyPenalty?: number
  tools?: Tool[]
  toolChoice?: "auto" | "none" | { type: "function", function: { name: string } }
}

interface AIResponse {
  content: string
  toolCalls?: ToolCall[]
  finishReason: "stop" | "length" | "tool_calls" | "content_filter"
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

interface Message {
  role: "system" | "user" | "assistant" | "tool"
  content: string
  toolCallId?: string
}
```

### 2. Streaming Types

```typescript
interface StreamingOptions {
  onTextChunk?: (chunk: string) => void
  onToolCall?: (toolCall: ToolCall) => Promise<ToolResult>
  onError?: (error: Error) => void
  onComplete?: () => void
  signal?: AbortSignal
}
```

## Utility Types

### 1. Database Types

```typescript
interface DbBase {
  id: string
  createdAt: Date
  updatedAt?: Date
}

// Utility for ensuring Date fields are properly typed
function ensureDateFields<T extends Record<string, any>>(
  obj: T,
  dateFields: (keyof T)[] = ['createdAt', 'updatedAt']
): T
```

### 2. Import/Export Types

```typescript
interface FullExportData {
  version: number
  exportedAt: string
  settings?: Record<string, any>
  apiKeys?: DbApiKey[]
  providerConfigs?: DbProviderConfig[]
  projects?: Project[]
  conversations?: Conversation[]
  interactions?: Interaction[]
  rules?: DbRule[]
  tags?: DbTag[]
  tagRuleLinks?: DbTagRuleLink[]
  mods?: DbMod[]
  syncRepos?: SyncRepo[]
}

interface FullImportOptions {
  importSettings: boolean
  importApiKeys: boolean
  importProviderConfigs: boolean
  importProjects: boolean
  importConversations: boolean
  importRulesAndTags: boolean
  importMods: boolean
  importSyncRepos: boolean
}
```

### 3. Sync Repository Types

```typescript
interface SyncRepo {
  id: string
  name: string
  url: string
  localPath: string
  authType: "none" | "token" | "ssh"
  authToken?: string
  lastSyncAt?: Date
  enabled: boolean
  createdAt: Date
  updatedAt: Date
}
```

## Type Guards and Utilities

### 1. Type Guards

```typescript
// VFS Type Guards
function isVfsFile(node: VfsNode): node is VfsFile {
  return node.type === "file"
}

function isVfsDirectory(node: VfsNode): node is VfsDirectory {
  return node.type === "folder"
}

// Role Type Guards
function isUserInteraction(interaction: Interaction): boolean {
  return interaction.role === "user"
}

function isAssistantInteraction(interaction: Interaction): boolean {
  return interaction.role === "assistant"
}
```

### 2. Utility Functions

```typescript
// Create new entities with proper defaults
function createNewConversation(projectId: string): Omit<Conversation, 'id'> {
  return {
    projectId,
    title: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    metadata: {}
  }
}

function createNewProject(name: string, parentId?: string): Omit<Project, 'id'> {
  const now = new Date()
  return {
    path: parentId ? `${parentId}/${name}` : name,
    name,
    parentId: parentId || null,
    createdAt: now,
    updatedAt: now,
    systemPrompt: null,
    modelId: null,
    // ... other defaults
  }
}
```

## React Component Types

### 1. Component Prop Types

```typescript
// Standard component patterns
interface BaseComponentProps {
  className?: string
  children?: React.ReactNode
}

interface LoadingComponentProps extends BaseComponentProps {
  isLoading: boolean
  error?: string | null
  skeleton?: React.ReactNode
}

// Modal/Dialog props
interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  size?: "sm" | "md" | "lg" | "xl"
}
```

### 2. Hook Return Types

```typescript
// Common hook patterns
interface UseAsyncOperationResult<TArgs extends any[], TResult> {
  run: (...args: TArgs) => Promise<TResult | undefined>
  isLoading: boolean
  error: string | null
  resetError: () => void
}

interface UseDataResult<T> {
  data: T | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}
```

This type reference provides the foundation for understanding and working with LiteChat's TypeScript codebase. All types are designed to be strict, composable, and maintainable while supporting the application's extensible architecture. 