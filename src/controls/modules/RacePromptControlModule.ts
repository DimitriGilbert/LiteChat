import React from "react";
import { type ControlModule } from "@/types/litechat/control";
import type { LiteChatModApi } from "@/types/litechat/modding";
import { RacePromptControl } from "@/controls/components/prompt/RacePromptControl";
import { useProviderStore } from "@/store/provider.store";
import { usePromptStateStore } from "@/store/prompt.store";
import { useConversationStore } from "@/store/conversation.store";
import { useInteractionStore } from "@/store/interaction.store";
import { useProjectStore } from "@/store/project.store";
import { providerEvent } from "@/types/litechat/events/provider.events";
import type { ModelListItem } from "@/types/litechat/provider";
import { InteractionService } from "@/services/interaction.service";
import { PersistenceService } from "@/services/persistence.service";
import { toast } from "sonner";
import type { PromptTurnObject, PromptObject } from "@/types/litechat/prompt";
import { ModMiddlewareHook } from "@/types/litechat/middleware.types";
import type { Interaction } from "@/types/litechat/interaction";
import { buildHistoryMessages } from "@/lib/litechat/ai-helpers";
import type { CoreMessage, TextPart, ImagePart } from "ai";
import { emitter } from "@/lib/litechat/event-emitter";
import { interactionEvent } from "@/types/litechat/events/interaction.events";



export class RacePromptControlModule implements ControlModule {
  public readonly id = "race-prompt-control";
  private eventUnsubscribers: (() => void)[] = [];
  // @ts-expect-error meh, do not care laaah
  private modApi: LiteChatModApi | null = null;
  private notifyComponentUpdate: (() => void) | null = null;

  // Race state
  private isRaceMode = false;
  private raceConfig: {
    modelIds: string[];
    staggerMs: number;
    combineEnabled: boolean;
    combineModelId?: string;
    combinePrompt?: string;
  } = {
    modelIds: [],
    staggerMs: 250,
    combineEnabled: false,
  };

  // Provider state
  public globallyEnabledModels: ModelListItem[] = [];
  public isLoadingProviders = false;

  async initialize(modApi: LiteChatModApi): Promise<void> {
    this.modApi = modApi;

    // Get initial provider state
    const providerState = useProviderStore.getState();
    this.globallyEnabledModels = providerState.getGloballyEnabledModelDefinitions();
    this.isLoadingProviders = providerState.isLoading;

    // Subscribe to provider events to track enabled models
    const unsubGloballyEnabledModelsUpdated = modApi.on(
      providerEvent.globallyEnabledModelsUpdated,
      (payload: { models: ModelListItem[] }) => {
        this.globallyEnabledModels = payload.models;
        this.notifyComponentUpdate?.();
      }
    );

    const unsubInitialDataLoaded = modApi.on(
      providerEvent.initialDataLoaded,
      (data: any) => {
        if (data.globallyEnabledModels) {
          this.globallyEnabledModels = data.globallyEnabledModels;
          this.isLoadingProviders = false;
          this.notifyComponentUpdate?.();
        }
      }
    );

    // Register middleware to intercept prompt submissions when race mode is active
    const unsubMiddleware = modApi.addMiddleware(
      ModMiddlewareHook.PROMPT_TURN_FINALIZE,
      async (payload: { turnData: PromptTurnObject }) => {
        if (this.isRaceMode) {
          // Store config before disabling race mode
          const currentRaceConfig = { ...this.raceConfig };
          // Immediately disable race mode to prevent multiple triggers
          this.setRaceMode(false);
          // Start the race asynchronously but return false to prevent normal submission
          this.handleRaceSubmissionAsync(payload.turnData, currentRaceConfig);
          return false; // Cancel normal submission
        }
        return payload; // Allow normal processing
      }
    );

    this.eventUnsubscribers.push(
      unsubGloballyEnabledModelsUpdated,
      unsubInitialDataLoaded,
      unsubMiddleware
    );
  }

  destroy(): void {
    this.eventUnsubscribers.forEach((unsub) => unsub());
    this.eventUnsubscribers = [];
    this.notifyComponentUpdate = null;
    this.modApi = null;
  }

  setNotifyCallback(callback: (() => void) | null): void {
    this.notifyComponentUpdate = callback;
  }

