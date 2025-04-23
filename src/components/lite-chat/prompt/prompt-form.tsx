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

// CORRECTED Props Interface
interface PromptFormProps {
  className?: string;
  onFormSubmit: (
    prompt: string,
    files: File[],
    vfsPaths: string[],
    context: any,
  ) => Promise<void>;
  customPromptActions: CustomPromptAction[];
  getContextSnapshot: () => ReadonlyChatContextSnapshot;
  selectedModel: AiModelConfig | undefined;
  stopStreaming: (parentMessageId?: string | null) => void; // Keep stopStreaming prop
}

const PromptFormComponent: React.FC<PromptFormProps> = ({
  className,
  // Destructure only the necessary props
  onFormSubmit,
  customPromptActions,
  getContextSnapshot,
  selectedModel,
}) => {
  // --- Fetch state/actions directly from stores ---
  const {
    promptInputValue, // Use direct names
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
    // Use direct name
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

  // --- Placeholder for middleware ---
  const runMiddlewarePlaceholder = useCallback(
    async (_hookName: any, payload: any) => {
      return payload; // Pass through
    },
    [],
  );

  // --- Internal Submit Handler ---
  const internalHandleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // --- Validations ---
    if (isStreaming) {
      // Use store value
      toast.warning("Please wait for the current response to finish.");
      return;
    }
    if (!selectedProviderId || !selectedModel) {
      toast.error("Please select an AI provider and model first.");
      setError("Provider/Model not selected.");
      return;
    }
    if (
      !promptInputValue && // Use store value
      attachedFiles.length === 0 && // Use store value
      selectedVfsPaths.length === 0 // Use store value
    ) {
      toast.info("Please enter a prompt or attach a file.");
      return;
    }

    // --- Get Conversation ID ---
    let currentConversationId =
      selectedItemType === "conversation" ? selectedItemId : null;
    if (!currentConversationId) {
      try {
        const parentId = selectedItemType === "project" ? selectedItemId : null;
        const newConvId = await createConversation(parentId, "New Chat");
        currentConversationId = newConvId;
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

    // --- Prepare Content ---
    const vfsContext = {
      isVfsReady,
      isVfsEnabledForItem,
      enableVfs: enableVfs,
      vfsKey,
    };
    const vfsContextResult =
      await FileHandlingService.processVfsFilesWithContext(
        selectedVfsPaths, // Use store value
        vfsContext,
      );
    const attachedFileParts =
      await FileHandlingService.processAttachedFiles(attachedFiles); // Use store value
    let finalContent: MessageContent;
    const vfsText = vfsContextResult.contextPrefix.trim();
    const userText = promptInputValue.trim(); // Use store value
    const imageParts = attachedFileParts.filter(
      (p): p is ImagePart => p.type === "image",
    );
    const textPartsFromFiles = attachedFileParts.filter(
      (p): p is TextPart => p.type === "text",
    );
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

    // --- Middleware ---
    const middlewarePayload: SubmitPromptPayload = {
      prompt: finalContent,
      conversationId: currentConversationId,
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

    // --- Call the passed onFormSubmit wrapper ---
    try {
      // Pass original values from store to the handler
      await onFormSubmit(
        promptInputValue, // Use store value
        attachedFiles, // Use store value
        selectedVfsPaths, // Use store value
        {
          selectedItemId: currentConversationId,
          contentToSendToAI: contentToSubmit,
          vfsContextPaths: vfsPathsToSave,
        },
      );
    } catch (error) {
      console.error("Error during form submission prop call:", error);
    }
  };

  // Effect for VFS path clearing - USE STORE VALUES
  useEffect(() => {
    if (!isVfsEnabledForItem && selectedVfsPaths.length > 0) {
      clearSelectedVfsPaths(); // Use store action
    }
  }, [isVfsEnabledForItem, selectedVfsPaths, clearSelectedVfsPaths]);

  return (
    <form
      onSubmit={internalHandleSubmit}
      className={cn("flex flex-col", className)}
    >
      <PromptFiles
        attachedFiles={attachedFiles} // Use store value
        removeAttachedFile={removeAttachedFile} // Use store action
      />
      <SelectedVfsFilesDisplay
        selectedVfsPaths={selectedVfsPaths} // Use store value
        removeSelectedVfsPath={removeSelectedVfsPath} // Use store action
        isVfsEnabledForItem={isVfsEnabledForItem} // From store
        isVfsReady={isVfsReady} // From store
      />

      <div className="flex items-end p-3 md:p-4">
        <PromptInput
          className="min-h-[60px]"
          prompt={promptInputValue} // Use store value
          setPrompt={setPromptInputValue} // Use store action
          isStreaming={isStreaming} // Use store value
        />
        <PromptActions
          prompt={promptInputValue} // Use store value
          isStreaming={isStreaming} // Use store value
          addAttachedFile={addAttachedFile} // Use store action
          setPrompt={setPromptInputValue} // Use store action
          selectedModel={selectedModel} // Prop
          customPromptActions={customPromptActions} // Prop
          getContextSnapshot={getContextSnapshot} // Prop
        />
      </div>

      <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
        {/* Pass stopStreaming prop down */}
        <PromptSettings />
      </div>
    </form>
  );
};

export const PromptForm = React.memo(PromptFormComponent);
