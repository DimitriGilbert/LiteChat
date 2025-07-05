// src/services/conversation.service.ts
// FULL FILE
import type {
  PromptObject,
  PromptTurnObject,
  ResolvedRuleContent,
} from "@/types/litechat/prompt";
import { InteractionService } from "./interaction.service";
import { PromptCompilationService } from "./prompt-compilation.service";
import { useInteractionStore } from "@/store/interaction.store";
import { useProjectStore } from "@/store/project.store";
import { usePromptStateStore } from "@/store/prompt.store";
import { useVfsStore } from "@/store/vfs.store";
import {
  buildHistoryMessages,
  processFileMetaToUserContent,
} from "@/lib/litechat/ai-helpers";
import type { CoreMessage, ImagePart, TextPart } from "ai";
import { toast } from "sonner";
import type { AttachedFileMetadata } from "@/store/input.store";
import type { fs as FsType } from "@zenfs/core";
import { useConversationStore } from "@/store/conversation.store";
import type { DbRule } from "@/types/litechat/rules";
import { useSettingsStore } from "@/store/settings.store";
import { nanoid } from "nanoid";
import * as VfsOps from "@/lib/litechat/vfs-operations";
import { emitter } from "@/lib/litechat/event-emitter";
import { vfsEvent, VfsEventPayloads } from "@/types/litechat/events/vfs.events";
import { interactionEvent } from "@/types/litechat/events/interaction.events";
import { PersistenceService } from "@/services/persistence.service";
import type { Interaction } from "@/types/litechat/interaction";
import { promptEvent } from "@/types/litechat/events/prompt.events";

