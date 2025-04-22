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
  DbProviderConfig,
  DbApiKey,
  DbConversation,
  MessageContent,
  SidebarItemType,
  CustomPromptAction,
  ReadonlyChatContextSnapshot,
  TextPart,
  ImagePart,
} from "@/lib/types";
import { FileHandlingService } from "@/services/file-handling-service";
import { ModMiddlewareHook } from "@/mods/api";
import type { SubmitPromptPayload } from "@/mods/types";

// Update props to receive volatile state directly
interface PromptFormProps {
  className?: string;
  // Direct Input State/Actions
  promptInputValue: string;
  setPromptInputValue: (value: string) => void;
  addAttachedFile: (file: File) => void;
  removeAttachedFile: (fileName: string) => void;
  clearPromptInput: () => void;
  // Direct Core State (Volatile)
  isStreaming: boolean;
  isVfsReady: boolean; // Add direct prop
  isVfsEnabledForItem: boolean; // Add direct prop
  // Bundled Props (less frequently changing / stable)
  attachedFiles: File[];
  selectedVfsPaths: string[];
  handleSubmitCore: (
    prompt: string,
    files: File[],
    vfsPaths: string[],
    context: {
      selectedItemId: string;
      contentToSendToAI: MessageContent;
      vfsContextPaths?: string[];
    },
  ) => Promise<void>;
  handleImageGenerationCore: (
    currentConversationId: string,
    prompt: string,
  ) => Promise<void>;
  setError: (error: string | null) => void;
  clearSelectedVfsPaths: () => void;
  toggleVfsEnabledAction: (id: string, type: SidebarItemType) => Promise<void>;
  selectedProviderId: string | null;
  selectedModelId: string | null;
  dbProviderConfigs: DbProviderConfig[];
  apiKeys: DbApiKey[];
  enableApiKeyManagement: boolean;
  updateDbProviderConfig: (
    id: string,
    changes: Partial<DbProviderConfig>,
  ) => Promise<void>;
  setSelectedProviderId: (id: string | null) => void;
  setSelectedModelId: (id: string | null) => void;
  selectedItemId: string | null;
  selectedItemType: SidebarItemType | null;
  createConversation: (
    parentId: string | null,
    title?: string,
  ) => Promise<string>;
  enableAdvancedSettings: boolean;
  temperature: number;
  setTemperature: (temp: number) => void;
  topP: number | null;
  setTopP: (topP: number | null) => void;
  maxTokens: number | null;
  setMaxTokens: (tokens: number | null) => void;
  topK: number | null;
  setTopK: (topK: number | null) => void;
  presencePenalty: number | null;
  setPresencePenalty: (penalty: number | null) => void;
  frequencyPenalty: number | null;
  setFrequencyPenalty: (penalty: number | null) => void;
  globalSystemPrompt: string | null;
  activeConversationData: DbConversation | null;
  updateConversationSystemPrompt: (
    id: string,
    systemPrompt: string | null,
  ) => Promise<void>;
  customPromptActions: CustomPromptAction[];
  getContextSnapshot: () => ReadonlyChatContextSnapshot;
  selectedModel: AiModelConfig | undefined;
  isVfsLoading: boolean;
  vfsError: string | null;
  vfsKey: string | null;
  stopStreaming: () => void;
  removeSelectedVfsPath: (path: string) => void;
}

