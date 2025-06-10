import type { LanguageModelV1, Tool } from "ai";
import type { 
  AIWorkerMessage, 
  AIWorkerResponse, 
} from "@/workers/ai.worker";
import type { AIServiceCallbacks } from "@/services/ai.service";
// nanoid removed - not used

export class AIWorkerManager {
  private static instance: AIWorkerManager;
  private worker: Worker | null = null;
  private pendingCallbacks = new Map<string, AIServiceCallbacks>();
  private initialized = false;

  private constructor() {}

  static getInstance(): AIWorkerManager {
    if (!AIWorkerManager.instance) {
      AIWorkerManager.instance = new AIWorkerManager();
    }
    return AIWorkerManager.instance;
  }

  private async initializeWorker(): Promise<void> {
    if (this.initialized && this.worker) return;

    try {
      // Import worker as URL for Vite
      const workerUrl = new URL('../workers/ai.worker.ts', import.meta.url);
      this.worker = new Worker(workerUrl, { type: 'module' });
      
      this.worker.onmessage = (event: MessageEvent<AIWorkerResponse>) => {
        this.handleWorkerMessage(event.data);
      };

      this.worker.onerror = (error) => {
        console.error('[AIWorkerManager] Worker error:', error);
      };

      this.initialized = true;
      console.log('[AIWorkerManager] AI Worker initialized');
    } catch (error) {
      console.error('[AIWorkerManager] Failed to initialize worker:', error);
      throw error;
    }
  }

  private handleWorkerMessage(response: AIWorkerResponse): void {
    const { type, id, payload } = response;
    const callbacks = this.pendingCallbacks.get(id);

    if (!callbacks) {
      console.warn(`[AIWorkerManager] No callbacks found for interaction ${id}`);
      return;
    }

    switch (type) {
      case 'chunk':
        callbacks.onChunk(payload.chunk);
        break;
      case 'reasoning-chunk':
        callbacks.onReasoningChunk(payload.chunk);
        break;
      case 'tool-call':
        callbacks.onToolCall(payload);
        break;
      case 'tool-result':
        callbacks.onToolResult(payload);
        break;
      case 'finish':
        callbacks.onFinish(payload);
        this.pendingCallbacks.delete(id);
        break;
      case 'error':
        console.error(`[AIWorkerManager] Worker error for ${id}:`, payload.error);
        callbacks.onError(new Error(payload.error));
        this.pendingCallbacks.delete(id);
        break;
      case 'aborted':
        // Don't call error callback for aborted interactions
        this.pendingCallbacks.delete(id);
        break;
      default:
        console.warn(`[AIWorkerManager] Unknown response type: ${type}`);
    }
  }

  async executeInteraction(
    interactionId: string,
    options: {
      model: LanguageModelV1;
      messages: any[];
      system?: string;
      toolChoice?: any;
      temperature?: number;
      maxTokens?: number;
      topP?: number;
      topK?: number;
      presencePenalty?: number;
      frequencyPenalty?: number;
      maxSteps?: number;
      providerOptions?: Record<string, any>;
      tools?: Record<string, Tool<any>>;
      streamingRenderFPS?: number;
    },
    callbacks: AIServiceCallbacks
  ): Promise<void> {
    await this.initializeWorker();
    
    if (!this.worker) {
      throw new Error('Failed to initialize AI worker');
    }

    // Store callbacks for this interaction
    this.pendingCallbacks.set(interactionId, callbacks);

    // Extract model configuration data instead of sending the model instance
    const { model, tools, ...restOptions } = options;
    
    // Get the model configuration from the provider store
    const providerStore = await import('@/store/provider.store');
    const selectedModelConfig = providerStore.useProviderStore.getState().getSelectedModel();
    
    if (!selectedModelConfig) {
      throw new Error('No model selected');
    }

    // Get provider configuration
    const providerConfigs = providerStore.useProviderStore.getState().dbProviderConfigs;
    const providerConfig = providerConfigs.find(c => c.id === selectedModelConfig.providerId);
    
    if (!providerConfig) {
      throw new Error('Provider configuration not found');
    }

    // Extract model ID from combined ID
    const modelIdParts = selectedModelConfig.id.split(':');
    if (modelIdParts.length < 2) {
      throw new Error('Invalid model ID format');
    }
    const modelId = modelIdParts.slice(1).join(':');

    // Get current VFS key
    const vfsStore = await import('@/store/vfs.store');
    const currentVfsKey = vfsStore.useVfsStore.getState().vfsKey;

    // Send start message to worker with serializable data
    const message: AIWorkerMessage = {
      type: 'start',
      id: interactionId,
      payload: {
        ...restOptions,
        // Pass flag to tell worker to initialize tool modules (don't send actual functions)
        enableTools: tools && Object.keys(tools).length > 0,
        modelConfig: {
          providerConfig,
          modelId,
          apiKey: providerStore.useProviderStore.getState().getApiKeyForProvider(selectedModelConfig.providerId) || undefined
        },
        streamingRenderFPS: options.streamingRenderFPS || 15,
        vfsKey: currentVfsKey || "orphan"
      }
    };

    this.worker.postMessage(message);
  }

  abortInteraction(interactionId: string): void {
    if (!this.worker) return;

    const message: AIWorkerMessage = {
      type: 'abort',
      id: interactionId
    };

    this.worker.postMessage(message);
    this.pendingCallbacks.delete(interactionId);
  }

  updateStreamingFPS(interactionId: string, fps: number): void {
    if (!this.worker) return;

    const message: AIWorkerMessage = {
      type: 'settings-update',
      id: interactionId,
      payload: { streamingRenderFPS: fps }
    };

    this.worker.postMessage(message);
  }

  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.initialized = false;
      this.pendingCallbacks.clear();
    }
  }
} 