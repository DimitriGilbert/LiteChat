// src/services/conversation.service.ts
// FULL FILE
import type {
  PromptObject,
  PromptTurnObject,
  ResolvedRuleContent,
} from "@/types/litechat/prompt";
import { InteractionService } from "./interaction.service";
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
import { VfsService } from "@/services/vfs.service";
import { emitter } from "@/lib/litechat/event-emitter";
import { vfsEvent, VfsEventPayloads } from "@/types/litechat/events/vfs.events";
import { PersistenceService } from "@/services/persistence.service";
import type { Interaction } from "@/types/litechat/interaction";

export const ConversationService = {
  async submitPrompt(turnData: PromptTurnObject): Promise<void> {
    console.log("[ConversationService] submitPrompt called", turnData);
    const interactionStoreState = useInteractionStore.getState();
    const projectStoreState = useProjectStore.getState();
    const promptState = usePromptStateStore.getState();
    const conversationStoreState = useConversationStore.getState();
    const settingsStoreState = useSettingsStore.getState();

    const conversationId = interactionStoreState.currentConversationId;
    if (!conversationId) {
      toast.error("Cannot submit prompt: No active conversation.");
      console.error(
        "[ConversationService] submitPrompt failed: No conversationId."
      );
      return;
    }

    const currentConversation =
      conversationStoreState.getConversationById(conversationId);
    const currentProjectId = currentConversation?.projectId ?? null;
    const effectiveSettings =
      projectStoreState.getEffectiveProjectSettings(currentProjectId);

    const isFirstInteraction =
      interactionStoreState.interactions.filter(
        (i) => i.conversationId === conversationId
      ).length === 0;
    const shouldGenerateTitle =
      isFirstInteraction &&
      settingsStoreState.autoTitleEnabled &&
      turnData.metadata?.autoTitleEnabledForTurn === true &&
      settingsStoreState.autoTitleModelId;

    // Correctly build history for the AI
    const activeInteractionsOnSpine = interactionStoreState.interactions
      .filter(i => i.parentId === null && i.status === "COMPLETED")
      .sort((a, b) => a.index - b.index);

    const turnsForHistoryBuilder: Interaction[] = activeInteractionsOnSpine.map(activeInteraction => {
      if (activeInteraction.type === "message.assistant_regen" && activeInteraction.metadata?.regeneratedFromId) {
        const originalInteraction = interactionStoreState.interactions.find(
          orig => orig.id === activeInteraction.metadata!.regeneratedFromId
        );
        // Ensure the original interaction was a user_assistant type and had a prompt.
        if (originalInteraction && originalInteraction.prompt && originalInteraction.type === "message.user_assistant") {
          // Create a synthetic interaction for history: original prompt + regen's response & active status
          return {
            ...activeInteraction, // Includes regen's ID, response, status, parentId (null), index, etc.
            prompt: originalInteraction.prompt, // Crucially, take the prompt from the original
            type: "message.user_assistant", // Present it as a standard turn for buildHistoryMessages
          } as Interaction;
        }
      }
      // If it's already a user_assistant type with a prompt, or a regen whose original prompt couldn't be mapped cleanly,
      // return it as is, but ensure it has a prompt if it's user_assistant type.
      if (activeInteraction.type === "message.user_assistant" && activeInteraction.prompt) {
        return activeInteraction;
      }
      // Return null for types that don't fit the user_assistant structure for buildHistoryMessages or are incomplete
      return null;
    }).filter(Boolean) as Interaction[]; // Filter out any nulls

    const historyMessages: CoreMessage[] =
      buildHistoryMessages(turnsForHistoryBuilder);

    let userContent = turnData.content;
    const userMessageContentParts: (TextPart | ImagePart)[] = [];

    const effectiveRulesContent: ResolvedRuleContent[] =
      turnData.metadata?.effectiveRulesContent ?? [];

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

    const attachedFilesMeta = turnData.metadata?.attachedFiles ?? [];
    if (attachedFilesMeta.length > 0) {
      const fileContentParts = await this._processFilesForPrompt(
        attachedFilesMeta,
        conversationId
      );
      userMessageContentParts.unshift(...fileContentParts);
    }

    if (userMessageContentParts.length > 0) {
      historyMessages.push({ role: "user", content: userMessageContentParts });
    } else {
      console.warn(
        "[ConversationService] No user text or file content found in turnData. Submitting without user message."
      );
    }

    const turnSystemPrompt = turnData.metadata?.turnSystemPrompt as
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
      ...(turnData.parameters ?? {}),
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
        }))(turnData.metadata ?? {}),
        modelId: promptState.modelId ?? undefined,
        attachedFiles: turnData.metadata.attachedFiles?.map(
          ({ contentBase64, contentText, ...rest }) => rest
        ),
      },
    };

    try {
      const mainInteractionPromise = InteractionService.startInteraction(
        promptObject,
        conversationId,
        turnData
      );

      if (shouldGenerateTitle) {
        console.log(
          "[ConversationService] Triggering asynchronous title generation."
        );
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
    console.log(
      `[ConversationService] regenerateInteraction called for ID: ${interactionId}`
    );
    const interactionStore = useInteractionStore.getState();
    const projectStoreState = useProjectStore.getState();
    const promptState = usePromptStateStore.getState();
    const conversationStoreState = useConversationStore.getState();

    const targetInteraction = interactionStore.interactions.find(
      (i) => i.id === interactionId
    );
    console.log("[ConversationService] Target interaction for regen:", JSON.parse(JSON.stringify(targetInteraction)));

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
      .filter((r) => r.type === "system")
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
      newGeneratedInteraction = await InteractionService.startInteraction(
        promptObject,
        conversationId,
        originalTurnData,
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
        interactionStore._updateInteractionInState(newGeneratedInteraction.id, updatesForNewInteraction);
        finalNewInteractionState = {
            ...newGeneratedInteraction, 
            ...updatesForNewInteraction
        } as Interaction;
        await PersistenceService.saveInteraction(finalNewInteractionState);
      }
      console.log("[ConversationService] New active interaction state after potential updates:", JSON.parse(JSON.stringify(finalNewInteractionState)));
      
      const versionsToUpdate: Interaction[] = [];
      let currentInteractionInChain: Interaction | undefined | null = targetInteraction;

      while (currentInteractionInChain) {
        versionsToUpdate.push(currentInteractionInChain);
        const regeneratedFromId: string | undefined = currentInteractionInChain.metadata?.regeneratedFromId;
        if (regeneratedFromId) {
          currentInteractionInChain = interactionStore.interactions.find(i => i.id === regeneratedFromId);
        } else {
          currentInteractionInChain = null;
        }
      }

      const chronologicalVersionsToUpdate = versionsToUpdate.sort((a, b) => {
        const timeA = a.startedAt?.getTime() ?? 0;
        const timeB = b.startedAt?.getTime() ?? 0;
        return timeA - timeB;
      });

      for (let i = 0; i < chronologicalVersionsToUpdate.length; i++) {
        const interactionToUpdate = chronologicalVersionsToUpdate[i];
        const updatesForOldVersion: Partial<Omit<Interaction, "id">> = {
          parentId: finalNewInteractionState.id,
          index: i, 
        };
        console.log(`[ConversationService] Updating old version ${interactionToUpdate.id} to be child of ${finalNewInteractionState.id} with childIndex ${i}`, JSON.parse(JSON.stringify(updatesForOldVersion)));

        interactionStore._updateInteractionInState(interactionToUpdate.id, updatesForOldVersion);
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
          const currentConversation = useConversationStore
            .getState()
            .getConversationById(conversationId);
          const targetVfsKey = currentConversation?.projectId ?? "orphan";
          const contentBytes = await VfsService.readFileOp(targetVfsKey, fileMeta.path);
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
    console.log(
      `[ConversationService] Ensuring VFS ready for key "${targetVfsKey}"...`
    );
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
