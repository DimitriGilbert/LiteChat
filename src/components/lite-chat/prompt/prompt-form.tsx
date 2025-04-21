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
import { ChatSubmissionService } from "@/services/chat-submission-service";
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
  handleSubmitCore: (
    currentConversationId: string,
    contentToSendToAI: MessageContent,
    vfsContextPaths?: string[],
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
  isSettingsModalOpen: boolean;
  setIsSettingsModalOpen: (isOpen: boolean) => void;
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
  handleSubmitCore,
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
  isSettingsModalOpen,
  setIsSettingsModalOpen,
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
  // REMOVED all store access hooks

  // --- Derivations using props ---

  // Derive selectedProvider for ChatSubmissionService & PromptActions
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

  // Use ChatSubmissionService for handling submit logic
  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Construct context object using props
    const submissionContext = {
      selectedProviderId,
      selectedProvider: derivedSelectedProvider, // Use derived provider
      selectedModel, // Use prop
      getApiKeyForProvider,
      dbProviderConfigs,
      enableApiKeyManagement,
      isStreaming,
      setError,
      selectedItemType,
      selectedItemId,
      activeConversationData, // Use prop
      createConversation,
      selectItem,
      deleteItem,
      vfs: vfsContextObject, // Pass placeholder or real VFS context
      enableVfs: true, // Pass global enableVfs flag if available
      isVfsEnabledForItem,
      runMiddleware: runMiddlewarePlaceholder, // Pass placeholder or real middleware runner
      handleSubmitCore,
      handleImageGenerationCore,
    };

    try {
      await ChatSubmissionService.submitChat(
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
      // setError might be called within the service, but can be called here too
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
          // Settings Modal related
          isSettingsModalOpen={isSettingsModalOpen}
          setIsSettingsModalOpen={setIsSettingsModalOpen}
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
          // Pass down stopStreaming
          stopStreaming={stopStreaming}
        />
      </div>
    </form>
  );
};

// Export the memoized component
export const PromptForm = React.memo(PromptFormComponent);