  setRaceMode(active: boolean, config?: {
    modelIds: string[];
    staggerMs: number;
    combineEnabled: boolean;
    combineModelId?: string;
    combinePrompt?: string;
  }): void {
    this.isRaceMode = active;
    
    if (active && config) {
      this.raceConfig = { ...config };
    } else {
      this.raceConfig = {
        modelIds: [],
        staggerMs: 250,
        combineEnabled: false,
      };
    }
    
    this.notifyComponentUpdate?.();
  }

  get isRaceModeActive(): boolean {
    return this.isRaceMode;
  }

  // Async method that handles race submission without blocking middleware
  private async handleRaceSubmissionAsync(turnData: PromptTurnObject, raceConfig?: typeof this.raceConfig): Promise<void> {
    try {
      const config = raceConfig || this.raceConfig;
      const { modelIds: raceModelIds, staggerMs, combineEnabled, combineModelId } = config;
      
      console.log(`[RacePromptControlModule] Starting race submission with ${raceModelIds.length} models:`, raceModelIds);
      
      if (raceModelIds.length === 0) {
        throw new Error("No models selected for race");
      }

      if (combineEnabled && !combineModelId) {
        throw new Error("Combine model not selected");
      }

      const interactionStore = useInteractionStore.getState();
      
      if (combineEnabled) {
        // COMBINE MODE: Create placeholder main interaction that will be replaced with combined result
        
        // Calculate the correct index for the main interaction
        const conversationInteractions = interactionStore.interactions.filter(
          (i) => i.conversationId === interactionStore.currentConversationId
        );
        const nextIndex = conversationInteractions.reduce((max, i) => Math.max(max, i.index), -1) + 1;
        
        // Create the main interaction directly (bypass middleware to avoid recursion)
        const promptObject = await this.buildPromptObject(turnData, interactionStore.currentConversationId!, nextIndex, turnData.metadata?.modelId || '');
        const mainInteraction = await InteractionService.startInteraction(
          promptObject,
          interactionStore.currentConversationId!,
          turnData,
          "message.user_assistant"
        );

        if (!mainInteraction) {
          throw new Error("Could not create main interaction");
        }

        const mainInteractionId = mainInteraction.id;

        // Immediately update the main interaction with placeholder and put it in streaming state
        interactionStore._updateInteractionInState(mainInteractionId, {
          response: "🏁 Starting race with " + raceModelIds.length + " models...\n\n⏳ Collecting responses for combination...",
          status: "STREAMING" as const,
          metadata: {
            ...mainInteraction.metadata,
            isRaceCombining: true,
            raceParticipantCount: raceModelIds.length,
            raceConfig: config,
          },
        });
        
        // Add to streaming state
        interactionStore._addStreamingId(mainInteractionId);

        // Create child interactions for race models + original model (ALL become tabs)
        const allRaceModels = [mainInteraction.metadata?.modelId, ...raceModelIds].filter(Boolean) as string[];
        
        const childInteractionPromises = allRaceModels.map((modelId: string, index: number) => {
          return new Promise<{ interaction: Interaction | null, modelId: string }>((resolve) => {
            setTimeout(async () => {
              try {
                const { nanoid } = await import("nanoid");
                const childInteractionId = nanoid();
                
                // Build prompt object for this race participant
                const promptObject = await this.buildPromptObject(turnData, interactionStore.currentConversationId!, mainInteraction.index + index + 1, modelId);

                // Create unique turnData for each child interaction
                const childTurnData: PromptTurnObject = {
                  ...turnData,
                  id: childInteractionId,
                  metadata: {
                    ...turnData.metadata,
                    modelId: modelId,
                    raceTab: true,
                    raceParticipantIndex: index + 1,
                    raceMainInteractionId: mainInteractionId,
                  }
                };

                const childInteraction = await InteractionService.startInteraction(
                  promptObject,
                  interactionStore.currentConversationId!,
                  childTurnData,
                  "message.assistant_regen"
                );

                // Make this a child of the main interaction
                if (childInteraction) {
                  const updates: Partial<Omit<Interaction, "id">> = {
                    parentId: mainInteractionId,
                    index: index + 1, // Tab index (0 is main, 1+ are additional tabs)
                  };

                  interactionStore._updateInteractionInState(childInteraction.id, updates);
                  await PersistenceService.saveInteraction({
                    ...childInteraction,
                    ...updates,
                  } as Interaction);
                }
                
                resolve({ interaction: childInteraction, modelId });
              } catch (error) {
                console.error(`[RacePromptControlModule] Error creating child interaction for ${modelId}:`, error);
                resolve({ interaction: null, modelId });
              }
            }, index * staggerMs);
          });
        });

        // Wait for all child interactions to be created
        const childResults = await Promise.all(childInteractionPromises);
        const successfulChildren = childResults.filter(r => r.interaction !== null);
        
        console.log(`[RacePromptControlModule] Race children created. Successful: ${successfulChildren.length}/${allRaceModels.length}`);

        // Wait for all children to complete and then combine
        await this.waitForRaceCompletion(mainInteractionId, successfulChildren.map(r => r.interaction!.id));
        
      } else {
        // NON-COMBINE MODE: Original race behavior with normal main interaction
        
        // Calculate the correct index for the main interaction
        const conversationInteractions = interactionStore.interactions.filter(
          (i) => i.conversationId === interactionStore.currentConversationId
        );
        const nextIndex = conversationInteractions.reduce((max, i) => Math.max(max, i.index), -1) + 1;
        
        // Create the main interaction directly (bypass middleware to avoid recursion)
        const promptObject = await this.buildPromptObject(turnData, interactionStore.currentConversationId!, nextIndex, turnData.metadata?.modelId || '');
        const mainInteraction = await InteractionService.startInteraction(
          promptObject,
          interactionStore.currentConversationId!,
          turnData,
          "message.user_assistant"
        );

        if (!mainInteraction) {
          throw new Error("Could not create main interaction");
        }

        const mainInteractionId = mainInteraction.id;

        // Create child interactions for race models only (main stays normal)
        const childInteractionPromises = raceModelIds.map((modelId: string, index: number) => {
          return new Promise<{ interaction: Interaction | null, modelId: string }>((resolve) => {
            setTimeout(async () => {
              try {
                const { nanoid } = await import("nanoid");
                const childInteractionId = nanoid();
                
                // Build prompt object for this race participant
                const promptObject = await this.buildPromptObject(turnData, interactionStore.currentConversationId!, mainInteraction.index + index + 1, modelId);

                // Create unique turnData for each child interaction
                const childTurnData: PromptTurnObject = {
                  ...turnData,
                  id: childInteractionId,
                  metadata: {
                    ...turnData.metadata,
                    modelId: modelId,
                    raceTab: true,
                    raceParticipantIndex: index + 1,
                    raceMainInteractionId: mainInteractionId,
                  }
                };

                const childInteraction = await InteractionService.startInteraction(
                  promptObject,
                  interactionStore.currentConversationId!,
                  childTurnData,
                  "message.assistant_regen"
                );

                // Make this a child of the main interaction
                if (childInteraction) {
                  const updates: Partial<Omit<Interaction, "id">> = {
                    parentId: mainInteractionId,
                    index: index + 1, // Tab index (0 is main, 1+ are additional tabs)
                  };

                  interactionStore._updateInteractionInState(childInteraction.id, updates);
                  await PersistenceService.saveInteraction({
                    ...childInteraction,
                    ...updates,
                  } as Interaction);
                }
                
                resolve({ interaction: childInteraction, modelId });
              } catch (error) {
                console.error(`[RacePromptControlModule] Error creating child interaction for ${modelId}:`, error);
                resolve({ interaction: null, modelId });
              }
            }, index * staggerMs);
          });
        });

        // Wait for all child interactions to be created
        const childResults = await Promise.all(childInteractionPromises);
        const successfulChildren = childResults.filter(r => r.interaction !== null);
        
        console.log(`[RacePromptControlModule] Non-combine race completed. Created ${successfulChildren.length}/${raceModelIds.length} child interactions`);
        
        toast.success(`Race started! Current model + ${successfulChildren.length} race models responding in tabs.`);
      }
      
    } catch (error) {
      toast.error(`Race failed: ${String(error)}`);
      console.error(`[RacePromptControlModule] Error during race:`, error);
    }
  }

