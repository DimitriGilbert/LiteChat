// src/services/conversation.service.ts
// Entire file content provided
import type { PromptObject, PromptTurnObject } from "@/types/litechat/prompt";
import { InteractionService } from "./interaction.service";
import { useInteractionStore } from "@/store/interaction.store";
import { useProjectStore } from "@/store/project.store";
import { usePromptStateStore } from "@/store/prompt.store";
import { useVfsStore } from "@/store/vfs.store";
import * as VfsOps from "@/lib/litechat/vfs-operations";
import {
  buildHistoryMessages,
  processFileMetaToUserContent,
} from "@/lib/litechat/ai-helpers";
import type { CoreMessage, ImagePart, TextPart } from "ai";
import { toast } from "sonner";
import type { AttachedFileMetadata } from "@/store/input.store";
import type { fs as FsType } from "@zenfs/core";
import { useConversationStore } from "@/store/conversation.store"; // Import ConversationStore

export const ConversationService = {
  async submitPrompt(turnData: PromptTurnObject): Promise<void> {
    console.log("[ConversationService] submitPrompt called", turnData);
    // Read necessary state using getState()
    const interactionStoreState = useInteractionStore.getState();
    const projectStoreState = useProjectStore.getState();
    const promptState = usePromptStateStore.getState(); // Read current prompt state
    const conversationStoreState = useConversationStore.getState();

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

    // 1. Build History
    const currentHistory = interactionStoreState.interactions;
    const completedHistory = currentHistory.filter(
      (i) => i.status === "COMPLETED" && i.type === "message.user_assistant",
    );
    const historyMessages: CoreMessage[] =
      buildHistoryMessages(completedHistory);

    // 2. Prepare User Message (Text + Files)
    const userMessageContentParts: (TextPart | ImagePart)[] = [];
    if (turnData.content) {
      userMessageContentParts.push({ type: "text", text: turnData.content });
    }

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

    // 3. Get Effective Settings (System Prompt) - Use turn override if present
    const turnSystemPrompt = turnData.metadata?.turnSystemPrompt as
      | string
      | undefined;
    const effectiveSettings =
      projectStoreState.getEffectiveProjectSettings(currentProjectId);
    // Prioritize turn prompt, then project, then global
    const systemPrompt =
      turnSystemPrompt ?? effectiveSettings.systemPrompt ?? undefined;

    // 4. Merge Parameters (PromptState + TurnData)
    const finalParameters = {
      temperature: promptState.temperature, // Read from prompt state
      max_tokens: promptState.maxTokens, // Read from prompt state
      top_p: promptState.topP, // Read from prompt state
      top_k: promptState.topK, // Read from prompt state
      presence_penalty: promptState.presencePenalty, // Read from prompt state
      frequency_penalty: promptState.frequencyPenalty, // Read from prompt state
      ...(turnData.parameters ?? {}), // Merge turn-specific params
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

    // 5. Construct PromptObject
    const promptObject: PromptObject = {
      system: systemPrompt, // Use the potentially overridden prompt
      messages: historyMessages,
      parameters: finalParameters,
      metadata: {
        // Remove turnSystemPrompt from final metadata sent to AI service if desired
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        ...(({ turnSystemPrompt, ...restMeta }) => restMeta)(
          turnData.metadata ?? {},
        ),
        modelId: promptState.modelId, // Read modelId from prompt state
        // Store only basic file info (no content) in the final prompt metadata sent to AI Service
        attachedFiles: turnData.metadata.attachedFiles?.map(
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          ({ contentBase64, contentText, ...rest }) => rest,
        ),
      },
      // toolChoice and tools will be added by InteractionService based on metadata
    };

    // 6. Delegate to InteractionService
    try {
      await InteractionService.startInteraction(
        promptObject,
        conversationId,
        turnData, // Pass original turnData for storage
      );
    } catch (error) {
      console.error("[ConversationService] Error starting interaction:", error);
      toast.error(
        `Failed to start interaction: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Re-throw or handle as needed if LiteChat needs to know about the failure
      throw error;
    }
  },

  async regenerateInteraction(interactionId: string): Promise<void> {
    console.log(
      "[ConversationService] regenerateInteraction called",
      interactionId,
    );
    // Read necessary state using getState()
    const interactionStoreState = useInteractionStore.getState();
    const projectStoreState = useProjectStore.getState();
    const promptState = usePromptStateStore.getState(); // Read current prompt state
    const conversationStoreState = useConversationStore.getState();

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

    // 2. Prepare User Message from original turn data
    const userMessageContentParts: (TextPart | ImagePart)[] = [];
    if (originalTurnData.content) {
      userMessageContentParts.push({
        type: "text",
        text: originalTurnData.content,
      });
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

    // 3. Get Effective Settings (System Prompt) - Use turn override if present
    const turnSystemPrompt = originalTurnData.metadata?.turnSystemPrompt as
      | string
      | undefined;
    const effectiveSettings =
      projectStoreState.getEffectiveProjectSettings(currentProjectId);
    // Prioritize turn prompt, then project, then global
    const systemPrompt =
      turnSystemPrompt ?? effectiveSettings.systemPrompt ?? undefined;

    // 4. Merge Parameters (Current PromptState + Original TurnData Params)
    const finalParameters = {
      temperature: promptState.temperature, // Read from prompt state
      max_tokens: promptState.maxTokens, // Read from prompt state
      top_p: promptState.topP, // Read from prompt state
      top_k: promptState.topK, // Read from prompt state
      presence_penalty: promptState.presencePenalty, // Read from prompt state
      frequency_penalty: promptState.frequencyPenalty, // Read from prompt state
      ...(originalTurnData.parameters ?? {}), // Merge original params
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
      system: systemPrompt, // Use the potentially overridden prompt
      messages: historyMessages,
      parameters: finalParameters,
      metadata: {
        // Remove turnSystemPrompt from final metadata sent to AI service if desired
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        ...(({ turnSystemPrompt, ...restMeta }) => restMeta)(
          originalTurnData.metadata ?? {},
        ),
        modelId: promptState.modelId, // Use current model selection from prompt state
        regeneratedFromId: interactionId, // Add regeneration marker
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
      await InteractionService.startInteraction(
        promptObject,
        conversationId,
        originalTurnData, // Pass original turn data
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
    const needsVfs = filesMeta.some((f) => f.source === "vfs");
    let vfsInstance: typeof FsType | null = null;

    if (needsVfs) {
      const currentConversation = useConversationStore
        .getState()
        .getConversationById(conversationId);
      const targetVfsKey = currentConversation?.projectId ?? "orphan";
      vfsInstance = await this._ensureVfsReady(targetVfsKey);
      if (!vfsInstance) {
        toast.error(
          `Filesystem unavailable for key ${targetVfsKey}. VFS files cannot be processed.`,
        );
        // Add placeholders for VFS files if FS failed
        filesMeta.forEach((fileMeta) => {
          if (fileMeta.source === "vfs") {
            fileContentParts.push({
              type: "text",
              text: `[Skipped VFS file: ${fileMeta.name} - Filesystem unavailable]`,
            });
          }
        });
        // Continue processing direct files
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
          const contentBytes = await VfsOps.readFileOp(fileMeta.path);
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

  // --- Helper for VFS Readiness (moved from initial structure) ---
  async _ensureVfsReady(targetVfsKey: string): Promise<typeof FsType | null> {
    const vfsState = useVfsStore.getState();
    if (
      vfsState.fs &&
      vfsState.configuredVfsKey === targetVfsKey &&
      !vfsState.loading &&
      !vfsState.initializingKey
    ) {
      return vfsState.fs;
    }

    console.log(
      `[ConversationService] VFS for key "${targetVfsKey}" not ready. Attempting initialization...`,
    );
    try {
      // Use getState() for VFS store action as well
      await useVfsStore.getState().initializeVFS(targetVfsKey);
      const updatedVfsState = useVfsStore.getState();
      if (
        updatedVfsState.fs &&
        updatedVfsState.configuredVfsKey === targetVfsKey
      ) {
        console.log(
          `[ConversationService] VFS for key "${targetVfsKey}" initialized successfully.`,
        );
        return updatedVfsState.fs;
      } else {
        throw new Error(
          `VFS initialization did not complete successfully for key ${targetVfsKey}. Store state: configured=${updatedVfsState.configuredVfsKey}, fs=${!!updatedVfsState.fs}`,
        );
      }
    } catch (vfsError) {
      console.error(
        `[ConversationService] Failed to ensure VFS ready for key ${targetVfsKey}:`,
        vfsError,
      );
      toast.error(
        `Filesystem error: Could not access files for key ${targetVfsKey}.`,
      );
      return null;
    }
  },
};
