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
  AiProviderConfig as AiProviderConfigType,
} from "@/lib/types";
import { FileHandlingService } from "@/services/file-handling-service";
import type { SubmitPromptPayload } from "@/mods/types";
// Removed unused imports
// import { createOpenAI } from "@ai-sdk/openai";
// import { createGoogleGenerativeAI } from "@ai-sdk/google";
// import { createOpenRouter } from "@openrouter/ai-sdk-provider";
// import { createOllama } from "ollama-ai-provider";
// import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

interface PromptFormProps {
  className?: string;
  // Direct Input State/Actions
  promptInputValue: string;
  setPromptInputValue: (value: string) => void;
  addAttachedFile: (file: File) => void;
  removeAttachedFile: (fileName: string) => void;
  // clearPromptInput: () => void; // Removed unused prop
  // clearAttachedFiles: () => void; // Removed unused prop
  // Direct Core State (Volatile)
  isStreaming: boolean;
  isVfsReady: boolean;
  isVfsEnabledForItem: boolean;
  // Form Submission Wrapper
  onFormSubmit: (
    prompt: string,
    files: File[],
    vfsPaths: string[],
    context: any,
  ) => Promise<void>; // Added prop
  // Other props
  attachedFiles: File[];
  selectedVfsPaths: string[];
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
  stopStreaming: (parentMessageId?: string | null) => void;
  removeSelectedVfsPath: (path: string) => void;
  // getApiKeyForProvider: (providerId: string) => string | undefined; // Removed unused prop
  // selectedProvider: AiProviderConfigType | undefined; // Removed unused prop
}

const PromptFormComponent: React.FC<PromptFormProps> = ({
  className,
  // Destructure all props
  promptInputValue,
  setPromptInputValue,
  addAttachedFile,
  removeAttachedFile,
  // clearPromptInput, // Removed unused prop
  // clearAttachedFiles, // Removed unused prop
  isStreaming,
  isVfsReady,
  isVfsEnabledForItem,
  onFormSubmit, // Destructure the wrapper function
  attachedFiles,
  selectedVfsPaths,
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
  // getApiKeyForProvider, // Removed unused prop
  // selectedProvider, // Removed unused prop
}) => {
  // Placeholder for middleware - replace if actual middleware is used
  const runMiddlewarePlaceholder = useCallback(
    async (_hookName: any, payload: any) => {
      // _hookName is unused
      return payload; // Pass through
    },
    [],
  );

  // Renamed internal handler
  const internalHandleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // --- Validations (remain the same) ---
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

    // --- Get Conversation ID (remains the same) ---
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

    // --- Prepare Content (remains the same) ---
    const vfsContext = {
      isVfsReady,
      isVfsEnabledForItem,
      enableVfs: true,
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
      if (userText) combinedText += (combinedText ? `\n\n` : "") + userText;
      textPartsFromFiles.forEach((part) => {
        combinedText += (combinedText ? `\n\n` : "") + part.text;
      });
      if (combinedText) finalContent.push({ type: "text", text: combinedText });
    } else {
      let combinedText = "";
      if (vfsText) combinedText += vfsText;
      if (userText) combinedText += (combinedText ? `\n\n` : "") + userText;
      textPartsFromFiles.forEach((part) => {
        combinedText += (combinedText ? `\n\n` : "") + part.text;
      });
      finalContent = combinedText;
    }

    // --- Middleware (remains the same, placeholder) ---
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
      await onFormSubmit(
        promptInputValue, // Pass original prompt value
        attachedFiles, // Pass original files
        selectedVfsPaths, // Pass original VFS paths
        {
          selectedItemId: currentConversationId,
          contentToSendToAI: contentToSubmit, // Pass processed content
          vfsContextPaths: vfsPathsToSave, // Pass processed VFS paths
        },
      );
      // Input clearing is now handled within the onFormSubmit wrapper in useLiteChatLogic
    } catch (error) {
      // Error handling is done within the onFormSubmit wrapper
      console.error("Error during form submission prop call:", error);
    }
  };

  // Effect for VFS path clearing (remains the same)
  useEffect(() => {
    if (!isVfsEnabledForItem && selectedVfsPaths.length > 0) {
      clearSelectedVfsPaths();
    }
  }, [isVfsEnabledForItem, selectedVfsPaths, clearSelectedVfsPaths]);

  return (
    // Use the internal handler for the form's onSubmit
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
        <PromptSettings
          selectedProviderId={selectedProviderId}
          dbProviderConfigs={dbProviderConfigs}
          apiKeys={apiKeys}
          enableApiKeyManagement={enableApiKeyManagement}
          selectedModelId={selectedModelId}
          setSelectedProviderId={setSelectedProviderId}
          setSelectedModelId={setSelectedModelId}
          enableVfs={true}
          isVfsEnabledForItem={isVfsEnabledForItem}
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
          isVfsReady={isVfsReady}
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