export const ConversationService = {
  async submitPrompt(turnData: PromptTurnObject): Promise<void> {
    console.log("[ConversationService] submitPrompt called", turnData);
    const interactionStoreState = useInteractionStore.getState();
    const settingsStoreState = useSettingsStore.getState();

    const conversationId = interactionStoreState.currentConversationId;
    if (!conversationId) {
      toast.error("Cannot submit prompt: No active conversation.");
      console.error(
        "[ConversationService] submitPrompt failed: No conversationId."
      );
      return;
    }


    const isFirstInteraction =
      interactionStoreState.interactions.filter(
        (i) => i.conversationId === conversationId
      ).length === 0;
    const shouldGenerateTitle =
      isFirstInteraction &&
      settingsStoreState.autoTitleEnabled &&
      turnData.metadata?.autoTitleEnabledForTurn === true &&
      settingsStoreState.autoTitleModelId;

    // Use centralized prompt compilation service
    const promptObject = await PromptCompilationService.compilePrompt(
      turnData,
      conversationId
    );

    try {
      const mainInteractionPromise = InteractionService.startInteraction(
        promptObject,
        conversationId,
        turnData
      );

      if (shouldGenerateTitle) {
        // console.log(
        //   "[ConversationService] Triggering asynchronous title generation."
        // );
        const rulesForTitleContext: DbRule[] = (
          turnData.metadata?.effectiveRulesContent ?? []
        ).map((erc) => ({
          id: erc.sourceRuleId || nanoid(),
          name: erc.sourceRuleId
            ? `Rule ${erc.sourceRuleId.substring(0, 4)}`
            : "Context Rule",
          content: erc.content,
          type: erc.type,
          createdAt: new Date(),
          updatedAt: new Date(),
        }));

        this.generateConversationTitle(
          conversationId,
          turnData,
          rulesForTitleContext
        ).catch((titleError) => {
          console.error(
            "[ConversationService] Background title generation failed:",
            titleError
          );
        });
      }
      await mainInteractionPromise;
    } catch (error) {
      console.error("[ConversationService] Error starting interaction:", error);
      toast.error(
        `Failed to start interaction: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      throw error;
    }
  },

  async generateConversationTitle(
    conversationId: string,
    originalTurnData: PromptTurnObject,
    activeRulesForTurn: DbRule[]
  ): Promise<void> {
    const settings = useSettingsStore.getState();

    if (!settings.autoTitleModelId) {
      console.warn(
        "[ConversationService] Auto-title generation skipped: No model selected in settings."
      );
      return;
    }

    let titlePromptContent = originalTurnData.content;

    if (titlePromptContent.length > settings.autoTitlePromptMaxLength) {
      titlePromptContent =
        titlePromptContent.substring(0, settings.autoTitlePromptMaxLength) +
        "...";
    }

    if (
      settings.autoTitleIncludeFiles &&
      originalTurnData.metadata?.attachedFiles?.length
    ) {
      const fileNames = originalTurnData.metadata.attachedFiles
        .map((f) => f.name)
        .join(", ");
      titlePromptContent += `

[Attached files: ${fileNames}]`;
    }

    if (settings.autoTitleIncludeRules && activeRulesForTurn.length > 0) {
      const ruleNames = activeRulesForTurn.map((r) => r.name).join(", ");
      titlePromptContent += `

[Active rules: ${ruleNames}]`;
    }

    const titlePromptObject: PromptObject = {
      system:
        "Generate a concise, descriptive title (max 8-10 words) for the following user prompt. Output ONLY the title text, nothing else.",
      messages: [{ role: "user", content: titlePromptContent }],
      parameters: {
        temperature: 0.5,
        max_tokens: 20,
      },
      metadata: {
        modelId: settings.autoTitleModelId,
        isTitleGeneration: true,
      },
      tools: undefined,
      toolChoice: "none",
    };

    const titleTurnData: PromptTurnObject = {
      id: nanoid(),
      content: `[Generate title based on: ${originalTurnData.content.substring(
        0,
        50
      )}...]`,
      parameters: titlePromptObject.parameters,
      metadata: {
        ...titlePromptObject.metadata,
        originalTurnId: originalTurnData.id,
      },
    };

    try {
      await InteractionService.startInteraction(
        titlePromptObject,
        conversationId,
        titleTurnData,
        "conversation.title_generation"
      );
    } catch (error) {
      console.error(
        "[ConversationService] Error starting title generation interaction:",
        error
      );
    }
  },

  async regenerateInteraction(interactionId: string): Promise<void> {
    // console.log(
    //   `[ConversationService] regenerateInteraction called for ID: ${interactionId}`
    // );
    const interactionStore = useInteractionStore.getState();
    const projectStoreState = useProjectStore.getState();
    const promptState = usePromptStateStore.getState();
    const conversationStoreState = useConversationStore.getState();

    const targetInteraction = interactionStore.interactions.find(
      (i) => i.id === interactionId
    );
    // console.log("[ConversationService] Target interaction for regen:", JSON.parse(JSON.stringify(targetInteraction)));

    if (!targetInteraction || !targetInteraction.prompt) {
      toast.error("Cannot regenerate: Original interaction data missing.");
      return;
    }

    const newInteractionParentId = null;
    const newInteractionIndex = targetInteraction.index;

    const originalTurnData = targetInteraction.prompt;
    const conversationId = targetInteraction.conversationId;
    const currentConversation =
      conversationStoreState.getConversationById(conversationId);
    const currentProjectId = currentConversation?.projectId ?? null;
    const effectiveSettings =
      projectStoreState.getEffectiveProjectSettings(currentProjectId);

    const historyUpToIndex = targetInteraction.index;
    const historyInteractions = interactionStore.interactions
      .filter(
        (i) =>
          i.conversationId === conversationId &&
          i.index < historyUpToIndex &&
          i.status === "COMPLETED" &&
          i.type === "message.user_assistant" &&
          i.parentId === null
      )
      .sort((a, b) => a.index - b.index);
    const historyMessages: CoreMessage[] =
      buildHistoryMessages(historyInteractions);

    let userContent = originalTurnData.content;
    const userMessageContentParts: (TextPart | ImagePart)[] = [];

    const effectiveRulesContent: ResolvedRuleContent[] =
      originalTurnData.metadata?.effectiveRulesContent ?? [];

    const systemRulesContent = effectiveRulesContent
      .filter((r) => r.type === "system" || r.type === "control")
      .map((r) => r.content);
    const beforeRulesContent = effectiveRulesContent
      .filter((r) => r.type === "before")
      .map((r) => r.content);
    const afterRulesContent = effectiveRulesContent
      .filter((r) => r.type === "after")
      .map((r) => r.content);

    if (beforeRulesContent.length > 0) {
      userContent = `${beforeRulesContent.join(`
`)}

${userContent}`;
    }
    if (afterRulesContent.length > 0) {
      userContent = `${userContent}

    ${afterRulesContent.join(`
`)}`;
    }

    if (userContent) {
      userMessageContentParts.push({ type: "text", text: userContent });
    }
    const originalAttachedFiles =
      originalTurnData.metadata?.attachedFiles ?? [];
    if (originalAttachedFiles.length > 0) {
      const fileContentParts = await this._processFilesForPrompt(
        originalAttachedFiles,
        conversationId
      );
      userMessageContentParts.unshift(...fileContentParts);
    }

    if (userMessageContentParts.length > 0) {
      historyMessages.push({ role: "user", content: userMessageContentParts });
    } else {
      console.warn(
        "[ConversationService] No user text or file content found in original turnData for regeneration."
      );
    }

    const turnSystemPrompt = originalTurnData.metadata?.turnSystemPrompt as
      | string
      | undefined;
    let baseSystemPrompt =
      turnSystemPrompt ?? effectiveSettings.systemPrompt ?? undefined;

    if (systemRulesContent.length > 0) {
      baseSystemPrompt = `${
        baseSystemPrompt
          ? `${baseSystemPrompt}

        `
          : ""
      }${systemRulesContent.join(`
`)}`;
    }

    const finalParameters = {
      temperature: promptState.temperature,
      max_tokens: promptState.maxTokens,
      top_p: promptState.topP,
      top_k: promptState.topK,
      presence_penalty: promptState.presencePenalty,
      frequency_penalty: promptState.frequencyPenalty,
      ...(originalTurnData.parameters ?? {}),
    };
    Object.keys(finalParameters).forEach((key) => {
      if (
        finalParameters[key as keyof typeof finalParameters] === null ||
        finalParameters[key as keyof typeof finalParameters] === undefined
      ) {
        delete finalParameters[key as keyof typeof finalParameters];
      }
    });

    const promptObject: PromptObject = {
      system: baseSystemPrompt,
      messages: historyMessages,
      parameters: finalParameters,
      metadata: {
        ...(({
          turnSystemPrompt: _turnSystemPrompt,
          activeTagIds,
          activeRuleIds,
          effectiveRulesContent: _effectiveRulesContent,
          autoTitleEnabledForTurn,
          ...restMeta
        }) => ({
          ...restMeta,
          effectivelyAppliedTagIds: activeTagIds,
          effectivelyAppliedRuleIds: activeRuleIds,
        }))(originalTurnData.metadata ?? {}),
        modelId: promptState.modelId ?? undefined,
        regeneratedFromId: interactionId,
        attachedFiles: originalAttachedFiles.map(
          ({ contentBase64, contentText, ...rest }) => rest
        ),
      },
    };

    let newGeneratedInteraction: Interaction | null = null;
    try {
      // CRITICAL FIX: Generate a new unique ID for the regenerated interaction
      // to avoid ID collision with the original interaction
      const newTurnData: PromptTurnObject = {
        ...originalTurnData,
        id: nanoid(), // Generate new unique ID instead of reusing original
      };

      newGeneratedInteraction = await InteractionService.startInteraction(
        promptObject,
        conversationId,
        newTurnData, // Use new turn data with unique ID
        "message.assistant_regen"
      );

      if (!newGeneratedInteraction) {
        throw new Error("Failed to create new interaction for regeneration.");
      }

      const updatesForNewInteraction: Partial<Omit<Interaction, "id">> = {};
      let newInteractionWasModified = false;

      if (newGeneratedInteraction.index !== newInteractionIndex) {
        updatesForNewInteraction.index = newInteractionIndex;
        newInteractionWasModified = true;
      }
      if (newGeneratedInteraction.parentId !== newInteractionParentId) {
        updatesForNewInteraction.parentId = newInteractionParentId;
        newInteractionWasModified = true;
      }

      let finalNewInteractionState = newGeneratedInteraction;
      if (newInteractionWasModified) {
        interactionStore._updateInteractionInState(
          newGeneratedInteraction.id,
          updatesForNewInteraction
        );
        finalNewInteractionState = {
          ...newGeneratedInteraction,
          ...updatesForNewInteraction,
        } as Interaction;
        await PersistenceService.saveInteraction(finalNewInteractionState);
      }
      // console.log("[ConversationService] New active interaction state after potential updates:", JSON.parse(JSON.stringify(finalNewInteractionState)));

      // Build the chain of interactions to update (original and any previous regens)
      const versionsToUpdate: Interaction[] = [];
      let currentInteractionInChain: Interaction | undefined | null =
        targetInteraction;

      while (currentInteractionInChain) {
        versionsToUpdate.push(currentInteractionInChain);
        const regeneratedFromId: string | undefined =
          currentInteractionInChain.metadata?.regeneratedFromId;
        if (regeneratedFromId) {
          currentInteractionInChain = interactionStore.interactions.find(
            (i) => i.id === regeneratedFromId
          );
        } else {
          currentInteractionInChain = null;
        }
      }

      // Sort chronologically to maintain proper ordering
      const chronologicalVersionsToUpdate = versionsToUpdate.sort((a, b) => {
        const timeA = a.startedAt?.getTime() ?? 0;
        const timeB = b.startedAt?.getTime() ?? 0;
        return timeA - timeB;
      });

      // CRITICAL FIX: Make old interactions children of the NEW regenerated interaction
      // (not children of themselves, which was the bug)
      for (let i = 0; i < chronologicalVersionsToUpdate.length; i++) {
        const interactionToUpdate = chronologicalVersionsToUpdate[i];
        const updatesForOldVersion: Partial<Omit<Interaction, "id">> = {
          parentId: finalNewInteractionState.id, // Make them children of the NEW interaction
          index: i, // Children get sequential index starting from 0
        };
        // console.log(`[ConversationService] Updating old version ${interactionToUpdate.id} to be child of ${finalNewInteractionState.id} with childIndex ${i}`, JSON.parse(JSON.stringify(updatesForOldVersion)));

        interactionStore._updateInteractionInState(
          interactionToUpdate.id,
          updatesForOldVersion
        );
        await PersistenceService.saveInteraction({
          ...interactionToUpdate,
          ...updatesForOldVersion,
        } as Interaction);
      }
    } catch (error) {
      console.error(
        "[ConversationService] Error during regeneration process:",
        error
      );
      toast.error(
        `Failed to regenerate response: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      throw error;
    }
  },

  // Add a set to track ongoing fork operations
  _pendingForks: new Set<string>(),
  _pendingCompactForks: new Set<string>(),

  async forkConversation(interactionId: string): Promise<void> {
    // console.log(
    //   `[ConversationService] forkConversation called for ID: ${interactionId}`
    // );

    // Prevent multiple simultaneous forks of the same interaction
    if (this._pendingForks.has(interactionId)) {
      console.warn(
        `[ConversationService] Fork already in progress for ${interactionId}`
      );
      toast.info("Fork already in progress for this interaction.");
      return;
    }

    this._pendingForks.add(interactionId);

    try {
      const interactionStore = useInteractionStore.getState();
      const conversationStoreState = useConversationStore.getState();

      const targetInteraction = interactionStore.interactions.find(
        (i) => i.id === interactionId
      );

      if (!targetInteraction) {
        toast.error("Cannot fork: Interaction not found.");
        return;
      }

      const originalConversation = conversationStoreState.getConversationById(
        targetInteraction.conversationId
      );
      if (!originalConversation) {
        toast.error("Cannot fork: Original conversation not found.");
        return;
      }

      // Get all interactions up to and including the target interaction
      const interactionsToFork = interactionStore.interactions
        .filter(
          (i) =>
            i.conversationId === targetInteraction.conversationId &&
            i.index <= targetInteraction.index &&
            i.parentId === null && // Only main spine interactions
            (i.type === "message.user_assistant" ||
              i.type === "message.assistant_regen")
        )
        .sort((a, b) => a.index - b.index);

      // Create new conversation with "Fork: " prefix
      const newConversationTitle = `Fork: ${originalConversation.title}`;
      const newConversationId = await conversationStoreState.addConversation({
        title: newConversationTitle,
        projectId: originalConversation.projectId,
        metadata: originalConversation.metadata,
      });

      // Duplicate all interactions up to the fork point into the single new conversation
      for (let i = 0; i < interactionsToFork.length; i++) {
        const interaction = interactionsToFork[i];
        const newInteraction: Interaction = {
          ...interaction,
          id: nanoid(),
          conversationId: newConversationId,
          index: i,
          parentId: null,
          startedAt: new Date(),
          endedAt: interaction.endedAt ? new Date() : null,
          metadata: {
            ...interaction.metadata,
            forkedFromId: interaction.id,
          },
        };
        await PersistenceService.saveInteraction(newInteraction);
      }

      // Select the new conversation and focus input
      await conversationStoreState.selectItem(
        newConversationId,
        "conversation"
      );
      emitter.emit(promptEvent.focusInputRequest, undefined);

      toast.success(
        `Conversation forked successfully: "${newConversationTitle}"`
      );
    } catch (error) {
      console.error("[ConversationService] Error during fork process:", error);
      toast.error(
        `Failed to fork conversation: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      throw error;
    } finally {
      // Always remove from pending forks
      this._pendingForks.delete(interactionId);
    }
  },

  async forkConversationCompact(
    interactionId: string,
    compactModelId: string
  ): Promise<void> {
    // console.log(
    //   `[ConversationService] forkConversationCompact called for ID: ${interactionId} with model: ${compactModelId}`
    // );

    // Prevent multiple simultaneous compact forks of the same interaction
    if (this._pendingCompactForks.has(interactionId)) {
      console.warn(
        `[ConversationService] Compact fork already in progress for ${interactionId}`
      );
      toast.info("Compact fork already in progress for this interaction.");
      return;
    }

    this._pendingCompactForks.add(interactionId);

    // The _pendingCompactForks set above already handles rapid-fire duplicate requests
    // Users should be able to create multiple compacts of the same conversation if they want

    try {
      const interactionStore = useInteractionStore.getState();
      const conversationStoreState = useConversationStore.getState();
      const settingsStoreState = useSettingsStore.getState();

      const targetInteraction = interactionStore.interactions.find(
        (i) => i.id === interactionId
      );

      if (!targetInteraction) {
        toast.error("Cannot fork compact: Interaction not found.");
        return;
      }

      const originalConversation = conversationStoreState.getConversationById(
        targetInteraction.conversationId
      );
      if (!originalConversation) {
        toast.error("Cannot fork compact: Original conversation not found.");
        return;
      }

      // Get all interactions up to and including the target interaction
      const interactionsToCompact = interactionStore.interactions
        .filter(
          (i) =>
            i.conversationId === targetInteraction.conversationId &&
            i.index <= targetInteraction.index &&
            i.parentId === null && // Only main spine interactions
            (i.type === "message.user_assistant" ||
              i.type === "message.assistant_regen")
        )
        .sort((a, b) => a.index - b.index);

      // Build the conversation history for compacting
      const historyMessages: CoreMessage[] = buildHistoryMessages(
        interactionsToCompact
      );

      // Helper function to safely format message content for text summarization
      const formatMessageContent = (content: any): string => {
        if (typeof content === "string") {
          return content;
        }

        if (Array.isArray(content)) {
          return content
            .map((part) => {
              if (part.type === "text") {
                return part.text;
              } else if (part.type === "image") {
                // For images, just indicate their presence without including the data
                return "[Image attached]";
              } else {
                // For other content types, provide a brief description
                return `[${part.type || "Content"} attached]`;
              }
            })
            .join(" ");
        }

        // For other object types, try to extract meaningful text or provide a placeholder
        if (typeof content === "object" && content !== null) {
          // If it has a text property, use that
          if ("text" in content && typeof content.text === "string") {
            return content.text;
          }
          // Otherwise, just indicate non-text content
          return "[Non-text content]";
        }

        return String(content);
      };

      // Format conversation history for text-based summarization
      const formattedHistory = historyMessages
        .map(
          (msg) =>
            `**${msg.role.toUpperCase()}:** ${formatMessageContent(
              msg.content
            )}`
        )
        .join("\n\n");

      // Use custom prompt from settings or default, ensuring history is always included
      const customPrompt = settingsStoreState.forkCompactPrompt;
      const defaultPrompt = `Please provide a comprehensive but concise summary of our previous conversation. Include:
1. The main topics discussed
2. Key decisions or conclusions reached
3. Important context that would be needed to continue the conversation
4. Any specific technical details, code, or data that were mentioned

Keep the summary detailed enough that we can seamlessly continue our discussion, but compact enough to be efficient.`;

      // If custom prompt is provided, use it as the instruction but always append the history
      const compactPrompt = customPrompt
        ? `${customPrompt}\n\nHere is our conversation history to summarize:\n\n${formattedHistory}`
        : `${defaultPrompt}\n\nHere is our conversation history to summarize:\n\n${formattedHistory}`;

      // Use custom model from settings if available, otherwise use the provided model
      const effectiveModelId =
        settingsStoreState.forkCompactModelId || compactModelId;

      const compactPromptObject: PromptObject = {
        system:
          "You are an expert at creating comprehensive conversation summaries. Provide a detailed but concise summary that captures all important context and information needed to continue the conversation seamlessly.",
        messages: [{ role: "user", content: compactPrompt }],
        parameters: {
          temperature: 0.3,
          max_tokens: 2000,
        },
        metadata: {
          modelId: effectiveModelId,
          isCompactGeneration: true,
        },
        tools: undefined,
        toolChoice: "none",
      };

      // Create new conversation with "Compact: " prefix
      const newConversationTitle = `Compact: ${originalConversation.title}`;
      const newConversationId = await conversationStoreState.addConversation({
        title: newConversationTitle,
        projectId: originalConversation.projectId,
        metadata: originalConversation.metadata,
      });

      // Create the user message asking for conversation summary
      const userMessage = `Please provide a comprehensive summary of our previous conversation titled "${originalConversation.title}". Include the main topics, key decisions, and important context needed to continue seamlessly.`;

      const initialUserInteraction: Interaction = {
        id: nanoid(),
        conversationId: newConversationId,
        type: "message.user_assistant",
        prompt: {
          id: nanoid(),
          content: userMessage,
          parameters: {},
          metadata: {
            isResumeMessage: true,
            originalConversationId: targetInteraction.conversationId,
            compactedFromInteractionId: interactionId,
          },
        },
        response: "Compacting...",
        status: "STREAMING",
        startedAt: new Date(),
        endedAt: null,
        metadata: {
          isResumeMessage: true,
          originalConversationId: targetInteraction.conversationId,
          compactedFromInteractionId: interactionId,
          isCompactingInProgress: true,
        },
        index: 0,
        parentId: null,
      };

      await PersistenceService.saveInteraction(initialUserInteraction);

      // Add the initial interaction to the current conversation's in-memory store before switching
      // This ensures the "Compacting..." message appears immediately in the UI
      const interactionStoreState = useInteractionStore.getState();
      interactionStoreState._addInteractionToState(initialUserInteraction);

      // FIRST: Select the new conversation so the interaction store is in the right context
      await conversationStoreState.selectItem(
        newConversationId,
        "conversation"
      );

      // Wait for conversation selection and interaction loading to complete
      await new Promise<void>((resolve) => {
        const handleInteractionLoaded = (payload: any) => {
          if (payload.conversationId === newConversationId) {
            emitter.off(interactionEvent.loaded, handleInteractionLoaded);
            resolve();
          }
        };
        emitter.on(interactionEvent.loaded, handleInteractionLoaded);

        // Fallback timeout in case event doesn't fire
        setTimeout(() => {
          emitter.off(interactionEvent.loaded, handleInteractionLoaded);
          resolve();
        }, 2000);
      });

      // THEN: Create the compact turn data for the hidden compact interaction
      const compactTurnData: PromptTurnObject = {
        id: nanoid(),
        content: `[Internal compact generation for conversation ${interactionId}]`,
        parameters: compactPromptObject.parameters,
        metadata: {
          ...compactPromptObject.metadata,
          originalConversationId: targetInteraction.conversationId,
          compactedFromInteractionId: interactionId,
          targetUserInteractionId: initialUserInteraction.id,
          targetConversationId: newConversationId,
        },
      };

      // FINALLY: Start the compact generation interaction (hidden) - now in correct context
      await InteractionService.startInteraction(
        compactPromptObject,
        newConversationId,
        compactTurnData,
        "conversation.compact"
      );

      // Focus input
      emitter.emit(promptEvent.focusInputRequest, undefined);

      toast.success(
        `Conversation compacted and forked: "${newConversationTitle}"`
      );
    } catch (error) {
      console.error(
        "[ConversationService] Error during compact fork process:",
        error
      );
      toast.error(
        `Failed to fork and compact conversation: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      throw error;
    } finally {
      // Always remove from pending compact forks
      this._pendingCompactForks.delete(interactionId);
    }
  },

  async _processFilesForPrompt(
    filesMeta: AttachedFileMetadata[],
    conversationId: string
  ): Promise<(TextPart | ImagePart)[]> {
    const fileContentParts: (TextPart | ImagePart)[] = [];
    const vfsFiles = filesMeta.filter((f) => f.source === "vfs");
    let vfsInstance: typeof FsType | undefined;

    if (vfsFiles.length > 0) {
      const currentConversation = useConversationStore
        .getState()
        .getConversationById(conversationId);
      const targetVfsKey = currentConversation?.projectId ?? "orphan";
      try {
        vfsInstance = await this._ensureVfsReady(targetVfsKey);
      } catch (fsError) {
        toast.error(
          `Filesystem unavailable for key ${targetVfsKey}. VFS files cannot be processed.`
        );
        vfsFiles.forEach((fileMeta) => {
          fileContentParts.push({
            type: "text",
            text: `[Skipped VFS file: ${fileMeta.name} - Filesystem unavailable]`,
          });
        });
        vfsInstance = undefined;
      }
    }

    for (const fileMeta of filesMeta) {
      let contentPart: TextPart | ImagePart | null = null;
      try {
        if (fileMeta.source === "direct") {
          contentPart = processFileMetaToUserContent(fileMeta);
        } else if (fileMeta.source === "vfs" && vfsInstance && fileMeta.path) {
          console.log(
            `[ConversationService] Fetching VFS file: ${fileMeta.path}`
          );
          const contentBytes = await VfsOps.readFileOp(fileMeta.path, {
            fsInstance: vfsInstance,
          });
          contentPart = processFileMetaToUserContent({
            ...fileMeta,
            contentBytes: contentBytes,
          });
        } else if (fileMeta.source === "vfs" && !vfsInstance) {
          continue;
        }

        if (contentPart) {
          fileContentParts.push(contentPart);
        }
      } catch (processingError) {
        console.error(
          `[ConversationService] Error processing file ${fileMeta.name}:`,
          processingError
        );
        fileContentParts.push({
          type: "text",
          text: `[Error processing file: ${fileMeta.name}]`,
        });
      }
    }
    return fileContentParts;
  },

  async _ensureVfsReady(
    targetVfsKey: string
  ): Promise<typeof FsType | undefined> {
    // console.log(
    //   `[ConversationService] Ensuring VFS ready for key "${targetVfsKey}"...`
    // );
    return new Promise((resolve, reject) => {
      const handleFsInstanceChanged = (
        payload: VfsEventPayloads[typeof vfsEvent.fsInstanceChanged]
      ) => {
        if (useVfsStore.getState().configuredVfsKey === targetVfsKey) {
          cleanupSubscriptions();
          resolve(payload.fsInstance as typeof FsType | undefined);
        }
      };

      const handleLoadingStateChanged = (
        payload: VfsEventPayloads[typeof vfsEvent.loadingStateChanged]
      ) => {
        if (
          useVfsStore.getState().configuredVfsKey === targetVfsKey &&
          !payload.isLoading &&
          !payload.operationLoading
        ) {
          if (payload.error) {
            cleanupSubscriptions();
            reject(new Error(payload.error));
          } else {
            const fsInstance = useVfsStore.getState().fs;
            if (fsInstance) {
              cleanupSubscriptions();
              resolve(fsInstance);
            }
          }
        }
      };

      const cleanupSubscriptions = () => {
        emitter.off(vfsEvent.fsInstanceChanged, handleFsInstanceChanged);
        emitter.off(vfsEvent.loadingStateChanged, handleLoadingStateChanged);
      };

      emitter.on(vfsEvent.fsInstanceChanged, handleFsInstanceChanged);
      emitter.on(vfsEvent.loadingStateChanged, handleLoadingStateChanged);

      const vfsState = useVfsStore.getState();
      if (
        vfsState.configuredVfsKey === targetVfsKey &&
        vfsState.fs &&
        !vfsState.loading &&
        !vfsState.operationLoading &&
        !vfsState.error
      ) {
        cleanupSubscriptions();
        resolve(vfsState.fs);
        return;
      }
      if (
        vfsState.configuredVfsKey === targetVfsKey &&
        vfsState.error &&
        !vfsState.loading &&
        !vfsState.operationLoading
      ) {
        cleanupSubscriptions();
        reject(new Error(vfsState.error));
        return;
      }

      emitter.emit(vfsEvent.initializeVFSRequest, {
        vfsKey: targetVfsKey,
        options: { force: true },
      });
    });
  },
};
