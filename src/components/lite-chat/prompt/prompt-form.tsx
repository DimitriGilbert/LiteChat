// src/components/lite-chat/prompt/prompt-form.tsx
import React, { useEffect, useCallback } from "react";
import { PromptInput } from "./prompt-input";
import { PromptSettings } from "./prompt-settings";
import { PromptFiles } from "./prompt-files";
import { SelectedVfsFilesDisplay } from "@/components/lite-chat/selected-vfs-files-display";
import { PromptActions } from "./prompt-actions";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type {
  AiModelConfig,
  MessageContent,
  CustomPromptAction,
  ReadonlyChatContextSnapshot,
  TextPart,
  ImagePart,
} from "@/lib/types";
import { FileHandlingService } from "@/services/file-handling-service";
import type { SubmitPromptPayload } from "@/mods/types";
import { useShallow } from "zustand/react/shallow";
import { useVfsStore } from "@/store/vfs.store";
import { useSidebarStore } from "@/store/sidebar.store";
import { useProviderStore } from "@/store/provider.store";
import { useCoreChatStore } from "@/store/core-chat.store";
import { useInputStore } from "@/store/input.store";

// Interface definition remains the same
interface PromptFormProps {
  className?: string;
  onFormSubmit: (
    prompt: string,
    files: File[],
    vfsPaths: string[],
    context: {
      selectedItemId: string | null; // This is the key part
      contentToSendToAI: MessageContent;
      vfsContextPaths?: string[];
    },
  ) => Promise<void>;
  customPromptActions: CustomPromptAction[];
  getContextSnapshot: () => ReadonlyChatContextSnapshot;
  selectedModel: AiModelConfig | undefined;
  stopStreaming: (parentMessageId?: string | null) => void;
}

