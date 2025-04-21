// src/components/lite-chat/prompt/prompt-wrapper.tsx
import React from "react";
import { PromptForm } from "./prompt-form";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  MessageContent,
  DbProviderConfig,
  DbApiKey,
  DbConversation,
  SidebarItemType,
  CustomPromptAction,
  ReadonlyChatContextSnapshot,
  AiModelConfig,
} from "@/lib/types";

// Update props to receive volatile state directly
interface PromptWrapperProps {
  className?: string;
  // Direct volatile state
  error: string | null;
  isStreaming: boolean;
  // Direct Input State/Actions
  promptInputValue: string;
  setPromptInputValue: (value: string) => void;
  addAttachedFile: (file: File) => void;
  removeAttachedFile: (fileName: string) => void;
  clearPromptInput: () => void;
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
  clearSelectedVfsPaths: () => void;
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
  selectedItemId: string | null;
  selectedItemType: SidebarItemType | null;
  setError: (error: string | null) => void;
  removeSelectedVfsPath: (path: string) => void;
  isVfsReady: boolean;
  toggleVfsEnabledAction: (id: string, type: SidebarItemType) => Promise<void>;
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
  getContextSnapshotForMod: () => ReadonlyChatContextSnapshot;
  selectedModel: AiModelConfig | undefined;
  stopStreaming: () => void;
  isVfsLoading: boolean;
  vfsError: string | null;
  vfsKey: string | null;
}

// Wrap component logic in a named function for React.memo
const PromptWrapperComponent: React.FC<PromptWrapperProps> = ({
  className,
  error, // Direct prop
  // Pass all other props down to PromptForm
  ...promptFormProps // Includes isStreaming, promptInputValue etc.
}) => {
  return (
    <div className={cn("flex-shrink-0", className)}>
      {error && (
        <div className="flex items-center gap-2 p-3 text-sm text-red-400 bg-red-900/20 border-t border-red-800/30">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span className="font-medium">{error}</span>
        </div>
      )}
      {/* Pass all necessary props down to PromptForm */}
      {/* PromptForm now receives isStreaming, error, promptInputValue directly */}
      <PromptForm
        {...promptFormProps}
        getContextSnapshot={promptFormProps.getContextSnapshotForMod}
      />
    </div>
  );
};

// Export the memoized component
// React.memo should be effective as most props are stable or less volatile now
export const PromptWrapper = React.memo(PromptWrapperComponent);
