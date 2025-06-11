# AI Integration

LiteChat provides comprehensive AI integration supporting multiple providers, streaming responses, tool execution, and advanced features like reasoning and image generation. The system is designed for extensibility and robust error handling.

## Architecture Overview

### Core Components

- **AIService** ([`src/services/ai.service.ts`](../src/services/ai.service.ts)) - Low-level AI SDK integration
- **InteractionService** ([`src/services/interaction.service.ts`](../src/services/interaction.service.ts)) - High-level conversation management
- **ProviderStore** ([`src/store/provider.store.ts`](../src/store/provider.store.ts)) - Provider and model configuration
- **Provider Helpers** ([`src/lib/litechat/provider-helpers.ts`](../src/lib/litechat/provider-helpers.ts)) - Model instantiation utilities

### AI SDK Integration

LiteChat uses the Vercel AI SDK (`ai` package) for unified provider access:

```typescript
import { streamText, type LanguageModelV1 } from "ai";

// Providers are instantiated through provider-specific factories
const model = openai("gpt-4"); // OpenAI
const model = anthropic("claude-3-opus"); // Anthropic  
const model = google("gemini-pro"); // Google
```

## Supported Providers

### OpenAI
- **Models**: GPT-4, GPT-4 Turbo, GPT-3.5, etc.
- **Features**: Function calling, vision, streaming, reasoning
- **Configuration**: API key, optional base URL override

### Google Gemini
- **Models**: Gemini Pro, Gemini Pro Vision
- **Features**: Function calling, vision, streaming
- **Configuration**: API key
- **Limitations**: CORS restrictions for browser deployment

### Anthropic Claude
- **Models**: Claude 3 Opus, Sonnet, Haiku
- **Features**: Function calling, vision, streaming, reasoning
- **Configuration**: Via OpenAI-compatible provider with Anthropic base URL

### OpenRouter
- **Models**: Access to multiple providers through unified API
- **Features**: Extensive model catalog, usage tracking
- **Configuration**: API key, uses OpenAI-compatible interface

### Local Providers

#### Ollama
- **Models**: Local LLMs (Llama, Mistral, CodeLlama, etc.)
- **Features**: Privacy-focused, offline operation
- **Configuration**: Base URL (typically `http://localhost:11434`), no API key
- **Setup**: Requires CORS configuration (`OLLAMA_ORIGIN='*'`)

#### OpenAI-Compatible APIs
- **Providers**: LMStudio, Text Generation WebUI, KoboldAI, etc.
- **Configuration**: Custom base URL, optional API key
- **Features**: Depends on provider implementation

## Provider Configuration

### Database Schema

```typescript
interface DbProviderConfig {
  id: string;
  type: ProviderType;
  label: string;
  baseUrl?: string;
  enabled: boolean;
  enabledModels: string[];
  globalModelOrder: string[];
  createdAt: Date;
}

interface DbApiKey {
  id: string;
  providerId: string; 
  keyValue: string;
  label?: string;
  createdAt: Date;
}
```

### Provider Types

```typescript
type ProviderType = 
  | "openai"
  | "google" 
  | "openrouter"
  | "ollama"
  | "openai-compatible";
```

### Model Management

Models are fetched from provider APIs where supported and stored with enabled/disabled status:

```typescript
// Fetch models from provider
await providerStore.fetchModels(providerId);

// Enable/disable specific models
await providerStore.updateProviderConfig(providerId, {
  enabledModels: ["gpt-4", "gpt-3.5-turbo"]
});

// Set global model display order
await providerStore.setGlobalModelSortOrder([
  "anthropic/claude-3-opus",
  "openai/gpt-4",
  "openai/gpt-3.5-turbo"
]);
```

## Streaming Architecture

### Stream Processing Flow

1. **Request Initiation**: `InteractionService.startInteraction()` creates interaction record
2. **AI Service Call**: `AIService.executeInteraction()` calls AI SDK with streaming
3. **Stream Processing**: Real-time processing of stream parts
4. **State Updates**: Interaction state updated as chunks arrive
5. **Finalization**: Stream completion triggers final state persistence

### Stream Parts Handling

The AI SDK provides different stream part types:

```typescript
// Text content chunks
case "text-delta":
  callbacks.onChunk(part.textDelta);
  break;

// Reasoning content (for supported models)
case "reasoning":
  callbacks.onReasoningChunk(part.textDelta);
  break;

// Function/tool calls
case "tool-call":
  callbacks.onToolCall(part);
  break;

// Tool execution results
case "tool-result":
  callbacks.onToolResult(part);
  break;

// Multi-step processing
case "step-start":
case "step-finish":
  // Handle multi-step tool execution
  break;

// Stream completion
case "finish":
  callbacks.onFinish({
    finishReason: part.finishReason,
    usage: part.usage,
    reasoning: extractedReasoning
  });
  break;
```

### Buffer Management

Streaming content is buffered in the InteractionStore:

```typescript
interface InteractionState {
  activeStreamBuffers: Record<string, string>;     // Main response content
  activeReasoningBuffers: Record<string, string>;  // Reasoning content
  streamingInteractionIds: string[];               // Active streams
}

// Append content to stream buffer
appendInteractionResponseChunk: (id: string, chunk: string) => void;
appendReasoningChunk: (id: string, chunk: string) => void;
```

## Tool System

### Tool Registration

Tools are registered by Control Modules and available during AI interactions:

