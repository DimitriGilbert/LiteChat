// src/components/lite-chat/prompt/prompt-wrapper.tsx
import React from "react";
import { PromptForm } from "./prompt-form";
import { AlertCircle, StopCircleIcon } from "lucide-react"; // Added StopCircleIcon
import { Button } from "@/components/ui/button"; // Added Button
import { cn } from "@/lib/utils";
import type {
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
  isVfsReady: boolean; // Add direct prop
  isVfsEnabledForItem: boolean; // Add direct prop
  // Direct Input State/Actions
  promptInputValue: string;
  setPromptInputValue: (value: string) => void;
  addAttachedFile: (file: File) => void;
  removeAttachedFile: (fileName: string) => void;
  clearPromptInput: () => void;
  // Bundled Props (less frequently changing / stable) - Passed down to PromptForm
  attachedFiles: File[];
  selectedVfsPaths: string[];
  handleSubmitCore: (
    prompt: string,
    files: File[],
    vfsPaths: string[],
    context: any,
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
  stopStreaming: () => void; // Add stopStreaming prop
  isVfsLoading: boolean;
  vfsError: string | null;
  vfsKey: string | null;
}

const PromptWrapperComponent: React.FC<PromptWrapperProps> = ({
  className,
  error, // Direct prop
  isStreaming, // Direct prop needed here for the button
  stopStreaming, // Direct prop needed here
  // Pass all other props down to PromptForm
  ...promptFormProps // Includes isStreaming, promptInputValue, isVfsReady etc.
}) => {
  return (
    <div className={cn("flex-shrink-0 relative", className)}>
      {/* Error Display */}
      {error && (
        <div className="flex items-center gap-2 p-3 text-sm text-red-400 bg-red-900/20 border-t border-red-800/30">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span className="font-medium">{error}</span>
        </div>
      )}

      {/* Abort Button - Rendered above the form */}
      {isStreaming && (
        <div className="absolute top-[-40px] left-1/2 transform -translate-x-1/2 z-10">
          <Button
            variant="destructive"
            size="sm"
            onClick={stopStreaming}
            className="h-8 px-3 shadow-lg"
            aria-label="Stop generating response"
          >
            <StopCircleIcon className="h-4 w-4 mr-1.5" />
            Stop
          </Button>
        </div>
      )}

      {/* Prompt Form */}
      <PromptForm
        {...promptFormProps}
        isStreaming={isStreaming} // Pass isStreaming down
        stopStreaming={stopStreaming} // Pass stopStreaming down
        getContextSnapshot={promptFormProps.getContextSnapshotForMod}
      />
    </div>
  );
};

export const PromptWrapper = React.memo(PromptWrapperComponent);