const PromptFormComponent: React.FC<PromptFormProps> = ({
  className,
  // Destructure direct props
  promptInputValue,
  setPromptInputValue,
  addAttachedFile,
  removeAttachedFile,
  clearPromptInput,
  isStreaming,
  isVfsReady, // Destructure direct prop
  isVfsEnabledForItem, // Destructure direct prop
  // Destructure bundled props
  attachedFiles,
  selectedVfsPaths,
  handleSubmitCore,
  handleImageGenerationCore,
  setError,
  clearSelectedVfsPaths,
  toggleVfsEnabledAction,
  selectedProviderId,
  selectedModelId,
  dbProviderConfigs,
  apiKeys,
  enableApiKeyManagement,
  updateDbProviderConfig,
  setSelectedProviderId,
  setSelectedModelId,
  selectedItemId,
  selectedItemType,
  createConversation,
  enableAdvancedSettings,
  temperature,
  setTemperature,
  topP,
  setTopP,
  maxTokens,
  setMaxTokens,
  topK,
  setTopK,
  presencePenalty,
  setPresencePenalty,
  frequencyPenalty,
  setFrequencyPenalty,
  globalSystemPrompt,
  activeConversationData,
  updateConversationSystemPrompt,
  customPromptActions,
  getContextSnapshot,
  selectedModel,
  isVfsLoading,
  vfsError,
  vfsKey,
  stopStreaming,
  removeSelectedVfsPath,
}) => {
  const runMiddlewarePlaceholder = useCallback(
    async (hookName: any, payload: any) => {
      console.warn(`Placeholder runMiddleware called for ${hookName}`, payload);
      return payload;
    },
    [],
  );

  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

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

    let currentConversationId =
      selectedItemType === "conversation" ? selectedItemId : null;

    if (!currentConversationId) {
      try {
        const parentId = selectedItemType === "project" ? selectedItemId : null;
        const newConvId = await createConversation(parentId, "New Chat");
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

    const imageGenCommand = "/imagine ";
    if (
      promptInputValue.startsWith(imageGenCommand) &&
      selectedModel.supportsImageGeneration
    ) {
      const imagePrompt = promptInputValue
        .substring(imageGenCommand.length)
        .trim();
      if (!imagePrompt) {
        toast.info("Please enter a prompt after /imagine.");
        return;
      }
      try {
        await handleImageGenerationCore(currentConversationId, imagePrompt);
        clearPromptInput();
        clearSelectedVfsPaths();
      } catch (err) {
        // Error handled by core function
      }
      return;
    } else if (
      promptInputValue.startsWith(imageGenCommand) &&
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

    let finalContent: MessageContent;
    // VFS processing needs the actual VFS object, which isn't directly available here.
    // Assuming FileHandlingService can access it or it's passed implicitly.
    const vfsContextResult = { contextPrefix: "", pathsIncludedInContext: [] }; // Placeholder
    const attachedFileParts =
      await FileHandlingService.processAttachedFiles(attachedFiles);

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
      if (combinedText) {
        finalContent.push({ type: "text", text: combinedText });
      }
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

    const middlewarePayload: SubmitPromptPayload = {
      prompt: finalContent,
      conversationId: currentConversationId,
      vfsPaths: vfsContextResult.pathsIncludedInContext,
    };
    const middlewareResult = await runMiddlewarePlaceholder(
      ModMiddlewareHook.SUBMIT_PROMPT,
      middlewarePayload,
    );

    if (middlewareResult === false) {
      toast.info("Submission cancelled by a mod.");
      return;
    }
    const contentToSubmit = middlewareResult.prompt;
    const vfsPathsToSave = middlewareResult.vfsPaths;

    try {
      await handleSubmitCore(
        promptInputValue,
        attachedFiles,
        selectedVfsPaths,
        {
          selectedItemId: currentConversationId,
          contentToSendToAI: contentToSubmit,
          vfsContextPaths: vfsPathsToSave,
        },
      );
      clearPromptInput();
      clearSelectedVfsPaths();
    } catch (error) {
      console.error("Error during chat submission:", error);
      toast.error(
        `Submission failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      setError(
        `Submission failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  };

  useEffect(() => {
    if (!isVfsEnabledForItem && selectedVfsPaths.length > 0) {
      clearSelectedVfsPaths();
    }
  }, [isVfsEnabledForItem, selectedVfsPaths, clearSelectedVfsPaths]);

  return (
    <form
      onSubmit={handleFormSubmit}
      className={cn("flex flex-col", className)}
    >
      <PromptFiles
        attachedFiles={attachedFiles}
        removeAttachedFile={removeAttachedFile}
      />
      <SelectedVfsFilesDisplay
        selectedVfsPaths={selectedVfsPaths}
        removeSelectedVfsPath={removeSelectedVfsPath}
        isVfsEnabledForItem={isVfsEnabledForItem} // Pass direct prop
        isVfsReady={isVfsReady} // Pass direct prop
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
        {/* Pass direct props down to PromptSettings */}
        <PromptSettings
          selectedProviderId={selectedProviderId}
          dbProviderConfigs={dbProviderConfigs}
          apiKeys={apiKeys}
          enableApiKeyManagement={enableApiKeyManagement}
          selectedModelId={selectedModelId}
          setSelectedProviderId={setSelectedProviderId}
          setSelectedModelId={setSelectedModelId}
          enableVfs={true} // Assuming global VFS is enabled if this renders
          isVfsEnabledForItem={isVfsEnabledForItem} // Pass direct prop
          selectedItemId={selectedItemId}
          selectedItemType={selectedItemType}
          toggleVfsEnabledAction={toggleVfsEnabledAction}
          enableAdvancedSettings={enableAdvancedSettings}
          temperature={temperature}
          setTemperature={setTemperature}
          topP={topP}
          setTopP={setTopP}
          maxTokens={maxTokens}
          setMaxTokens={setMaxTokens}
          topK={topK}
          setTopK={setTopK}
          presencePenalty={presencePenalty}
          setPresencePenalty={setPresencePenalty}
          frequencyPenalty={frequencyPenalty}
          setFrequencyPenalty={setFrequencyPenalty}
          globalSystemPrompt={globalSystemPrompt}
          activeConversationData={activeConversationData}
          updateConversationSystemPrompt={updateConversationSystemPrompt}
          updateDbProviderConfig={updateDbProviderConfig}
          isVfsReady={isVfsReady} // Pass direct prop
          isVfsLoading={isVfsLoading}
          vfsError={vfsError}
          vfsKey={vfsKey}
          stopStreaming={stopStreaming}
        />
      </div>
    </form>
  );
};

export const PromptForm = React.memo(PromptFormComponent);