```typescript
// Register a tool in a Control Module
modApi.registerTool("file_read", {
  description: "Read contents of a file",
  parameters: z.object({
    path: z.string().describe("File path to read")
  })
}, async ({ path }, context) => {
  // Tool implementation
  const content = await readFile(path);
  return { content };
});
```

### Built-in Tools

#### VFS Tools (`VfsToolsModule`)
- `vfs_read_file` - Read file from Virtual File System
- `vfs_write_file` - Write file to VFS
- `vfs_list_directory` - List directory contents
- `vfs_create_directory` - Create directories
- `vfs_delete_file` - Delete files/directories
- `vfs_move_file` - Move/rename files

#### Git Tools (`GitToolsModule`)  
- `git_status` - Check repository status
- `git_add` - Stage files
- `git_commit` - Create commits
- `git_push` - Push to remote
- `git_pull` - Pull from remote

### Tool Execution

```typescript
// Tools are automatically available during AI interactions
const callOptions: AIServiceCallOptions = {
  model: modelInstance,
  messages: conversationHistory,
  tools: registeredTools,
  toolChoice: "auto", // or "none", "required"
  maxSteps: 5 // Maximum tool execution steps
};
```

### Tool Context

Tools receive execution context with relevant application state:

```typescript
interface ToolContext {
  conversationId: string;
  interactionId: string;
  selectedVfsKey: string;
  currentDirectory: string;
  // Additional context...
}
```

## Advanced Features

### Reasoning Support

For models that support reasoning (o1-preview, o1-mini):

```typescript
// Reasoning is streamed separately and displayed to users
interface Interaction {
  response: string;           // Main response
  metadata: {
    reasoning?: string;       // Extracted reasoning
    // ...
  };
}
```

### Image Generation

Via Image Generation Control Module:

```typescript
// Supports models with image generation capabilities
const imagePrompt = "A detailed architectural diagram";
const result = await generateImage(imagePrompt, {
  size: "1024x1024",
  quality: "standard"
});
```

### Parameter Control

Fine-grained control over AI parameters:

```typescript
interface AIParameters {
  temperature?: number;        // 0.0 - 2.0
  maxTokens?: number;         // Max response length
  topP?: number;              // 0.0 - 1.0
  topK?: number;              // Integer
  presencePenalty?: number;   // -2.0 - 2.0
  frequencyPenalty?: number;  // -2.0 - 2.0
  maxSteps?: number;          // Tool execution steps
}
```

### Web Search Integration

For supported models and providers:

```typescript
// Enable web search for the next interaction
const promptMetadata = {
  webSearchEnabled: true,
  // Other metadata...
};
```

## Error Handling

### Provider Errors

```typescript
// Common provider error scenarios
- Invalid API key
- Rate limiting  
- Model not available
- Network connectivity
- Malformed requests
```

### Stream Interruption

```typescript
// Graceful handling of stream interruption
- User cancellation (AbortController)
- Network disconnection
- Provider timeouts
- Token limit exceeded
```

### Tool Execution Errors

```typescript
// Tool error handling
try {
  const result = await toolImplementation(params, context);
  return { success: true, result };
} catch (error) {
  return { 
    success: false, 
    error: error.message,
    recoverable: true 
  };
}
```

## Performance Considerations

### Model Caching

- Model instances are cached per provider configuration
- Lazy loading of provider libraries
- Connection pooling for HTTP requests

### Streaming Optimization

- Efficient buffer management
- Batched UI updates during streaming
- Memory cleanup on stream completion

### Token Management

- Usage tracking per interaction
- Context window estimation
- Automatic truncation strategies

## Security

### API Key Management

- Keys stored encrypted in IndexedDB
- No server-side key storage
- Per-provider key isolation

### Request Validation

- Parameter validation before API calls
- Sanitization of user inputs
- Protection against prompt injection

### Tool Execution Security

- Sandboxed tool execution
- VFS isolation per project
- No arbitrary code execution

## Development Guide

### Adding New Providers

1. **Extend Provider Types**:
   ```typescript
   // Add to ProviderType union
   type ProviderType = "existing" | "new-provider";
   ```

2. **Create Provider Factory**:
   ```typescript
   // In provider-helpers.ts
   case "new-provider":
     return createCustomProvider(config);
   ```

3. **Add UI Configuration**:
   ```typescript
   // Provider-specific settings form
   ```

### Custom Tool Development

1. **Define Tool Schema**:
   ```typescript
   const toolSchema = z.object({
     param1: z.string(),
     param2: z.number().optional()
   });
   ```

2. **Implement Tool Logic**:
   ```typescript
   const implementation = async (params, context) => {
     // Tool logic here
     return result;
   };
   ```

3. **Register in Module**:
   ```typescript
   modApi.registerTool("tool-name", toolSchema, implementation);
   ```

### Debugging AI Interactions

- Use browser DevTools for network inspection
- Monitor InteractionStore state changes
- Enable debug logging in services
- Check provider-specific error responses

## Configuration Examples

### Development Setup

```typescript
// Local development with Ollama
const config = {
  type: "ollama",
  label: "Local Ollama",
  baseUrl: "http://localhost:11434",
  enabled: true,
  enabledModels: ["llama2", "codellama"]
};
```

### Production Setup

```typescript
// Production with multiple providers
const configs = [
  {
    type: "openai",
    label: "Production OpenAI", 
    enabled: true,
    enabledModels: ["gpt-4", "gpt-3.5-turbo"]
  },
  {
    type: "anthropic",
    label: "Claude Backup",
    baseUrl: "https://api.anthropic.com/v1",
    enabled: true,
    enabledModels: ["claude-3-opus"]
  }
];
``` 