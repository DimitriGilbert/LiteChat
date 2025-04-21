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
  // Bundled Props (less frequently changing / stable)
  attachedFiles: File[];
  selectedVfsPaths: string[];
  isVfsEnabledForItem: boolean;
  handleSubmitCore: (
    prompt: string, // Keep original prompt for potential logging
    files: File[], // Keep original files
    vfsPaths: string[], // Keep original VFS paths
    context: {
      // Pass processed context
      selectedItemId: string;
      contentToSendToAI: MessageContent;
      vfsContextPaths?: string[];
    },
  ) => Promise<void>;
  handleImageGenerationCore: (
    currentConversationId: string,
    prompt: string,
  ) => Promise<void>;
  setError: (error: string | null) => void; // Needed for submit service
  clearSelectedVfsPaths: () => void;
  isVfsReady: boolean;
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
  getContextSnapshot: () => ReadonlyChatContextSnapshot; // Renamed from getContextSnapshotForMod
  selectedModel: AiModelConfig | undefined;
  isVfsLoading: boolean;
  vfsError: string | null;
  vfsKey: string | null;
  stopStreaming: () => void;
  removeSelectedVfsPath: (path: string) => void;
}

const PromptFormComponent: React.FC<PromptFormProps> = ({
  className,
  // Destructure direct props (volatile state + input)
  promptInputValue,
  setPromptInputValue,
  addAttachedFile,
  removeAttachedFile,
  clearPromptInput,
  isStreaming,
  // Destructure bundled props (stable)
  attachedFiles,
  selectedVfsPaths,
  isVfsEnabledForItem,
  handleSubmitCore,
  handleImageGenerationCore,
  setError,
  clearSelectedVfsPaths,
  isVfsReady,
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
  // Placeholder for runMiddleware
  const runMiddlewarePlaceholder = useCallback(
    async (hookName: any, payload: any) => {
      console.warn(`Placeholder runMiddleware called for ${hookName}`, payload);
      return payload;
    },
    [],
  );

  // Use the handleSubmitCore prop passed from LiteChatInner
  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

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

    // Create new conversation if none is selected
    if (!currentConversationId) {
      try {
        const parentId = selectedItemType === "project" ? selectedItemId : null;
        const newConvId = await createConversation(parentId, "New Chat");
        // selectItem is handled by the parent store/effect now
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
        // Call the stable wrapper function from props
        await handleImageGenerationCore(currentConversationId, imagePrompt);
        clearPromptInput(); // Clear input after successful submission
        clearSelectedVfsPaths();
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (err) {
        // Error handled by handleImageGenerationCore wrapper
      }
      return; // Stop further processing
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

    // --- Proceed with Text/Multi-modal Chat Submission ---
    // Prepare Content for AI (Text/Multi-modal)
    let finalContent: MessageContent;
    // VFS processing needs the actual VFS object, which isn't directly available here.
    // This logic should ideally happen closer to where VFS state is managed or passed down.
    // For now, we'll simplify and assume VFS content is handled externally or passed in context.
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

    // --- Middleware Placeholder ---
    // This needs to be implemented properly if middleware is used.
    // For now, assume no middleware or pass the placeholder function.
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
    // --- End Middleware Placeholder ---

    try {
      // Call the wrapper function passed via props
      await handleSubmitCore(
        promptInputValue, // Pass original prompt for potential logging/history
        attachedFiles, // Pass original files
        selectedVfsPaths, // Pass original VFS paths
        {
          // Pass the processed context
          selectedItemId: currentConversationId,
          contentToSendToAI: contentToSubmit, // Use potentially modified content
          vfsContextPaths: vfsPathsToSave, // Use potentially modified paths
        },
      );
      clearPromptInput(); // Use direct prop action
      clearSelectedVfsPaths(); // Use bundled prop action
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

  // Effect to clear VFS paths if VFS becomes disabled for the item (uses props)
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
      {/* Pass props down */}
      <PromptFiles
        attachedFiles={attachedFiles} // From bundle
        removeAttachedFile={removeAttachedFile} // Direct prop
      />
      {/* Pass props down */}
      <SelectedVfsFilesDisplay
        selectedVfsPaths={selectedVfsPaths} // From bundle
        removeSelectedVfsPath={removeSelectedVfsPath} // From bundle
        isVfsEnabledForItem={isVfsEnabledForItem} // From bundle
        isVfsReady={isVfsReady} // From bundle
      />

      <div className="flex items-end p-3 md:p-4">
        {/* Pass direct props down */}
        <PromptInput
          className="min-h-[60px]"
          prompt={promptInputValue} // Direct prop
          setPrompt={setPromptInputValue} // Direct prop
          isStreaming={isStreaming} // Direct prop
        />
        {/* Pass direct props down */}
        <PromptActions
          prompt={promptInputValue} // Direct prop
          isStreaming={isStreaming} // Direct prop
          addAttachedFile={addAttachedFile} // Direct prop
          setPrompt={setPromptInputValue} // Direct prop
          // Pass derived/state props needed by PromptActions (from stable bundle)
          selectedModel={selectedModel}
          customPromptActions={customPromptActions}
          getContextSnapshot={getContextSnapshot}
        />
      </div>

      <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
        {/* Pass stable props down */}
        <PromptSettings
          // Provider/Model related (from stable bundle)
          selectedProviderId={selectedProviderId}
          dbProviderConfigs={dbProviderConfigs}
          apiKeys={apiKeys}
          enableApiKeyManagement={enableApiKeyManagement}
          selectedModelId={selectedModelId}
          setSelectedProviderId={setSelectedProviderId}
          setSelectedModelId={setSelectedModelId}
          // VFS related (from stable bundle)
          enableVfs={true} // Pass global flag if available
          isVfsEnabledForItem={isVfsEnabledForItem}
          selectedItemId={selectedItemId}
          selectedItemType={selectedItemType}
          toggleVfsEnabledAction={toggleVfsEnabledAction}
          // Advanced Settings related (from stable bundle)
          enableAdvancedSettings={enableAdvancedSettings}
          // Pass down AI params for PromptSettingsAdvanced (from stable bundle)
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
          // Pass down VFS state for PromptSettingsAdvanced (from stable bundle)
          isVfsReady={isVfsReady}
          isVfsLoading={isVfsLoading}
          vfsError={vfsError}
          vfsKey={vfsKey}
          // Pass down stopStreaming (from stable bundle)
          stopStreaming={stopStreaming}
        />
      </div>
    </form>
  );
};

// Export the memoized component
// React.memo should be effective as most props are stable or less volatile now
export const PromptForm = React.memo(PromptFormComponent);
