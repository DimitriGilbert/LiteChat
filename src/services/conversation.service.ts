// src/services/conversation.service.ts
// FULL FILE
import type { PromptObject, PromptTurnObject } from "@/types/litechat/prompt";
import { InteractionService } from "./interaction.service";
import { useInteractionStore } from "@/store/interaction.store";
import { useProjectStore } from "@/store/project.store";
import { usePromptStateStore } from "@/store/prompt.store";
import { useVfsStore } from "@/store/vfs.store";
import { useRulesStore } from "@/store/rules.store";
import * as VfsOps from "@/lib/litechat/vfs-operations";
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

export const ConversationService = {
  async submitPrompt(turnData: PromptTurnObject): Promise<void> {
    console.log("[ConversationService] submitPrompt called", turnData);
    const interactionStoreState = useInteractionStore.getState();
    const projectStoreState = useProjectStore.getState();
    const promptState = usePromptStateStore.getState();
    const conversationStoreState = useConversationStore.getState();
    const rulesStoreState = useRulesStore.getState();
    const settingsStoreState = useSettingsStore.getState();

    const conversationId = interactionStoreState.currentConversationId;
    if (!conversationId) {
      toast.error("Cannot submit prompt: No active conversation.");
      console.error(
        "[ConversationService] submitPrompt failed: No conversationId.",
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
        (i) => i.conversationId === conversationId,
      ).length === 0;
    const shouldGenerateTitle =
      isFirstInteraction &&
      settingsStoreState.autoTitleEnabled &&
      turnData.metadata?.autoTitleEnabledForTurn === true &&
      settingsStoreState.autoTitleModelId;

    const currentHistory = interactionStoreState.interactions;
    const completedHistory = currentHistory.filter(
      (i) => i.status === "COMPLETED" && i.type === "message.user_assistant",
    );
    const historyMessages: CoreMessage[] =
      buildHistoryMessages(completedHistory);

    let userContent = turnData.content;
    const userMessageContentParts: (TextPart | ImagePart)[] = [];

    const projectDefaultTagIds = effectiveSettings.defaultTagIds ?? [];
    const projectDefaultRuleIds = effectiveSettings.defaultRuleIds ?? [];
    const turnActiveTagIds = turnData.metadata?.activeTagIds ?? [];
    const turnActiveRuleIds = turnData.metadata?.activeRuleIds ?? [];

    const combinedActiveTagIds = Array.from(
      new Set([...projectDefaultTagIds, ...turnActiveTagIds]),
    );
    const combinedActiveRuleIds = Array.from(
      new Set([...projectDefaultRuleIds, ...turnActiveRuleIds]),
    );

    const allEffectiveRuleIds = new Set<string>(combinedActiveRuleIds);
    combinedActiveTagIds.forEach((tagId: string) => {
      rulesStoreState
        .getRulesForTag(tagId)
        .forEach((rule) => allEffectiveRuleIds.add(rule.id));
    });

    const activeRules: DbRule[] =
      rulesStoreState.getRulesByIds(Array.from(allEffectiveRuleIds)) || [];

    const systemRules = activeRules
      .filter((r) => r.type === "system")
      .map((r) => r.content);
    const beforeRules = activeRules
      .filter((r) => r.type === "before")
      .map((r) => r.content);
    const afterRules = activeRules
      .filter((r) => r.type === "after")
      .map((r) => r.content);

    if (beforeRules.length > 0) {
      userContent = `${beforeRules.join(`
`)}

${userContent}`;
    }
    if (afterRules.length > 0) {
      userContent = `${userContent}

    ${afterRules.join(`
`)}`;
    }

    if (userContent) {
      userMessageContentParts.push({ type: "text", text: userContent });
    }

    const attachedFilesMeta = turnData.metadata?.attachedFiles ?? [];
    if (attachedFilesMeta.length > 0) {
      const fileContentParts = await this._processFilesForPrompt(
        attachedFilesMeta,
        conversationId,
      );
      userMessageContentParts.unshift(...fileContentParts);
    }

    if (userMessageContentParts.length > 0) {
      historyMessages.push({ role: "user", content: userMessageContentParts });
    } else {
      console.warn(
        "[ConversationService] No user text or file content found in turnData. Submitting without user message.",
      );
    }

    const turnSystemPrompt = turnData.metadata?.turnSystemPrompt as
      | string
      | undefined;
    let baseSystemPrompt =
      turnSystemPrompt ?? effectiveSettings.systemPrompt ?? undefined;

    if (systemRules.length > 0) {
      baseSystemPrompt = `${
        baseSystemPrompt
          ? `${baseSystemPrompt}

        `
          : ""
      }${systemRules.join(`
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
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        ...(({
          turnSystemPrompt,
          activeTagIds,
          activeRuleIds,
          autoTitleEnabledForTurn,
          ...restMeta
        }) => ({
          ...restMeta,
          effectivelyAppliedTagIds: combinedActiveTagIds,
          effectivelyAppliedRuleIds: Array.from(allEffectiveRuleIds),
        }))(turnData.metadata ?? {}),
        modelId: promptState.modelId ?? undefined,
        attachedFiles: turnData.metadata.attachedFiles?.map(
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          ({ contentBase64, contentText, ...rest }) => rest,
        ),
      },
    };

    try {
      const mainInteractionPromise = InteractionService.startInteraction(
        promptObject,
        conversationId,
        turnData,
      );

      if (shouldGenerateTitle) {
        console.log(
          "[ConversationService] Triggering asynchronous title generation.",
        );
        this.generateConversationTitle(
          conversationId,
          turnData,
          activeRules,
        ).catch((titleError) => {
          console.error(
            "[ConversationService] Background title generation failed:",
            titleError,
          );
        });
      }
      await mainInteractionPromise;
    } catch (error) {
      console.error("[ConversationService] Error starting interaction:", error);
      toast.error(
        `Failed to start interaction: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  },

  async generateConversationTitle(
    conversationId: string,
    originalTurnData: PromptTurnObject,
    activeRulesForTurn: DbRule[],
  ): Promise<void> {
    const settings = useSettingsStore.getState();

    if (!settings.autoTitleModelId) {
      console.warn(
        "[ConversationService] Auto-title generation skipped: No model selected in settings.",
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
      content: `[Generate title based on: ${originalTurnData.content.substring(0, 50)}...]`,
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
        "conversation.title_generation",
      );
    } catch (error) {
      console.error(
        "[ConversationService] Error starting title generation interaction:",
        error,
      );
    }
  },

  async regenerateInteraction(interactionId: string): Promise<void> {
    console.log(
      "[ConversationService] regenerateInteraction called",
      interactionId,
    );
    const interactionStoreState = useInteractionStore.getState();
    const projectStoreState = useProjectStore.getState();
    const promptState = usePromptStateStore.getState();
    const conversationStoreState = useConversationStore.getState();
    const rulesStoreState = useRulesStore.getState();

    const targetInteraction = interactionStoreState.interactions.find(
      (i) => i.id === interactionId,
    );

    if (!targetInteraction || !targetInteraction.prompt) {
      toast.error("Cannot regenerate: Original interaction data missing.");
      return;
    }

    const originalTurnData = targetInteraction.prompt;
    const conversationId = targetInteraction.conversationId;
    const currentConversation =
      conversationStoreState.getConversationById(conversationId);
    const currentProjectId = currentConversation?.projectId ?? null;
    const effectiveSettings =
      projectStoreState.getEffectiveProjectSettings(currentProjectId);

    const historyUpToIndex = targetInteraction.index;
    const historyInteractions = interactionStoreState.interactions
      .filter(
        (i) =>
          i.conversationId === conversationId &&
          i.index < historyUpToIndex &&
          i.status === "COMPLETED" &&
          i.type === "message.user_assistant",
      )
      .sort((a, b) => a.index - b.index);
    const historyMessages: CoreMessage[] =
      buildHistoryMessages(historyInteractions);

    let userContent = originalTurnData.content;
    const userMessageContentParts: (TextPart | ImagePart)[] = [];

    const originalEffectivelyAppliedTagIds =
      targetInteraction.metadata?.effectivelyAppliedTagIds ??
      originalTurnData.metadata?.activeTagIds ??
      [];
    const originalEffectivelyAppliedRuleIds =
      targetInteraction.metadata?.effectivelyAppliedRuleIds ??
      originalTurnData.metadata?.activeRuleIds ??
      [];

    const allEffectiveRuleIds = new Set<string>(
      originalEffectivelyAppliedRuleIds,
    );
    originalEffectivelyAppliedTagIds.forEach((tagId: string) => {
      rulesStoreState
        .getRulesForTag(tagId)
        .forEach((rule) => allEffectiveRuleIds.add(rule.id));
    });

    const activeRules: DbRule[] =
      rulesStoreState.getRulesByIds(Array.from(allEffectiveRuleIds)) || [];

    const beforeRules = activeRules
      .filter((r) => r.type === "before")
      .map((r) => r.content);
    const afterRules = activeRules
      .filter((r) => r.type === "after")
      .map((r) => r.content);

    if (beforeRules.length > 0) {
      userContent = `${beforeRules.join(`
`)}

${userContent}`;
    }
    if (afterRules.length > 0) {
      userContent = `${userContent}

    ${afterRules.join(`
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
        conversationId,
      );
      userMessageContentParts.unshift(...fileContentParts);
    }

    if (userMessageContentParts.length > 0) {
      historyMessages.push({ role: "user", content: userMessageContentParts });
    } else {
      console.warn(
        "[ConversationService] No user text or file content found in original turnData for regeneration.",
      );
    }

    const turnSystemPrompt = originalTurnData.metadata?.turnSystemPrompt as
      | string
      | undefined;
    let baseSystemPrompt =
      turnSystemPrompt ?? effectiveSettings.systemPrompt ?? undefined;

    const systemRules = activeRules
      .filter((r) => r.type === "system")
      .map((r) => r.content);
    if (systemRules.length > 0) {
      baseSystemPrompt = `${
        baseSystemPrompt
          ? `${baseSystemPrompt}

        `
          : ""
      }${systemRules.join(`
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
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        ...(({
          turnSystemPrompt,
          activeTagIds,
          activeRuleIds,
          autoTitleEnabledForTurn,
          effectivelyAppliedTagIds,
          effectivelyAppliedRuleIds,
          ...restMeta
        }) => ({
          ...restMeta,
          effectivelyAppliedTagIds: originalEffectivelyAppliedTagIds,
          effectivelyAppliedRuleIds: Array.from(allEffectiveRuleIds),
        }))(originalTurnData.metadata ?? {}),
        modelId: promptState.modelId ?? undefined,
        regeneratedFromId: interactionId,
        attachedFiles: originalAttachedFiles.map(
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          ({ contentBase64, contentText, ...rest }) => rest,
        ),
      },
    };

    try {
      await InteractionService.startInteraction(
        promptObject,
        conversationId,
        originalTurnData,
        "message.assistant_regen",
      );
    } catch (error) {
      console.error(
        "[ConversationService] Error starting regeneration interaction:",
        error,
      );
      toast.error(
        `Failed to start regeneration: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  },

  async _processFilesForPrompt(
    filesMeta: AttachedFileMetadata[],
    conversationId: string,
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
          `Filesystem unavailable for key ${targetVfsKey}. VFS files cannot be processed.`,
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
            `[ConversationService] Fetching VFS file: ${fileMeta.path}`,
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
          processingError,
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
    targetVfsKey: string,
  ): Promise<typeof FsType | undefined> {
    console.log(
      `[ConversationService] Ensuring VFS ready for key "${targetVfsKey}"...`,
    );
    try {
      const fsInstance = await useVfsStore
        .getState()
        .initializeVFS(targetVfsKey, { force: true });
      console.log(`[ConversationService] VFS ready for key "${targetVfsKey}".`);
      return fsInstance;
    } catch (vfsError) {
      console.error(
        `[ConversationService] Failed to ensure VFS ready for key ${targetVfsKey}:`,
        vfsError,
      );
      throw vfsError;
    }
  },
};
