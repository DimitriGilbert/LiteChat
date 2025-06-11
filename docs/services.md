# Service Layer Architecture

This guide covers LiteChat's service layer, which encapsulates business logic and provides a clean interface between the UI and data layers. Services handle complex operations, coordinate between different parts of the system, and maintain separation of concerns.

## Architecture Overview

Services in LiteChat follow these principles:
- **Single Responsibility**: Each service handles a specific domain area
- **Event-Driven**: Services communicate through the event system
- **Stateless**: Services don't maintain state; they read from stores and emit events
- **Async by Default**: Most service methods are asynchronous and return Promises

### Service Location
All services are located in `src/services/` and follow the naming convention `*.service.ts`.

## Core Services

### 1. Persistence Service (`persistence.service.ts`)

The `PersistenceService` provides a clean abstraction over the database layer (Dexie.js/IndexedDB).

#### Key Features
- **CRUD Operations**: Create, read, update, delete for all entity types
- **Transaction Support**: Database transactions for data consistency
- **Error Handling**: Centralized error logging and handling
- **Date Field Handling**: Automatic conversion between Date objects and ISO strings

#### Core Methods

```typescript
export class PersistenceService {
  // Conversations
  static async loadConversations(): Promise<Conversation[]>
  static async saveConversation(conversation: Conversation): Promise<string>
  static async deleteConversation(id: string): Promise<void>

  // Interactions
  static async loadInteractions(conversationId: string): Promise<Interaction[]>
  static async saveInteraction(interaction: Interaction): Promise<string>
  static async deleteInteraction(id: string): Promise<void>

  // Projects
  static async loadProjects(): Promise<Project[]>
  static async saveProject(project: Project): Promise<string>
  static async deleteProject(id: string): Promise<void>

  // Provider Configurations
  static async loadProviderConfigs(): Promise<DbProviderConfig[]>
  static async saveProviderConfig(config: DbProviderConfig): Promise<string>

  // Rules and Tags
  static async loadRules(): Promise<DbRule[]>
  static async saveRule(rule: DbRule): Promise<string>
  static async loadTags(): Promise<DbTag[]>
  static async saveTag(tag: DbTag): Promise<string>

  // Import/Export
  static async exportAllData(): Promise<FullExportData>
  static async importAllData(data: FullExportData, options: FullImportOptions): Promise<void>
}
```

#### Usage Pattern

```typescript
// Services read state and trigger events, never modify state directly
class SomeService {
  static async performOperation() {
    try {
      // Read current state
      const currentData = someStore.getState().data

      // Perform business logic
      const result = await PersistenceService.saveData(processedData)

      // Emit success event
      eventEmitter.emit(someEvent.operationCompleted, { result })
    } catch (error) {
      // Emit error event
      eventEmitter.emit(someEvent.operationFailed, { error: error.message })
    }
  }
}
```

### 2. AI Service (`ai.service.ts`)

The `AIService` handles direct interaction with AI providers through the Vercel AI SDK.

#### Key Features
- **Streaming Responses**: Real-time text generation with streaming
- **Tool Execution**: Coordinate AI tool calls with system tools
- **Multi-Provider Support**: Abstract interface for different AI providers
- **Error Handling**: Graceful handling of API errors and timeouts

#### Core Methods

```typescript
export class AIService {
  /**
   * Stream a chat completion with tool support
   */
  static async streamChatCompletion(
    payload: AIPayload,
    options: StreamingOptions
  ): Promise<void>

  /**
   * Generate a single completion (non-streaming)
   */
  static async generateCompletion(
    payload: AIPayload
  ): Promise<AIResponse>

  /**
   * Handle tool execution during streaming
   */
  static async executeTools(
    toolCalls: ToolCall[],
    interactionId: string
  ): Promise<ToolResult[]>
}
```

### 3. Conversation Service (`conversation.service.ts`)

The `ConversationService` orchestrates conversation management and prompt submission.

#### Key Features
- **Prompt Processing**: Apply rules, handle attachments, process context
- **Title Generation**: Automatic conversation titles
- **Rule Application**: Apply prompt engineering rules and templates
- **File Context**: Include file contents and VFS context in prompts

#### Core Methods

```typescript
export class ConversationService {
  /**
   * Submit a new prompt, creating conversation and interaction
   */
  static async submitPrompt(params: SubmitPromptParams): Promise<string>

  /**
   * Process prompt with rules and context
   */
  static async processPrompt(
    originalPrompt: string,
    options: PromptProcessingOptions
  ): Promise<ProcessedPrompt>

  /**
   * Generate conversation title from first interaction
   */
  static async generateConversationTitle(
    conversationId: string
  ): Promise<void>

  /**
   * Apply rules to prompt content
   */
  static applyRulesToPrompt(
    prompt: string,
    rules: DbRule[]
  ): string
}
```

#### Usage Example

```typescript
// Conversation service coordinates multiple concerns
const result = await ConversationService.submitPrompt({
  prompt: userInput,
  projectId: currentProject.id,
  conversationId: selectedConversation?.id,
  attachments: selectedFiles,
  ruleIds: projectDefaults.ruleIds,
  modelOverride: tempModelSelection
})
```