const PromptFormComponent: React.FC<PromptFormProps> = ({
  className,
  onFormSubmit,
  customPromptActions,
  getContextSnapshot,
  selectedModel,
  // stopStreaming prop is not used directly here, but passed down
}) => {
  // --- Fetch state/actions directly from stores ---
  const {
    promptInputValue,
    setPromptInputValue,
    attachedFiles,
    addAttachedFile,
    removeAttachedFile,
    selectedVfsPaths,
    removeSelectedVfsPath,
    clearSelectedVfsPaths,
  } = useInputStore(
    useShallow((state) => ({
      promptInputValue: state.promptInputValue,
      setPromptInputValue: state.setPromptInputValue,
      attachedFiles: state.attachedFiles,
      addAttachedFile: state.addAttachedFile,
      removeAttachedFile: state.removeAttachedFile,
      selectedVfsPaths: state.selectedVfsPaths,
      removeSelectedVfsPath: state.removeSelectedVfsPath,
      clearSelectedVfsPaths: state.clearSelectedVfsPaths,
    })),
  );

  const { isStreaming, setError } = useCoreChatStore(
    useShallow((state) => ({
      isStreaming: state.isStreaming,
      setError: state.setError,
    })),
  );

  const { selectedItemId, selectedItemType, createConversation } =
    useSidebarStore(
      useShallow((state) => ({
        selectedItemId: state.selectedItemId,
        selectedItemType: state.selectedItemType,
        createConversation: state.createConversation,
      })),
    );

  const { isVfsReady, isVfsEnabledForItem, vfsKey, enableVfs } = useVfsStore(
    useShallow((state) => ({
      isVfsReady: state.isVfsReady,
      isVfsEnabledForItem: state.isVfsEnabledForItem,
      vfsKey: state.vfsKey,
      enableVfs: state.enableVfs,
    })),
  );

  const { selectedProviderId } = useProviderStore(
    useShallow((state) => ({
      selectedProviderId: state.selectedProviderId,
    })),
  );

  // Placeholder for middleware - replace with actual implementation if needed
  const runMiddlewarePlaceholder = useCallback(
    async (_hookName: any, payload: any) => {
      return payload;
    },
    [],
  );

  const internalHandleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log("[PromptForm] internalHandleSubmit triggered."); // Log start

    if (isStreaming) {
      toast.warning("Please wait for the current response to finish.");
      return;
    }
    if (!selectedProviderId || !selectedModel) {
      toast.error("Please select an AI provider and model first.");
      setError("Provider/Model not selected.");
      return;
    }
    if (
      !promptInputValue &&
      attachedFiles.length === 0 &&
      selectedVfsPaths.length === 0
    ) {
      toast.info("Please enter a prompt or attach a file.");
      return;
    }

    // --- Get Conversation ID ---
    let currentConversationId: string | null =
      selectedItemType === "conversation" ? selectedItemId : null;

    console.log(
      `[PromptForm] Initial check: selectedItemId=${selectedItemId}, selectedItemType=${selectedItemType}, currentConversationId=${currentConversationId}`,
    ); // Log initial state

    // If no conversation is selected, try to create one
    if (!currentConversationId) {
      try {
        const parentId = selectedItemType === "project" ? selectedItemId : null;
        console.log(
          `[PromptForm] No conversation selected, attempting to create new one (parentId: ${parentId})...`,
        );
        const newConvId = await createConversation(parentId, "New Chat");
        console.log(`[PromptForm] createConversation returned: ${newConvId}`); // Log return value
        currentConversationId = newConvId; // Assign the returned ID
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error("[PromptForm] Error creating conversation:", err); // Log error
        setError(`Failed to create conversation: ${message}`);
        toast.error(`Failed to create conversation: ${message}`);
        return; // Stop submission if creation fails
      }
    }

    // Check if ID is valid *after* potential creation attempt
    console.log(
      `[PromptForm] After creation attempt, currentConversationId=${currentConversationId}`,
    ); // Log state after attempt
    if (!currentConversationId) {
      const errorMsg = "Failed to determine active conversation.";
      console.error(`[PromptForm] ${errorMsg}`); // Log the specific error point
      setError(errorMsg);
      toast.error(errorMsg);
      return; // Stop submission if ID is still null
    }

    // --- Prepare Content ---
    console.log("[PromptForm] Preparing content..."); // Log content prep
    const vfsContext = {
      isVfsReady,
      isVfsEnabledForItem,
      enableVfs: enableVfs,
      vfsKey,
    };
    const vfsContextResult =
      await FileHandlingService.processVfsFilesWithContext(
        selectedVfsPaths,
        vfsContext,
      );
    const attachedFileParts =
      await FileHandlingService.processAttachedFiles(attachedFiles);

    let finalContent: MessageContent;
    const vfsText = vfsContextResult.contextPrefix.trim();
    const userText = promptInputValue.trim();
    const imageParts = attachedFileParts.filter(
      (p): p is ImagePart => p.type === "image",
    );
    const textPartsFromFiles = attachedFileParts.filter(
      (p): p is TextPart => p.type === "text",
    );

    // Construct final content based on parts
    if (imageParts.length > 0) {
      finalContent = [];
      finalContent.push(...imageParts);
      let combinedText = "";
      if (vfsText) combinedText += vfsText;
      if (userText)
        combinedText +=
          (combinedText
            ? `

`
            : "") + userText;
      textPartsFromFiles.forEach((part) => {
        combinedText +=
          (combinedText
            ? `

`
            : "") + part.text;
      });
      if (combinedText) finalContent.push({ type: "text", text: combinedText });
    } else {
      let combinedText = "";
      if (vfsText) combinedText += vfsText;
      if (userText)
        combinedText +=
          (combinedText
            ? `

`
            : "") + userText;
      textPartsFromFiles.forEach((part) => {
        combinedText +=
          (combinedText
            ? `

`
            : "") + part.text;
      });
      finalContent = combinedText;
    }
    console.log("[PromptForm] Content prepared:", finalContent); // Log prepared content

    // --- Middleware (Placeholder) ---
    const middlewarePayload: SubmitPromptPayload = {
      prompt: finalContent,
      conversationId: currentConversationId, // Use the determined ID
      vfsPaths: vfsContextResult.pathsIncludedInContext,
    };
    const middlewareResult = await runMiddlewarePlaceholder(
      "SUBMIT_PROMPT",
      middlewarePayload,
    );
    if (middlewareResult === false) {
      toast.info("Submission cancelled by a mod.");
      return;
    }
    const contentToSubmit = middlewareResult.prompt;
    const vfsPathsToSave = middlewareResult.vfsPaths;

    // --- Call the actual submission handler ---
    console.log(
      `[PromptForm] Calling onFormSubmit with conversationId: ${currentConversationId}`,
    ); // Log before calling prop
    try {
      await onFormSubmit(promptInputValue, attachedFiles, selectedVfsPaths, {
        selectedItemId: currentConversationId, // Pass the validated ID
        contentToSendToAI: contentToSubmit,
        vfsContextPaths: vfsPathsToSave,
      });
      console.log("[PromptForm] onFormSubmit call completed."); // Log after call
    } catch (error) {
      console.error("[PromptForm] Error during onFormSubmit prop call:", error);
    }
  };

  // Effect to clear selected VFS paths if VFS becomes disabled for the item
  useEffect(() => {
    if (!isVfsEnabledForItem && selectedVfsPaths.length > 0) {
      clearSelectedVfsPaths();
    }
  }, [isVfsEnabledForItem, selectedVfsPaths, clearSelectedVfsPaths]);

  return (
    <form
      onSubmit={internalHandleSubmit}
      className={cn("flex flex-col", className)}
    >
      <PromptFiles
        attachedFiles={attachedFiles}
        removeAttachedFile={removeAttachedFile}
      />
      <SelectedVfsFilesDisplay
        selectedVfsPaths={selectedVfsPaths}
        removeSelectedVfsPath={removeSelectedVfsPath}
        isVfsEnabledForItem={isVfsEnabledForItem}
        isVfsReady={isVfsReady}
      />

      <div className="flex items-end p-3 md:p-4">
        <PromptInput
          className="min-h-[60px]"
          prompt={promptInputValue}
          setPrompt={setPromptInputValue}
          isStreaming={isStreaming}
        />
        <PromptActions
          prompt={promptInputValue}
          isStreaming={isStreaming}
          addAttachedFile={addAttachedFile}
          setPrompt={setPromptInputValue}
          selectedModel={selectedModel}
          customPromptActions={customPromptActions}
          getContextSnapshot={getContextSnapshot}
        />
      </div>

      <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
        <PromptSettings />
      </div>
    </form>
  );
};

export const PromptForm = React.memo(PromptFormComponent);
