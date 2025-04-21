// src/components/lite-chat/prompt/prompt-form.tsx
import React, { useEffect, useMemo, useCallback } from "react";
import { PromptInput } from "./prompt-input";
import { PromptSettings } from "./prompt-settings";
import { PromptFiles } from "./prompt-files";
import { SelectedVfsFilesDisplay } from "@/components/lite-chat/selected-vfs-files-display";
import { PromptActions } from "./prompt-actions";
// REMOVED store imports
import { cn } from "@/lib/utils";
import { toast } from "sonner";
// REMOVED: import { ChatSubmissionService } from "@/services/chat-submission-service";
import type {
  AiProviderConfig,
  AiModelConfig,
  DbProviderConfig,
  DbApiKey,
  DbConversation,
  MessageContent, // Added
  SidebarItemType, // Added
  CustomPromptAction, // Added for PromptActions
  ReadonlyChatContextSnapshot, // Import from lib/types
} from "@/lib/types";
// Import Mod types if runMiddleware is used
// import { ModMiddlewareHook, ModMiddlewareHookName } from "@/mods/api";
// import type { ModMiddlewarePayloadMap, ModMiddlewareReturnMap } from "@/mods/types";
import { FileHandlingService } from "@/services/file-handling-service"; // Import for content prep

// Define props based on what PromptWrapper passes down
interface PromptFormProps {
  className?: string;
  // Input State/Actions
  promptInputValue: string;
  attachedFiles: File[];
  setPromptInputValue: (value: string) => void;
  addAttachedFile: (file: File) => void;
  removeAttachedFile: (fileName: string) => void;
  clearPromptInput: () => void;
  // Core Chat State/Actions
  isStreaming: boolean;
  // Renamed handleSubmitCore to handleFormSubmitWrapper to avoid confusion
  handleSubmitCore: (
    prompt: string,
    files: File[],
    vfsPaths: string[],
    context: any, // Context passed from LiteChatInner
  ) => Promise<void>;
  handleImageGenerationCore: (
    currentConversationId: string,
    prompt: string,
  ) => Promise<void>;
  setError: (error: string | null) => void; // Needed for submit service
  // VFS State/Actions
  selectedVfsPaths: string[];
  clearSelectedVfsPaths: () => void;
  isVfsEnabledForItem: boolean;
  removeSelectedVfsPath: (path: string) => void;
  isVfsReady: boolean;
  toggleVfsEnabledAction: (id: string, type: SidebarItemType) => Promise<void>;
  // Provider State/Actions
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
  // Sidebar State/Actions
  selectedItemId: string | null;
  selectedItemType: SidebarItemType | null;
  dbConversations: DbConversation[]; // Keep for deriving activeConversationData
  createConversation: (
    parentId: string | null,
    title?: string,
  ) => Promise<string>;
  selectItem: (
    id: string | null,
    type: SidebarItemType | null,
  ) => Promise<void>;
  deleteItem: (id: string, type: SidebarItemType) => Promise<void>;
  // Settings State/Actions
  // REMOVED: isSettingsModalOpen: boolean;
  // REMOVED: setIsSettingsModalOpen: (isOpen: boolean) => void;
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
  // Mod Store (Placeholder - If needed)
  // runMiddleware: <H extends ModMiddlewareHookName>(hookName: H, initialPayload: ModMiddlewarePayloadMap[H]) => Promise<ModMiddlewareReturnMap[H] | false>;
  // VFS Context Object (Placeholder - If needed directly, otherwise passed to service)
  // vfs: VfsContextObject;
  // enableVfs: boolean; // Global VFS flag
  // Props for PromptActions
  customPromptActions: CustomPromptAction[];
  getContextSnapshot: () => ReadonlyChatContextSnapshot;
  selectedModel: AiModelConfig | undefined;
  // Props for PromptSettingsAdvanced
  isVfsLoading: boolean;
  vfsError: string | null;
  vfsKey: string | null;
  // Props for PromptSettings
  stopStreaming: () => void;
}

