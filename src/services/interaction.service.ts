// src/services/interaction.service.ts
// FULL FILE
import type { PromptObject, PromptTurnObject } from "@/types/litechat/prompt";
import type {
  Interaction,
  InteractionStatus,
  InteractionType,
} from "@/types/litechat/interaction";
import { AIService, AIServiceCallbacks } from "./ai.service";
import { useInteractionStore } from "@/store/interaction.store";
import { useControlRegistryStore } from "@/store/control.store";
import { useProviderStore } from "@/store/provider.store";
import { useConversationStore } from "@/store/conversation.store";
import { useVfsStore } from "@/store/vfs.store";
import { useSettingsStore } from "@/store/settings.store";
import { usePromptStateStore } from "@/store/prompt.store";
import { PersistenceService } from "./persistence.service";
import { runMiddleware, getContextSnapshot } from "@/lib/litechat/ai-helpers";
import {
  splitModelId,
  instantiateModelInstance,
} from "@/lib/litechat/provider-helpers";
import { emitter } from "@/lib/litechat/event-emitter";
import { nanoid } from "nanoid";
import { toast } from "sonner";
import { z } from "zod";
import {
  type ToolImplementation,
  ModMiddlewareHook,
  type ReadonlyChatContextSnapshot,
} from "@/types/litechat/modding";
import { interactionEvent } from "@/types/litechat/events/interaction.events";
import {
  type Tool,
  type ToolCallPart,
  type ToolResultPart,
  type FinishReason,
  type LanguageModelUsage,
  type ProviderMetadata,
  type LanguageModelV1,
  type CoreMessage,
} from "ai";
import type { fs } from "@zenfs/core";
import { conversationEvent } from "@/types/litechat/events/conversation.events";
import { vfsEvent } from "@/types/litechat/events/vfs.events";
import { canvasEvent,} from "@/types/litechat/events/canvas.events";
import { providerEvent } from "@/types/litechat/events/provider.events";
import { ConversationService } from "@/services/conversation.service";

interface AIServiceCallOptions {
  model: LanguageModelV1;
  messages: CoreMessage[];
  abortSignal: AbortSignal;
  system?: string;
  tools?: Record<string, Tool<any>>;
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
}

type ToolContext = ReadonlyChatContextSnapshot & {
  fsInstance?: typeof fs;
};

