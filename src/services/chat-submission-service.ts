// src/services/chat-submission-service.ts
import { toast } from "sonner";
import { modEvents, ModEvent } from "@/mods/events";
import { ModMiddlewareHook } from "@/mods/api";
import type {
  DbProviderType,
  SidebarItemType,
} from "@/lib/types";
import type {
  ModMiddlewarePayloadMap,
} from "@/mods/types";
import { requiresApiKey } from "@/utils/chat-utils";
import { FileHandlingService } from "./file-handling-service";

export interface ChatSubmissionDependencies {
  // Provider management
  selectedProviderId: string | null;
  selectedProvider: { name: string } | null;
  selectedModel: any | null;
  getApiKeyForProvider: () => string | undefined;
  dbProviderConfigs: any[];
  enableApiKeyManagement: boolean;
  
  // Streaming state
  isStreaming: boolean;
  setError: (error: string | null) => void;
  
  // Sidebar/Item management
  selectedItemType: SidebarItemType | null;
  selectedItemId: string | null;
  activeConversationData: { parentId: string | null } | null;
  createConversation: (parentId: string | null, title: string) => Promise<string>;
  selectItem: (id: string | null, type: SidebarItemType | null) => Promise<void>;
  deleteItem: (id: string, type: SidebarItemType) => Promise<void>;
  
  // VFS
  vfs: any;
  enableVfs: boolean;
  isVfsEnabledForItem: boolean;
  
  // Middleware
  runMiddleware: <H extends typeof ModMiddlewareHook.SUBMIT_PROMPT>(
    hookName: H,
    initialPayload: ModMiddlewarePayloadMap[H],
  ) => Promise<ModMiddlewarePayloadMap[H] | false>;
  
  // Message handling
  handleSubmitCore: (
    originalUserPrompt: string,
    conversationId: string,
    promptToSendToAI: string,
    vfsContextPaths?: string[],
  ) => Promise<void>;
}

export class ChatSubmissionService {
  /**
   * Handles the submission of a chat message, including preprocessing files and running middleware
   */
  public static async submitChat(
    promptValue: string,
    attachedFilesValue: File[],
    vfsPathsToSubmit: string[],
    deps: ChatSubmissionDependencies
  ): Promise<void> {
    const currentPrompt = promptValue.trim();
    const canSubmit =
      currentPrompt.length > 0 ||
      attachedFilesValue.length > 0 ||
      vfsPathsToSubmit.length > 0;

    if (!canSubmit) return;
    
    if (deps.isStreaming) {
      toast.info("Please wait for the current response to finish.");
      return;
    }
    
    if (!deps.selectedProvider || !deps.selectedModel) {
      deps.setError("Error: Please select an active AI Provider and Model first.");
      toast.error("Please select an AI Provider and Model.");
      return;
    }

    // Check if API key is required and present
    await ChatSubmissionService.validateApiKey(deps);

    // Determine conversation and project IDs
    const { conversationId, newConvCreated } = 
      await ChatSubmissionService.resolveConversation(currentPrompt, deps);
    
    if (!conversationId) {
      deps.setError("Error: Could not determine target conversation for submit.");
      toast.error("Could not determine target conversation.");
      return;
    }
    
    // Process files from VFS and attached files
    const { contextPrefix, pathsIncludedInContext } = await ChatSubmissionService.processFiles(
      vfsPathsToSubmit,
      attachedFilesValue,
      deps
    );

    const originalUserPrompt = currentPrompt;
    const promptToSendToAI = contextPrefix + originalUserPrompt;

    if (promptToSendToAI.trim().length > 0) {
      let submitPayload: ModMiddlewarePayloadMap[typeof ModMiddlewareHook.SUBMIT_PROMPT] =
        {
          prompt: promptToSendToAI,
          originalUserPrompt,
          attachedFiles: attachedFilesValue,
          vfsPaths: pathsIncludedInContext,
          conversationId: conversationId || '',
        };

      modEvents.emit(ModEvent.MESSAGE_BEFORE_SUBMIT, {
        prompt: originalUserPrompt,
        attachedFiles: attachedFilesValue,
        vfsPaths: pathsIncludedInContext,
      });

      const middlewareResult = await deps.runMiddleware(
        ModMiddlewareHook.SUBMIT_PROMPT,
        submitPayload,
      );

      if (middlewareResult === false) {
        toast.info("Submission cancelled by a mod.");
        if (newConvCreated && conversationId) {
          await deps.deleteItem(conversationId, "conversation");
        }
        return;
      }
      
      submitPayload = middlewareResult;

      await deps.handleSubmitCore(
        submitPayload.originalUserPrompt,
        submitPayload.conversationId,
        submitPayload.prompt,
        submitPayload.vfsPaths,
      );
    }
  }
  
