import { streamText, StreamTextResult, tool } from "ai";
import type {
  CoreMessage,
  Tool,
  FinishReason,
  LanguageModelUsage,
  ProviderMetadata,
} from "ai";
import type { DbProviderConfig } from "@/types/litechat/provider";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createOllama } from "ollama-ai-provider";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

// VFS Worker Manager for tool execution
// Import tool modules to initialize them in the worker
import { VfsToolsModule } from "@/controls/modules/VfsToolsModule";
import { GitToolsModule } from "@/controls/modules/GitToolsModule";
import { createModApi } from "@/modding/api-factory";
import type { LiteChatModApi } from "@/types/litechat/modding";

// TOOL REGISTRY SYSTEM FOR THE WORKER
const workerToolRegistry = new Map<string, Tool<any, any>>();
let workerModApi: LiteChatModApi | null = null;
let toolModulesInitialized = false;

// Initialize tool modules in the worker
const initializeToolModules = async (vfsKey: string) => {
  if (toolModulesInitialized) return;
  
  console.log('[AIWorker] Initializing tool modules in worker...');
  
  // Create a mod API for the worker context
  workerModApi = createModApi({
    id: "ai-worker-tools",
    name: "AI Worker Tools",
    sourceUrl: null,
    scriptContent: null,
    enabled: true,
    loadOrder: -1000,
    createdAt: new Date(),
  });

  // Override registerTool to add tools to worker registry
  workerModApi.registerTool = (name: string, toolDef: any, executor?: Function) => {
    console.log(`[AIWorker] Registering tool in worker: ${name}`);
    
    // Create AI SDK compatible tool
    const aiTool = tool({
      description: toolDef.description,
      parameters: toolDef.parameters,
      execute: async (args: any) => {
        if (executor) {
          // Create context with VFS operations routed to VFS worker
          const context = {
            vfsKey
          };
          return executor(args, context);
        }
        throw new Error(`No executor for tool: ${name}`);
      }
    });
    
    workerToolRegistry.set(name, aiTool);
    return () => workerToolRegistry.delete(name);
  };

  // Initialize modules
  const vfsModule = new VfsToolsModule();
  const gitModule = new GitToolsModule();
  
  await vfsModule.initialize(workerModApi);
  await gitModule.initialize(workerModApi);
  
  vfsModule.register(workerModApi);
  gitModule.register(workerModApi);
  
  toolModulesInitialized = true;
  console.log(`[AIWorker] Tool modules initialized. Registered tools:`, Array.from(workerToolRegistry.keys()));
};

// Get all registered tools as object for AI SDK
const getRegisteredTools = (): Record<string, Tool<any, any>> => {
  const tools: Record<string, Tool<any, any>> = {};
  for (const [name, tool] of workerToolRegistry) {
    tools[name] = tool;
  }
  return tools;
};

export interface AIWorkerCallOptions {
  modelConfig: {
    providerConfig: DbProviderConfig;
    modelId: string;
    apiKey?: string;
  };
  messages: CoreMessage[];
  system?: string;
  enableTools?: boolean; // Flag to enable tool modules (don't send actual functions)
  toolChoice?:
    | "auto"
    | "none"
    | "required"
    | { type: "tool"; toolName: string };
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
  maxSteps?: number;
  providerOptions?: Record<string, any>;
  streamingRenderFPS?: number;
  vfsKey?: string;
}

export interface AIWorkerMessage {
  type: 'start' | 'abort' | 'settings-update';
  id: string;
  payload?: any;
}

export interface AIWorkerResponse {
  type: 'chunk' | 'reasoning-chunk' | 'tool-call' | 'tool-result' | 'finish' | 'error' | 'aborted';
  id: string;
  payload?: any;
}

interface StreamState {
  abortController: AbortController;
  streamResult?: StreamTextResult<any, any>;
  lastChunkTime: number;
  streamingFPS: number;
  pendingChunks: string[];
  pendingReasoningChunks: string[];
  chunkTimer?: number;
}

class AIWorkerService {
  private activeStreams = new Map<string, StreamState>();

