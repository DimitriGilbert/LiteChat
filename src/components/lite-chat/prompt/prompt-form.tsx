
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
  // DbProviderConfig, // Removed - Fetched from store
  // DbApiKey, // Removed - Fetched from store
  // DbConversation,
  MessageContent,
  // SidebarItemType,
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


interface PromptFormProps {
  className?: string;
  // Direct Input State/Actions (High Frequency - Passed Down)
  promptInputValue: string;
  setPromptInputValue: (value: string) => void;
  addAttachedFile: (file: File) => void;
  removeAttachedFile: (fileName: string) => void;
  // Direct Core State (Volatile - Passed Down)
  isStreaming: boolean;
  // Form Submission Wrapper (Passed Down)
  onFormSubmit: (
    prompt: string,
    files: File[],
    vfsPaths: string[],
    context: any,
  ) => Promise<void>;
  // Other props passed down
  attachedFiles: File[];
  selectedVfsPaths: string[];
  clearSelectedVfsPaths: () => void;
  customPromptActions: CustomPromptAction[];
  getContextSnapshot: () => ReadonlyChatContextSnapshot; // Renamed prop
  selectedModel: AiModelConfig | undefined; // Keep selectedModel for PromptActions
  stopStreaming: (parentMessageId?: string | null) => void;
  removeSelectedVfsPath: (path: string) => void;
}

const PromptFormComponent: React.FC<PromptFormProps> = ({
  className,
  // Destructure passed props
  promptInputValue,
  setPromptInputValue,
  addAttachedFile,
  removeAttachedFile,
  isStreaming,
  onFormSubmit,
  attachedFiles,
  selectedVfsPaths,
  clearSelectedVfsPaths,
  customPromptActions,
  getContextSnapshot,
  selectedModel,
  // stopStreaming,
  removeSelectedVfsPath,
}) => {
  // --- Fetch state/actions from stores ---
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

  const setError = useCoreChatStore((state) => state.setError);

  // Placeholder for middleware - replace if actual middleware is used
  const runMiddlewarePlaceholder = useCallback(
    async (_hookName: any, payload: any) => {
      return payload; // Pass through
    },
    [],
  );

  // Renamed internal handler
  const internalHandleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // --- Validations ---
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
    let currentConversationId =
      selectedItemType === "conversation" ? selectedItemId : null;
    if (!currentConversationId) {
      try {
        const parentId = selectedItemType === "project" ? selectedItemId : null;
        const newConvId = await createConversation(parentId, "New Chat");
        currentConversationId = newConvId;
        // Selection is handled by createConversation action
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
      await onFormSubmit(promptInputValue, attachedFiles, selectedVfsPaths, {
        selectedItemId: currentConversationId,
        contentToSendToAI: contentToSubmit,
        vfsContextPaths: vfsPathsToSave,
      });
    } catch (error) {
      console.error("Error during form submission prop call:", error);
    }
  };

  // Effect for VFS path clearing
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
        {/* PromptSettings will fetch its own data */}
        {/* Remove stopStreaming prop */}
        <PromptSettings />
      </div>
    </form>
  );
};

export const PromptForm = React.memo(PromptFormComponent);