    private async waitForRaceCompletion(mainInteractionId: string, childInteractionIds: string[]): Promise<void> {
    console.log(`[RacePromptControlModule] Setting up promise-based waiting for ${childInteractionIds.length} child interactions`);
    
    return new Promise((resolve) => {
      let completedCount = 0;
      const targetCount = childInteractionIds.length;
      
      // Listen for interaction completion events
      const handleInteractionCompleted = (payload: { interactionId: string; status: string }) => {
        if (!childInteractionIds.includes(payload.interactionId)) {
          return; // Not one of our race children
        }
        
        if (payload.status === "COMPLETED" || payload.status === "ERROR") {
          completedCount++;
          console.log(`[RacePromptControlModule] Race progress: ${completedCount}/${targetCount} models completed (${payload.interactionId})`);
          
          // Update progress in main interaction
          const interactionStore = useInteractionStore.getState();
          interactionStore._updateInteractionInState(mainInteractionId, {
            response: `🏁 Race progress: ${completedCount}/${targetCount} models completed\n\n⏳ ${completedCount === targetCount ? 'Combining responses...' : 'Waiting for remaining responses...'}`,
            metadata: {
              isRaceCombining: true,
              raceCompletedCount: completedCount,
              raceParticipantCount: targetCount,
            },
          });
          
          if (completedCount === targetCount) {
            // All completed, clean up listener and start combine process
            console.log(`[RacePromptControlModule] All ${targetCount} race participants completed! Starting combine process...`);
            emitter.off(interactionEvent.completed, handleInteractionCompleted);
            this.startCombineProcess(mainInteractionId, childInteractionIds);
            resolve();
          }
        }
      };
      
      // Register event listener
      emitter.on(interactionEvent.completed, handleInteractionCompleted);
    });
  }