  /**
   * Validates that a required API key is present
   */
  private static async validateApiKey(deps: ChatSubmissionDependencies): Promise<void> {
    const selectedDbConfig = (deps.dbProviderConfigs || []).find((p) => p.id === deps.selectedProviderId);
    const needsKeyCheck =
      selectedDbConfig?.apiKeyId ||
      requiresApiKey(selectedDbConfig?.type as DbProviderType);

    if (needsKeyCheck && !deps.getApiKeyForProvider()) {
      const errorMsg = `API Key for ${deps.selectedProvider?.name} is not set, selected, or linked. Check Settings -> Providers.`;
      deps.setError(errorMsg);
      toast.error(errorMsg);
      if (!deps.enableApiKeyManagement) {
        toast.info(
          "API Key management is disabled. Ensure keys are configured correctly if needed by the provider.",
        );
      }
      throw new Error(errorMsg);
    }
  }
  
  /**
   * Resolves the conversation ID to use for submission
   */
  private static async resolveConversation(
    currentPrompt: string,
    deps: ChatSubmissionDependencies
  ): Promise<{ conversationId: string | null; parentProjectId: string | null; newConvCreated: boolean }> {
    let conversationId: string | null = null;
    let parentProjectId: string | null = null;
    let newConvCreated = false;

    if (deps.selectedItemType === "project" && deps.selectedItemId) {
      parentProjectId = deps.selectedItemId;
    } else if (
      deps.selectedItemType === "conversation" &&
      deps.selectedItemId
    ) {
      parentProjectId = deps.activeConversationData?.parentId ?? null;
      conversationId = deps.selectedItemId;
    }

    if (!conversationId) {
      try {
        const title = currentPrompt.substring(0, 50) || "New Chat";
        const newConvId = await deps.createConversation(
          parentProjectId,
          title,
        );
        if (!newConvId)
          throw new Error("Failed to get ID for new conversation.");
        conversationId = newConvId;
        newConvCreated = true;
        modEvents.emit(ModEvent.CHAT_CREATED, {
          id: newConvId,
          type: "conversation",
          parentId: parentProjectId,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        throw new Error(`Could not start chat - ${message}`);
      }
    }
    
    return { conversationId, parentProjectId, newConvCreated };
  }
  
  /**
   * Processes files from both VFS and attached files for inclusion in the chat
   */
  private static async processFiles(
    vfsPathsToSubmit: string[],
    attachedFilesValue: File[],
    deps: ChatSubmissionDependencies
  ): Promise<{ contextPrefix: string; pathsIncludedInContext: string[] }> {
    // Process VFS files
    const vfsResult = await FileHandlingService.processVfsFiles(
      vfsPathsToSubmit,
      deps.vfs,
      deps.isVfsEnabledForItem,
      deps.enableVfs
    );
    
    // Process attached files
    const attachedFilesPrefix = await FileHandlingService.processAttachedFiles(attachedFilesValue);
    
    return {
      contextPrefix: vfsResult.contextPrefix + attachedFilesPrefix,
      pathsIncludedInContext: vfsResult.pathsIncludedInContext
    };
  }
}