// Wrap component logic in a named function for React.memo
const PromptFormComponent: React.FC<PromptFormProps> = ({
  className,
  // Destructure all props
  promptInputValue,
  attachedFiles,
  setPromptInputValue,
  addAttachedFile,
  removeAttachedFile,
  clearPromptInput,
  isStreaming,
  handleSubmitCore, // Use the renamed prop
  handleImageGenerationCore,
  setError,
  selectedVfsPaths,
  clearSelectedVfsPaths,
  isVfsEnabledForItem,
  removeSelectedVfsPath,
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
  dbConversations, // Keep for deriving activeConversationData
  createConversation,
  selectItem,
  deleteItem,
  // REMOVED: isSettingsModalOpen,
  // REMOVED: setIsSettingsModalOpen,
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
  // runMiddleware, // Placeholder
  // vfs, // Placeholder
  // enableVfs, // Placeholder
}) => {
  // --- Derivations using props ---

  // Derive selectedProvider for PromptActions
  const derivedSelectedProvider = useMemo((): AiProviderConfig | null => {
    const config = dbProviderConfigs.find(
      (p: DbProviderConfig) => p.id === selectedProviderId,
    );
    if (!config) return null;
    return {
      id: config.id,
      name: config.name,
      type: config.type,
      models: [], // Placeholder - derived elsewhere if needed for UI
      allAvailableModels: config.fetchedModels || [],
    };
  }, [selectedProviderId, dbProviderConfigs]);

  // Get getApiKeyForProvider for ChatSubmissionService
  const getApiKeyForProvider = useCallback(() => {
    const config = dbProviderConfigs.find(
      (p: DbProviderConfig) => p.id === selectedProviderId,
    );
    if (!config || !config.apiKeyId) return undefined;
    return apiKeys.find((k: DbApiKey) => k.id === config.apiKeyId)?.value;
  }, [selectedProviderId, dbProviderConfigs, apiKeys]);

  // Placeholder for VFS context object if needed directly
  // This might be better constructed within the submit service
  const vfsContextObject = useMemo(
    () => ({
      // Placeholder values - replace with actual VFS state if passed down
      isReady: false, // vfs.isReady,
      isLoading: false, // vfs.isLoading,
      isOperationLoading: false, // vfs.isOperationLoading,
      error: null, // vfs.error,
      configuredVfsKey: null, // vfs.configuredVfsKey,
      fs: null, // vfs.fs,
      listFiles: async () => [], // vfs.listFiles,
      readFile: async () => new Uint8Array(), // vfs.readFile,
      writeFile: async () => {}, // vfs.writeFile,
      deleteItem: async () => {}, // vfs.deleteItem,
      createDirectory: async () => {}, // vfs.createDirectory,
      downloadFile: async () => {}, // vfs.downloadFile,
      uploadFiles: async () => {}, // vfs.uploadFiles,
      uploadAndExtractZip: async () => {}, // vfs.uploadAndExtractZip,
      downloadAllAsZip: async () => {}, // vfs.downloadAllAsZip,
      rename: async () => {}, // vfs.rename,
      vfsKey: null, // vfs.vfsKey,
    }),
    [], // Add dependencies if vfs object is passed and used
  );

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
        await handleImageGenerationCore(currentConversationId, imagePrompt);
        clearPromptInput(); // Clear input after successful submission
        clearSelectedVfsPaths();
      } catch (err) {
        // Error handled by handleImageGenerationCore
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

    // Construct context for the wrapper function
    const submissionContext = {
      selectedItemId: currentConversationId,
      contentToSendToAI: finalContent,
      vfsContextPaths: vfsContextResult.pathsIncludedInContext,
      // Add other context fields if needed by the wrapper
    };

    try {
      // Call the wrapper function passed via props
      await handleSubmitCore(
        promptInputValue,
        attachedFiles,
        selectedVfsPaths,
        submissionContext,
      );
      clearPromptInput(); // Use prop action
      clearSelectedVfsPaths(); // Use prop action
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
        attachedFiles={attachedFiles}
        removeAttachedFile={removeAttachedFile}
      />
      {/* Pass props down */}
      <SelectedVfsFilesDisplay
        selectedVfsPaths={selectedVfsPaths}
        removeSelectedVfsPath={removeSelectedVfsPath}
        isVfsEnabledForItem={isVfsEnabledForItem}
        isVfsReady={isVfsReady}
      />

      <div className="flex items-end p-3 md:p-4">
        {/* Pass props down */}
        <PromptInput
          className="min-h-[60px]"
          prompt={promptInputValue}
          setPrompt={setPromptInputValue}
          isStreaming={isStreaming}
        />
        {/* Pass props down */}
        <PromptActions
          prompt={promptInputValue}
          isStreaming={isStreaming}
          addAttachedFile={addAttachedFile}
          setPrompt={setPromptInputValue}
          // Pass derived/state props needed by PromptActions
          selectedModel={selectedModel}
          customPromptActions={customPromptActions}
          getContextSnapshot={getContextSnapshot}
        />
      </div>

      <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
        {/* Pass props down */}
        <PromptSettings
          // Provider/Model related
          selectedProviderId={selectedProviderId}
          dbProviderConfigs={dbProviderConfigs}
          apiKeys={apiKeys}
          enableApiKeyManagement={enableApiKeyManagement}
          selectedModelId={selectedModelId}
          setSelectedProviderId={setSelectedProviderId}
          setSelectedModelId={setSelectedModelId}
          // VFS related
          enableVfs={true} // Pass global flag if available
          isVfsEnabledForItem={isVfsEnabledForItem}
          selectedItemId={selectedItemId}
          selectedItemType={selectedItemType}
          toggleVfsEnabledAction={toggleVfsEnabledAction}
          // Settings Modal related (REMOVED)
          // isSettingsModalOpen={isSettingsModalOpen}
          // setIsSettingsModalOpen={setIsSettingsModalOpen}
          // Advanced Settings related
          enableAdvancedSettings={enableAdvancedSettings}
          // Pass down AI params for PromptSettingsAdvanced
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
          // Pass down VFS state for PromptSettingsAdvanced
          isVfsReady={isVfsReady}
          isVfsLoading={isVfsLoading}
          vfsError={vfsError}
          vfsKey={vfsKey}
          // REMOVED: stopStreaming={stopStreaming}
        />
      </div>
    </form>
  );
};

// Export the memoized component
export const PromptForm = React.memo(PromptFormComponent);