  private async startCombineProcess(mainInteractionId: string, childInteractionIds: string[]): Promise<void> {
    try {
      const interactionStore = useInteractionStore.getState();
      const mainInteraction = interactionStore.interactions.find(i => i.id === mainInteractionId);
      const storedRaceConfig = mainInteraction?.metadata?.raceConfig as typeof this.raceConfig;
      
      const { combineModelId, combinePrompt } = storedRaceConfig || {};
      
      if (!combineModelId) {
        throw new Error("Combine model not configured");
      }
      
      // Collect all race responses
      const raceResponses = childInteractionIds.map((id, index) => {
        const interaction = interactionStore.interactions.find(i => i.id === id);
        const modelId = interaction?.metadata?.modelId || `Model ${index + 1}`;
        const response = interaction?.response || "No response";
        const status = interaction?.status || "UNKNOWN";
        
        return `**${modelId}** (${status}):\n${response}`;
      }).join('\n\n---\n\n');

      // Create combine prompt
      const defaultCombinePrompt = `Please analyze and combine the following AI responses to provide a comprehensive, well-structured answer. 

Take the best insights from each response, resolve any contradictions, and present a unified, clear, and complete answer. If responses differ significantly, explain the different perspectives and provide your reasoned conclusion.

Focus on accuracy, completeness, and clarity in your combined response.`;

      const finalCombinePrompt = `${combinePrompt || defaultCombinePrompt}

Here are the responses to combine:

${raceResponses}`;

      // Create combine prompt object - EXACTLY like ForkCompact does
      const combinePromptObject: PromptObject = {
        system: "You are an expert at analyzing and synthesizing multiple AI responses into comprehensive, unified answers.",
        messages: [{ role: "user", content: finalCombinePrompt }],
        parameters: {
          temperature: 0.3,
          max_tokens: 4000,
        },
        metadata: {
          modelId: combineModelId,
          isCompactGeneration: true, // Use the same flag as ForkCompact
        },
      };

      // Create combine turn data - EXACTLY like ForkCompact does  
      const { nanoid } = await import("nanoid");
      const combineTurnData: PromptTurnObject = {
        id: nanoid(),
        content: `[Internal combine generation for race interaction ${mainInteractionId}]`,
        parameters: combinePromptObject.parameters,
        metadata: {
          ...combinePromptObject.metadata,
          targetUserInteractionId: mainInteractionId, // This is the key - points to main interaction
          targetConversationId: interactionStore.currentConversationId,
        }
      };

      // Start the combine interaction using conversation.compact type - EXACTLY like ForkCompact
      await InteractionService.startInteraction(
        combinePromptObject,
        interactionStore.currentConversationId!,
        combineTurnData,
        "conversation.compact" // This triggers the existing compact completion handler
      );
      
    } catch (error) {
      console.error(`[RacePromptControlModule] Error in combine process:`, error);
      
      // Update main interaction with error
      const interactionStore = useInteractionStore.getState();
      interactionStore._updateInteractionInState(mainInteractionId, {
        response: `❌ Failed to combine responses: ${String(error)}`,
        status: "ERROR" as const,
        endedAt: new Date(),
        metadata: {
          isRaceCombining: false,
          combineError: String(error),
        },
      });
      
      // Remove from streaming
      interactionStore._removeStreamingId(mainInteractionId);
    }
  }

