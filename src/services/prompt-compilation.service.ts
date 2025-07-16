// src/services/prompt-compilation.service.ts
// Central service for compiling prompts to eliminate duplication

import type { PromptTurnObject, PromptObject } from "@/types/litechat/prompt";
import type { ResolvedRuleContent } from "@/types/litechat/prompt";
import type { AttachedFileMetadata } from "@/store/input.store";
import type { Interaction } from "@/types/litechat/interaction";
import type { ModelMessage, TextPart, ImagePart } from "ai";
import { useInteractionStore } from "@/store/interaction.store";
import { useProjectStore } from "@/store/project.store";
import { usePromptStateStore } from "@/store/prompt.store";
import { useConversationStore } from "@/store/conversation.store";
import { useControlRegistryStore } from "@/store/control.store";
import { buildHistoryMessages } from "@/lib/litechat/ai-helpers";
import { processFileMetaToUserContent } from "@/lib/litechat/ai-helpers";
import * as VfsOps from "@/lib/litechat/vfs-operations";
import { useVfsStore } from "@/store/vfs.store";
import { emitter } from "@/lib/litechat/event-emitter";
import { vfsEvent } from "@/types/litechat/events/vfs.events";
import { toast } from "sonner";

export class PromptCompilationService {
  /**
   * Central method to compile a complete PromptObject from turnData and conversationId
   * This eliminates the duplicated logic across ConversationService, WorkflowService, and PromptEnhancementService
   */
  static async compilePrompt(
    turnData: PromptTurnObject,
    conversationId: string,
    options: {
      includePromptControls?: boolean;
    } = {}
  ): Promise<PromptObject> {
    const { includePromptControls = false } = options;
    
    const interactionStoreState = useInteractionStore.getState();
    const projectStoreState = useProjectStore.getState();
    const promptState = usePromptStateStore.getState();
    const conversationStoreState = useConversationStore.getState();

    const currentConversation =
      conversationStoreState.getConversationById(conversationId);
    const currentProjectId = currentConversation?.projectId ?? null;
    const effectiveSettings =
      projectStoreState.getEffectiveProjectSettings(currentProjectId);

    // Collect parameters and metadata from prompt controls if enabled
    let controlParameters: Record<string, any> = {};
    let controlMetadata: Record<string, any> = {};
    
    if (includePromptControls) {
      const controlRegistryState = useControlRegistryStore.getState();
      const promptControls = Object.values(controlRegistryState.promptControls);
      
      for (const control of promptControls) {
        if (control.getParameters) {
          const params = await control.getParameters();
          if (params) controlParameters = { ...controlParameters, ...params };
        }
        if (control.getMetadata) {
          const meta = await control.getMetadata();
          if (meta) controlMetadata = { ...controlMetadata, ...meta };
        }
      }
    }

    // Build history for the AI
    const activeInteractionsOnSpine = interactionStoreState.interactions
      .filter(
        (i) =>
          i.conversationId === conversationId &&
          i.parentId === null &&
          i.status === "COMPLETED"
      )
      .sort((a, b) => a.index - b.index);

    const turnsForHistoryBuilder: Interaction[] = activeInteractionsOnSpine
      .map((activeInteraction) => {
        if (
          activeInteraction.type === "message.assistant_regen" &&
          activeInteraction.metadata?.regeneratedFromId
        ) {
          const originalInteraction = interactionStoreState.interactions.find(
            (orig) => orig.id === activeInteraction.metadata!.regeneratedFromId
          );
          if (
            originalInteraction &&
            originalInteraction.prompt &&
            originalInteraction.type === "message.user_assistant"
          ) {
            return {
              ...activeInteraction,
              prompt: originalInteraction.prompt,
              type: "message.user_assistant",
            } as Interaction;
          }
        }
        if (
          activeInteraction.type === "message.user_assistant" &&
          activeInteraction.prompt
        ) {
          return activeInteraction;
        }
        return null;
      })
      .filter(Boolean) as Interaction[];

    const historyMessages: ModelMessage[] = buildHistoryMessages(
      turnsForHistoryBuilder
    );

    let userContent = turnData.content;
    const userMessageContentParts: (TextPart | ImagePart)[] = [];

    const effectiveRulesContent: ResolvedRuleContent[] =
      turnData.metadata?.effectiveRulesContent ?? [];

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

    // Process attached files
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
    }

    // Build system prompt - merge with control metadata
    const combinedMetadata = { ...turnData.metadata, ...controlMetadata };
    const turnSystemPrompt = combinedMetadata?.turnSystemPrompt as
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

    // Build final parameters - merge control parameters with turn data parameters
    const finalParameters = {
      temperature: promptState.temperature,
      max_tokens: promptState.maxTokens,
      top_p: promptState.topP,
      top_k: promptState.topK,
      presence_penalty: promptState.presencePenalty,
      frequency_penalty: promptState.frequencyPenalty,
      ...controlParameters, // Control parameters override prompt state
      ...(turnData.parameters ?? {}), // Turn data parameters have highest priority
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
        }))(combinedMetadata ?? {}),
        modelId: (combinedMetadata?.modelId || promptState.modelId) ?? undefined,
        attachedFiles: turnData.metadata?.attachedFiles?.map(
          ({ contentBase64, contentText, ...rest }) => rest
        ),
      },
    };

    return promptObject;
  }

  /**
   * Enhanced method for workflow and other advanced use cases that need full prompt controls
   * Returns both the compiled PromptObject and the enhanced TurnData
   */
  static async compilePromptWithControls(
    conversationId: string,
    userContent: string,
    baseTurnData: PromptTurnObject
  ): Promise<{ promptObject: PromptObject; turnData: PromptTurnObject }> {
    // Create enhanced turn data that will be processed with prompt controls
    const enhancedTurnData: PromptTurnObject = {
      ...baseTurnData,
      content: userContent,
    };

    // Compile with prompt controls enabled
    const promptObject = await this.compilePrompt(
      enhancedTurnData,
      conversationId,
      { includePromptControls: true }
    );

    // Build complete turn data with the same parameters and metadata as the prompt object
    const completeTurnData: PromptTurnObject = {
      ...enhancedTurnData,
      parameters: promptObject.parameters,
      metadata: promptObject.metadata,
    };

    return { promptObject, turnData: completeTurnData };
  }

    /**
   * Process attached files for prompt compilation
   * Full implementation copied from ConversationService._processFilesForPrompt
   */
  private static async _processFilesForPrompt(
    filesMeta: AttachedFileMetadata[],
    conversationId: string
  ): Promise<(TextPart | ImagePart)[]> {
    const fileContentParts: (TextPart | ImagePart)[] = [];
    const vfsFiles = filesMeta.filter((f) => f.source === "vfs");
    let vfsInstance: any;

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
            `[PromptCompilationService] Fetching VFS file: ${fileMeta.path}`
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
          `[PromptCompilationService] Error processing file ${fileMeta.name}:`,
          processingError
        );
        fileContentParts.push({
          type: "text",
          text: `[Error processing file: ${fileMeta.name}]`,
        });
      }
    }
    return fileContentParts;
  }

  private static async _ensureVfsReady(targetVfsKey: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const handleFsInstanceChanged = (payload: any) => {
        if (useVfsStore.getState().configuredVfsKey === targetVfsKey) {
          cleanupSubscriptions();
          resolve(payload.fsInstance);
        }
      };

      const handleLoadingStateChanged = (payload: any) => {
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
  }
}