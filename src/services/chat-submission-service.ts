// src/services/chat-submission-service.ts
import { toast } from "sonner";
import { FileHandlingService } from "./file-handling-service";
import type {
  MessageContent,
  TextPart,
  ImagePart,
  VfsContextObject,
  AiProviderConfig,
  AiModelConfig,
  DbConversation,
  SidebarItemType,
  DbProviderConfig,
} from "@/lib/types";
import { ModMiddlewareHook, ModMiddlewareHookName } from "@/mods/api";
import type {
  ModMiddlewarePayloadMap,
  ModMiddlewareReturnMap,
  SubmitPromptPayload,
} from "@/mods/types";
// Removed unused import: PerformImageGenerationResult

// Define the context expected by submitChat
interface SubmitChatContext {
  selectedProviderId: string | null;
  selectedProvider: AiProviderConfig | null;
  selectedModel: AiModelConfig | undefined;
  getApiKeyForProvider: () => string | undefined;
  dbProviderConfigs: DbProviderConfig[];
  enableApiKeyManagement: boolean;
  isStreaming: boolean;
  setError: (error: string | null) => void;
  selectedItemType: SidebarItemType | null;
  selectedItemId: string | null;
  activeConversationData: DbConversation | null;
  createConversation: (
    parentId: string | null,
    title?: string,
  ) => Promise<string>;
  selectItem: (
    id: string | null,
    type: SidebarItemType | null,
  ) => Promise<void>;
  deleteItem: (id: string, type: SidebarItemType) => Promise<void>;
  vfs: VfsContextObject;
  enableVfs: boolean;
  isVfsEnabledForItem: boolean;
  runMiddleware: <H extends ModMiddlewareHookName>(
    hookName: H,
    initialPayload: ModMiddlewarePayloadMap[H],
  ) => Promise<ModMiddlewareReturnMap[H] | false>;
  handleSubmitCore: (
    currentConversationId: string,
    contentToSendToAI: MessageContent,
    vfsContextPaths?: string[],
  ) => Promise<void>;
  // Add the image generation function from the core hook
  handleImageGenerationCore: (
    currentConversationId: string,
    prompt: string,
  ) => Promise<void>; // Changed return type to void as it handles DB saving
}

export class ChatSubmissionService {
  public static async submitChat(
    promptValue: string,
    attachedFiles: File[],
    vfsPaths: string[],
    context: SubmitChatContext,
  ): Promise<void> {
    const {
      selectedProviderId,
      selectedModel,
      isStreaming,
      setError,
      selectedItemType,
      selectedItemId,
      createConversation,
      selectItem,
      vfs,
      enableVfs,
      isVfsEnabledForItem,
      runMiddleware,
      handleSubmitCore,
      handleImageGenerationCore, // Destructure the new function
    } = context;

    // Basic validations
    if (isStreaming) {
      toast.warning("Please wait for the current response to finish.");
      return;
    }
    if (!selectedProviderId || !selectedModel) {
      toast.error("Please select an AI provider and model first.");
      setError("Provider/Model not selected.");
      return;
    }
    if (!promptValue && attachedFiles.length === 0 && vfsPaths.length === 0) {
      toast.info("Please enter a prompt or attach a file.");
      return;
    }

    let currentConversationId =
      selectedItemType === "conversation" ? selectedItemId : null;

    // Create new conversation if none is selected
    if (!currentConversationId) {
      try {
        const parentId = selectedItemType === "project" ? selectedItemId : null;
        const newConvId = await createConversation(parentId, "New Chat");
        await selectItem(newConvId, "conversation");
        currentConversationId = newConvId;
        toast.success("Started new conversation.");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(`Failed to create conversation: ${message}`);
        toast.error(`Failed to create conversation: ${message}`);
        return;
      }
    }

    if (!currentConversationId) {
      setError("Failed to determine active conversation.");
      toast.error("Could not determine active conversation.");
      return;
    }

    // --- Check for Image Generation Command ---
    const imageGenCommand = "/imagine ";
    if (
      promptValue.startsWith(imageGenCommand) &&
      selectedModel.supportsImageGeneration
    ) {
      const imagePrompt = promptValue.substring(imageGenCommand.length).trim();
      if (!imagePrompt) {
        toast.info("Please enter a prompt after /imagine.");
        return;
      }
      // TODO: Add middleware hook specifically for image generation?
      // For now, directly call the core image generation handler
      await handleImageGenerationCore(currentConversationId, imagePrompt);
      return; // Stop further processing for text chat
    } else if (
      promptValue.startsWith(imageGenCommand) &&
      !selectedModel.supportsImageGeneration
    ) {
      toast.error(
        `Model '${selectedModel.name}' does not support image generation.`,
      );
      setError(
        `Model '${selectedModel.name}' does not support image generation.`,
      );
      return;
    }

    // --- Proceed with Text/Multi-modal Chat Submission ---

    // Prepare Content for AI (Text/Multi-modal)
    let finalContent: MessageContent;
    const vfsSimpleContext = {
      isVfsReady: vfs.isReady,
      isVfsEnabledForItem: isVfsEnabledForItem,
      enableVfs: enableVfs,
      vfsKey: vfs.vfsKey,
    };
    const vfsContextResult =
      await FileHandlingService.processVfsFilesWithContext(
        vfsPaths,
        vfsSimpleContext, // Pass the simplified context
      );
    const attachedFileParts =
      await FileHandlingService.processAttachedFiles(attachedFiles);

    const vfsText = vfsContextResult.contextPrefix.trim();
    const userText = promptValue.trim(); // Use the original promptValue here

    const imageParts = attachedFileParts.filter(
      (p): p is ImagePart => p.type === "image",
    );
    const textPartsFromFiles = attachedFileParts.filter(
      (p): p is TextPart => p.type === "text",
    );

    if (imageParts.length > 0) {
      // Multi-modal case
      finalContent = [];
      finalContent.push(...imageParts);
      let combinedText = "";
      if (vfsText) combinedText += vfsText;
      if (userText) combinedText += (combinedText ? "\n" : "") + userText;
      textPartsFromFiles.forEach((part) => {
        combinedText += (combinedText ? "\n" : "") + part.text;
      });
      if (combinedText) {
        finalContent.push({ type: "text", text: combinedText });
      }
    } else {
      // Text-only case
      let combinedText = "";
      if (vfsText) combinedText += vfsText;
      if (userText) combinedText += (combinedText ? "\n" : "") + userText;
      textPartsFromFiles.forEach((part) => {
        combinedText += (combinedText ? "\n" : "") + part.text;
      });
      finalContent = combinedText;
    }

    // Middleware
    const middlewarePayload: SubmitPromptPayload = {
      prompt: finalContent,
      conversationId: currentConversationId,
      vfsPaths: vfsContextResult.pathsIncludedInContext,
    };

    const middlewareResult = (await runMiddleware(
      ModMiddlewareHook.SUBMIT_PROMPT,
      middlewarePayload,
    )) as SubmitPromptPayload | false;

    if (middlewareResult === false) {
      toast.info("Submission cancelled by a mod.");
      return;
    }

    const contentToSubmit = middlewareResult.prompt;
    const vfsPathsToSave = middlewareResult.vfsPaths;

    // Call Core Text/Multi-modal Submission Logic
    await handleSubmitCore(
      currentConversationId,
      contentToSubmit,
      vfsPathsToSave,
    );
  }
}