  private async buildPromptObject(turnData: PromptTurnObject, conversationId: string, newIndex: number, modelId: string): Promise<PromptObject> {
    const interactionStore = useInteractionStore.getState();
    const projectStore = useProjectStore.getState();
    const conversationStore = useConversationStore.getState();
    
    const currentConversation = conversationStore.getConversationById(conversationId);
    const currentProjectId = currentConversation?.projectId ?? null;
    const effectiveSettings = projectStore.getEffectiveProjectSettings(currentProjectId);

    // Build history up to the current index
    const historyInteractions = interactionStore.interactions
      .filter(
        (i) =>
          i.conversationId === conversationId &&
          i.index < newIndex &&
          i.status === "COMPLETED" &&
          i.type === "message.user_assistant" &&
          i.parentId === null
      )
      .sort((a, b) => a.index - b.index);
      
    const historyMessages: CoreMessage[] = buildHistoryMessages(historyInteractions);

    // Process the current turn data
    let userContent = turnData.content;
    const userMessageContentParts: (TextPart | ImagePart)[] = [];

    const effectiveRulesContent = turnData.metadata?.effectiveRulesContent ?? [];
    const systemRulesContent = effectiveRulesContent
      .filter((r) => r.type === "system")
      .map((r) => r.content);
    const beforeRulesContent = effectiveRulesContent
      .filter((r) => r.type === "before")
      .map((r) => r.content);
    const afterRulesContent = effectiveRulesContent
      .filter((r) => r.type === "after")
      .map((r) => r.content);

    if (beforeRulesContent.length > 0) {
      userContent = `${beforeRulesContent.join('\n')}\n\n${userContent}`;
    }
    if (afterRulesContent.length > 0) {
      userContent = `${userContent}\n\n${afterRulesContent.join('\n')}`;
    }

    if (userContent) {
      userMessageContentParts.push({ type: "text", text: userContent });
    }

    if (userMessageContentParts.length > 0) {
      historyMessages.push({ role: "user", content: userMessageContentParts });
    }

    const turnSystemPrompt = turnData.metadata?.turnSystemPrompt as string | undefined;
    let baseSystemPrompt = turnSystemPrompt ?? effectiveSettings.systemPrompt ?? undefined;

    if (systemRulesContent.length > 0) {
      baseSystemPrompt = `${baseSystemPrompt ? `${baseSystemPrompt}\n\n` : ""}${systemRulesContent.join('\n')}`;
    }
    
    const promptState = usePromptStateStore.getState();
    const finalParameters = {
      temperature: promptState.temperature,
      max_tokens: promptState.maxTokens,
      top_p: promptState.topP,
      top_k: promptState.topK,
      presence_penalty: promptState.presencePenalty,
      frequency_penalty: promptState.frequencyPenalty,
      ...(turnData.parameters ?? {}),
    };

    // Remove null/undefined parameters
    Object.keys(finalParameters).forEach((key) => {
      if (
        finalParameters[key as keyof typeof finalParameters] === null ||
        finalParameters[key as keyof typeof finalParameters] === undefined
      ) {
        delete finalParameters[key as keyof typeof finalParameters];
      }
    });

    return {
      system: baseSystemPrompt,
      messages: historyMessages,
      parameters: finalParameters,
      metadata: {
        ...(turnData.metadata ?? {}),
        modelId: modelId, // Use the specific race model
        attachedFiles: turnData.metadata?.attachedFiles?.map(
          ({ contentBase64, contentText, ...rest }) => rest
        ),
      },
    };
  }

  register(modApi: LiteChatModApi): void {
    modApi.registerPromptControl({
      id: this.id,
      status: () => "ready",
      triggerRenderer: () => {
        return React.createElement(RacePromptControl, {
          module: this,
        });
      },
    });
  }
} 