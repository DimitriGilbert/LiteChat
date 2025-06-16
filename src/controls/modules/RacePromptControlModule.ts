import React from "react";
import { type ControlModule } from "@/types/litechat/control";
import type { LiteChatModApi } from "@/types/litechat/modding";
import { RacePromptControl } from "@/controls/components/prompt/RacePromptControl";
import { useProviderStore } from "@/store/provider.store";
import { useInteractionStore } from "@/store/interaction.store";
import { providerEvent } from "@/types/litechat/events/provider.events";
import type { ModelListItem } from "@/types/litechat/provider";
import { InteractionService } from "@/services/interaction.service";
import { PersistenceService } from "@/services/persistence.service";
import { toast } from "sonner";
import type { PromptTurnObject, PromptObject } from "@/types/litechat/prompt";
import { ModMiddlewareHook } from "@/types/litechat/middleware.types";
import type { Interaction } from "@/types/litechat/interaction";

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
    raceTimeoutSec: number;
    combineEnabled: boolean;
    combineModelId?: string;
    combinePrompt?: string;
  } = {
    modelIds: [],
    staggerMs: 250,
    raceTimeoutSec: 120,
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

    // Register middleware to detect when race is needed and convert the first interaction
    const unsubMiddleware = modApi.addMiddleware(
      ModMiddlewareHook.INTERACTION_BEFORE_START,
      (payload: { prompt: PromptObject; conversationId: string }) => {
        if (this.isRaceMode) {
          // Store config before disabling race mode
          const currentRaceConfig = { ...this.raceConfig };
          // Immediately disable race mode to prevent multiple triggers
          this.setRaceMode(false);
          
          // Run the race setup in the background (fire-and-forget)
          // DO NOT await this, as it would block the UI thread.
          this.handleRaceConversion(payload.prompt, payload.conversationId, currentRaceConfig);
          
          // Return false to cancel the original interaction immediately
          return false;
        }
        return payload; // Allow normal processing for non-race interactions
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
    raceTimeoutSec?: number;
    combineEnabled: boolean;
    combineModelId?: string;
    combinePrompt?: string;
  }): void {
    this.isRaceMode = active;
    
    if (active && config) {
      this.raceConfig = { ...config, raceTimeoutSec: config.raceTimeoutSec || 120 };
    } else {
      this.raceConfig = {
        modelIds: [],
        staggerMs: 250,
        raceTimeoutSec: 120,
        combineEnabled: false,
      };
    }
    
    this.notifyComponentUpdate?.();
  }

  get isRaceModeActive(): boolean {
    return this.isRaceMode;
  }

  // New approach: Create race setup from scratch since we cancelled the original interaction
  private async handleRaceConversion(prompt: PromptObject, conversationId: string, raceConfig: typeof this.raceConfig): Promise<void> {
    try {
      const { modelIds: raceModelIds, staggerMs, combineEnabled, combineModelId } = raceConfig;
      
      if (raceModelIds.length === 0) {
        throw new Error("No additional models selected for race");
      }

      if (combineEnabled && !combineModelId) {
        throw new Error("Combine model not selected");
      }

      const interactionStore = useInteractionStore.getState();
      
      // Extract the original user message from the prompt object
      const userMessage = prompt.messages[prompt.messages.length - 1];
      if (!userMessage || userMessage.role !== "user") {
        throw new Error("Could not find user message in prompt");
      }
      
      // Convert message content to string for turn data
      let userContent = "";
      if (typeof userMessage.content === "string") {
        userContent = userMessage.content;
      } else if (Array.isArray(userMessage.content)) {
        userContent = userMessage.content
          .filter(part => part.type === "text")
          .map(part => (part as any).text)
          .join("");
      }

      // Create a base turn data object from the prompt
      const baseTurnData: PromptTurnObject = {
        id: "",  // Will be set per interaction
        content: userContent,
        parameters: prompt.parameters || {},
        metadata: {
          ...prompt.metadata,
          modelId: prompt.metadata?.modelId || "", // Will be overridden per interaction
        },
      };

      const originalModelId = prompt.metadata?.modelId;
      if (!originalModelId) {
        throw new Error("No model ID available in prompt metadata");
      }

      if (combineEnabled) {
        // COMBINE MODE: Manually create main interaction, then start children
        const { nanoid } = await import("nanoid");
        
        // --- Manually create the main placeholder interaction ---
        const mainInteractionId = nanoid();
        const mainTurnData: PromptTurnObject = {
          ...baseTurnData,
          id: mainInteractionId,
          metadata: {
            ...baseTurnData.metadata,
            modelId: combineModelId as string,
            isRaceCombining: true,
            raceParticipantCount: raceModelIds.length + 1,
            raceConfig: raceConfig,
          },
        };
        
        const conversationInteractions = interactionStore.interactions.filter(
          (i) => i.conversationId === conversationId
        );
        const newIndex = conversationInteractions.reduce((max, i) => Math.max(max, i.index), -1) + 1;

        const mainInteraction: Interaction = {
          id: mainInteractionId,
          conversationId: conversationId,
          type: "message.user_assistant",
          prompt: { ...mainTurnData },
          response: null, // Response is null because content comes from stream buffer
          status: "STREAMING",
          startedAt: new Date(),
          endedAt: null,
          metadata: {
            ...mainTurnData.metadata,
            isRaceCombining: true,
            raceParticipantCount: raceModelIds.length + 1,
            toolCalls: [],
            toolResults: [],
          },
          index: newIndex,
          parentId: null,
        };

        // Add to state and persistence WITHOUT starting an AI call for it
        interactionStore._addInteractionToState(mainInteraction);
        interactionStore._addStreamingId(mainInteraction.id);
        
        // Set the initial content in the stream buffer for the UI to render
        interactionStore.setActiveStreamBuffer(
          mainInteraction.id,
          "🏁 Starting race with " + (raceModelIds.length + 1) + " models...\n\n⏳ Collecting responses for combination..."
        );
        
        await PersistenceService.saveInteraction(mainInteraction);
        
        // Manually emit the 'added' event to ensure UI updates
        emitter.emit(interactionEvent.added, { interaction: mainInteraction });

        emitter.emit(interactionEvent.started, {
          interactionId: mainInteraction.id,
          conversationId: mainInteraction.conversationId,
          type: mainInteraction.type,
        });
        // --- End of manual creation ---


        // Create child interactions for ALL models (original + race models)  
        const allRaceModels = [originalModelId, ...raceModelIds];
        const allChildInteractionPromises = allRaceModels.map((modelId: string, index: number) => {
          return new Promise<{ interaction: Interaction | null, modelId: string }>((resolve) => {
            setTimeout(async () => {
              try {
                const childInteractionId = nanoid();
                
                // Create unique turnData for each child interaction
                const childTurnData: PromptTurnObject = {
                  ...baseTurnData,
                  id: childInteractionId,
                  metadata: {
                    ...baseTurnData.metadata,
                    modelId: modelId,
                    raceTab: true,
                    raceParticipantIndex: index + 1,
                    raceMainInteractionId: mainInteraction.id,
                  }
                };

                // Create prompt for this specific model
                const childPrompt: PromptObject = {
                  ...prompt,
                  metadata: {
                    ...prompt.metadata,
                    modelId: modelId,
                  },
                };

                const childInteraction = await InteractionService.startInteraction(
                  childPrompt,
                  conversationId,
                  childTurnData,
                  "message.assistant_regen"
                );

                // Make this a child of the main interaction
                if (childInteraction) {
                  const updates: Partial<Omit<Interaction, "id">> = {
                    parentId: mainInteraction.id,
                    index: index + 1, // Tab index (0 is main, 1+ are children)
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

        // Wait for all children to be created
        const allChildResults = await Promise.all(allChildInteractionPromises);
        const successfulChildren = allChildResults.filter((r: { interaction: Interaction | null, modelId: string }) => r.interaction !== null);
        
        // All child IDs
        const allChildIds = successfulChildren.map((r: { interaction: Interaction | null, modelId: string }) => r.interaction!.id);

        // Wait for all children to complete and then combine
        await this.waitForRaceCompletion(mainInteraction.id, allChildIds, raceConfig.raceTimeoutSec);
        
      } else {
        // NON-COMBINE MODE: Create original interaction as main, then additional race children
        
        const { nanoid } = await import("nanoid");
        const mainInteractionId = nanoid();
        
        // Create main interaction with original model
        const mainTurnData: PromptTurnObject = {
          ...baseTurnData,
          id: mainInteractionId,
          metadata: {
            ...baseTurnData.metadata,
            modelId: originalModelId,
            raceTab: true,
            raceParticipantIndex: 1,
            raceMainInteractionId: mainInteractionId, // Self-reference
          },
        };

        const mainInteraction = await InteractionService.startInteraction(
          prompt,
          conversationId,
          mainTurnData,
          "message.user_assistant"
        );

        if (!mainInteraction) {
          throw new Error("Could not create main race interaction");
        }

        // Create additional child interactions for race models only
        const childInteractionPromises = raceModelIds.map((modelId: string, index: number) => {
          return new Promise<{ interaction: Interaction | null, modelId: string }>((resolve) => {
            setTimeout(async () => {
              try {
                const childInteractionId = nanoid();
                
                // Create unique turnData for each child interaction
                const childTurnData: PromptTurnObject = {
                  ...baseTurnData,
                  id: childInteractionId,
                  metadata: {
                    ...baseTurnData.metadata,
                    modelId: modelId,
                    raceTab: true,
                    raceParticipantIndex: index + 2,
                    raceMainInteractionId: mainInteraction.id,
                  }
                };

                // Create prompt for this specific model
                const childPrompt: PromptObject = {
                  ...prompt,
                  metadata: {
                    ...prompt.metadata,
                    modelId: modelId,
                  },
                };

                const childInteraction = await InteractionService.startInteraction(
                  childPrompt,
                  conversationId,
                  childTurnData,
                  "message.assistant_regen"
                );

                // Make this a child of the main interaction
                if (childInteraction) {
                  const updates: Partial<Omit<Interaction, "id">> = {
                    parentId: mainInteraction.id,
                    index: index + 1, // Tab index
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

        toast.success(`Race started! Original model + ${successfulChildren.length} additional race models responding in tabs.`);
      }
      
    } catch (error) {
      toast.error(`Race conversion failed: ${String(error)}`);
      console.error(`[RacePromptControlModule] Error during race conversion:`, error);
    }
  }

  private async waitForRaceCompletion(mainInteractionId: string, childInteractionIds: string[], timeoutSec: number = 120): Promise<void> {
  
    return new Promise((resolve) => {
      let completedCount = 0;
      const targetCount = childInteractionIds.length;

      let timeoutId: NodeJS.Timeout | null = null;

      const cleanup = () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        emitter.off(interactionEvent.completed, handleInteractionCompleted);
      };
      
      const handleInteractionCompleted = (payload: { interactionId: string; status: string }) => {
        if (!childInteractionIds.includes(payload.interactionId)) {
          return; // Not one of our race children
        }
        
        if (payload.status === "COMPLETED" || payload.status === "ERROR") {
          completedCount++;
          
          const interactionStore = useInteractionStore.getState();
          const progressText = `🏁 Race progress: ${completedCount}/${targetCount} models completed\n\n⏳ ${completedCount === targetCount ? 'Combining responses...' : 'Waiting for remaining responses...'}`;
          interactionStore.setActiveStreamBuffer(mainInteractionId, progressText);
          
          const updates = {
            metadata: {
              isRaceCombining: true,
              raceCompletedCount: completedCount,
              raceParticipantCount: targetCount,
            },
          };
          interactionStore._updateInteractionInState(mainInteractionId, updates);
          
          if (completedCount === targetCount) {
            cleanup();
            this.startCombineProcess(mainInteractionId, childInteractionIds);
            resolve();
          }
        }
      };
      
      emitter.on(interactionEvent.completed, handleInteractionCompleted);

      timeoutId = setTimeout(() => {
        console.warn(`[RacePromptControlModule] Race timed out for main interaction ${mainInteractionId}.`);
        cleanup();
        
        const interactionStore = useInteractionStore.getState();
        const errorText = `❌ Race timed out. Only ${completedCount}/${targetCount} models responded within ${timeoutSec} seconds.`;
        interactionStore.setActiveStreamBuffer(mainInteractionId, errorText);
        interactionStore._updateInteractionInState(mainInteractionId, {
          status: "ERROR",
          endedAt: new Date(),
          metadata: {
            isRaceCombining: false,
            combineError: "Race timed out",
          },
        });
        interactionStore._removeStreamingId(mainInteractionId);
        resolve(); // Resolve anyway to not leave the calling function hanging
      }, timeoutSec * 1000); // Use configurable timeout
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
      
      // Validate current conversation ID
      const currentConversationId = interactionStore.currentConversationId;
      if (!currentConversationId) {
        throw new Error("No current conversation ID available for combine process");
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

      // Create combine prompt object - Use the existing compact system
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

      // Create combine turn data - Use targetUserInteractionId to let existing handler work
      const { nanoid } = await import("nanoid");
      const combineTurnData: PromptTurnObject = {
        id: nanoid(),
        content: `[Internal combine generation for race interaction ${mainInteractionId}]`,
        parameters: combinePromptObject.parameters,
        metadata: {
          modelId: combineModelId,
          targetUserInteractionId: mainInteractionId, // This correctly points to the main interaction to be updated.
          targetConversationId: currentConversationId,
        }
      };

      // Start the combine interaction using conversation.compact type - Let existing handler do the work
      await InteractionService.startInteraction(
        combinePromptObject,
        currentConversationId,
        combineTurnData,
        "conversation.compact" // This triggers the existing compact completion handler
      );
      
    } catch (error) {

      
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