### 4. Interaction Service (`interaction.service.ts`)

The `InteractionService` manages the lifecycle of AI interactions from start to completion.

#### Key Features
- **Streaming Management**: Handle real-time text streaming
- **Tool Coordination**: Execute and track tool calls
- **State Tracking**: Monitor interaction progress and completion
- **Error Recovery**: Handle failures and partial completions

#### Core Methods

```typescript
export class InteractionService {
  /**
   * Start a new interaction with streaming
   */
  static async startInteraction(
    params: StartInteractionParams
  ): Promise<string>

  /**
   * Append streaming text chunk
   */
  static appendTextChunk(
    interactionId: string,
    chunk: string
  ): void

  /**
   * Execute AI tool call
   */
  static async executeToolCall(
    interactionId: string,
    toolCall: ToolCall
  ): Promise<ToolResult>

  /**
   * Mark interaction as complete
   */
  static markInteractionComplete(
    interactionId: string
  ): Promise<void>

  /**
   * Handle interaction errors
   */
  static markInteractionAsError(
    interactionId: string,
    error: Error
  ): Promise<void>
}
```

### 5. Import/Export Service (`import-export.service.ts`)

The `ImportExportService` handles data portability and backup functionality.

#### Key Features
- **Full Data Export**: Complete application state export
- **Selective Import**: Choose which data types to import
- **Conversation Export**: Individual conversation exports
- **Format Validation**: Validate import data structure

#### Core Methods

```typescript
export class ImportExportService {
  /**
   * Export all application data
   */
  static async exportAllData(): Promise<FullExportData>

  /**
   * Import full configuration from file
   */
  static async importFullConfiguration(
    file: File,
    options: FullImportOptions
  ): Promise<void>

  /**
   * Export single conversation with interactions
   */
  static async exportConversation(
    conversationId: string
  ): Promise<ConversationExport>

  /**
   * Import conversations from export file
   */
  static async importConversations(
    file: File,
    targetProjectId?: string
  ): Promise<void>
}
```

### 6. Sync Services

#### Git Sync Service (`sync.service.ts`)
Handles Git repository synchronization with conversations.

```typescript
export class SyncService {
  /**
   * Sync conversation to Git repository
   */
  static async syncConversationToGit(
    conversationId: string,
    repoId: string
  ): Promise<void>

  /**
   * Pull latest changes from Git repository
   */
  static async pullFromRepository(repoId: string): Promise<void>

  /**
   * Push local changes to Git repository
   */
  static async pushToRepository(repoId: string): Promise<void>
}
```

#### Bulk Sync Service (`bulk-sync.service.ts`)
Handles batch synchronization operations.

```typescript
export class BulkSyncService {
  /**
   * Perform bulk synchronization of multiple repos
   */
  static async performBulkSync(options: BulkSyncOptions): Promise<void>

  /**
   * Stop any running bulk sync operation
   */
  static abort(): void

  /**
   * Check if bulk sync is currently running
   */
  static isActive(): boolean
}
```

### 7. Specialized Services

#### Model Fetcher (`model-fetcher.ts`)
Fetches available models from AI providers.

```typescript
export class ModelFetcher {
  /**
   * Fetch models for a provider configuration
   */
  static async fetchModelsForProvider(
    config: DbProviderConfig
  ): Promise<ModelListItem[]>

  /**
   * Update model cache for provider
   */
  static async updateProviderModels(
    providerId: string
  ): Promise<void>
}
```

#### AI Image Generation Service (`ai-image-generation.service.ts`)
Handles image generation requests.

```typescript
export interface ImageGenerationResult {
  image: string // URL or base64 encoded image
  finishReason: "stop" | "length" | "content-filter" | "other"
}

export class AIImageGenerationService {
  static async generateImage(
    prompt: string,
    options: ImageGenerationOptions
  ): Promise<ImageGenerationResult>
}
```

#### Event Action Coordinator Service (`event-action-coordinator.service.ts`)
Central hub for routing action request events to store handlers.

```typescript
export class EventActionCoordinatorService {
  /**
   * Register store action handlers
   */
  static registerStore(handlers: RegisteredActionHandler[]): void

  /**
   * Initialize event listeners for all registered handlers
   */
  static initialize(): void

  /**
   * Clean up event listeners
   */
  static cleanup(): void
}
```

## Service Patterns

### 1. Event-Driven Communication

Services use events for communication rather than direct method calls:

```typescript
// Instead of direct calls
// someStore.updateData(newData) // DON'T DO THIS

// Use events
eventEmitter.emit(someEvent.updateDataRequest, { data: newData })

// Service listens for request events and emits result events
class SomeService {
  static async handleUpdateRequest(payload: { data: any }) {
    try {
      const result = await this.processData(payload.data)
      eventEmitter.emit(someEvent.dataUpdated, { result })
    } catch (error) {
      eventEmitter.emit(someEvent.updateFailed, { error: error.message })
    }
  }
}
```