  async executeInteraction(
    interactionId: string,
    options: AIWorkerCallOptions
  ): Promise<void> {
    const abortController = new AbortController();
    const streamingFPS = options.streamingRenderFPS || 15;
    const chunkInterval = 1000 / streamingFPS;
    
    const streamState: StreamState = {
      abortController,
      lastChunkTime: 0,
      streamingFPS,
      pendingChunks: [] as string[],
      pendingReasoningChunks: [] as string[],
    };
    
    this.activeStreams.set(interactionId, streamState);

    // Set up chunk batching timer
    const flushChunks = () => {
      const now = Date.now();
      if (now - streamState.lastChunkTime >= chunkInterval) {
        if (streamState.pendingChunks.length > 0) {
          const combinedChunk = streamState.pendingChunks.join('');
          streamState.pendingChunks = [];
          this.postMessage({
            type: 'chunk',
            id: interactionId,
            payload: { chunk: combinedChunk }
          });
        }
        if (streamState.pendingReasoningChunks.length > 0) {
          const combinedReasoning = streamState.pendingReasoningChunks.join('');
          streamState.pendingReasoningChunks = [];
          this.postMessage({
            type: 'reasoning-chunk',
            id: interactionId,
            payload: { chunk: combinedReasoning }
          });
        }
        streamState.lastChunkTime = now;
      }
      
      if (this.activeStreams.has(interactionId)) {
        streamState.chunkTimer = setTimeout(flushChunks, chunkInterval / 4) as any;
      }
    };

    streamState.chunkTimer = setTimeout(flushChunks, chunkInterval / 4) as any;

    try {
      // Recreate the model instance from the configuration
      const { modelConfig, ...restOptions } = options;
      const model = createModelInstance(
        modelConfig.providerConfig,
        modelConfig.modelId,
        modelConfig.apiKey
      );

      if (!model) {
        throw new Error(`Failed to instantiate model ${modelConfig.modelId}`);
      }

      let streamOptions: any = {
        ...restOptions,
        model,
        abortSignal: abortController.signal
      };

      // Only add tools if they were explicitly enabled
      if (options.enableTools) {
        // Initialize tool modules in the worker
        await initializeToolModules(options.vfsKey || 'orphan');
        // Get the registered tools
        const registeredTools = getRegisteredTools();
        console.log(`[AIWorker] Tools available to model:`, Object.keys(registeredTools));
        streamOptions.tools = registeredTools;
      }

      const streamResult = await streamText(streamOptions);
      streamState.streamResult = streamResult;

      let receivedFinishPart = false;
      let finalFinishReason: FinishReason | null = null;
      let finalUsage: LanguageModelUsage | undefined;
      let finalProviderMetadata: ProviderMetadata | undefined;
      let finalReasoning: string | undefined;

      for await (const part of streamResult.fullStream) {
        if (abortController.signal.aborted) {
          console.log(`[AIWorker] Stream ${interactionId} aborted by signal.`);
          break;
        }

        switch (part.type) {
          case "text-delta":
            streamState.pendingChunks.push(part.textDelta);
            break;
          case "reasoning":
            streamState.pendingReasoningChunks.push(part.textDelta);
            break;
          case "tool-call":
            this.postMessage({
              type: 'tool-call',
              id: interactionId,
              payload: part
            });
            break;
          case "finish":
            receivedFinishPart = true;
            finalFinishReason = part.finishReason;
            finalUsage = part.usage;
            finalProviderMetadata = part.providerMetadata;
            break;
          case "error":
            this.postMessage({
              type: 'error',
              id: interactionId,
              payload: { 
                error: part.error instanceof Error ? part.error.message : part.error 
              }
            });
            return;
          default:
            // Handle tool-result and other part types dynamically
            if ((part as any).type === "tool-result") {
              this.postMessage({
                type: 'tool-result',
                id: interactionId,
                payload: part
              });
            } else if ((part as any).type === "step-start") {
              // New AI SDK streaming event - tool execution step started
              console.log(`[AIWorker] Tool execution step started for ${interactionId}`);
            } else if ((part as any).type === "step-finish") {
              // New AI SDK streaming event - tool execution step finished
              console.log(`[AIWorker] Tool execution step finished for ${interactionId}`);
            } else {
              console.warn(
                `[AIWorker] Received unexpected stream part type: ${(part as any).type}`,
                part
              );
            }
            break;
        }
      }

      // Flush any remaining chunks
      if (streamState.pendingChunks.length > 0) {
        const combinedChunk = streamState.pendingChunks.join('');
        this.postMessage({
          type: 'chunk',
          id: interactionId,
          payload: { chunk: combinedChunk }
        });
      }
      if (streamState.pendingReasoningChunks.length > 0) {
        const combinedReasoning = streamState.pendingReasoningChunks.join('');
        this.postMessage({
          type: 'reasoning-chunk',
          id: interactionId,
          payload: { chunk: combinedReasoning }
        });
      }

      // Extract final reasoning
      if (streamResult?.reasoning) {
        finalReasoning = await streamResult.reasoning;
      }

      // Send finish event
      if (!abortController.signal.aborted && receivedFinishPart) {
        this.postMessage({
          type: 'finish',
          id: interactionId,
          payload: {
            finishReason: finalFinishReason!,
            usage: finalUsage,
            providerMetadata: finalProviderMetadata,
            reasoning: finalReasoning,
          }
        });
      } else if (!abortController.signal.aborted && !receivedFinishPart) {
        this.postMessage({
          type: 'error',
          id: interactionId,
          payload: { 
            error: "Stream ended unexpectedly without a finish signal." 
          }
        });
      }

    } catch (error: unknown) {
      console.error(`[AIWorker] Error during streamText call for ${interactionId}:`, error);
      if (!(error instanceof Error && error.name === "AbortError")) {
        this.postMessage({
          type: 'error',
          id: interactionId,
          payload: { 
            error: error instanceof Error ? error.message : String(error) 
          }
        });
      }
    } finally {
      this.cleanup(interactionId);
    }
  }