export const InteractionService = {
  _activeControllers: new Map<string, AbortController>(),
  _streamingToolData: new Map<string, { calls: string[]; results: string[] }>(),
  _firstChunkTimestamps: new Map<string, number>(),
  _interactionStartTimes: new Map<string, number>(),
  _pendingRegenerations: new Set<string>(),

  initializeCanvasEventHandlers(): void {
    emitter.on(
      canvasEvent.copyInteractionResponseRequest,
      async (payload) => {
        const { interactionId } = payload;
        const interaction = useInteractionStore
          .getState()
          .interactions.find((i) => i.id === interactionId);

        if (!interaction) {
          toast.error(`Copy failed: Interaction ${interactionId} not found.`);
          console.warn(
            `[InteractionService] Copy request for unknown interaction ${interactionId}`
          );
          return;
        }

        const contentToCopy = interaction.response ?? "";
        if (typeof contentToCopy !== "string" || contentToCopy.trim() === "") {
          toast.info("No response content to copy.");
          return;
        }

        try {
          await navigator.clipboard.writeText(contentToCopy);
          toast.success("Response copied!");
          // Optionally emit another event for UI update if needed, e.g., canvasEvent.interactionResponseCopied
        } catch (err) {
          toast.error("Failed to copy response.");
          console.error("[InteractionService] Error copying response:", err);
        }
      }
    );

    emitter.on(
      canvasEvent.regenerateInteractionRequest,
      async (payload) => {
        const { interactionId } = payload;
        console.log(`[InteractionService] Received regenerateInteractionRequest for ${interactionId}`);

        if (this._pendingRegenerations.has(interactionId)) {
          console.warn(`[InteractionService] Regeneration already pending for ${interactionId}. Ignoring request.`);
          return;
        }

        const interaction = useInteractionStore
          .getState()
          .interactions.find((i) => i.id === interactionId);

        if (!interaction) {
          toast.error(
            `Regeneration failed: Interaction ${interactionId} not found.`
          );
          console.warn(
            `[InteractionService] Regeneration request for unknown interaction ${interactionId}`
          );
          return;
        }

        // Add safety checks: is it the last one? Is global streaming off?
        // The module should ideally enforce this via `disabled` state,
        // but double-checking here can be good.
        const interactionStoreState = useInteractionStore.getState();
        const globalStreamingStatus = interactionStoreState.status;
        if (globalStreamingStatus === "streaming") {
          toast.info("Cannot regenerate while another response is streaming.");
          return;
        }

        // Check if it's the last interaction on the main spine
        const conversationInteractions = interactionStoreState.interactions.filter(
          (i) => i.conversationId === interaction.conversationId && 
                 i.parentId === null && // Only main spine interactions
                 (i.type === "message.user_assistant" || i.type === "message.assistant_regen")
        ).sort((a, b) => a.index - b.index);
        
        const lastInteractionOnSpine = conversationInteractions.length > 0 
          ? conversationInteractions[conversationInteractions.length - 1] 
          : null;

        if (lastInteractionOnSpine?.id !== interactionId) {
          toast.info("Can only regenerate the last response in the conversation.");
          return;
        }

        try {
          this._pendingRegenerations.add(interactionId);
          // console.log(`[InteractionService] Starting ConversationService.regenerateInteraction for ${interactionId}`);
          await ConversationService.regenerateInteraction(interactionId);
          // console.log(`[InteractionService] Finished ConversationService.regenerateInteraction for ${interactionId}`);
          // Feedback for starting regeneration might be good, or handled by UI changes
        } catch (error) {
          toast.error(`Failed to regenerate response: ${String(error)}`);
          console.error(
            `[InteractionService] Error regenerating interaction ${interactionId}:`,
            error
          );
        } finally {
          this._pendingRegenerations.delete(interactionId);
        }
      }
    );

    emitter.on(
      canvasEvent.regenerateInteractionWithModelRequest,
      async (payload) => {
        const { interactionId, modelId } = payload;
        // console.log(`[InteractionService] Received regenerateInteractionWithModelRequest for ${interactionId} with model ${modelId}`);

        if (this._pendingRegenerations.has(interactionId)) {
          console.warn(`[InteractionService] Regeneration already pending for ${interactionId}. Ignoring request.`);
          return;
        }

        const interaction = useInteractionStore
          .getState()
          .interactions.find((i) => i.id === interactionId);

        if (!interaction) {
          toast.error(
            `Regeneration failed: Interaction ${interactionId} not found.`
          );
          console.warn(
            `[InteractionService] Regeneration request for unknown interaction ${interactionId}`
          );
          return;
        }

        // Add safety checks: is it the last one? Is global streaming off?
        const interactionStoreState = useInteractionStore.getState();
        const globalStreamingStatus = interactionStoreState.status;
        if (globalStreamingStatus === "streaming") {
          toast.info("Cannot regenerate while another response is streaming.");
          return;
        }

        // Check if it's the last interaction on the main spine
        const conversationInteractions = interactionStoreState.interactions.filter(
          (i) => i.conversationId === interaction.conversationId && 
                 i.parentId === null && // Only main spine interactions
                 (i.type === "message.user_assistant" || i.type === "message.assistant_regen")
        ).sort((a, b) => a.index - b.index);
        
        const lastInteractionOnSpine = conversationInteractions.length > 0 
          ? conversationInteractions[conversationInteractions.length - 1] 
          : null;

        if (lastInteractionOnSpine?.id !== interactionId) {
          toast.info("Can only regenerate the last response in the conversation.");
          return;
        }

        try {
          this._pendingRegenerations.add(interactionId);
          
          // Store the current model ID to restore later
          const promptState = usePromptStateStore.getState();
          const originalModelId = promptState.modelId;
          
          console.log(`[InteractionService] Temporarily setting model to ${modelId} for regeneration`);
          
          // Temporarily set the selected model for regeneration
          promptState.setModelId(modelId);
          
          try {
            // console.log(`[InteractionService] Starting ConversationService.regenerateInteraction for ${interactionId} with model ${modelId}`);
            await ConversationService.regenerateInteraction(interactionId);
            // console.log(`[InteractionService] Finished ConversationService.regenerateInteraction for ${interactionId}`);
          } finally {
            // Always restore the original model ID, whether success or failure
            console.log(`[InteractionService] Restoring original model ${originalModelId}`);
            promptState.setModelId(originalModelId);
          }
          
        } catch (error) {
          toast.error(`Failed to regenerate response: ${String(error)}`);
          console.error(
            `[InteractionService] Error regenerating interaction ${interactionId}:`,
            error
          );
        } finally {
          this._pendingRegenerations.delete(interactionId);
        }
      }
    );

    emitter.on(
      canvasEvent.raceInteractionRequest,
      async (payload) => {
        const { interactionId, modelIds, staggerMs } = payload;
        // console.log(`[InteractionService] Received raceInteractionRequest for ${interactionId} with ${modelIds.length} models`);

        const interaction = useInteractionStore
          .getState()
          .interactions.find((i) => i.id === interactionId);

        if (!interaction) {
          toast.error(
            `Race failed: Interaction ${interactionId} not found.`
          );
          console.warn(
            `[InteractionService] Race request for unknown interaction ${interactionId}`
          );
          return;
        }

        // Add safety checks
        const interactionStoreState = useInteractionStore.getState();
        const globalStreamingStatus = interactionStoreState.status;
        if (globalStreamingStatus === "streaming") {
          toast.info("Cannot start race while another response is streaming.");
          return;
        }

        // Check if it's the last interaction on the main spine
        const conversationInteractions = interactionStoreState.interactions.filter(
          (i) => i.conversationId === interaction.conversationId && 
                 i.parentId === null && // Only main spine interactions
                 (i.type === "message.user_assistant" || i.type === "message.assistant_regen")
        ).sort((a, b) => a.index - b.index);
        
        const lastInteractionOnSpine = conversationInteractions.length > 0 
          ? conversationInteractions[conversationInteractions.length - 1] 
          : null;

        if (lastInteractionOnSpine?.id !== interactionId) {
          toast.info("Can only race from the last response in the conversation.");
          return;
        }

        if (modelIds.length < 2) {
          toast.error("Need at least 2 models to race");
          return;
        }

        try {
          // Store the current model ID to restore later
          const promptState = usePromptStateStore.getState();
          const originalModelId = promptState.modelId;
          
          console.log(`[InteractionService] Starting race with ${modelIds.length} models`);
          toast.info(`Starting race with ${modelIds.length} models...`);

          // Create multiple regenerations with staggered timing
          const racePromises = modelIds.map((modelId: string, index: number) => {
            return new Promise((resolve) => {
              setTimeout(async () => {
                try {
                  // Set the model for this specific race
                  promptState.setModelId(modelId);
                  
                  // console.log(`[InteractionService] Starting race participant ${index + 1}/${modelIds.length} with model ${modelId}`);
                  await ConversationService.regenerateInteraction(interactionId);
                  // console.log(`[InteractionService] Race participant ${index + 1} finished`);
                  resolve({ success: true, modelId, index });
                } catch (error) {
                  console.error(`[InteractionService] Race participant ${index + 1} failed:`, error);
                  resolve({ success: false, modelId, index, error });
                }
              }, index * staggerMs);
            });
          });

          // Wait for all race participants to complete
          const results = await Promise.all(racePromises);
          
          // Restore original model
          promptState.setModelId(originalModelId);
          
          const successCount = results.filter(r => (r as any).success).length;
          const failCount = results.length - successCount;
          
          if (successCount > 0) {
            toast.success(`Race completed! ${successCount} models responded${failCount > 0 ? `, ${failCount} failed` : ''}`);
          } else {
            toast.error(`Race failed: All ${modelIds.length} models failed to respond`);
          }
          
        } catch (error) {
          toast.error(`Race failed: ${String(error)}`);
          console.error(`[InteractionService] Error during race:`, error);
        }
      }
    );

    emitter.on(
      canvasEvent.forkConversationRequest,
      async (payload) => {
        const { interactionId } = payload;
        console.log(`[InteractionService] Received forkConversationRequest for ${interactionId}`);

        const interaction = useInteractionStore
          .getState()
          .interactions.find((i) => i.id === interactionId);

        if (!interaction) {
          toast.error(
            `Fork failed: Interaction ${interactionId} not found.`
          );
          console.warn(
            `[InteractionService] Fork request for unknown interaction ${interactionId}`
          );
          return;
        }

        // Add safety checks: is global streaming off?
        const interactionStoreState = useInteractionStore.getState();
        const globalStreamingStatus = interactionStoreState.status;
        if (globalStreamingStatus === "streaming") {
          toast.info("Cannot fork while another response is streaming.");
          return;
        }

        try {
          await ConversationService.forkConversation(interactionId);
        } catch (error) {
          toast.error(`Failed to fork conversation: ${String(error)}`);
          console.error(
            `[InteractionService] Error forking conversation ${interactionId}:`,
            error
          );
        }
      }
    );

    emitter.on(
      canvasEvent.forkConversationWithModelRequest,
      async (payload) => {
        const { interactionId, modelId } = payload;
        console.log(`[InteractionService] Received forkConversationWithModelRequest for ${interactionId} with model ${modelId}`);

        const interaction = useInteractionStore
          .getState()
          .interactions.find((i) => i.id === interactionId);

        if (!interaction) {
          toast.error(
            `Fork failed: Interaction ${interactionId} not found.`
          );
          console.warn(
            `[InteractionService] Fork request for unknown interaction ${interactionId}`
          );
          return;
        }

        // Add safety checks: is global streaming off?
        const interactionStoreState = useInteractionStore.getState();
        const globalStreamingStatus = interactionStoreState.status;
        if (globalStreamingStatus === "streaming") {
          toast.info("Cannot fork while another response is streaming.");
          return;
        }

        try {
          console.log(`[InteractionService] Creating fork conversation first, then setting model to ${modelId}`);
          
          // First, create the conversation
          await ConversationService.forkConversation(interactionId);
          
          // Wait for the conversation creation to take effect
          await new Promise(resolve => requestAnimationFrame(resolve));
          
          // Now set the model for the new conversation
          console.log(`[InteractionService] Setting global model to ${modelId} for the new forked conversation`);
          emitter.emit(providerEvent.selectModelRequest, { modelId });
          
        } catch (error) {
          toast.error(`Failed to fork conversation: ${String(error)}`);
          console.error(
            `[InteractionService] Error forking conversation ${interactionId}:`,
            error
          );
        }
      }
    );

    emitter.on(
      canvasEvent.forkConversationCompactRequest,
      async (payload) => {
        const { interactionId, modelId } = payload;
        console.log(`[InteractionService] Received forkConversationCompactRequest for ${interactionId} with model ${modelId}`);

        const interaction = useInteractionStore
          .getState()
          .interactions.find((i) => i.id === interactionId);

        if (!interaction) {
          toast.error(
            `Fork compact failed: Interaction ${interactionId} not found.`
          );
          console.warn(
            `[InteractionService] Fork compact request for unknown interaction ${interactionId}`
          );
          return;
        }

        // Add safety checks: is global streaming off?
        const interactionStoreState = useInteractionStore.getState();
        const globalStreamingStatus = interactionStoreState.status;
        if (globalStreamingStatus === "streaming") {
          toast.info("Cannot fork compact while another response is streaming.");
          return;
        }

        try {
          console.log(`[InteractionService] Creating compact fork conversation with model ${modelId}`);
          
          // Create the compact fork conversation
          await ConversationService.forkConversationCompact(interactionId, modelId);
          
        } catch (error) {
          toast.error(`Failed to fork and compact conversation: ${String(error)}`);
          console.error(
            `[InteractionService] Error forking and compacting conversation ${interactionId}:`,
            error
          );
        }
      }
    );

    // Handler for copyCodeBlockRequest
    emitter.on(
      canvasEvent.copyCodeBlockRequest,
      async (payload) => {
        const { content, interactionId, codeBlockId, language } = payload;
        if (!content || content.trim() === "") {
          toast.info("No code to copy.");
          return;
        }
        try {
          await navigator.clipboard.writeText(content);
          toast.success(`Code block ${language ? `(${language}) ` : ''}copied!`);
          console.log(
            `[InteractionService] Code block copied. InteractionID: ${interactionId}, CodeBlockID: ${codeBlockId}, Language: ${language}`
          );
          // Optionally emit canvasEvent.codeBlockCopied if specific UI feedback is needed beyond toast
        } catch (err) {
          toast.error("Failed to copy code block.");
          console.error("[InteractionService] Error copying code block:", err);
        }
      }
    );

    // TODO: Add listeners for other canvas events like regenerate, rate, etc.
    // emitter.on(canvasEvent.regenerateInteractionRequest, async (payload) => { ... });
    // emitter.on(canvasEvent.rateInteractionRequest, async (payload) => { ... });
  },

  async startInteraction(
    prompt: PromptObject,
    conversationId: string,
    initiatingTurnData: PromptTurnObject,
    interactionType: InteractionType = "message.user_assistant"
  ): Promise<Interaction | null> {
    console.log(
      `[InteractionService] startInteraction called (Type: ${interactionType})`,
      prompt,
      conversationId,
      initiatingTurnData
    );

    const startMiddlewareResult = await runMiddleware(
      ModMiddlewareHook.INTERACTION_BEFORE_START,
      { prompt, conversationId }
    );
    if (startMiddlewareResult === false) {
      console.log(
        "[InteractionService] Interaction start cancelled by middleware."
      );
      return null;
    }
    const finalPrompt =
      startMiddlewareResult && typeof startMiddlewareResult === "object"
        ? (startMiddlewareResult as { prompt: PromptObject }).prompt
        : prompt;

    // Use the provided interaction ID from turnData if available, otherwise generate a new one
    const interactionId = initiatingTurnData.id || nanoid();
    const abortController = new AbortController();
    this._activeControllers.set(interactionId, abortController);
    this._streamingToolData.set(interactionId, { calls: [], results: [] });
    this._firstChunkTimestamps.delete(interactionId);
    this._interactionStartTimes.delete(interactionId);

    const interactionStoreState = useInteractionStore.getState();
    const currentInteractions = interactionStoreState.interactions;
    const conversationInteractions = currentInteractions.filter(
      (i) => i.conversationId === conversationId
    );
    const newIndex =
      interactionType === "conversation.title_generation" || interactionType === "conversation.compact"
        ? -1
        : conversationInteractions.reduce(
            (max, i) => Math.max(max, i.index),
            -1
          ) + 1;
    
    // Default parentId for new interactions on the main spine should be null.
    // It will only be set if this interaction is explicitly a child (e.g. during regeneration updates)
    const defaultParentId = null; 

    const startTime = performance.now();
    this._interactionStartTimes.set(interactionId, startTime);

    const interaction: Interaction = {
      id: interactionId,
      conversationId: conversationId,
      startedAt: new Date(),
      endedAt: null,
      type: interactionType,
      status: "STREAMING",
      prompt: { ...initiatingTurnData }, // Create a copy to avoid reference mutations
      response: null, // Keep as null for proper API contract
      index: newIndex,
      parentId: defaultParentId,
      metadata: {
        ...(initiatingTurnData.metadata || {}),
        ...(finalPrompt.metadata || {}),
        toolCalls: [],
        toolResults: [],
        reasoning: undefined,
      },
    };

    if (interactionType !== "conversation.title_generation" && interactionType !== "conversation.compact") {
      interactionStoreState._addInteractionToState(interaction);
      interactionStoreState._addStreamingId(interactionId);
    } else {
      interactionStoreState._addInteractionToState(interaction);
      interactionStoreState._addStreamingId(interactionId);
      console.log(
        `[InteractionService] Added ${interactionType} interaction ${interactionId} to state.`
      );
    }
    PersistenceService.saveInteraction({ ...interaction }).catch((e) => {
      console.error(
        `[InteractionService] Failed initial persistence for ${interactionId}`,
        e
      );
    });

    emitter.emit(interactionEvent.started, {
      interactionId,
      conversationId,
      type: interaction.type,
    });

    const targetModelId = finalPrompt.metadata?.modelId;
    if (!targetModelId) {
      await this._finalizeInteraction(
        interactionId,
        "ERROR",
        new Error("No model ID specified in prompt metadata."),
        interactionType
      );
      return null;
    }

    const { providerId, modelId: specificModelId } =
      splitModelId(targetModelId);
    if (!providerId || !specificModelId) {
      await this._finalizeInteraction(
        interactionId,
        "ERROR",
        new Error(`Invalid combined model ID format: ${targetModelId}`),
        interactionType
      );
      return null;
    }

    const providerConfig = useProviderStore
      .getState()
      .dbProviderConfigs.find((p) => p.id === providerId);
    if (!providerConfig) {
      await this._finalizeInteraction(
        interactionId,
        "ERROR",
        new Error(`Provider configuration not found for ID: ${providerId}`),
        interactionType
      );
      return null;
    }

    const apiKey = useProviderStore.getState().getApiKeyForProvider(providerId);
    const modelInstance = instantiateModelInstance(
      providerConfig,
      specificModelId,
      apiKey
    );

    if (!modelInstance) {
      await this._finalizeInteraction(
        interactionId,
        "ERROR",
        new Error(
          `Failed to instantiate model instance ${targetModelId} from provider ${providerConfig.name}`
        ),
        interactionType
      );
      return null;
    }
    console.log(
      `[InteractionService] Using model instance for ${targetModelId}`
    );

    // Gather enabled tools (both regular and MCP)
    const toolsWithExecute = interactionType !== "conversation.title_generation" && interactionType !== "conversation.compact"
      ? (finalPrompt.metadata?.enabledTools ?? []).reduce((acc, name) => {
          // Check if this is an MCP tool
          if (name.startsWith('mcp_')) {
            // For MCP tools, get the actual tool from MCP clients
            // Access MCP clients through the global module registry
            const mcpToolsModule = (globalThis as any).mcpToolsModuleInstance as { mcpClients: Map<string, any> } | undefined;
            
            if (mcpToolsModule && mcpToolsModule.mcpClients) {
              // Parse the MCP tool name: mcp_{serverName}_{toolName}
              const parts = name.substring(4).split('_'); // Remove 'mcp_' prefix
              if (parts.length >= 2) {
                const serverName = parts[0];
                const toolName = parts.slice(1).join('_'); // Handle tool names with underscores
                
                // Find the MCP client for this server
                for (const [, clientInfo] of mcpToolsModule.mcpClients) {
                  if (clientInfo.name === serverName && clientInfo.tools[toolName]) {
                    // Get the properly registered tool from the control registry instead of raw MCP tool
                    const allRegisteredTools = useControlRegistryStore.getState().getRegisteredTools();
                    const registeredMcpToolName = `mcp_${serverName}_${toolName}`;
                    const registeredToolInfo = allRegisteredTools[registeredMcpToolName];
                    
                    if (registeredToolInfo && registeredToolInfo.definition) {
                      // Create a clean tool object for AI SDK - don't spread existing tool
                      const toolDefinition: Tool<any> = {
                        description: registeredToolInfo.definition.description,
                        parameters: registeredToolInfo.definition.parameters,
                        execute: async (args: any) => {
                          if (registeredToolInfo.implementation) {
                            // Use the registered implementation which already handles MCP calls properly
                            return await registeredToolInfo.implementation(args, getContextSnapshot());
                          } else {
                            console.error(`[InteractionService] MCP tool ${toolName} has no implementation`);
                            throw new Error(`MCP tool ${toolName} has no implementation`);
                          }
                        }
                      };
                      
                      acc[name] = toolDefinition;
                    } else {
                      console.warn(`[InteractionService] MCP tool ${registeredMcpToolName} not found in control registry`);
                    }
                    break;
                  }
                }
              }
            }
          } else {
            // Handle regular tools as before
            const allRegisteredTools = useControlRegistryStore
              .getState()
              .getRegisteredTools();
            const toolInfo = allRegisteredTools[name];
            
            if (toolInfo && toolInfo.implementation) {
              // Create a clean tool object for AI SDK - don't spread existing tool
              const toolDefinition: Tool<any> = {
                description: toolInfo.definition.description,
                parameters: toolInfo.definition.parameters,
                execute: async (args: any) => {
                const currentConvId =
                  useInteractionStore.getState().currentConversationId;
                const conversation = currentConvId
                  ? useConversationStore
                      .getState()
                      .getConversationById(currentConvId)
                  : null;

                let targetVfsKey: string;
                if (conversation && conversation.projectId) {
                  if (typeof conversation.projectId === 'string') {
                    targetVfsKey = conversation.projectId;
                  } else {
                    console.warn(`[InteractionService] conversation.projectId for conversation ${currentConvId} is not a string (type: ${typeof conversation.projectId}). Defaulting VFS key to "orphan". Value:`, conversation.projectId);
                    targetVfsKey = "orphan";
                  }
                } else {
                  targetVfsKey = "orphan";
                }
                
                let fsInstance: typeof fs | undefined | null;
                try {
                  emitter.emit(vfsEvent.initializeVFSRequest, {
                    vfsKey: targetVfsKey,
                    options: { force: true },
                  });
                  await new Promise((resolve) => setTimeout(resolve, 100)); 
                  fsInstance = useVfsStore.getState().fs;
                  if (
                    useVfsStore.getState().configuredVfsKey !== targetVfsKey ||
                    !fsInstance
                  ) {
                    throw new Error(
                      `Filesystem for key "${targetVfsKey}" not ready after request.`
                    );
                  }
                } catch (initError: any) {
                  throw new Error(`Filesystem error: ${initError.message}`);
                }
                try {
                  const contextSnapshot = getContextSnapshot();
                  const parsedArgs = toolInfo.definition.parameters.parse(args);
                  const implementation: ToolImplementation<any> =
                    toolInfo.implementation!;
                  const contextWithFs: ToolContext = {
                    ...contextSnapshot,
                    fsInstance,
                  };
                  return await implementation(parsedArgs, contextWithFs);
                } catch (e) {
                  // const toolError = e instanceof Error ? e.message : String(e);
                  if (e instanceof z.ZodError) {
                    throw new Error(`Invalid arguments: ${e.errors
                      .map((err) => `${err.path.join(".")} (${err.message})`)
                      .join(", ")}`);
                  }
                  throw new Error(e instanceof Error ? e.message : String(e));
                }
                }
              };
              acc[name] = toolDefinition;
            }
          }
          return acc;
        }, {} as Record<string, Tool<any>>)
      : undefined;

    // Check if the selected model supports tools
    const { getSelectedModel } = useProviderStore.getState();
    const selectedModel = getSelectedModel();
    const modelSupportsTools = selectedModel?.metadata?.supported_parameters?.includes("tools") ?? false;

    const enabledMcpTools = (finalPrompt.metadata?.enabledTools ?? []).filter(name => name.startsWith('mcp_')).length;
    const enabledRegularTools = (finalPrompt.metadata?.enabledTools ?? []).filter(name => !name.startsWith('mcp_')).length;
    
    if (!modelSupportsTools && (enabledMcpTools > 0 || enabledRegularTools > 0)) {
      console.warn(`[InteractionService] Model ${selectedModel?.name || 'unknown'} does not support tools. Ignoring ${enabledMcpTools + enabledRegularTools} enabled tools.`);
    }
    


    const maxSteps =
      finalPrompt.parameters?.maxSteps ??
      useSettingsStore.getState().toolMaxSteps;

    // Prepare options for AIService.executeInteraction
    const callOptions: AIServiceCallOptions = {
      model: modelInstance,
      messages: finalPrompt.messages,
      abortSignal: abortController.signal,
      system: finalPrompt.system,
      temperature: finalPrompt.parameters?.temperature,
      maxTokens: finalPrompt.parameters?.max_tokens,
      topP: finalPrompt.parameters?.top_p,
      topK: finalPrompt.parameters?.top_k,
      presencePenalty: finalPrompt.parameters?.presence_penalty,
      frequencyPenalty: finalPrompt.parameters?.frequency_penalty,
      maxSteps: maxSteps,
      // Only include tools if the model supports them
      ...(modelSupportsTools &&
        toolsWithExecute &&
        Object.keys(toolsWithExecute).length > 0 && {
          tools: toolsWithExecute,
        }),
      ...(finalPrompt.parameters?.providerOptions && {
        providerOptions: finalPrompt.parameters.providerOptions,
      }),
      // Only set toolChoice if the model supports tools
      ...(modelSupportsTools && finalPrompt.toolChoice && {
        toolChoice: finalPrompt.toolChoice,
      }),
    };

    // Define callbacks within startInteraction to capture interactionId and interactionType in scope
    const callbacks: AIServiceCallbacks = {
      onChunk: (chunk) => this._handleChunk(interactionId, chunk),
      onReasoningChunk: (chunk) =>
        this._handleReasoningChunk(interactionId, chunk),
      onToolCall: (toolCall) => this._handleToolCall(interactionId, toolCall),
      onToolResult: (toolResult) =>
        this._handleToolResult(interactionId, toolResult),
      onFinish: (details) =>
        this._handleFinish(interactionId, details, interactionType).catch(finishError => {
          console.error(`[InteractionService] Error in finish handler for ${interactionId}:`, finishError);
        }),
      onError: (error) =>
        this._handleError(interactionId, error, interactionType).catch(errorHandlerError => {
          console.error(`[InteractionService] Error in error handler for ${interactionId}:`, errorHandlerError);
        }),
    };

    console.log(
      `[InteractionService] Calling AIService.executeInteraction for ${interactionId}`
    );
    AIService.executeInteraction(interactionId, callOptions, callbacks).catch(
      (execError) => {
        console.error(
          `[InteractionService] Error during AIService.executeInteraction for ${interactionId}:`,
          execError
        );
        const currentInteractionState = useInteractionStore.getState().interactions.find(i => i.id === interactionId);
        if (currentInteractionState && currentInteractionState.status === "STREAMING") {
            this._finalizeInteraction(
            interactionId,
            "ERROR",
            execError instanceof Error ? execError : new Error(String(execError)),
            interactionType
          ).catch(finalizeError => {
            console.error(`[InteractionService] Error during finalization after execution error:`, finalizeError);
          });
        }
      }
    );

    return interaction; 
  },

  abortInteraction(interactionId: string): void {
    console.log(`[InteractionService] Aborting interaction ${interactionId}`);
    const controller = this._activeControllers.get(interactionId);
    if (controller && !controller.signal.aborted) {
      controller.abort();
      toast.info("Interaction cancelled.");
    } else {
      console.warn(
        `[InteractionService] No active controller found or already aborted for ${interactionId}.`
      );
      const interactionStoreState = useInteractionStore.getState();
      const interaction = interactionStoreState.interactions.find(
        (i) => i.id === interactionId
      );
      if (
        interactionStoreState.streamingInteractionIds.includes(interactionId)
      ) {
        console.warn(
          `[InteractionService] Forcing cleanup for potentially stuck interaction ${interactionId}`
        );
        this._finalizeInteraction(
          interactionId,
          "CANCELLED",
          new Error("Interaction aborted manually (controller missing)"),
          interaction?.type ?? "message.user_assistant"
        ).catch(finalizeError => {
          console.error(`[InteractionService] Error during forced finalization:`, finalizeError);
        });
      }
    }
  },

  async _handleChunk(interactionId: string, chunk: string): Promise<void> {
    if (!this._firstChunkTimestamps.has(interactionId)) {
      this._firstChunkTimestamps.set(interactionId, performance.now());
    }
    const chunkPayload = { interactionId, chunk };
    const chunkResult = await runMiddleware(
      ModMiddlewareHook.INTERACTION_PROCESS_CHUNK,
      chunkPayload
    );
    if (chunkResult !== false) {
      const processedChunk =
        chunkResult && typeof chunkResult === "object" && "chunk" in chunkResult
          ? chunkResult.chunk
          : chunk;
      useInteractionStore
        .getState()
        .appendInteractionResponseChunk(interactionId, processedChunk);
      emitter.emit(interactionEvent.streamChunk, {
        interactionId,
        chunk: processedChunk,
      });
    }
  },

  _handleReasoningChunk(interactionId: string, chunk: string): void {
    useInteractionStore.getState().appendReasoningChunk(interactionId, chunk);
  },

  _handleToolCall(interactionId: string, toolCall: ToolCallPart): void {
    try {
      const callString = JSON.stringify(toolCall);
      const currentData = this._streamingToolData.get(interactionId) || {
        calls: [],
        results: [],
      };
      currentData.calls.push(callString);
      this._streamingToolData.set(interactionId, currentData);
      useInteractionStore.getState()._updateInteractionInState(interactionId, {
        metadata: { toolCalls: [...currentData.calls] },
      });
    } catch (e) {
      console.error(
        `[InteractionService] Failed to process tool call for ${interactionId}:`,
        e
      );
    }
  },

  _handleToolResult(interactionId: string, toolResult: ToolResultPart): void {
    try {
      const resultString = JSON.stringify(toolResult);
      const currentData = this._streamingToolData.get(interactionId) || {
        calls: [],
        results: [],
      };
      currentData.results.push(resultString);
      this._streamingToolData.set(interactionId, currentData);
      useInteractionStore.getState()._updateInteractionInState(interactionId, {
        metadata: { toolResults: [...currentData.results] },
      });
    } catch (e) {
      console.error(
        `[InteractionService] Failed to process tool result for ${interactionId}:`,
        e
      );
    }
  },

  async _handleFinish(
    interactionId: string,
    details: {
      finishReason: FinishReason;
      usage?: LanguageModelUsage;
      providerMetadata?: ProviderMetadata;
      reasoning?: string;
    },
    interactionType: InteractionType
  ): Promise<void> {
    console.log(
      `[InteractionService] Finishing interaction ${interactionId} (Type: ${interactionType}). Reason: ${details.finishReason}`
    );
    await this._finalizeInteraction(
      interactionId,
      "COMPLETED",
      undefined,
      interactionType,
      details
    );
  },

  async _handleError(
    interactionId: string,
    error: Error,
    interactionType: InteractionType
  ): Promise<void> {
    console.error(
      `[InteractionService] Handling error for interaction ${interactionId} (Type: ${interactionType}):`,
      error
    );
    const isAbort = error.name === "AbortError";
    await this._finalizeInteraction(
      interactionId,
      isAbort ? "CANCELLED" : "ERROR",
      isAbort ? undefined : error,
      interactionType
    );
  },

  async _finalizeInteraction(
    interactionId: string,
    status: InteractionStatus,
    error?: Error,
    interactionType: InteractionType = "message.user_assistant",
    finishDetails?: {
      finishReason: FinishReason;
      usage?: LanguageModelUsage;
      providerMetadata?: ProviderMetadata;
      reasoning?: string;
    }
  ): Promise<void> {
    const interactionStore = useInteractionStore.getState();
    const currentInteraction = interactionStore.interactions.find(
      (i) => i.id === interactionId
    );

    if (
      !currentInteraction ||
      (currentInteraction.status !== "STREAMING" &&
        interactionType !== "conversation.title_generation" &&
        interactionType !== "conversation.compact")
    ) {
      console.warn(
        `[InteractionService] Interaction ${interactionId} already finalized or not found. Skipping finalization with status ${status}.`
      );
      this._activeControllers.delete(interactionId);
      this._streamingToolData.delete(interactionId);
      this._interactionStartTimes.delete(interactionId);
      this._firstChunkTimestamps.delete(interactionId);
      return;
    }

    const finalBufferedContent =
      interactionStore.activeStreamBuffers[interactionId] ?? "";
    const finalReasoningContent =
      interactionStore.activeReasoningBuffers[interactionId] ?? "";
    const toolData = this._streamingToolData.get(interactionId) || {
      calls: [],
      results: [],
    };
    const currentMetadata = currentInteraction?.metadata || {};

    console.log(
      `[InteractionService] Finalizing ${interactionId}. Buffered Content Length: ${finalBufferedContent.length}, Reasoning Length: ${finalReasoningContent.length}`
    );

    const endTime = performance.now();
    const startTime = this._interactionStartTimes.get(interactionId);
    const firstChunkTime = this._firstChunkTimestamps.get(interactionId);
    const generationTime = startTime
      ? Math.round(endTime - startTime)
      : undefined;
    const timeToFirstToken =
      startTime && firstChunkTime
        ? Math.round(firstChunkTime - startTime)
        : undefined;

    const definitiveReasoning =
      finishDetails?.reasoning ?? finalReasoningContent;

    const finalUpdates: Partial<Omit<Interaction, "id">> = {
      status: status,
      endedAt: new Date(),
      response: finalBufferedContent || null,
      metadata: {
        ...currentMetadata,
        ...(finishDetails?.usage && {
          promptTokens: finishDetails.usage.promptTokens,
          completionTokens: finishDetails.usage.completionTokens,
          totalTokens: finishDetails.usage.totalTokens,
        }),
        ...(finishDetails?.providerMetadata && {
          providerMetadata: finishDetails.providerMetadata,
        }),
        toolCalls: toolData.calls,
        toolResults: toolData.results,
        reasoning: definitiveReasoning || undefined,
        timeToFirstToken: timeToFirstToken,
        generationTime: generationTime,
        ...((status === "ERROR" ||
          status === "WARNING" ||
          status === "CANCELLED") && {
          error: error?.message ?? "Interaction ended unexpectedly.",
        }),
      },
    };

    if (
      interactionType === "conversation.title_generation" &&
      status === "COMPLETED" &&
      finalUpdates.response &&
      typeof finalUpdates.response === "string"
    ) {
      const generatedTitle = finalUpdates.response.trim().replace(/^"|"$/g, "");
      if (currentInteraction && generatedTitle) {
        // console.log(
        //   `[InteractionService] Updating conversation ${currentInteraction.conversationId} title to: "${generatedTitle}"`
        // );
        emitter.emit(conversationEvent.updateConversationRequest, {
          id: currentInteraction.conversationId,
          updates: { title: generatedTitle },
        });
      }
    }

    //     console.log(`[InteractionService] Checking completion handler conditions for ${interactionId}:`, {
    //   interactionType,
    //   status,
    //   hasResponse: !!finalUpdates.response,
    //   responseType: typeof finalUpdates.response,
    //   currentInteractionMetadata: currentInteraction?.metadata
    // });

        // Handle prompt enhancement completion
    if (
      interactionType === "prompt.enhance" &&
      status === "COMPLETED" &&
      finalUpdates.response &&
      typeof finalUpdates.response === "string"
    ) {
      const enhancedPrompt = finalUpdates.response.trim();
      if (enhancedPrompt) {
        // Import PromptEnhancementService to handle completion
        const { PromptEnhancementService } = await import("@/services/prompt-enhancement.service");
        await PromptEnhancementService.handleEnhancementCompletion(
          interactionId,
          enhancedPrompt
        );
      }
    }



    if (
      interactionType === "conversation.compact" &&
      status === "COMPLETED" &&
      finalUpdates.response &&
      typeof finalUpdates.response === "string"
    ) {
      const compactSummary = finalUpdates.response.trim();
      const targetUserInteractionId = currentInteraction?.metadata?.targetUserInteractionId;
      const targetConversationId = currentInteraction?.metadata?.targetConversationId;
      const combineSourceInteractionId = currentInteraction?.metadata?.combineSourceInteractionId;
      
      // Handle combine generation completion differently from regular compact
      if (currentInteraction?.metadata?.isCombineGeneration && combineSourceInteractionId) {
        console.log(`[InteractionService] Combine completion handler triggered for ${interactionId} targeting ${combineSourceInteractionId}`);
        
        try {
          const interactionStore = useInteractionStore.getState();
          
          // Update the combine interaction itself with the combined response
          const combineInteraction = interactionStore.interactions.find(i => 
            i.parentId === combineSourceInteractionId && 
            i.metadata?.isCombineGeneration === true &&
            i.metadata?.isCompactingInProgress === true
          );
          
          if (combineInteraction) {
            const updatedMetadata = {
              ...combineInteraction.metadata,
              isCompactingInProgress: false,
              combineGeneratedAt: new Date().toISOString(),
            };
            
            interactionStore._updateInteractionInState(combineInteraction.id, {
              response: compactSummary,
              status: "COMPLETED" as InteractionStatus,
              endedAt: new Date(),
              metadata: updatedMetadata
            });
            
            // Save to persistence
            const updatedCombineInteraction = interactionStore.interactions.find(i => i.id === combineInteraction.id);
            if (updatedCombineInteraction) {
              await PersistenceService.saveInteraction(updatedCombineInteraction);
            }
            
            // Emit event to update UI
            emitter.emit(interactionEvent.updated, {
              interactionId: combineInteraction.id,
              updates: {
                response: compactSummary,
                status: "COMPLETED" as InteractionStatus,
                endedAt: new Date(),
                metadata: updatedMetadata
              },
            });
            
            // Remove from streaming state
            interactionStore._removeStreamingId(combineInteraction.id);
          }
          
        } catch (error) {
          console.error(`[InteractionService] Error updating combine interaction:`, error);
        }
      }
      // Regular compact completion logic
      else if (compactSummary && targetUserInteractionId && targetConversationId) {
        // console.log(`[InteractionService] Compact completion handler triggered for ${interactionId}:`, {
        //   compactSummaryLength: compactSummary.length,
        //   targetUserInteractionId,
        //   targetConversationId
        // });
        
        try {
          // Switch to the target conversation first
          const conversationStore = useConversationStore.getState();
          await conversationStore.selectItem(targetConversationId, "conversation");
          
          // Ensure interactions are loaded for the target conversation
          const interactionStore = useInteractionStore.getState();
          if (interactionStore.currentConversationId !== targetConversationId) {
            // console.log(`[InteractionService] Loading interactions for target conversation ${targetConversationId}`);
            await interactionStore.loadInteractions(targetConversationId);
          }
          
          // Get the current interaction to preserve existing metadata
          const targetInteraction = interactionStore.interactions.find(i => i.id === targetUserInteractionId);
          
          if (!targetInteraction) {
            throw new Error(`Target interaction ${targetUserInteractionId} not found after loading conversation ${targetConversationId}`);
          }
          
          // console.log(`[InteractionService] Found target interaction ${targetUserInteractionId} with current response:`, {
          //   response: targetInteraction.response?.substring(0, 50) + '...',
          //   status: targetInteraction.status,
          //   conversationId: targetInteraction.conversationId,
          //   currentConversationId: interactionStore.currentConversationId
          // });
          
          // Merge metadata instead of overwriting to preserve existing data
          // const updates = {
          //   response: compactSummary,
          //   status: "COMPLETED" as InteractionStatus,
          //   endedAt: new Date(),
          //   metadata: {
          //     ...targetInteraction.metadata, // Preserve existing metadata
          //     isCompactingInProgress: false,
          //     compactGeneratedAt: new Date().toISOString(),
          //   },
          // };
          
          // console.log(`[InteractionService] Applying updates to ${targetUserInteractionId}:`, {
          //   responseLength: compactSummary.length,
          //   status: updates.status,
          //   targetConversationId,
          //   currentConversationId: interactionStore.currentConversationId
          // });
          
          // Create the fully updated interaction object with the compact summary
          const fullyUpdatedInteraction = {
            ...targetInteraction,
            response: compactSummary,  // CRITICAL: Set the actual summary
            status: "COMPLETED" as InteractionStatus,
            endedAt: new Date(),
            metadata: {
              ...targetInteraction.metadata,
              isCompactingInProgress: false,
              isRaceCombining: false, // Clear race combining flag if it was set
              compactGeneratedAt: new Date().toISOString(),
              combinedResponse: targetInteraction.metadata?.isRaceCombining ? true : undefined, // Mark as combined if it was a race
            }
          };
          
          // console.log(`[InteractionService] DIRECT DATABASE UPDATE for ${targetUserInteractionId}:`, {
          //   responseLength: compactSummary.length,
          //   status: fullyUpdatedInteraction.status,
          //   oldResponse: targetInteraction.response?.substring(0, 50),
          //   newResponse: compactSummary.substring(0, 50)
          // });
          
          // CRITICAL: Save directly to Dexie database FIRST
          await PersistenceService.saveInteraction(fullyUpdatedInteraction);
          // console.log(`[InteractionService] ✅ DEXIE DATABASE UPDATED for ${targetUserInteractionId}`);
          
          // THEN update Zustand state using the proper method
          interactionStore._updateInteractionInState(targetUserInteractionId, {
            response: compactSummary,
            status: "COMPLETED" as InteractionStatus,
            endedAt: new Date(),
            metadata: fullyUpdatedInteraction.metadata
          });
          
          // Emit event to update UI
          emitter.emit(interactionEvent.updated, {
            interactionId: targetUserInteractionId,
            updates: {
              response: compactSummary,
              status: "COMPLETED" as InteractionStatus,
              endedAt: new Date(),
              metadata: fullyUpdatedInteraction.metadata
            },
          });
          
          // Remove from streaming state
          interactionStore._removeStreamingId(targetUserInteractionId);
        } catch (error) {
          console.error(`[InteractionService] Error updating user interaction ${targetUserInteractionId} with compact summary:`, error);
          
          // Fallback: try to update with error message
          try {
            const conversationStore = useConversationStore.getState();
            await conversationStore.selectItem(targetConversationId, "conversation");
            
            const interactionStore = useInteractionStore.getState();
            const fallbackTargetInteraction = interactionStore.interactions.find(i => i.id === targetUserInteractionId);
            
            const fallbackUpdates = {
              response: "Error generating compact summary. Please try again.",
              status: "ERROR" as InteractionStatus,
              endedAt: new Date(),
              metadata: {
                ...(fallbackTargetInteraction?.metadata || {}), // Preserve existing metadata
                isCompactingInProgress: false,
                compactError: error instanceof Error ? error.message : String(error),
              },
            };
            
            interactionStore._updateInteractionInState(targetUserInteractionId, fallbackUpdates);
            emitter.emit(interactionEvent.updated, {
              interactionId: targetUserInteractionId,
              updates: fallbackUpdates,
            });
            interactionStore._removeStreamingId(targetUserInteractionId);
            
            const fallbackInteraction = interactionStore.interactions.find((i) => i.id === targetUserInteractionId);
            if (fallbackInteraction) {
              await PersistenceService.saveInteraction(fallbackInteraction);
            }
          } catch (fallbackError) {
            console.error(`[InteractionService] Fallback update also failed for ${targetUserInteractionId}:`, fallbackError);
          }
        }
      }
    }

    interactionStore._updateInteractionInState(interactionId, finalUpdates);
    interactionStore._removeStreamingId(interactionId);

    const finalInteractionState = useInteractionStore
      .getState()
      .interactions.find((i) => i.id === interactionId);

    if (finalInteractionState) {
      // console.log(
      //   `[InteractionService] Persisting final state for ${interactionId}. Response length: ${
      //     finalInteractionState.response?.length ?? 0
      //   }`
      // );
      PersistenceService.saveInteraction({ ...finalInteractionState }).catch(
        (e) => {
          console.error(
            `[InteractionService] Failed final persistence for ${interactionId}`,
            e
          );
        }
      );
    } else {
      console.error(
        `[InteractionService] CRITICAL - Could not find final state for interaction ${interactionId} to persist.`
      );
    }

    let parsedToolCalls: ToolCallPart[] = [];
    let parsedToolResults: ToolResultPart[] = [];
    try {
      parsedToolCalls = toolData.calls.map((s) => JSON.parse(s));
      parsedToolResults = toolData.results.map((s) => JSON.parse(s));
    } catch (e) {
      console.error(
        `[InteractionService] Failed to parse tool strings for event emitter:`,
        e
      );
    }

    emitter.emit(interactionEvent.completed, {
      interaction: finalInteractionState,
      interactionId,
      status: status,
      error: error?.message,
      toolCalls: parsedToolCalls,
      toolResults: parsedToolResults,
    });

    this._activeControllers.delete(interactionId);
    this._streamingToolData.delete(interactionId);
    this._interactionStartTimes.delete(interactionId);
    this._firstChunkTimestamps.delete(interactionId);

    // console.log(
    //   `[InteractionService] Finalized interaction ${interactionId} with status ${status}.`
    // );
  },
};