### 2. Error Handling Pattern

```typescript
export class ServiceBase {
  protected static async executeWithErrorHandling<T>(
    operation: () => Promise<T>,
    errorEvent: string,
    context: string
  ): Promise<T | null> {
    try {
      return await operation()
    } catch (error) {
      console.error(`${context}:`, error)
      eventEmitter.emit(errorEvent, { 
        error: error instanceof Error ? error.message : String(error) 
      })
      return null
    }
  }
}

// Usage in services
class ExampleService extends ServiceBase {
  static async performOperation(id: string): Promise<void> {
    await this.executeWithErrorHandling(
      () => this.doActualWork(id),
      someEvent.operationFailed,
      'ExampleService.performOperation'
    )
  }
}
```

### 3. Async Operation Pattern

```typescript
export class AsyncServicePattern {
  /**
   * Standard pattern for async operations with loading states
   */
  static async performAsyncOperation(params: any): Promise<void> {
    // Emit loading start
    eventEmitter.emit(someEvent.loadingStateChanged, { 
      isLoading: true, 
      error: null 
    })

    try {
      // Perform actual work
      const result = await this.doWork(params)
      
      // Emit success
      eventEmitter.emit(someEvent.operationCompleted, { result })
    } catch (error) {
      // Emit error
      eventEmitter.emit(someEvent.operationFailed, { 
        error: error instanceof Error ? error.message : String(error) 
      })
    } finally {
      // Always emit loading end
      eventEmitter.emit(someEvent.loadingStateChanged, { 
        isLoading: false 
      })
    }
  }
}
```

### 4. Service Coordination Pattern

```typescript
// Services coordinate complex operations involving multiple domains
export class CoordinatedService {
  static async performComplexOperation(params: ComplexParams): Promise<void> {
    // Step 1: Prepare data
    const processedData = await DataProcessingService.processInput(params.input)
    
    // Step 2: Validate with another service
    const isValid = await ValidationService.validate(processedData)
    if (!isValid) {
      throw new Error('Validation failed')
    }
    
    // Step 3: Persist changes
    const savedId = await PersistenceService.saveData(processedData)
    
    // Step 4: Trigger downstream operations
    eventEmitter.emit(dataEvent.dataCreated, { id: savedId, data: processedData })
    
    // Step 5: Optional cleanup or notifications
    await NotificationService.notifyCompletion(savedId)
  }
}
```

## Service Testing

### 1. Unit Testing Services

```typescript
import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { AIService } from './ai.service'
import { eventEmitter } from '../lib/event-emitter'

describe('AIService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should handle streaming responses', async () => {
    const mockPayload = {
      messages: [{ role: 'user', content: 'Hello' }],
      model: 'gpt-3.5-turbo'
    }

    const onTextChunk = jest.fn()
    const streamingOptions = { onTextChunk }

    await AIService.streamChatCompletion(mockPayload, streamingOptions)

    expect(onTextChunk).toHaveBeenCalled()
  })

  it('should emit error events on failure', async () => {
    const errorSpy = jest.fn()
    eventEmitter.on('ai.error', errorSpy)

    // Test error scenario
    await AIService.streamChatCompletion(invalidPayload, options)

    expect(errorSpy).toHaveBeenCalledWith({
      error: expect.stringContaining('Failed')
    })
  })
})
```

### 2. Integration Testing

```typescript
describe('Service Integration', () => {
  it('should coordinate conversation creation flow', async () => {
    // Test full flow from prompt submission to completion
    const conversationId = await ConversationService.submitPrompt({
      prompt: 'Test prompt',
      projectId: 'test-project'
    })

    expect(conversationId).toBeDefined()
    
    // Verify conversation was created
    const conversation = await PersistenceService.loadConversation(conversationId)
    expect(conversation).toBeDefined()
    expect(conversation.projectId).toBe('test-project')
  })
})
```

## Best Practices

### 1. Service Design
- **Single Responsibility**: Each service should handle one domain area
- **Stateless**: Services don't maintain state; they read from stores
- **Event-Driven**: Use events for communication, not direct method calls
- **Error Handling**: Always handle errors gracefully and emit appropriate events

### 2. Method Design
- **Async by Default**: Most service methods should be async
- **Clear Interfaces**: Use TypeScript interfaces for parameters and return types
- **Validation**: Validate inputs and provide clear error messages
- **Documentation**: Document complex business logic and edge cases

### 3. Dependencies
- **Loose Coupling**: Services should depend on interfaces, not implementations
- **Event Coordination**: Use events to coordinate between services
- **Error Isolation**: One service failure shouldn't cascade to others
- **Testing**: Design services to be easily unit testable

### 4. Performance
- **Batch Operations**: Group related operations when possible
- **Caching**: Cache expensive computations appropriately
- **Cancellation**: Support operation cancellation for long-running tasks
- **Resource Management**: Clean up resources properly

This service layer architecture ensures clean separation of concerns, maintainable business logic, and efficient coordination between different parts of the LiteChat application. 