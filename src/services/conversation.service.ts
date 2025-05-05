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
    // Read necessary state using getState()
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

    // --- Check if this is the first interaction ---
    const isFirstInteraction =
      interactionStoreState.interactions.filter(
        (i) => i.conversationId === conversationId,
      ).length === 0;
    const shouldGenerateTitle =
      isFirstInteraction &&
      settingsStoreState.autoTitleEnabled &&
      turnData.metadata?.autoTitleEnabledForTurn === true &&
      settingsStoreState.autoTitleModelId;
    // --- End Check ---

    // 1. Build History
    const currentHistory = interactionStoreState.interactions;
    const completedHistory = currentHistory.filter(
      (i) => i.status === "COMPLETED" && i.type === "message.user_assistant",
    );
    const historyMessages: CoreMessage[] =
      buildHistoryMessages(completedHistory);

    // 2. Prepare User Message (Text + Files + Rules)
    let userContent = turnData.content;
    const userMessageContentParts: (TextPart | ImagePart)[] = [];

    // --- Apply Rules ---
    const activeTagIds = turnData.metadata?.activeTagIds ?? [];
    const activeRuleIds = turnData.metadata?.activeRuleIds ?? [];
    const allActiveRuleIds = new Set<string>(activeRuleIds);
    activeTagIds.forEach((tagId: string) => {
      rulesStoreState
        .getRulesForTag(tagId)
        .forEach((rule) => allActiveRuleIds.add(rule.id));
    });

    const activeRules: DbRule[] =
      rulesStoreState.getRulesByIds(Array.from(allActiveRuleIds)) || [];

    const systemRules = activeRules
      .filter((r) => r.type === "system")
      .map((r) => r.content);
    const beforeRules = activeRules
      .filter((r) => r.type === "before")
      .map((r) => r.content);
    const afterRules = activeRules
      .filter((r) => r.type === "after")
      .map((r) => r.content);

    // Apply 'before' rules
    if (beforeRules.length > 0) {
      userContent = `${beforeRules.join(`\n`)}

${userContent}`;
    }
    // Apply 'after' rules
    if (afterRules.length > 0) {
      userContent = `${userContent}

    ${afterRules.join(`\n`)}`;
    }
    // --- End Apply Rules ---

    // Add processed user text content
    if (userContent) {
      userMessageContentParts.push({ type: "text", text: userContent });
    }

    // Process and add file content
    const attachedFilesMeta = turnData.metadata?.attachedFiles ?? [];
    if (attachedFilesMeta.length > 0) {
      const fileContentParts = await this._processFilesForPrompt(
        attachedFilesMeta,
        conversationId,
      );
      // Prepend file parts to user message content
      userMessageContentParts.unshift(...fileContentParts);
    }

    // Add the user message to history (only if it has content or files)
    if (userMessageContentParts.length > 0) {
      historyMessages.push({ role: "user", content: userMessageContentParts });
    } else {
      console.warn(
        "[ConversationService] No user text or file content found in turnData. Submitting without user message.",
      );
    }

    // 3. Get Effective Settings (System Prompt + Rules)
    const turnSystemPrompt = turnData.metadata?.turnSystemPrompt as
      | string
      | undefined;
    const effectiveSettings =
      projectStoreState.getEffectiveProjectSettings(currentProjectId);
    // Prioritize turn prompt, then project, then global
    let baseSystemPrompt =
      turnSystemPrompt ?? effectiveSettings.systemPrompt ?? undefined;

    // Apply 'system' rules
    if (systemRules.length > 0) {
      baseSystemPrompt = `${
        baseSystemPrompt
          ? `${baseSystemPrompt}

        `
          : ""
      }${systemRules.join(`\n`)}`;
    }

    // 4. Merge Parameters (PromptState + TurnData)
    const finalParameters = {
      temperature: promptState.temperature,
      max_tokens: promptState.maxTokens,
      top_p: promptState.topP,
      top_k: promptState.topK,
      presence_penalty: promptState.presencePenalty,
      frequency_penalty: promptState.frequencyPenalty,
      ...(turnData.parameters ?? {}),
    };
    // Clean null/undefined parameters
    Object.keys(finalParameters).forEach((key) => {
      if (
        finalParameters[key as keyof typeof finalParameters] === null ||
        finalParameters[key as keyof typeof finalParameters] === undefined
      ) {
        delete finalParameters[key as keyof typeof finalParameters];
      }
    });

    // 5. Construct PromptObject for main interaction
    const promptObject: PromptObject = {
      system: baseSystemPrompt,
      messages: historyMessages,
      parameters: finalParameters,
      metadata: {
        // Remove rule/tag/auto-title activation metadata before sending to AI service
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        ...(({
          turnSystemPrompt,
          activeTagIds,
          activeRuleIds,
          autoTitleEnabledForTurn,
          ...restMeta
        }) => restMeta)(turnData.metadata ?? {}),
        modelId: promptState.modelId ?? undefined,
        // Store only basic file info (no content) in the final prompt metadata sent to AI Service
        attachedFiles: turnData.metadata.attachedFiles?.map(
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          ({ contentBase64, contentText, ...rest }) => rest,
        ),
      },
      // toolChoice and tools will be added by InteractionService based on metadata
    };

    // 6. Delegate main interaction to InteractionService
    try {
      // Don't await this if title generation needs to run in parallel
      const mainInteractionPromise = InteractionService.startInteraction(
        promptObject,
        conversationId,
        turnData,
      );

      // --- Trigger Title Generation Asynchronously ---
      if (shouldGenerateTitle) {
        console.log(
          "[ConversationService] Triggering asynchronous title generation.",
        );
        // Don't await this promise, let it run in the background
        this.generateConversationTitle(
          conversationId,
          turnData,
          activeRules,
        ).catch((titleError) => {
          console.error(
            "[ConversationService] Background title generation failed:",
            titleError,
          );
          // Optionally toast a silent error or log it
        });
      }
      // --- End Title Generation Trigger ---

      // Await the main interaction promise *after* potentially starting title gen
      await mainInteractionPromise;
    } catch (error) {
      console.error("[ConversationService] Error starting interaction:", error);
      toast.error(
        `Failed to start interaction: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Re-throw or handle as needed if LiteChat needs to know about the failure
      throw error;
    }
  },

  // --- New function for Title Generation ---
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

    // 1. Prepare simplified prompt content
    let titlePromptContent = originalTurnData.content;

    // Truncate based on settings
    if (titlePromptContent.length > settings.autoTitlePromptMaxLength) {
      titlePromptContent =
        titlePromptContent.substring(0, settings.autoTitlePromptMaxLength) +
        "...";
    }

    // Optionally add file info
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

    // Optionally add rules info
    if (settings.autoTitleIncludeRules && activeRulesForTurn.length > 0) {
      const ruleNames = activeRulesForTurn.map((r) => r.name).join(", ");
      titlePromptContent += `

[Active rules: ${ruleNames}]`;
    }

    // 2. Construct Title Generation Prompt Object
    const titlePromptObject: PromptObject = {
      // Use a specific system prompt for title generation
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
      // No tools needed for title generation
      tools: undefined,
      toolChoice: "none",
    };

    // 3. Create a dummy PromptTurnObject for the title generation interaction record
    // This won't be displayed but helps track the request
    const titleTurnData: PromptTurnObject = {
      id: nanoid(),
      content: `[Generate title based on: ${originalTurnData.content.substring(0, 50)}...]`,
      parameters: titlePromptObject.parameters,
      metadata: {
        ...titlePromptObject.metadata,
        originalTurnId: originalTurnData.id,
      },
    };

    // 4. Call InteractionService with specific type
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
      // Don't toast here, as it's a background task
    }
  },
  // --- End Title Generation Function ---

  async regenerateInteraction(interactionId: string): Promise<void> {
    console.log(
      "[ConversationService] regenerateInteraction called",
      interactionId,
    );
    // Read necessary state using getState()
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

    // 1. Build History up to the point of regeneration
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

    // 2. Prepare User Message from original turn data (Apply rules again)
    let userContent = originalTurnData.content;
    const userMessageContentParts: (TextPart | ImagePart)[] = [];

    // --- Apply Rules (from original turn data) ---
    const activeTagIds = originalTurnData.metadata?.activeTagIds ?? [];
    const activeRuleIds = originalTurnData.metadata?.activeRuleIds ?? [];
    const allActiveRuleIds = new Set<string>(activeRuleIds);
    activeTagIds.forEach((tagId: string) => {
      rulesStoreState
        .getRulesForTag(tagId)
        .forEach((rule) => allActiveRuleIds.add(rule.id));
    });

    const activeRules: DbRule[] =
      rulesStoreState.getRulesByIds(Array.from(allActiveRuleIds)) || [];

    const beforeRules = activeRules
      .filter((r) => r.type === "before")
      .map((r) => r.content);
    const afterRules = activeRules
      .filter((r) => r.type === "after")
      .map((r) => r.content);

    // Apply 'before' rules
    if (beforeRules.length > 0) {
      userContent = `${beforeRules.join(`\n`)}

${userContent}`;
    }
    // Apply 'after' rules
    if (afterRules.length > 0) {
      userContent = `${userContent}

    ${afterRules.join(`\n`)}`;
    }
    // --- End Apply Rules ---

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

    // 3. Get Effective Settings (System Prompt + Rules)
    const turnSystemPrompt = originalTurnData.metadata?.turnSystemPrompt as
      | string
      | undefined;
    const effectiveSettings =
      projectStoreState.getEffectiveProjectSettings(currentProjectId);
    // Prioritize turn prompt, then project, then global
    let baseSystemPrompt =
      turnSystemPrompt ?? effectiveSettings.systemPrompt ?? undefined;

    // Apply 'system' rules (from original turn)
    const systemRules = activeRules
      .filter((r) => r.type === "system")
      .map((r) => r.content);
    if (systemRules.length > 0) {
      baseSystemPrompt = `${
        baseSystemPrompt
          ? `${baseSystemPrompt}

        `
          : ""
      }${systemRules.join(`\n`)}`;
    }

    // 4. Merge Parameters (Current PromptState + Original TurnData Params)
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

    // 5. Construct PromptObject
    const promptObject: PromptObject = {
      system: baseSystemPrompt,
      messages: historyMessages,
      parameters: finalParameters,
      metadata: {
        // Remove rule/tag/auto-title activation metadata
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        ...(({
          turnSystemPrompt,
          activeTagIds,
          activeRuleIds,
          autoTitleEnabledForTurn,
          ...restMeta
        }) => restMeta)(originalTurnData.metadata ?? {}),
        modelId: promptState.modelId ?? undefined,
        regeneratedFromId: interactionId,
        // Store only basic file info (no content)
        attachedFiles: originalAttachedFiles.map(
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          ({ contentBase64, contentText, ...rest }) => rest,
        ),
      },
      // toolChoice and tools will be added by InteractionService based on metadata
    };

    // 6. Delegate to InteractionService
    try {
      // Specify the type as regeneration
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
      // Re-throw or handle as needed
      throw error;
    }
  },

  // --- Helper to process files (used by submit and regenerate) ---
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
        // Add placeholders for VFS files if FS failed
        vfsFiles.forEach((fileMeta) => {
          fileContentParts.push({
            type: "text",
            text: `[Skipped VFS file: ${fileMeta.name} - Filesystem unavailable]`,
          });
        });
        // Set vfsInstance to undefined to skip processing below
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
          // Pass the specific fsInstance to readFileOp
          const contentBytes = await VfsOps.readFileOp(fileMeta.path, {
            fsInstance: vfsInstance,
          });
          contentPart = processFileMetaToUserContent({
            ...fileMeta,
            contentBytes: contentBytes,
          });
        } else if (fileMeta.source === "vfs" && !vfsInstance) {
          // Skip VFS files if instance is null (error handled above)
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

  // --- Helper for VFS Readiness (updated) ---
  async _ensureVfsReady(
    targetVfsKey: string,
  ): Promise<typeof FsType | undefined> {
    console.log(
      `[ConversationService] Ensuring VFS ready for key "${targetVfsKey}"...`,
    );
    try {
      // Use forced initialization to get an instance without affecting UI state
      // Wrap in try...catch as initializeVFS now throws on error
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
      // Re-throw the error to be caught by the caller (_processFilesForPrompt)
      throw vfsError;
    }
  },
};