  abortInteraction(interactionId: string): void {
    const streamState = this.activeStreams.get(interactionId);
    if (streamState) {
      streamState.abortController.abort();
      this.cleanup(interactionId);
      this.postMessage({
        type: 'aborted',
        id: interactionId,
        payload: {}
      });
    }
  }

  updateStreamingFPS(interactionId: string, fps: number): void {
    const streamState = this.activeStreams.get(interactionId);
    if (streamState) {
      streamState.streamingFPS = fps;
    }
  }

  private cleanup(interactionId: string): void {
    const streamState = this.activeStreams.get(interactionId);
    if (streamState?.chunkTimer) {
      clearTimeout(streamState.chunkTimer);
    }
    this.activeStreams.delete(interactionId);
  }

  private postMessage(message: AIWorkerResponse): void {
    self.postMessage(message);
  }
}

const aiWorkerService = new AIWorkerService();

self.onmessage = async (event: MessageEvent<AIWorkerMessage>) => {
  const { type, id, payload } = event.data;

  switch (type) {
    case 'start':
      await aiWorkerService.executeInteraction(id, payload);
      break;
    case 'abort':
      aiWorkerService.abortInteraction(id);
      break;
    case 'settings-update':
      if (payload.streamingRenderFPS !== undefined) {
        aiWorkerService.updateStreamingFPS(id, payload.streamingRenderFPS);
      }
      break;
    default:
      console.warn(`[AIWorker] Unknown message type: ${type}`);
  }
};

// Local function to instantiate model in worker context
function createModelInstance(
  config: DbProviderConfig,
  modelId: string,
  apiKey?: string,
): any | null {
  try {
    switch (config.type) {
      case "openai":
        return createOpenAI({ apiKey })(modelId);
      case "google":
        return createGoogleGenerativeAI({ apiKey })(modelId);
      case "openrouter":
        return createOpenRouter({
          apiKey,
          extraBody: { include_reasoning: true },
        })(modelId);
      case "ollama":
        return createOllama({ baseURL: config.baseURL ?? undefined })(modelId);
      case "openai-compatible":
        if (!config.baseURL) throw new Error("Base URL required");
        const trimmed = config.baseURL.replace(/\/+$/, "");
        const baseURL = /\/(v\d+(\.\d+)*)$/.test(trimmed) ? trimmed : trimmed + "/v1";
        return createOpenAICompatible({
          baseURL,
          apiKey,
          name: config.name || "Custom API",
        })(modelId);
      default:
        console.warn(`Unsupported provider type: ${config.type}`);
        return null;
    }
  } catch (e) {
    console.error(`Failed instantiate model ${modelId} for ${config.name}:`, e);
    return null;
  }
} 