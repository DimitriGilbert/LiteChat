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
  // Removed unused CoreMessage import
} from "@/lib/types";
import { ModMiddlewareHook, ModMiddlewareHookName } from "@/mods/api"; // Import hook names
import type {
  ModMiddlewarePayloadMap,
  ModMiddlewareReturnMap,
  SubmitPromptPayload, // Import specific payload type
} from "@/mods/types"; // Assuming middleware types

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
  deleteItem: (id: string, type: SidebarItemType) => Promise<void>; // Added deleteItem if needed
  vfs: VfsContextObject;
  enableVfs: boolean;
  isVfsEnabledForItem: boolean;
  runMiddleware: <H extends ModMiddlewareHookName>(
    hookName: H,
    initialPayload: ModMiddlewarePayloadMap[H],
  ) => Promise<ModMiddlewareReturnMap[H] | false>;
  handleSubmitCore: (
    // Removed originalUserPrompt
    currentConversationId: string,
    contentToSendToAI: MessageContent,
    vfsContextPaths?: string[],
  ) => Promise<void>;
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
    } = context;

    // Basic validations (remain the same)
    if (isStreaming) {
      toast.warning("Please wait for the current response to finish.");
      return;
    }
    if (!selectedProviderId || !selectedModel) {
      toast.error("Please select an AI provider and model first.");
      setError("Provider/Model not selected.");
      return;
    }
    // Allow submission even if promptValue is empty, as long as files are attached
    if (!promptValue && attachedFiles.length === 0 && vfsPaths.length === 0) {
      toast.info("Please enter a prompt or attach a file.");
      return;
    }

    let currentConversationId =
      selectedItemType === "conversation" ? selectedItemId : null;

    // Create new conversation if none is selected (remains the same)
    if (!currentConversationId) {
      try {
        const parentId = selectedItemType === "project" ? selectedItemId : null;
        const newConvId = await createConversation(parentId, "New Chat");
        await selectItem(newConvId, "conversation"); // Select the new conversation
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

    // --- Prepare Content for AI (CORRECTED LOGIC) ---
    let finalContent: MessageContent;
    const vfsContextResult = await FileHandlingService.processVfsFiles(
      vfsPaths,
      vfs,
      isVfsEnabledForItem,
      enableVfs,
    );
    // This returns ContentPart[] (TextPart | ImagePart)
    const attachedFileParts =
      await FileHandlingService.processAttachedFiles(attachedFiles);

    const vfsText = vfsContextResult.contextPrefix.trim();
    const userText = promptValue.trim();

    // Check if any image parts were generated
    const imageParts = attachedFileParts.filter(
      (p): p is ImagePart => p.type === "image",
    );
    const textPartsFromFiles = attachedFileParts.filter(
      (p): p is TextPart => p.type === "text",
    );

    if (imageParts.length > 0) {
      // --- Multi-modal case: Content MUST be an array ---
      finalContent = [];

      // 1. Add all image parts
      finalContent.push(...imageParts);

      // 2. Combine all text sources into a single text part
      let combinedText = "";
      if (vfsText) {
        combinedText += vfsText;
      }
      if (userText) {
        combinedText += (combinedText ? "\n\n" : "") + userText; // Add user prompt text
      }
      textPartsFromFiles.forEach((part) => {
        combinedText += (combinedText ? "\n\n" : "") + part.text; // Add text from files
      });

      // 3. Add the combined text part if it's not empty
      if (combinedText) {
        finalContent.push({ type: "text", text: combinedText });
      }
      // If only images were attached and no text prompt, finalContent will just contain ImageParts
    } else {
      // --- Text-only case: Content is a single string ---
      let combinedText = "";
      if (vfsText) {
        combinedText += vfsText;
      }
      if (userText) {
        combinedText += (combinedText ? "\n\n" : "") + userText;
      }
      textPartsFromFiles.forEach((part) => {
        combinedText += (combinedText ? "\n\n" : "") + part.text;
      });
      finalContent = combinedText; // Assign the combined string
    }
    // --- End Content Preparation ---

    // --- Middleware ---
    // Ensure the payload matches the expected type for SUBMIT_PROMPT
    const middlewarePayload: SubmitPromptPayload = {
      prompt: finalContent, // Pass the correctly structured content (string or array)
      conversationId: currentConversationId,
      vfsPaths: vfsContextResult.pathsIncludedInContext,
    };

    // Type assertion for the return value might be needed depending on runMiddleware definition
    const middlewareResult = (await runMiddleware(
      ModMiddlewareHook.SUBMIT_PROMPT,
      middlewarePayload,
    )) as SubmitPromptPayload | false; // Assert return type

    if (middlewareResult === false) {
      toast.info("Submission cancelled by a mod.");
      return; // Submission cancelled
    }

    // Use the potentially modified content from middleware
    const contentToSubmit = middlewareResult.prompt;
    const vfsPathsToSave = middlewareResult.vfsPaths; // Use potentially modified paths

    // --- Call Core Submission Logic ---
    await handleSubmitCore(
      // Removed promptValue (originalUserPrompt)
      currentConversationId,
      contentToSubmit, // Pass the final, correctly structured content
      vfsPathsToSave,
    );
  }
}
