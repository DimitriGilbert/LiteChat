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


export class RacePromptControlModule implements ControlModule {
  public readonly id = "race-prompt-control";
  private eventUnsubscribers: (() => void)[] = [];
  // @ts-expect-error meh, do not care laaah
  private modApi: LiteChatModApi | null = null;
  private notifyComponentUpdate: (() => void) | null = null;

  // Race state
  private isRaceMode = false;
  private raceModelIds: string[] = [];
  private raceStaggerMs = 250;

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
          return await this.handleRaceSubmission(payload.turnData);
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

  setRaceMode(active: boolean, modelIds?: string[], staggerMs?: number): void {
    this.isRaceMode = active;
    
    if (active && modelIds && staggerMs !== undefined) {
      this.raceModelIds = modelIds;
      this.raceStaggerMs = staggerMs;
    } else {
      this.raceModelIds = [];
      this.raceStaggerMs = 250;
    }
    
    this.notifyComponentUpdate?.();
  }

  get isRaceModeActive(): boolean {
    return this.isRaceMode;
  }

  // This method will be called by middleware when race mode is active
  async handleRaceSubmission(turnData: PromptTurnObject): Promise<false | { turnData: PromptTurnObject }> {
    try {
      console.log(`[RacePromptControlModule] Starting race submission with ${this.raceModelIds.length} models:`, this.raceModelIds);
      
      const interactionStore = useInteractionStore.getState();
      // const conversationStore = useConversationStore.getState();
      
      // Get current conversation
      const currentConversationId = interactionStore.currentConversationId;
      if (!currentConversationId) {
        toast.error("No active conversation for racing");
        return false;
      }

      if (this.raceModelIds.length === 0) {
        toast.error("No models selected for racing");
        this.setRaceMode(false);
        return false;
      }

      toast.info(`Racing ${this.raceModelIds.length} models with your prompt...`);

      // Get the conversation index for the new interactions
      const conversationInteractions = interactionStore.interactions.filter(
        (i) => i.conversationId === currentConversationId
      );
      const newIndex = conversationInteractions.reduce(
        (max, i) => Math.max(max, i.index),
        -1
      ) + 1;

      // Build the prompt object once (will be reused for all models)
      const promptObject = await this.buildPromptObject(turnData, currentConversationId, newIndex);

      // Store the model IDs before disabling race mode
      const raceModelIds = [...this.raceModelIds];
      const staggerMs = this.raceStaggerMs;

      // Get the currently selected model (this becomes the main interaction)
      const promptState = usePromptStateStore.getState();
      const currentModelId = promptState.modelId;
      
      if (!currentModelId) {
        toast.error("No model currently selected");
        this.setRaceMode(false);
        return false;
      }

      // Disable race mode to prevent multiple races
      this.setRaceMode(false);

      // Create the main interaction with the currently selected model (this goes on the main spine)
      const mainPromptObject = {
        ...promptObject,
        metadata: {
          ...promptObject.metadata,
          modelId: currentModelId,
        }
      };

      const mainInteraction = await InteractionService.startInteraction(
        mainPromptObject,
        currentConversationId,
        turnData,
        "message.user_assistant"
      );

      if (!mainInteraction) {
        throw new Error("Failed to create main race interaction");
      }

      // Create child interactions for ALL race models (these become tabs)
      const childInteractionPromises = raceModelIds.map((modelId, index) => {
        return new Promise<void>((resolve) => {
          setTimeout(async () => {
            try {
              const childPromptObject = {
                ...promptObject,
                metadata: {
                  ...promptObject.metadata,
                  modelId: modelId,
                  raceTab: true, // Mark this as a race tab
                  raceParticipantIndex: index + 1, // Track the race position
                }
              };

              // Create unique turnData for each child interaction
              const { nanoid } = await import("nanoid");
              const childTurnData: PromptTurnObject = {
                ...turnData,
                id: nanoid(), // Each child gets its own unique ID
                metadata: {
                  ...turnData.metadata,
                  raceTab: true,
                  raceParticipantIndex: index + 1,
                  parentTurnId: turnData.id, // Reference to parent
                }
              };

              const childInteraction = await InteractionService.startInteraction(
                childPromptObject,
                currentConversationId,
                childTurnData,
                "message.assistant_regen"
              );

              if (childInteraction) {
                // Update the child interaction to be a tab of the main interaction
                const updates: Partial<Omit<Interaction, "id">> = {
                  parentId: mainInteraction.id,
                  index: index + 1, // Tab index (0 is main, 1+ are additional tabs)
                };

                interactionStore._updateInteractionInState(childInteraction.id, updates);
                await PersistenceService.saveInteraction({
                  ...childInteraction,
                  ...updates,
                } as Interaction);
              }

              resolve();
            } catch (error) {
              console.error(`[RacePromptControlModule] Race participant ${index + 1} failed:`, error);
              resolve();
            }
          }, (index + 1) * staggerMs); // Start after the main interaction
        });
      });

      // Wait for all child interactions to be created
      await Promise.all(childInteractionPromises);
      
      toast.success(`Race started! Current model + ${raceModelIds.length} race models responding in tabs.`);
      
      return false; // Cancel normal submission since we handled it
      
    } catch (error) {
      toast.error(`Race failed: ${String(error)}`);
      console.error(`[RacePromptControlModule] Error during race:`, error);
      
      // Disable race mode on error
      this.setRaceMode(false);
      return false; // Cancel normal submission
    }
  }

  private async buildPromptObject(turnData: PromptTurnObject, conversationId: string, newIndex: number): Promise<PromptObject> {
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

    const attachedFilesMeta = turnData.metadata?.attachedFiles ?? [];
    if (attachedFilesMeta.length > 0) {
      // TODO: Process files properly (reuse ConversationService._processFilesForPrompt logic)
      // For now, just add them as text
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
        attachedFiles: attachedFilesMeta.map(
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