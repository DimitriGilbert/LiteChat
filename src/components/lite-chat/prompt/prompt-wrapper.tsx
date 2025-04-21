// src/components/lite-chat/prompt/prompt-wrapper.tsx
import React from "react";
import { PromptForm } from "./prompt-form";
// REMOVED store imports
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
// Import prop types needed by PromptForm
import type {
  MessageContent,
  DbProviderConfig,
  DbApiKey,
  DbConversation,
  SidebarItemType,
  CustomPromptAction, // Added
  ReadonlyChatContextSnapshot, // Import from lib/types
  AiModelConfig, // Added
} from "@/lib/types";

// Define props based on what ChatWrapper passes down
interface PromptWrapperProps {
  className?: string;
  error: string | null;
  // State/Actions for PromptForm
  promptInputValue: string;
  attachedFiles: File[];
  selectedVfsPaths: string[];
  isVfsEnabledForItem: boolean;
  isStreaming: boolean;
  setPromptInputValue: (value: string) => void;
  addAttachedFile: (file: File) => void;
  removeAttachedFile: (fileName: string) => void;
  clearPromptInput: () => void;
  handleSubmitCore: (
    currentConversationId: string,
    contentToSendToAI: MessageContent,
    vfsContextPaths?: string[],
  ) => Promise<void>;
  handleImageGenerationCore: (
    currentConversationId: string,
    prompt: string,
  ) => Promise<void>;
  clearSelectedVfsPaths: () => void;
  // State/Actions for PromptSettings
  selectedProviderId: string | null;
  selectedModelId: string | null;
  dbProviderConfigs: DbProviderConfig[];
  apiKeys: DbApiKey[];
  enableApiKeyManagement: boolean;
  dbConversations: DbConversation[];
  createConversation: (
    parentId: string | null,
    title?: string,
  ) => Promise<string>;
  selectItem: (
    id: string | null,
    type: SidebarItemType | null,
  ) => Promise<void>;
  deleteItem: (id: string, type: SidebarItemType) => Promise<void>;
  updateDbProviderConfig: (
    id: string,
    changes: Partial<DbProviderConfig>,
  ) => Promise<void>;
  // Need selectedItemId/Type for PromptForm's submit logic
  selectedItemId: string | null;
  selectedItemType: SidebarItemType | null;
  // Props needed by children
  setError: (error: string | null) => void;
  removeSelectedVfsPath: (path: string) => void;
  isVfsReady: boolean;
  toggleVfsEnabledAction: (id: string, type: SidebarItemType) => Promise<void>;
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
  setSelectedProviderId: (id: string | null) => void;
  setSelectedModelId: (id: string | null) => void;
  customPromptActions: CustomPromptAction[];
  getContextSnapshotForMod: () => ReadonlyChatContextSnapshot; // Changed name
  selectedModel: AiModelConfig | undefined;
  stopStreaming: () => void;
  isVfsLoading: boolean;
  vfsError: string | null;
  vfsKey: string | null;
}

// Wrap component logic in a named function for React.memo
const PromptWrapperComponent: React.FC<PromptWrapperProps> = ({
  className,
  error, // Use prop
  // Pass all other props down to PromptForm
  ...promptFormProps
}) => {
  // REMOVED store access

  return (
    <div className={cn("flex-shrink-0", className)}>
      {error && (
        <div className="flex items-center gap-2 p-3 text-sm text-red-400 bg-red-900/20 border-t border-red-800/30">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span className="font-medium">{error}</span>
        </div>
      )}
      {/* Pass all necessary props down to PromptForm */}
      <PromptForm {...promptFormProps} />
    </div>
  );
};

// Export the memoized component
export const PromptWrapper = React.memo(PromptWrapperComponent);
